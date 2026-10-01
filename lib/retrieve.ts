// Embeddings v1 · E3 — catalogue retrieval for the Round 3 fresh picks.
//
// After Round 2, each player's taste fingerprint is the average of the stored
// vectors of the films they swiped "This vibe" on. Films missing from the
// catalogue are skipped, and there is no OpenAI call during a game. If the two
// players' closest pair of likes is similar enough, the midpoint of that pair is a
// SHARED seed: the films nearest it go to BOTH lists, so a real match gets more
// likely. The rest of the fresh slots come from each player's own fingerprint.
//
// Geometry only SOURCES candidates. Claude still ranks them and the overlap and
// bridge logic still picks the winner (no maximin or midpoint winner selector).
// Every fresh film passes the same checks as today before it takes a slot, and any
// database error, empty result or timeout falls back to today's path with one
// structured warning. This module never throws.
import "server-only";
import { attachAvailability } from "./availability";
import { evaluateAvailability } from "./filter";
import { isKidsFare } from "./genres";
import type { PoolMovie } from "./blendTypes";

type Player = 1 | 2;
type PerPlayer<T> = { 1: T; 2: T };

// ---- settings (Otto's defaults, approved by Lasse; tuned in E4) ------------
/** Fresh candidates per player when the catalogue serves them (was 2). */
export const FRESH_SLOTS = 6;
/** Of those, up to this many come from the shared seed; own films fill any gap. */
export const SHARED_SLOTS = 3;
/** The closest cross-player pair of likes must be at least this similar to share. */
export const SHARED_SEED_MIN_SIM = 0.45;
/** Films retrieved per catalogue query. */
export const RETRIEVE_K = 40;
/** TMDB availability calls per player for fresh films (shared checks count too). */
export const MAX_AVAIL_CHECKS = 12;
/** Per database call; past this the game falls back to today's path. */
export const RETRIEVE_TIMEOUT_MS = 1500;
/** Of each player's availability budget, how much the shared list may spend
 * (shared films are checked once and serve both players). */
const SHARED_CHECKS = 6;
const EMBEDDING_DIM = 1536; // text-embedding-3-small, matches the movies table
// Quality floor — must match lib/infer.ts (the catalogue was built above it, but
// vote counts and averages drift, so the stored values are re-checked here).
const MIN_VOTES = 100;
const MIN_VOTE_AVERAGE = 6.2;

/** The kill switch. `override` is the eval route's per-request A/B only; the live
 * game always reads the server env, and the flag is never user-facing. */
export function embeddingsEnabled(override?: boolean): boolean {
  if (typeof override === "boolean") return override;
  return process.env.EMBEDDINGS_ENABLED === "true";
}

// ---- vector math (pure) ----------------------------------------------------

/** Component-wise average; null for no vectors. */
export function meanVector(vecs: number[][]): number[] | null {
  if (vecs.length === 0) return null;
  const out = new Array<number>(vecs[0].length).fill(0);
  for (const v of vecs) for (let i = 0; i < out.length; i++) out[i] += v[i];
  for (let i = 0; i < out.length; i++) out[i] /= vecs.length;
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const norm = Math.sqrt(na) * Math.sqrt(nb);
  return norm === 0 ? 0 : dot / norm;
}

/** The most similar pair of likes across the two players (one from each). */
export function closestPair(
  a: number[][],
  b: number[][]
): { i: number; j: number; similarity: number } | null {
  let best: { i: number; j: number; similarity: number } | null = null;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const similarity = cosine(a[i], b[j]);
      if (!best || similarity > best.similarity) best = { i, j, similarity };
    }
  }
  return best;
}

/** The shared seed: the midpoint of the closest cross-player pair of likes, if
 * that pair is at least SHARED_SEED_MIN_SIM similar. Below it the two tastes are
 * too far apart to share, and own fingerprints fill every fresh slot. */
export function sharedSeed(
  a: number[][],
  b: number[][]
): { seed: number[] | null; similarity: number | null } {
  const pair = closestPair(a, b);
  if (!pair) return { seed: null, similarity: null };
  return {
    seed: pair.similarity >= SHARED_SEED_MIN_SIM ? meanVector([a[pair.i], b[pair.j]]) : null,
    similarity: pair.similarity,
  };
}

// ---- catalogue rows and the checks (pure) ----------------------------------

/** A catalogue row as match_movies returns it (the fields this module uses). */
export interface CatalogueFilm {
  tmdb_id: number;
  title: string;
  year: number | null;
  overview: string | null;
  genre_ids: number[] | null;
  collection_id: number | null;
  vote_count: number;
  vote_average: number;
  poster_path: string | null;
  similarity: number;
}

const isNullableNumber = (x: unknown) => x === null || x === undefined || typeof x === "number";
function isCatalogueFilm(r: unknown): r is CatalogueFilm {
  const f = r as Record<string, unknown> | null;
  return (
    !!f &&
    Number.isInteger(f.tmdb_id) &&
    typeof f.title === "string" &&
    typeof f.vote_count === "number" &&
    typeof f.vote_average === "number" &&
    typeof f.similarity === "number" &&
    isNullableNumber(f.year) &&
    isNullableNumber(f.collection_id) &&
    (f.genre_ids == null || Array.isArray(f.genre_ids)) &&
    (f.poster_path == null || typeof f.poster_path === "string")
  );
}

export interface ScreenContext {
  /** The pool and every film swiped this game (so E-9 holds for fresh films). */
  excludeIds: Set<number>;
  allowKidsFare: boolean;
  /** Franchises already in the candidates (the liked films). */
  blockedCollections: Set<number>;
}

/** The checks that need no network: not in the pool or swiped this game, quality
 * floor with a poster, kids-fare rule, and franchise dedup against the liked
 * films. Availability is checked separately, within a budget. */
export function passesScreen(f: CatalogueFilm, ctx: ScreenContext): boolean {
  return (
    !ctx.excludeIds.has(f.tmdb_id) &&
    !!f.poster_path &&
    f.vote_count >= MIN_VOTES &&
    f.vote_average >= MIN_VOTE_AVERAGE &&
    (ctx.allowKidsFare || !isKidsFare(f.genre_ids ?? [])) &&
    (f.collection_id == null || !ctx.blockedCollections.has(f.collection_id))
  );
}

/** Availability for this couple, memoised per game: a film checked once (say for
 * the shared list) costs nothing the second time. */
export interface EligibilityCheck {
  isChecked(id: number): boolean;
  isEligible(id: number): Promise<boolean>;
}

export function availabilityCheck(
  region: string,
  services: number[],
  willingToPay: boolean
): EligibilityCheck & { calls(): number } {
  const memo = new Map<number, Promise<boolean>>();
  return {
    isChecked: (id) => memo.has(id),
    isEligible: (id) => {
      let result = memo.get(id);
      if (!result) {
        result = attachAvailability([{ id }], region).then(
          ([m]) => evaluateAvailability(m.availability, services, willingToPay).eligible
        );
        memo.set(id, result);
      }
      return result;
    },
    calls: () => memo.size,
  };
}

/** Films already taken for a list: ids and franchises. Mutated as films are picked. */
export interface Taken {
  ids: Set<number>;
  collections: Set<number>;
}

/**
 * Walk a similarity-ordered list and keep up to `need` films that are watchable for
 * this couple, one per franchise. Eligibility is checked in at most two parallel
 * rounds (a small first round, then the rest of the budget) and never costs more
 * than `budget` NEW checks; a film already checked this game is free.
 */
export async function pickEligible(
  list: CatalogueFilm[],
  need: number,
  budget: number,
  check: EligibilityCheck,
  taken: Taken
): Promise<{ picked: CatalogueFilm[]; eligible: number; checksUsed: number }> {
  const picked: CatalogueFilm[] = [];
  let eligible = 0;
  let checksUsed = 0;
  if (need <= 0) return { picked, eligible, checksUsed };

  const order = list.filter((f) => !taken.ids.has(f.tmdb_id));
  let next = 0;
  for (const roundSize of [need + 2, Number.POSITIVE_INFINITY]) {
    if (picked.length >= need || next >= order.length) break;
    const batch: CatalogueFilm[] = [];
    while (next < order.length && batch.length < roundSize) {
      const f = order[next++];
      if (f.collection_id != null && taken.collections.has(f.collection_id)) continue;
      if (!check.isChecked(f.tmdb_id)) {
        if (checksUsed >= budget) continue; // no budget left for a film we'd have to check
        checksUsed++;
      }
      batch.push(f);
    }
    const ok = await Promise.all(batch.map((f) => check.isEligible(f.tmdb_id)));
    batch.forEach((f, i) => {
      if (!ok[i]) return;
      eligible++;
      if (picked.length >= need) return;
      if (taken.ids.has(f.tmdb_id)) return;
      if (f.collection_id != null && taken.collections.has(f.collection_id)) return;
      picked.push(f);
      taken.ids.add(f.tmdb_id);
      if (f.collection_id != null) taken.collections.add(f.collection_id);
    });
  }
  return { picked, eligible, checksUsed };
}

// ---- Supabase (plain fetch to the REST / RPC endpoints, server-only) -------

type Reason = "config" | "timeout" | "error" | "empty";

class RetrievalError extends Error {
  readonly reason: Reason;
  constructor(reason: Reason, message: string) {
    super(message);
    this.reason = reason;
  }
}

interface Db {
  rest: string;
  headers: Record<string, string>;
}

function supabase(): Db | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    rest: `${url.replace(/\/$/, "")}/rest/v1`,
    headers: {
      apikey: key,
      "content-type": "application/json",
      // A legacy JWT key also goes in Authorization; a new sb_secret_ key is not a
      // JWT and must not (Supabase rejects it there).
      ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
    },
  };
}

async function dbJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RETRIEVE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new RetrievalError("error", `supabase ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e instanceof RetrievalError) throw e;
    if (controller.signal.aborted) throw new RetrievalError("timeout", "supabase timeout");
    throw new RetrievalError("error", e instanceof Error ? e.message : "supabase error");
  } finally {
    clearTimeout(timer);
  }
}

function parseVector(raw: unknown): number[] | null {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw); // pgvector's text form, e.g. "[0.01,-0.2,...]"
    } catch {
      return null;
    }
  }
  return Array.isArray(v) &&
    v.length === EMBEDDING_DIM &&
    v.every((x) => typeof x === "number" && Number.isFinite(x))
    ? (v as number[])
    : null;
}

/** Stored vectors for the given films; films missing from the catalogue are absent. */
async function loadVectors(db: Db, ids: number[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  const safe = ids.filter((id) => Number.isInteger(id));
  if (safe.length === 0) return out;
  const rows = await dbJson(
    `${db.rest}/movies?select=tmdb_id,embedding&tmdb_id=in.(${safe.join(",")})`,
    { headers: db.headers }
  );
  if (!Array.isArray(rows)) throw new RetrievalError("error", "bad vector payload");
  for (const r of rows as { tmdb_id?: unknown; embedding?: unknown }[]) {
    const v = parseVector(r?.embedding);
    if (Number.isInteger(r?.tmdb_id) && v) out.set(r.tmdb_id as number, v);
  }
  return out;
}

/** The k catalogue films nearest `query` (cosine), skipping `excludeIds`. */
async function matchMovies(
  db: Db,
  query: number[],
  k: number,
  excludeIds: number[]
): Promise<CatalogueFilm[]> {
  const rows = await dbJson(`${db.rest}/rpc/match_movies`, {
    method: "POST",
    headers: db.headers,
    body: JSON.stringify({ query: `[${query.join(",")}]`, k, exclude_ids: excludeIds }),
  });
  if (!Array.isArray(rows)) throw new RetrievalError("error", "bad match payload");
  return rows.filter(isCatalogueFilm);
}

// ---- orchestration ---------------------------------------------------------

/** A fresh film for a player's candidate list. */
export interface FreshFilm {
  id: number;
  title: string;
  year: string | null;
  overview: string;
  posterPath: string | null;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
  collectionId: number | null;
  /** From the shared seed (in both players' lists) rather than this player's own. */
  shared: boolean;
}

const toFresh = (f: CatalogueFilm, shared: boolean): FreshFilm => ({
  id: f.tmdb_id,
  title: f.title,
  year: f.year != null ? String(f.year) : null,
  overview: f.overview ?? "",
  posterPath: f.poster_path,
  genreIds: f.genre_ids ?? [],
  voteAverage: f.vote_average,
  voteCount: f.vote_count,
  collectionId: f.collection_id,
  shared,
});

/** Per-game numbers for the server log. Counts and similarities only. */
export interface RetrievalStats {
  /** "embeddings" if the catalogue served at least one player. */
  outcome: "embeddings" | "fallback";
  /** Why it fell back, when it did unexpectedly (a missing fingerprint is expected). */
  reason: Reason | null;
  fingerprints: PerPlayer<boolean>;
  sharedSimilarity: number | null;
  sharedSeed: boolean;
  /** Catalogue rows returned for the player (shared + own queries). */
  retrieved: PerPlayer<number>;
  /** Checked films that passed every check, availability included. */
  eligible: PerPlayer<number>;
  /** Fresh films that took a candidate slot. */
  selected: PerPlayer<number>;
  availabilityChecks: number;
  ms: number;
}

export interface RetrieveInput {
  pool: PoolMovie[];
  likes: PerPlayer<number[]>;
  /** Every film swiped this game, by either player, either way. */
  swiped: Set<number>;
  allowKidsFare: boolean;
  /** Franchises of the films either player liked. */
  likedCollections: Set<number>;
  region: string;
  services: number[];
  willingToPay: boolean;
}

export interface RetrieveOutcome {
  /** Per player: the fresh films for their list, or null = use today's path. */
  fresh: PerPlayer<FreshFilm[] | null>;
  stats: RetrievalStats;
}

/** Fresh candidates for both players from the catalogue. Never throws. */
export async function retrieveFresh(input: RetrieveInput): Promise<RetrieveOutcome> {
  const started = Date.now();
  const stats: RetrievalStats = {
    outcome: "fallback",
    reason: null,
    fingerprints: { 1: false, 2: false },
    sharedSimilarity: null,
    sharedSeed: false,
    retrieved: { 1: 0, 2: 0 },
    eligible: { 1: 0, 2: 0 },
    selected: { 1: 0, 2: 0 },
    availabilityChecks: 0,
    ms: 0,
  };
  const done = (fresh: PerPlayer<FreshFilm[] | null>): RetrieveOutcome => {
    stats.ms = Date.now() - started;
    stats.outcome = fresh[1] || fresh[2] ? "embeddings" : "fallback";
    if (stats.reason) {
      console.warn(
        JSON.stringify({
          event: "embeddings.fallback",
          reason: stats.reason,
          players: ([1, 2] as const).filter((p) => !fresh[p]),
        })
      );
    }
    return { fresh, stats };
  };
  const todaysPath = { 1: null, 2: null };

  const db = supabase();
  if (!db) {
    stats.reason = "config";
    return done(todaysPath);
  }

  try {
    // 1. Fingerprints: the average stored vector of each player's likes.
    const vectors = await loadVectors(db, [...new Set([...input.likes[1], ...input.likes[2]])]);
    const likedVecs = (p: Player) =>
      input.likes[p].map((id) => vectors.get(id)).filter((v): v is number[] => !!v);
    const vecs = { 1: likedVecs(1), 2: likedVecs(2) };
    const fingerprint = { 1: meanVector(vecs[1]), 2: meanVector(vecs[2]) };
    stats.fingerprints = { 1: !!fingerprint[1], 2: !!fingerprint[2] };
    // No usable likes is expected (all skipped, or none in the catalogue): that
    // player simply gets today's path, with no warning.
    if (!fingerprint[1] && !fingerprint[2]) return done(todaysPath);

    // 2. Shared seed from the closest cross-player pair of likes.
    const shared =
      fingerprint[1] && fingerprint[2] ? sharedSeed(vecs[1], vecs[2]) : { seed: null, similarity: null };
    stats.sharedSimilarity = shared.similarity;
    stats.sharedSeed = !!shared.seed;

    // 3. Nearest catalogue films, all queries in parallel.
    const exclude = [...new Set([...input.pool.map((m) => m.id), ...input.swiped])];
    const [sharedRows, own1, own2] = await Promise.all([
      shared.seed ? matchMovies(db, shared.seed, RETRIEVE_K, exclude) : Promise.resolve([]),
      fingerprint[1] ? matchMovies(db, fingerprint[1], RETRIEVE_K, exclude) : Promise.resolve([]),
      fingerprint[2] ? matchMovies(db, fingerprint[2], RETRIEVE_K, exclude) : Promise.resolve([]),
    ]);
    const ownRows = { 1: own1, 2: own2 };
    stats.retrieved = { 1: sharedRows.length + own1.length, 2: sharedRows.length + own2.length };
    if (sharedRows.length + own1.length + own2.length === 0) {
      stats.reason = "empty";
      return done(todaysPath);
    }

    // 4. The checks, then availability within budget. Shared films first (checked
    //    once, they go to both lists), then each player's own films fill the rest.
    const screen: ScreenContext = {
      excludeIds: new Set(exclude),
      allowKidsFare: input.allowKidsFare,
      blockedCollections: input.likedCollections,
    };
    const screened = (rows: CatalogueFilm[]) => rows.filter((f) => passesScreen(f, screen));
    const check = availabilityCheck(input.region, input.services, input.willingToPay);

    const sharedTaken: Taken = { ids: new Set(), collections: new Set() };
    const sharedPick = shared.seed
      ? await pickEligible(screened(sharedRows), SHARED_SLOTS, SHARED_CHECKS, check, sharedTaken)
      : { picked: [], eligible: 0, checksUsed: 0 };

    const ownPick = (p: Player) =>
      fingerprint[p]
        ? pickEligible(
            screened(ownRows[p]),
            FRESH_SLOTS - sharedPick.picked.length,
            MAX_AVAIL_CHECKS - sharedPick.checksUsed,
            check,
            { ids: new Set(sharedTaken.ids), collections: new Set(sharedTaken.collections) }
          )
        : Promise.resolve(null);
    const [mine1, mine2] = await Promise.all([ownPick(1), ownPick(2)]);
    stats.availabilityChecks = check.calls();

    const forPlayer = (p: Player, mine: Awaited<ReturnType<typeof ownPick>>) => {
      if (!fingerprint[p] || !mine) return null;
      const films = [
        ...sharedPick.picked.map((f) => toFresh(f, true)),
        ...mine.picked.map((f) => toFresh(f, false)),
      ];
      stats.eligible[p] = sharedPick.eligible + mine.eligible;
      stats.selected[p] = films.length;
      return films.length > 0 ? films : null;
    };
    const fresh = { 1: forPlayer(1, mine1), 2: forPlayer(2, mine2) };
    // A player with a fingerprint but nothing eligible is an empty result.
    if (([1, 2] as const).some((p) => fingerprint[p] && !fresh[p])) stats.reason = "empty";
    return done(fresh);
  } catch (e) {
    stats.reason = e instanceof RetrievalError ? e.reason : "error";
    return done(todaysPath);
  }
}

/** One structured line per game (server only, no personal data). */
export function logRetrieval(
  stats: RetrievalStats,
  used: PerPlayer<number>,
  servedBy: PerPlayer<"embeddings" | "today">
): void {
  console.info(JSON.stringify({ event: "embeddings.retrieval", ...stats, used, servedBy }));
}
