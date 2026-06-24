// The no-overlap path. Rank candidates by fit to BOTH players' moods, preferring
// the INTERSECTION of their tastes (sci-fi + action → The Matrix). Eligibility is
// MANDATORY, not a soft preference: we only ever return a title the couple can
// actually watch. When nothing's eligible we hand back a recoverable state
// (offer rentals, or the honest "nothing watchable" end-state) — never an
// unavailable movie dressed up as a match. Round 3 rejections are excluded.
import "server-only";
import { attachAvailability } from "./availability";
import { evaluateAvailability, type MovieAvailability } from "./filter";
import { isKidsFare } from "./genres";
import { matchPercent, matchTags } from "./matchInsight";
import { round3Rank } from "./ranking";
import { getCollectionId, getRecommendations, tmdbImageUrl, type TmdbDiscoverMovie } from "./tmdb";
import type { PoolMovie } from "./blendTypes";
import type { MatchMovie } from "./inferTypes";

const MIN_VOTES = 100;
const MIN_VOTE_AVERAGE = 6.2;
const MAX_SEEDS = 3;
const MAX_MATCHES = 10; // winner + the full eligible runner-up tail (UI shows ~3 inline + "see more")
// Availability is fetched in fit-order batches. The scan EARLY-STOPS once enough
// matches (titles watchable under the current constraint) are collected; a
// "needs-rentals" or "none" claim — both assertions that NO such title exists —
// only after the full ranked pool is exhausted, so an included title is never
// missed behind a rentable.
const AVAIL_BATCH = 5;

interface BridgeCand {
  id: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
  collectionId: number | null;
}

const fromPool = (m: PoolMovie): BridgeCand => ({
  id: m.id,
  title: m.title,
  year: m.year,
  posterUrl: m.posterUrl,
  genreIds: m.genreIds,
  voteAverage: m.voteAverage,
  voteCount: m.voteCount,
  collectionId: m.collectionId,
});

const fromDiscover = (m: TmdbDiscoverMovie): BridgeCand => ({
  id: m.id,
  title: m.title,
  year: m.release_date ? m.release_date.slice(0, 4) : null,
  posterUrl: tmdbImageUrl(m.poster_path, "w342"),
  genreIds: m.genre_ids ?? [],
  voteAverage: m.vote_average,
  voteCount: m.vote_count,
  collectionId: null,
});

async function recommendationsFor(seedIds: number[]): Promise<TmdbDiscoverMovie[]> {
  const map = new Map<number, TmdbDiscoverMovie>();
  for (const id of seedIds.slice(0, MAX_SEEDS)) {
    try {
      for (const m of await getRecommendations(id)) map.set(m.id, m);
    } catch {
      /* skip a bad seed */
    }
  }
  return [...map.values()];
}

const fitsAnchor = (genreIds: number[], anchor: number[]) =>
  anchor.length === 0 || genreIds.some((g) => anchor.includes(g));

/** Always a watchable decision OR an honest, recoverable state — never an
 * unavailable match. */
export type BridgeOutcome =
  | { kind: "match"; movie: MatchMovie; alternatives: MatchMovie[] }
  | { kind: "needs-rentals" } // a best-fit title is eligible IF they pay → offer the expand
  | { kind: "none" }; //          nothing watchable even paying → honest end-state

export async function bridge(
  pool: PoolMovie[],
  positives1: number[],
  positives2: number[],
  anchor1: number[],
  anchor2: number[],
  allowKidsFare: boolean,
  region: string,
  services: number[],
  willingToPay: boolean,
  declinedIds: number[],
  moodAxes: string[] = []
): Promise<BridgeOutcome> {
  const fresh = await recommendationsFor([...positives1, ...positives2]);
  const freshIds = new Set(fresh.map((m) => m.id));
  const declined = new Set(declinedIds); // titles either player explicitly passed on
  const candidates = [...pool.map(fromPool), ...fresh.map(fromDiscover)];

  const seen = new Set<number>();
  const quality = candidates.filter((c) => {
    if (seen.has(c.id) || declined.has(c.id)) return false; // respect Round 3 rejections
    seen.add(c.id);
    return (
      !!c.posterUrl &&
      c.voteCount >= MIN_VOTES &&
      c.voteAverage >= MIN_VOTE_AVERAGE &&
      (allowKidsFare || !isKidsFare(c.genreIds))
    );
  });

  // Fresh TMDB recs enter with collectionId null — enrich them (parity with the
  // infer path) so franchise dedup can catch a fresh sequel in the bridge tail.
  await Promise.all(
    quality.map(async (c) => {
      if (freshIds.has(c.id) && c.collectionId == null) c.collectionId = await getCollectionId(c.id);
    })
  );

  const score = (c: BridgeCand) =>
    (fitsAnchor(c.genreIds, anchor1) ? 1 : 0) + (fitsAnchor(c.genreIds, anchor2) ? 1 : 0);
  // Fit to both moods first; among equal-fit titles use the soft Round 3 rank, so
  // discoveries surface over the ubiquitous canon (the quality floor still holds).
  const ranked = quality
    .map((c) => ({ c, s: score(c) }))
    .filter(({ s }) => s >= 1)
    .sort((a, b) => b.s - a.s || round3Rank(b.c) - round3Rank(a.c))
    .map((x) => x.c);

  if (ranked.length === 0) return { kind: "none" };

  type Scanned = BridgeCand & { availability: MovieAvailability };
  const scanned: Scanned[] = [];
  const eligible = (c: Scanned) =>
    evaluateAvailability(c.availability, services, willingToPay).eligible;
  const rentable = (c: Scanned) => c.availability.rent.length + c.availability.buy.length > 0;

  // Scan in fit order, collecting up to MAX_MATCHES titles watchable under the
  // CURRENT constraint (winner + runner-ups), one per franchise. Early-stop once
  // we have enough. Both "needs-rentals" and "none" assert NO such title exists,
  // so they're returned only after EXHAUSTING the full ranked pool — an included
  // title deeper than an earlier rentable one is never missed, and a not-paying
  // couple is never nudged to pay when a free option existed.
  const chosen: Scanned[] = [];
  const seenCollections = new Set<number>();
  const take = (c: Scanned) => {
    if (!eligible(c) || chosen.length >= MAX_MATCHES) return;
    if (c.collectionId != null) {
      if (seenCollections.has(c.collectionId)) return;
      seenCollections.add(c.collectionId);
    }
    chosen.push(c);
  };
  for (let i = 0; i < ranked.length && chosen.length < MAX_MATCHES; i += AVAIL_BATCH) {
    const batch = await attachAvailability(ranked.slice(i, i + AVAIL_BATCH), region);
    scanned.push(...batch);
    for (const c of batch) take(c);
  }

  if (chosen.length > 0) {
    // Bridge fit is coarse (anchors hit + vote average), so equal-fit runner-ups
    // collapse to the same %. A small per-rank decrement gives a readable descent
    // (the % is the engagement number; fit still drives the base).
    const toMatch = (c: Scanned, rank: number): MatchMovie => {
      const fit01 = (score(c) / 2) * 0.6 + Math.min(c.voteAverage / 10, 1) * 0.4 - rank * 0.05;
      return {
        id: c.id,
        title: c.title,
        year: c.year,
        posterUrl: c.posterUrl,
        genreIds: c.genreIds,
        availability: c.availability,
        matchTags: matchTags(moodAxes, c.genreIds),
        matchPercent: matchPercent(fit01),
      };
    };
    return {
      kind: "match",
      movie: toMatch(chosen[0], 0),
      alternatives: chosen.slice(1).map((c, i) => toMatch(c, i + 1)),
    };
  }
  // No title is watchable under the current constraint anywhere in the pool. If
  // paying would unlock one, offer the expand; otherwise the honest end-state.
  return !willingToPay && scanned.some(rentable) ? { kind: "needs-rentals" } : { kind: "none" };
}
