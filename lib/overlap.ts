// Deterministic Round 3 resolution (pure — no I/O, unit-tested).
//
// A match needs at least one title BOTH players picked (the winner). Zero overlap
// → the caller runs the async bridge (lib/bridge.ts). The winner + its alternatives
// come from a single both-players-aware ranked pool: both-picked first, then
// one-picked, then the rest of the eligible shortlist (so a thin-overlap couple
// still gets fallbacks). Every alternative obeys the winner's rules — eligible,
// not declined, franchise-deduped. We never recompute a looser pool to fill slots.
import { evaluateAvailability } from "./filter";
import { matchPercent, matchTags } from "./matchInsight";
import type { MatchMovie, MatchResult, PlayerRec } from "./inferTypes";

const MAX_ALTERNATIVES = 9; // the full tail; the UI shows ~3 inline + "see other matches"

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

export interface MatchOptions {
  services: number[];
  willingToPay: boolean;
  /** Titles either player was shown but did not pick — excluded from alternatives. */
  declined?: number[];
  /** Couple's combined mood words, for the "why it matched" tags. */
  moodAxes?: string[];
}

const rankOf = (recs: PlayerRec[], id: number) => {
  const i = recs.findIndex((r) => r.id === id);
  return i === -1 ? recs.length : i; // absent = just past the end (bounded)
};

/**
 * Overlap match: the winner is the best title BOTH players picked, or null (→
 * bridge). The alternatives are the full both-aware ranked tail — both-picked
 * first, then one-picked, then the rest of the ELIGIBLE shortlist — so a thin
 * overlap still yields fallbacks. Every alternative is eligible (a picked title is
 * trusted-eligible; a never-picked one must clear the availability filter), not
 * declined, and franchise-deduped. No looser pool is recomputed to fill slots; if
 * the shortlist is exhausted we return fewer.
 */
export function pickMatch(
  recs1: PlayerRec[],
  recs2: PlayerRec[],
  picks1: number[],
  picks2: number[],
  opts: MatchOptions = { services: [], willingToPay: true }
): MatchResult | null {
  const { services, willingToPay, declined = [], moodAxes = [] } = opts;
  const p1 = new Set(picks1);
  const p2 = new Set(picks2);
  const declinedSet = new Set(declined);

  // A match requires at least one title both players picked.
  if (![...p1].some((id) => p2.has(id))) return null;

  const byId = new Map<number, PlayerRec>();
  for (const r of [...recs1, ...recs2]) if (!byId.has(r.id)) byId.set(r.id, r);

  const maxFit = Math.max(recs1.length + recs2.length, 1);
  const fitOf = (id: number) => rankOf(recs1, id) + rankOf(recs2, id);
  const tierOf = (id: number) => (p1.has(id) && p2.has(id) ? 0 : p1.has(id) || p2.has(id) ? 1 : 2);
  const isEligible = (r: PlayerRec) =>
    evaluateAvailability(r.availability, services, willingToPay).eligible;

  // Both-picked first, then one-picked, then eligible never-picked — by fit within
  // tier. Drop declined; a never-picked title must be eligible.
  const ranked = [...byId.values()]
    .filter((r) => {
      if (declinedSet.has(r.id)) return false;
      return p1.has(r.id) || p2.has(r.id) || isEligible(r);
    })
    .sort((a, b) => tierOf(a.id) - tierOf(b.id) || fitOf(a.id) - fitOf(b.id));

  // Franchise-dedupe (keep the best-ranked entry per collection).
  const seen = new Set<number>();
  const deduped = ranked.filter((r) => {
    if (r.collectionId == null) return true;
    if (seen.has(r.collectionId)) return false;
    seen.add(r.collectionId);
    return true;
  });

  const toMovie = (r: PlayerRec, pos: number) =>
    toMatchMovie(r, 1 - fitOf(r.id) / maxFit - pos * 0.04, moodAxes);

  return {
    movie: toMovie(deduped[0], 0), // top = best both-picked title
    reason: "overlap",
    alternatives: deduped.slice(1, 1 + MAX_ALTERNATIVES).map((r, i) => toMovie(r, i + 1)),
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
