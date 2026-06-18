// AI call #1 — the "taste" layer, strictly facts/taste split.
//
// Claude reads the couple's underlying mood and returns SEARCH STRATEGY ONLY:
// 1–3 ranked blend directions (TMDB genre ids + keyword terms + tone). It never
// names or invents movies. Every real movie comes from deterministic TMDB
// Discover queries built from that strategy. Anything malformed → no-AI genre
// fallback; a too-thin pool progressively relaxes, then rebuilds from genres.
import "server-only";
import { CLAUDE_MODEL, getAnthropic } from "./anthropic";
import { categoryGenreId } from "./categories";
import { ANIMATION_GENRE_ID, isKidsFare } from "./genres";
import {
  discoverMovies,
  searchKeyword,
  tmdbImageUrl,
  type TmdbDiscoverMovie,
} from "./tmdb";
import type { BlendResult, BlendStrategy, Direction, PoolMovie } from "./blendTypes";

const MAX_DIRECTIONS = 3;
const TARGET_POOL = 45;
const VIABLE_POOL = 15; // below this, relax constraints / rebuild from genres
const MIN_VOTES = 100;

// TMDB movie genre ids the AI may use (Family 10751 deliberately omitted).
const VALID_GENRE_IDS = new Set([
  28, 12, 16, 35, 80, 99, 18, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37,
]);

// ---- AI strategy -----------------------------------------------------------

const STRATEGY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    moodRead: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        axes: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "axes"],
    },
    directions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          theme: { type: "string" },
          genreIds: { type: "array", items: { type: "integer" } },
          keywords: { type: "array", items: { type: "string" } },
          tone: { type: "array", items: { type: "string" } },
          sourcePicks: { type: "array", items: { type: "string" } },
        },
        required: ["theme", "genreIds", "keywords", "tone", "sourcePicks"],
      },
    },
  },
  required: ["moodRead", "directions"],
} as const;

const SYSTEM_PROMPT = `You are the taste strategist for Movie Match, a couples movie picker. In Round 1 two players each picked 2–3 "vibes" (genres and/or moods). Each player's picks are a MENU of acceptable moods (OR within a player), not a single combined demand.

Your job is taste only — you NEVER name movies, franchises, or IDs. You return search strategy that a separate system turns into real movies.

Steps:
1. Read the couple's UNDERLYING MOOD from the combined picks — the tone the genres share (e.g. dark/tense, light/warm, cozy, adrenaline, thoughtful, playful). If there is no clear shared mood, set summary to "mixed".
2. Choose 1–${MAX_DIRECTIONS} COHERENT, RANKED blend directions across all picks. Priority: (a) shared picks both chose — strongest; (b) cross-player combos that form a real sub-genre/mood (Horror+Comedy → horror-comedy); (c) never force incoherent combos. If nothing blends well, return each side's strongest single pick as separate directions. Do NOT merge every pick into one direction.
3. Mood is a LENS for ranking and tone, never a veto — do not bury an explicit pick just because it is off-mood.

For each direction return:
- theme: one human-readable line.
- genreIds: TMDB movie genre ids from this list — 28 Action, 12 Adventure, 16 Animation, 35 Comedy, 80 Crime, 99 Documentary, 18 Drama, 14 Fantasy, 36 History, 27 Horror, 10402 Music, 9648 Mystery, 10749 Romance, 878 Science Fiction, 53 Thriller, 10752 War, 37 Western. Keep it tight (usually 1–2) so the sub-genre stays coherent.
- keywords: 2–5 SINGLE-CONCEPT terms TMDB tags movies with — concrete nouns or short phrases like "zombie", "heist", "time travel", "dystopia", "road trip". Lowercase. NOT descriptive sentences (e.g. "love across time" will not match anything).
- tone: a few tone words consistent with the mood read.
- sourcePicks: which picks this came from, e.g. ["P1: Horror", "P2: Comedy"].

Respond only with the structured JSON.`;

const isNonEmptyString = (x: unknown): x is string =>
  typeof x === "string" && x.trim().length > 0;

const isBoundedStringArray = (x: unknown, max: number): x is string[] =>
  Array.isArray(x) && x.length <= max && x.every(isNonEmptyString);

/**
 * Strict runtime validation of the model output against the declared schema:
 * types, non-empty strings, size limits, and a TMDB genre-id allowlist. Anything
 * off-spec returns null so the caller falls back to the no-AI genre strategy.
 */
export function validateStrategy(value: unknown): BlendStrategy | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  const moodRead = v.moodRead as Record<string, unknown> | undefined;
  if (!moodRead || typeof moodRead !== "object") return null;
  if (!isNonEmptyString(moodRead.summary)) return null;
  if (!isBoundedStringArray(moodRead.axes, 6)) return null;

  const directions = v.directions;
  if (
    !Array.isArray(directions) ||
    directions.length < 1 ||
    directions.length > MAX_DIRECTIONS
  ) {
    return null;
  }

  const cleaned: Direction[] = [];
  for (const d of directions) {
    if (!d || typeof d !== "object") return null;
    const dir = d as Record<string, unknown>;
    if (!isNonEmptyString(dir.theme)) return null;
    if (
      !Array.isArray(dir.genreIds) ||
      dir.genreIds.length < 1 ||
      dir.genreIds.length > 4 ||
      !dir.genreIds.every((g) => Number.isInteger(g) && VALID_GENRE_IDS.has(g as number))
    ) {
      return null;
    }
    if (!isBoundedStringArray(dir.keywords, 8)) return null;
    if (!isBoundedStringArray(dir.tone, 8)) return null;
    if (!isBoundedStringArray(dir.sourcePicks, 8)) return null;
    cleaned.push({
      theme: dir.theme,
      genreIds: dir.genreIds as number[],
      keywords: dir.keywords as string[],
      tone: dir.tone as string[],
      sourcePicks: dir.sourcePicks as string[],
    });
  }

  return {
    moodRead: { summary: moodRead.summary, axes: moodRead.axes as string[] },
    directions: cleaned,
  };
}

async function getStrategy(p1: string[], p2: string[]): Promise<BlendStrategy | null> {
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" }, // lean + fast (BRD flags AI latency)
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Player 1's picks: ${p1.join(", ")}\nPlayer 2's picks: ${p2.join(", ")}`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: STRATEGY_SCHEMA } },
    });

    if (response.stop_reason === "refusal") return null;
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return null;
    }
    return validateStrategy(parsed);
  } catch {
    return null; // never crash the round on an AI hiccup
  }
}

/** Deterministic fallback: each player's selected genres as separate directions. */
export function fallbackStrategy(p1: string[], p2: string[]): BlendStrategy {
  const picks = [
    ...p1.map((label) => ({ label, player: "P1" })),
    ...p2.map((label) => ({ label, player: "P2" })),
  ];

  const byGenre = new Map<number, { label: string; players: Set<string> }>();
  for (const { label, player } of picks) {
    const gid = categoryGenreId(label);
    if (gid == null) continue;
    const entry = byGenre.get(gid) ?? { label, players: new Set<string>() };
    entry.players.add(player);
    byGenre.set(gid, entry);
  }

  // Shared genres (both players) rank first.
  const directions: Direction[] = [...byGenre.entries()]
    .sort((a, b) => b[1].players.size - a[1].players.size)
    .slice(0, MAX_DIRECTIONS)
    .map(([gid, entry]) => ({
      theme: entry.label,
      genreIds: [gid],
      keywords: [],
      tone: [],
      sourcePicks: [...entry.players].map((p) => `${p}: ${entry.label}`),
    }));

  // All-mood edge case: no genres at all → top popular as a single direction.
  if (directions.length === 0) {
    directions.push({
      theme: "Popular picks",
      genreIds: [],
      keywords: [],
      tone: [],
      sourcePicks: [],
    });
  }

  return { moodRead: { summary: "mixed", axes: [] }, directions };
}

// ---- Deterministic pool ----------------------------------------------------

async function fetchForDirection(
  dir: Direction,
  perDirection: number
): Promise<TmdbDiscoverMovie[]> {
  const keywordIds = (await Promise.all(dir.keywords.map(searchKeyword))).filter(
    (id): id is number => id != null
  );

  const base: Record<string, string> = { "vote_count.gte": String(MIN_VOTES) };
  if (keywordIds.length) base.with_keywords = keywordIds.join("|"); // OR

  const collect = async (genreJoin: string) => {
    const params = { ...base };
    if (dir.genreIds.length) params.with_genres = dir.genreIds.join(genreJoin);
    const out: TmdbDiscoverMovie[] = [];
    for (let page = 1; page <= 3 && out.length < perDirection; page++) {
      const res = await discoverMovies({ ...params, page: String(page) });
      if (res.length === 0) break;
      out.push(...res);
    }
    return out;
  };

  // Genres AND keeps a sub-genre tight (horror-comedy = tagged both). But many
  // real blends aren't co-tagged on TMDB (e.g. "Her" isn't tagged Romance), so a
  // multi-genre AND can come back too thin. Keep the precise AND matches first,
  // then broaden to OR (keyword filter preserved) to fill toward the target.
  const results = await collect(",");
  if (dir.genreIds.length > 1 && results.length < perDirection) {
    const seen = new Set(results.map((m) => m.id));
    for (const m of await collect("|")) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        results.push(m);
      }
    }
  }
  return results;
}

async function buildPool(
  directions: Direction[],
  excludeKidsFare: boolean
): Promise<PoolMovie[]> {
  const perDirection = Math.ceil(TARGET_POOL / directions.length);
  const seen = new Set<number>();
  const pool: PoolMovie[] = [];

  for (let i = 0; i < directions.length; i++) {
    const dir = directions[i];
    const movies = await fetchForDirection(dir, perDirection);
    let added = 0;
    for (const m of movies) {
      if (added >= perDirection) break;
      if (seen.has(m.id) || !m.poster_path) continue; // need a poster for the swipe UI
      if (excludeKidsFare && isKidsFare(m.genre_ids)) continue; // drop kids' tentpoles
      seen.add(m.id);
      pool.push({
        id: m.id,
        title: m.title,
        year: m.release_date ? m.release_date.slice(0, 4) : null,
        overview: m.overview,
        posterUrl: tmdbImageUrl(m.poster_path, "w342"),
        genreIds: m.genre_ids ?? [],
        voteAverage: m.vote_average,
        voteCount: m.vote_count,
        directionIndex: i,
        directionTheme: dir.theme,
      });
      added++;
    }
  }
  return pool;
}

/**
 * Build a pool big enough to drive Round 2/3. If the strategy's directions come
 * back too thin, progressively relax — drop keyword constraints, then rebuild
 * from the deterministic genre fallback — so a retry never hits the same dead
 * end. Returns the directions that actually produced the pool (so the pool's
 * direction tags stay consistent).
 */
export async function buildViablePool(
  directions: Direction[],
  p1: string[],
  p2: string[],
  excludeKidsFare: boolean
): Promise<{ directions: Direction[]; pool: PoolMovie[] }> {
  let pool = await buildPool(directions, excludeKidsFare);
  if (pool.length >= VIABLE_POOL) return { directions, pool };

  // Relax: drop keyword constraints (genres only).
  const noKeywords = directions.map((d) => ({ ...d, keywords: [] }));
  pool = await buildPool(noKeywords, excludeKidsFare);
  if (pool.length >= VIABLE_POOL) return { directions: noKeywords, pool };

  // Last resort: rebuild from each player's genres (always yields popular films).
  const fallback = fallbackStrategy(p1, p2).directions;
  pool = await buildPool(fallback, excludeKidsFare);
  return { directions: fallback, pool };
}

// ---- Orchestration ---------------------------------------------------------

export async function blendTastes(p1: string[], p2: string[]): Promise<BlendResult> {
  const strategy = (await getStrategy(p1, p2)) ?? fallbackStrategy(p1, p2);

  // Exclude kids' fare (Animation AND Family — Mario/Zootopia) by default,
  // UNLESS a player explicitly picked an animation category (then they want it).
  const pickedGenreIds = new Set(
    [...p1, ...p2].map(categoryGenreId).filter((id): id is number => id != null)
  );
  const excludeKidsFare = !pickedGenreIds.has(ANIMATION_GENRE_ID);

  const { directions, pool } = await buildViablePool(
    strategy.directions,
    p1,
    p2,
    excludeKidsFare
  );
  return { moodRead: strategy.moodRead, directions, pool };
}
