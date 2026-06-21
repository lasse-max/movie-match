// Proportionate request hardening for the infer/bridge routes. The real risk is
// COST + CORRECTNESS — a huge array inflating the Claude prompt, or fabricated
// movie facts reaching the AI — NOT multi-user security (the session is the
// sender's own, stateless). So: bound sizes, validate basic shape, dedup, and
// check ids against the submitted pool. Deliberately not a fortress; full
// rate-limiting stays a later concern. Isomorphic so it's unit-testable.
import { SUPPORTED_REGIONS } from "./constants";
import type { PoolMovie } from "./blendTypes";

export const MAX_POOL = 60;
export const MAX_IDS = 60;

const asInt = (x: unknown): number | null =>
  typeof x === "number" && Number.isInteger(x) ? x : null;
const asNum = (x: unknown, fallback = 0): number =>
  typeof x === "number" && Number.isFinite(x) ? x : fallback;
const asStr = (x: unknown, fallback = ""): string => (typeof x === "string" ? x : fallback);
const asStrOrNull = (x: unknown): string | null => (typeof x === "string" ? x : null);

/**
 * Validate + bound a client-submitted candidate pool: keep only well-shaped
 * movies (a valid integer id is required; other fields are coerced to safe
 * defaults so fabricated facts can't reach the AI), dedup by id, cap at MAX_POOL.
 */
export function sanitizePool(raw: unknown): PoolMovie[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: PoolMovie[] = [];
  for (const item of raw) {
    if (out.length >= MAX_POOL) break;
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const id = asInt(m.id);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: asStr(m.title),
      year: asStrOrNull(m.year),
      overview: asStr(m.overview),
      posterUrl: asStrOrNull(m.posterUrl),
      genreIds: Array.isArray(m.genreIds)
        ? m.genreIds.filter((g): g is number => asInt(g) != null)
        : [],
      voteAverage: asNum(m.voteAverage),
      voteCount: asNum(m.voteCount),
      directionIndex: asInt(m.directionIndex) ?? 0,
      directionTheme: asStr(m.directionTheme),
    });
  }
  return out;
}

/** Integer ids from `raw`, deduped and capped — for lists not tied to the pool
 * (Round 3 picks/declines may include fresh recs that aren't in the pool). */
export function boundedIds(raw: unknown, max = MAX_IDS): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  for (const x of raw) {
    const id = asInt(x);
    if (id != null) seen.add(id);
    if (seen.size >= max) break;
  }
  return [...seen];
}

/** Like boundedIds, but only ids that exist in `allowed` (the submitted pool). */
export function idsIn(raw: unknown, allowed: Set<number>, max = MAX_IDS): number[] {
  return boundedIds(raw, max).filter((id) => allowed.has(id));
}

/** A region we actually support in setup (else callers fall back to the default). */
export function isSupportedRegion(region: unknown): region is string {
  return typeof region === "string" && SUPPORTED_REGIONS.some((r) => r.code === region);
}
