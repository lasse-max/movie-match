// Deterministic Round 3 resolution (pure — no I/O, unit-tested).
//
// Overlap = the titles BOTH players marked "would watch", ranked by combined fit
// (each player's rec order is their fit ranking). One or more → match. Zero
// overlap → the caller runs the async bridge (lib/bridge.ts). Price/availability
// is never a ranking factor here.
import type { MatchMovie, MatchResult, PlayerRec } from "./inferTypes";

export function recToMovie(r: PlayerRec): MatchMovie {
  return {
    id: r.id,
    title: r.title,
    year: r.year,
    posterUrl: r.posterUrl,
    genreIds: r.genreIds,
    availability: r.availability,
  };
}

/**
 * Titles both players would watch, best combined fit first. Fit = position in
 * each player's ranked recs (lower is better); combined = the sum.
 */
export function findOverlap(
  recs1: PlayerRec[],
  recs2: PlayerRec[],
  picks1: number[],
  picks2: number[]
): MatchMovie[] {
  const picked2 = new Set(picks2);
  const both = [...new Set(picks1)].filter((id) => picked2.has(id));
  if (both.length === 0) return [];

  const rankIn = (recs: PlayerRec[], id: number) => {
    const i = recs.findIndex((r) => r.id === id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const byId = new Map<number, PlayerRec>();
  for (const r of [...recs1, ...recs2]) if (!byId.has(r.id)) byId.set(r.id, r);

  return both
    .map((id) => ({ id, fit: rankIn(recs1, id) + rankIn(recs2, id) }))
    .sort((a, b) => a.fit - b.fit)
    .map(({ id }) => byId.get(id))
    .filter((r): r is PlayerRec => !!r)
    .map(recToMovie);
}

/** Overlap match (best combined fit), or null when there's no overlap → bridge. */
export function pickMatch(
  recs1: PlayerRec[],
  recs2: PlayerRec[],
  picks1: number[],
  picks2: number[]
): MatchResult | null {
  const overlap = findOverlap(recs1, recs2, picks1, picks2);
  return overlap.length > 0 ? { movie: overlap[0], reason: "overlap" } : null;
}

/**
 * Titles a player was SHOWN in Round 3 but did not pick = an explicit decline.
 * Never-shown finalists (backfill beyond the visible set, or ineligible titles
 * filtered out before display) are neither picked nor declined — they stay
 * eligible for the bridge. De-duped across both players.
 */
export function declinedFrom(
  shown: Record<1 | 2, number[]>,
  picks: Record<1 | 2, number[]>
): number[] {
  const declined = new Set<number>();
  for (const p of [1, 2] as const) {
    const picked = new Set(picks[p]);
    for (const id of shown[p]) if (!picked.has(id)) declined.add(id);
  }
  return [...declined];
}
