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
import { genreNames, isKidsFare } from "./genres";
import { getRecommendations, tmdbImageUrl, type TmdbDiscoverMovie } from "./tmdb";
import type { MoodRead, PoolMovie } from "./blendTypes";
import type { InferResult, PlayerInference, PlayerRec, RecSource } from "./inferTypes";

type Player = 1 | 2;
export interface PlayerSwipes {
  yes: number[];
  no: number[];
}
export type Swipes = Record<Player, PlayerSwipes>;

const TARGET_RECS = 5;
const MAX_FRESH = 2;
const FRESH_SEEDS = 3;
const MAX_CANDIDATES = 12;
const MIN_VOTES = 100;

interface Candidate {
  id: number;
  title: string;
  year: string | null;
  overview: string;
  posterUrl: string | null;
  genreIds: number[];
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
  voteCount: m.vote_count,
  directionTheme: "Fresh pick",
  source,
});

const candidateToRec = (c: Candidate): PlayerRec => ({
  id: c.id,
  title: c.title,
  year: c.year,
  overview: c.overview,
  posterUrl: c.posterUrl,
  genreIds: c.genreIds,
  source: c.source,
});

// ---- candidate assembly ----------------------------------------------------

/** ≤2 fresh titles from the recommendation graph, seeded by strongest positives. */
async function freshExpansion(
  seeds: PoolMovie[],
  excludeIds: Set<number>,
  allowKidsFare: boolean
): Promise<Candidate[]> {
  const fresh: Candidate[] = [];
  const seen = new Set(excludeIds);
  for (const seed of seeds.slice(0, FRESH_SEEDS)) {
    if (fresh.length >= MAX_FRESH) break;
    let recs: TmdbDiscoverMovie[] = [];
    try {
      recs = await getRecommendations(seed.id);
    } catch {
      continue;
    }
    for (const m of recs) {
      if (fresh.length >= MAX_FRESH) break;
      if (seen.has(m.id) || !m.poster_path || m.vote_count < MIN_VOTES) continue;
      if (!allowKidsFare && isKidsFare(m.genre_ids)) continue;
      seen.add(m.id);
      fresh.push(discoverToCandidate(m, "fresh"));
    }
  }
  return fresh;
}

function assembleCandidates(
  player: Player,
  pool: PoolMovie[],
  swipes: Swipes,
  fresh: Candidate[]
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

  // (a) cross-player positives — the other player already validated these.
  for (const m of lookup(swipes[other].yes)) add(poolToCandidate(m, "cross-player"));
  // (b) this player's own positives.
  for (const m of lookup(swipes[player].yes)) add(poolToCandidate(m, "swipe"));
  // (c) fresh expansion.
  for (const c of fresh) add(c);
  // Pad with the strongest remaining pool titles so the AI always has ≥5 to rank.
  if (candidates.length < TARGET_RECS + 1) {
    for (const m of [...pool].sort((a, b) => b.voteCount - a.voteCount)) {
      if (candidates.length >= MAX_CANDIDATES) break;
      add(poolToCandidate(m, "swipe"));
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

Round 2 showed each player a handful of titles; they swiped each toward ("this vibe") or away. Treat swipes as signals about the KIND of movie they're leaning toward tonight — tone, pace, darkness, era — NOT verdicts on the specific titles (someone may swipe away from a film they love but aren't in the mood for).

For EACH player:
1. Infer their underlying mood — a one-line summary and a couple of axis words — from what they leaned toward vs away.
2. From THAT player's candidate list, SELECT and RANK the best ~5 fits for the mood, best first. Return candidate IDs only — never invent titles or ids, and only use ids from that player's list.

A candidate the OTHER player already liked is valuable (easiest match) — include it when it genuinely fits this player's mood; never force a clashing title.

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

export async function inferMoods(pool: PoolMovie[], swipes: Swipes): Promise<InferResult> {
  // If the pool already carries kids' fare, the couple opted into it (Animated
  // pick), so fresh expansion may too.
  const allowKidsFare = pool.some((m) => isKidsFare(m.genreIds));
  const byId = new Map(pool.map((m) => [m.id, m]));
  const positives = (player: Player) =>
    swipes[player].yes
      .map((id) => byId.get(id))
      .filter((m): m is PoolMovie => !!m)
      .sort((a, b) => b.voteCount - a.voteCount);

  const poolIds = new Set(pool.map((m) => m.id));
  const fresh1 = await freshExpansion(positives(1), poolIds, allowKidsFare);
  const fresh2 = await freshExpansion(positives(2), poolIds, allowKidsFare);

  const cand1 = assembleCandidates(1, pool, swipes, fresh1);
  const cand2 = assembleCandidates(2, pool, swipes, fresh2);

  const ai = await callInferAI(pool, swipes, cand1, cand2);

  const inference = (player: Player, cands: Candidate[]): PlayerInference => ({
    moodRead: ai ? ai[player].moodRead : { summary: "mixed", axes: [] },
    recs: finalizeRecs(cands, ai ? ai[player].recIds : []),
  });

  return { 1: inference(1, cand1), 2: inference(2, cand2) };
}
