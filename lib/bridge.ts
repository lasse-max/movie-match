// The no-overlap path. Rank candidates by fit to BOTH players' moods, preferring
// the INTERSECTION of their tastes (sci-fi + action → The Matrix). Eligibility is
// MANDATORY, not a soft preference: we only ever return a title the couple can
// actually watch. When nothing's eligible we hand back a recoverable state
// (offer rentals, or the honest "nothing watchable" end-state) — never an
// unavailable movie dressed up as a match. Round 3 rejections are excluded.
import "server-only";
import { attachAvailability } from "./availability";
import { evaluateAvailability } from "./filter";
import { isKidsFare } from "./genres";
import { getRecommendations, tmdbImageUrl, type TmdbDiscoverMovie } from "./tmdb";
import type { PoolMovie } from "./blendTypes";
import type { MatchMovie } from "./inferTypes";

const MIN_VOTES = 100;
const MIN_VOTE_AVERAGE = 6.2;
const MAX_SEEDS = 3;
const TOP_TO_CHECK = 10; // bound availability fetches to the best-fit candidates

interface BridgeCand {
  id: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
}

const fromPool = (m: PoolMovie): BridgeCand => ({
  id: m.id,
  title: m.title,
  year: m.year,
  posterUrl: m.posterUrl,
  genreIds: m.genreIds,
  voteAverage: m.voteAverage,
  voteCount: m.voteCount,
});

const fromDiscover = (m: TmdbDiscoverMovie): BridgeCand => ({
  id: m.id,
  title: m.title,
  year: m.release_date ? m.release_date.slice(0, 4) : null,
  posterUrl: tmdbImageUrl(m.poster_path, "w342"),
  genreIds: m.genre_ids ?? [],
  voteAverage: m.vote_average,
  voteCount: m.vote_count,
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
  | { kind: "match"; movie: MatchMovie }
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
  declinedIds: number[]
): Promise<BridgeOutcome> {
  const fresh = await recommendationsFor([...positives1, ...positives2]);
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

  const score = (c: BridgeCand) =>
    (fitsAnchor(c.genreIds, anchor1) ? 1 : 0) + (fitsAnchor(c.genreIds, anchor2) ? 1 : 0);
  const ranked = quality
    .map((c) => ({ c, s: score(c) }))
    .filter(({ s }) => s >= 1)
    .sort((a, b) => b.s - a.s || b.c.voteAverage - a.c.voteAverage)
    .map((x) => x.c);

  if (ranked.length === 0) return { kind: "none" };

  // Eligibility is mandatory: return the best-fit title the couple can ACTUALLY
  // watch — never a degraded nearest pick with no confirmed way to watch it.
  const withAvail = await attachAvailability(ranked.slice(0, TOP_TO_CHECK), region);
  const chosen = withAvail.find(
    (c) => evaluateAvailability(c.availability, services, willingToPay).eligible
  );
  if (chosen) {
    return {
      kind: "match",
      movie: {
        id: chosen.id,
        title: chosen.title,
        year: chosen.year,
        posterUrl: chosen.posterUrl,
        genreIds: chosen.genreIds,
        availability: chosen.availability,
      },
    };
  }

  // Nothing's eligible. If paying would unlock a best-fit title, offer the expand;
  // otherwise it's the honest end-state — never an unavailable match.
  const couldRent = withAvail.some(
    (c) => c.availability.rent.length + c.availability.buy.length > 0
  );
  return !willingToPay && couldRent ? { kind: "needs-rentals" } : { kind: "none" };
}
