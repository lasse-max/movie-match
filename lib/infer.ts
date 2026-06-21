// AI call #2 — mood inference → each player's ~5 Round 3 recs.
//
// Round 2 swipes are read as VIBE signals about the direction a player leans
// (not verdicts on titles). For each player we deterministically assemble a
// candidate set — (a) cross-player positives the OTHER player liked, (b) this
// player's own swipe-validated pool picks, (c) ≤2 fresh titles from TMDB's
// recommendation graph — then Claude infers the mood and ranks/selects IDs from
// that set. The AI never names titles; output is validated against the set and
// shortfalls are filled deterministically, so it never crashes.
import "server-only";
import { CLAUDE_MODEL, getAnthropic } from "./anthropic";
import { categoryGenreId } from "./categories";
import { genreNames, isKidsFare } from "./genres";
import { attachAvailability } from "./availability";
import { evaluateAvailability, NO_AVAILABILITY } from "./filter";
import { getRecommendations, tmdbImageUrl, type TmdbDiscoverMovie } from "./tmdb";
import type { MoodRead, PoolMovie } from "./blendTypes";
import type { InferResult, PlayerInference, PlayerRec, RecSource } from "./inferTypes";

type Player = 1 | 2;
export interface PlayerSwipes {
  yes: number[];
  no: number[];
}
export type Swipes = Record<Player, PlayerSwipes>;
export type Categories = Record<Player, string[]>;

const TARGET_RECS = 5;
const MAX_FRESH = 2;
const FRESH_SEEDS = 3;
const MAX_CANDIDATES = 12;
const BACKFILL_SCAN = 10; // mood-fit pool titles appended after recs (fit-ranked)
const AVAIL_BATCH = 5; // availability fetched in fit-order batches…
const MAX_AVAIL_FETCHES = 15; // …up to this ceiling — never the whole pool (latency)
const MIN_VOTES = 100;
const MIN_VOTE_AVERAGE = 6.2; // quality floor for fresh expansion AND backfill

interface Candidate {
  id: number;
  title: string;
  year: string | null;
  overview: string;
  posterUrl: string | null;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
  directionTheme: string;
  source: RecSource;
}

const poolToCandidate = (m: PoolMovie, source: RecSource): Candidate => ({
  id: m.id,
  title: m.title,
  year: m.year,
  overview: m.overview,
  posterUrl: m.posterUrl,
  genreIds: m.genreIds,
  voteAverage: m.voteAverage,
  voteCount: m.voteCount,
  directionTheme: m.directionTheme,
  source,
});

const discoverToCandidate = (m: TmdbDiscoverMovie, source: RecSource): Candidate => ({
  id: m.id,
  title: m.title,
  year: m.release_date ? m.release_date.slice(0, 4) : null,
  overview: m.overview,
  posterUrl: tmdbImageUrl(m.poster_path, "w342"),
  genreIds: m.genre_ids ?? [],
  voteAverage: m.vote_average,
  voteCount: m.vote_count,
  directionTheme: "Fresh pick",
  source,
});

/** Anchor genres = the TMDB genres behind a player's Round 1 category picks. */
function anchorGenres(categories: string[]): Set<number> {
  return new Set(
    categories.map(categoryGenreId).filter((g): g is number => g != null)
  );
}

/** Mood read derived from Round 1 — the graceful fallback when a player handed
 * no Round 2 swipe signal (all "Don't know"), so inference never guesses from
 * nothing. Empty categories (shouldn't happen in the real flow) → "mixed". */
function round1Mood(categories: string[]): MoodRead {
  if (categories.length === 0) return { summary: "mixed", axes: [] };
  return {
    summary: `In the mood for ${categories.map((c) => c.toLowerCase()).join(", ")}`,
    axes: categories,
  };
}

const candidateToRec = (c: Candidate): PlayerRec => ({
  id: c.id,
  title: c.title,
  year: c.year,
  overview: c.overview,
  posterUrl: c.posterUrl,
  genreIds: c.genreIds,
  source: c.source,
  availability: NO_AVAILABILITY, // replaced by the availability step
});

// ---- candidate assembly ----------------------------------------------------

/** ≤2 best-rated fresh titles from the recommendation graph (quality-floored). */
async function freshExpansion(
  seeds: PoolMovie[],
  excludeIds: Set<number>,
  allowKidsFare: boolean
): Promise<Candidate[]> {
  const eligible: Candidate[] = [];
  const seen = new Set(excludeIds);
  for (const seed of seeds.slice(0, FRESH_SEEDS)) {
    let recs: TmdbDiscoverMovie[] = [];
    try {
      recs = await getRecommendations(seed.id);
    } catch {
      continue;
    }
    for (const m of recs) {
      if (seen.has(m.id) || !m.poster_path) continue;
      if (m.vote_count < MIN_VOTES || m.vote_average < MIN_VOTE_AVERAGE) continue;
      if (!allowKidsFare && isKidsFare(m.genre_ids)) continue;
      seen.add(m.id);
      eligible.push(discoverToCandidate(m, "fresh"));
    }
  }
  // Prefer the best-rated fits rather than the first ones the graph returned.
  return eligible.sort((a, b) => b.voteAverage - a.voteAverage).slice(0, MAX_FRESH);
}

function assembleCandidates(
  player: Player,
  pool: PoolMovie[],
  swipes: Swipes,
  fresh: Candidate[],
  anchor: Set<number>
): Candidate[] {
  const other: Player = player === 1 ? 2 : 1;
  const byId = new Map(pool.map((m) => [m.id, m]));
  const lookup = (ids: number[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((m): m is PoolMovie => !!m)
      .sort((a, b) => b.voteCount - a.voteCount);

  const seen = new Set<number>();
  const candidates: Candidate[] = [];
  const add = (c: Candidate) => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      candidates.push(c);
    }
  };

  // A cross-player title is eligible only if it shares one of THIS player's
  // anchor genres — keeps the other player's likes that clash with this player's
  // mood out of the list (no pure-action title in a sci-fi list).
  const fitsMood = (genreIds: number[]) =>
    anchor.size === 0 || genreIds.some((g) => anchor.has(g));

  // (a) cross-player positives that fit this player's mood — the easiest match.
  for (const m of lookup(swipes[other].yes)) {
    if (fitsMood(m.genreIds)) add(poolToCandidate(m, "cross-player"));
  }
  // (b) this player's own positives.
  for (const m of lookup(swipes[player].yes)) add(poolToCandidate(m, "swipe"));
  // (c) fresh expansion.
  for (const c of fresh) add(c);
  // Pad with the strongest remaining MOOD-FIT pool titles so the AI always has
  // ≥5 to rank (off-mood titles stay out — same gate as cross-player).
  if (candidates.length < TARGET_RECS + 1) {
    for (const m of [...pool].sort((a, b) => b.voteCount - a.voteCount)) {
      if (candidates.length >= MAX_CANDIDATES) break;
      if (fitsMood(m.genreIds)) add(poolToCandidate(m, "swipe"));
    }
  }
  return candidates.slice(0, MAX_CANDIDATES);
}

/**
 * Turn ranked ids into the final ≤5 recs: keep only ids present in the candidate
 * set (drop invented ones), de-dupe, cap fresh expansion at 2, then fill any
 * shortfall from the candidate assembly order (cross-player first).
 */
export function finalizeRecs(candidates: Candidate[], recIds: number[]): PlayerRec[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const chosen: Candidate[] = [];
  const used = new Set<number>();
  let freshCount = 0;

  const tryAdd = (c: Candidate | undefined) => {
    if (!c || used.has(c.id) || chosen.length >= TARGET_RECS) return;
    if (c.source === "fresh" && freshCount >= MAX_FRESH) return;
    used.add(c.id);
    chosen.push(c);
    if (c.source === "fresh") freshCount++;
  };

  for (const id of recIds) tryAdd(byId.get(id)); // ranked, validated
  for (const c of candidates) tryAdd(c); // fill shortfall deterministically
  return chosen.map(candidateToRec);
}

// ---- AI call ---------------------------------------------------------------

const INFER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    players: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          player: { type: "integer" },
          moodRead: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              axes: { type: "array", items: { type: "string" } },
            },
            required: ["summary", "axes"],
          },
          recIds: { type: "array", items: { type: "integer" } },
        },
        required: ["player", "moodRead", "recIds"],
      },
    },
  },
  required: ["players"],
} as const;

const INFER_SYSTEM = `You read each player's latent movie mood from their Round 2 swipes and pick their Round 3 shortlist.

Round 2 showed each player a handful of titles; they swiped each toward ("this vibe") or away, or skipped ones they didn't recognize. Skipped titles are omitted from the lists below — treat them as no signal, never as a soft "away". Treat swipes as signals about the KIND of movie they're leaning toward tonight — tone, pace, darkness, era — NOT verdicts on the specific titles (someone may swipe away from a film they love but aren't in the mood for).

For EACH player:
1. Infer their underlying mood — a one-line summary and a couple of axis words — from what they leaned toward vs away.
2. From THAT player's candidate list, SELECT and RANK the best ~5 fits for the mood, best first. Return candidate IDs only — never invent titles or ids, and only use ids from that player's list.

The candidate list already includes some titles the OTHER player liked — these are the easiest path to a mutual match, so prefer them WHEN they fit this player's mood. But fit comes first: never pick a title that clashes with the mood just because the other player liked it (e.g. a pure action film for someone after sci-fi). A clashing title should be left out of the 5 entirely.

Respond only with the structured JSON.`;

type AiParsed = Record<Player, { moodRead: MoodRead; recIds: number[] }>;

function parseInference(text: string): AiParsed | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const players = (parsed as { players?: unknown })?.players;
  if (!Array.isArray(players)) return null;

  const out: Partial<AiParsed> = {};
  for (const p of players) {
    if (!p || typeof p !== "object") return null;
    const entry = p as Record<string, unknown>;
    if (entry.player !== 1 && entry.player !== 2) return null;
    const mood = entry.moodRead as Record<string, unknown> | undefined;
    if (!mood || typeof mood.summary !== "string" || !mood.summary.trim()) return null;
    if (!Array.isArray(mood.axes) || !mood.axes.every((a) => typeof a === "string")) return null;
    if (!Array.isArray(entry.recIds) || !entry.recIds.every((id) => Number.isInteger(id))) {
      return null;
    }
    out[entry.player] = {
      moodRead: { summary: mood.summary, axes: mood.axes as string[] },
      recIds: entry.recIds as number[],
    };
  }
  return out[1] && out[2] ? (out as AiParsed) : null;
}

function buildUserMessage(
  pool: PoolMovie[],
  swipes: Swipes,
  cand1: Candidate[],
  cand2: Candidate[]
): string {
  const byId = new Map(pool.map((m) => [m.id, m]));
  const title = (id: number) => {
    const m = byId.get(id);
    return m ? `${m.title}${m.year ? ` (${m.year})` : ""}` : `#${id}`;
  };
  const swipeLine = (ids: number[]) => ids.map(title).join("; ") || "(none)";
  const candList = (cands: Candidate[]) =>
    cands
      .map(
        (c) =>
          `  - ${c.id}: ${c.title}${c.year ? ` (${c.year})` : ""} [${genreNames(c.genreIds).join(", ")}] — ${c.directionTheme}`
      )
      .join("\n");

  return [
    `Player 1 swiped TOWARD: ${swipeLine(swipes[1].yes)}`,
    `Player 1 swiped AWAY: ${swipeLine(swipes[1].no)}`,
    `Player 1 candidates (rank ~${TARGET_RECS}, best first):\n${candList(cand1)}`,
    ``,
    `Player 2 swiped TOWARD: ${swipeLine(swipes[2].yes)}`,
    `Player 2 swiped AWAY: ${swipeLine(swipes[2].no)}`,
    `Player 2 candidates (rank ~${TARGET_RECS}, best first):\n${candList(cand2)}`,
  ].join("\n");
}

async function callInferAI(
  pool: PoolMovie[],
  swipes: Swipes,
  cand1: Candidate[],
  cand2: Candidate[]
): Promise<AiParsed | null> {
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system: INFER_SYSTEM,
      messages: [{ role: "user", content: buildUserMessage(pool, swipes, cand1, cand2) }],
      output_config: { format: { type: "json_schema", schema: INFER_SCHEMA } },
    });
    if (response.stop_reason === "refusal") return null;
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    return parseInference(textBlock.text);
  } catch {
    return null;
  }
}

// ---- orchestration ---------------------------------------------------------

/** Extra mood-fit pool titles (beyond the ~5 recs) so the availability filter
 * has alternatives to fall back on rather than emptying a player's list. */
function backfillCandidates(
  pool: PoolMovie[],
  exclude: Set<number>,
  anchor: Set<number>
): Candidate[] {
  const fits = (g: number[]) => anchor.size === 0 || g.some((x) => anchor.has(x));
  // Stays mood-fit AND quality-floored: eligibility narrows the GOOD candidates,
  // it never licenses padding the list with mediocre titles.
  return [...pool]
    .sort((a, b) => b.voteCount - a.voteCount)
    .filter(
      (m) => !exclude.has(m.id) && fits(m.genreIds) && m.voteAverage >= MIN_VOTE_AVERAGE
    )
    .slice(0, BACKFILL_SCAN)
    .map((m) => poolToCandidate(m, "swipe"));
}

export async function inferMoods(
  pool: PoolMovie[],
  swipes: Swipes,
  categories: Categories,
  region: string,
  services: number[],
  willingToPay: boolean
): Promise<InferResult> {
  // If the pool already carries kids' fare, the couple opted into it (Animated
  // pick), so fresh expansion may too.
  const allowKidsFare = pool.some((m) => isKidsFare(m.genreIds));
  const byId = new Map(pool.map((m) => [m.id, m]));
  const positives = (player: Player) =>
    swipes[player].yes
      .map((id) => byId.get(id))
      .filter((m): m is PoolMovie => !!m)
      .sort((a, b) => b.voteCount - a.voteCount);

  const anchor1 = anchorGenres(categories[1]);
  const anchor2 = anchorGenres(categories[2]);
  const poolIds = new Set(pool.map((m) => m.id));
  const fresh1 = await freshExpansion(positives(1), poolIds, allowKidsFare);
  const fresh2 = await freshExpansion(positives(2), poolIds, allowKidsFare);

  const cand1 = assembleCandidates(1, pool, swipes, fresh1, anchor1);
  const cand2 = assembleCandidates(2, pool, swipes, fresh2, anchor2);

  const ai = await callInferAI(pool, swipes, cand1, cand2);

  const build = async (
    player: Player,
    cands: Candidate[],
    anchor: Set<number>
  ): Promise<PlayerInference> => {
    const recs = finalizeRecs(cands, ai ? ai[player].recIds : []);
    const recIds = new Set(recs.map((r) => r.id));
    const backfill = backfillCandidates(pool, recIds, anchor).map(candidateToRec);

    // Fit-ranked candidate list (recs by fit, then backfill by fit/voteCount).
    // Eligibility NEVER reorders this — willing-to-pay/access-type only FILTERS at
    // display time (lib/filter selectWatchable), per the canonical ranking rule.
    const ranked = [...recs, ...backfill];

    // Attach availability in fit order, in BATCHES, until enough eligible options
    // are found OR we hit the bounded ceiling — so a narrow-service couple is
    // never falsely told "nothing's watchable" by a too-shallow scan, yet we
    // never fetch availability for the whole pool.
    const finalists: PlayerRec[] = [];
    let eligible = 0;
    for (let i = 0; i < ranked.length && i < MAX_AVAIL_FETCHES; i += AVAIL_BATCH) {
      const batch = await attachAvailability(ranked.slice(i, i + AVAIL_BATCH), region);
      finalists.push(...batch);
      eligible += batch.filter(
        (r) => evaluateAvailability(r.availability, services, willingToPay).eligible
      ).length;
      if (eligible >= TARGET_RECS) break;
    }

    // Degrade gracefully: a player who handed no swipe signal (all "Don't know")
    // falls back to their Round 1 mood rather than an AI read of nothing.
    const hasSignal = swipes[player].yes.length + swipes[player].no.length > 0;
    const moodRead =
      ai && hasSignal ? ai[player].moodRead : round1Mood(categories[player]);

    return { moodRead, recs: finalists };
  };

  const [p1, p2] = await Promise.all([build(1, cand1, anchor1), build(2, cand2, anchor2)]);
  return { 1: p1, 2: p2 };
}
