// Deterministic Round 3 resolution (pure — no I/O, unit-tested).
//
// Overlap = the titles BOTH players marked "would watch", ranked by combined fit
// (each player's rec order is their fit ranking). One or more → match. Zero
// overlap → the caller runs the async bridge (lib/bridge.ts). Price/availability
// is never a ranking factor here.
import { matchPercent, matchTags } from "./matchInsight";
import type { MatchMovie, MatchResult, PlayerRec } from "./inferTypes";

const MAX_ALTERNATIVES = 3; // runner-ups shown beneath the hero on the match screen

/** A rec + its combined fit, ranked best (lowest fit) first. Fit = position in
 * each player's ranked recs (lower is better); combined = the sum. */
function rankedOverlap(
  recs1: PlayerRec[],
  recs2: PlayerRec[],
  picks1: number[],
  picks2: number[]
): { rec: PlayerRec; fit: number }[] {
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
    .map((id) => ({ rec: byId.get(id), fit: rankIn(recs1, id) + rankIn(recs2, id) }))
    .filter((x): x is { rec: PlayerRec; fit: number } => !!x.rec)
    .sort((a, b) => a.fit - b.fit);
}

/** Titles both players would watch, best combined fit first. */
export function findOverlap(
  recs1: PlayerRec[],
  recs2: PlayerRec[],
  picks1: number[],
  picks2: number[]
): PlayerRec[] {
  return rankedOverlap(recs1, recs2, picks1, picks2).map((x) => x.rec);
}

/** Build a match movie with "why it matched" tags + a fit percentage. */
export function toMatchMovie(
  rec: PlayerRec,
  fit01: number,
  moodAxes: string[]
): MatchMovie {
  return {
    id: rec.id,
    title: rec.title,
    year: rec.year,
    posterUrl: rec.posterUrl,
    genreIds: rec.genreIds,
    availability: rec.availability,
    matchTags: matchTags(moodAxes, rec.genreIds),
    matchPercent: matchPercent(fit01),
  };
}

/**
 * Overlap match (best combined fit) + up to 3 runner-ups, each with tags/percent,
 * or null when there's no overlap → bridge. `moodAxes` are the couple's combined
 * mood words (for the "why it matched" tags).
 */
export function pickMatch(
  recs1: PlayerRec[],
  recs2: PlayerRec[],
  picks1: number[],
  picks2: number[],
  moodAxes: string[] = []
): MatchResult | null {
  const ranked = rankedOverlap(recs1, recs2, picks1, picks2);
  if (ranked.length === 0) return null;
  // Normalize fit against the worst combined rank in play (0 = both ranked it #1).
  const maxFit = Math.max(recs1.length, 1) + Math.max(recs2.length, 1);
  const movies = ranked.map((x) => toMatchMovie(x.rec, 1 - x.fit / maxFit, moodAxes));
  return {
    movie: movies[0],
    reason: "overlap",
    alternatives: movies.slice(1, 1 + MAX_ALTERNATIVES),
  };
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
