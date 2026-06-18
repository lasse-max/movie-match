// The no-overlap path. Rank candidates by fit to BOTH players' moods, preferring
// the INTERSECTION of their tastes (sci-fi + action → The Matrix). Eligibility is
// a gate, not a ranking factor: among the best-fit titles, pick the best one the
// couple can actually watch. Always a decision (falls back to a nearest pick).
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
  fallback: MatchMovie | null
): Promise<MatchMovie | null> {
  const fresh = await recommendationsFor([...positives1, ...positives2]);
  const candidates = [...pool.map(fromPool), ...fresh.map(fromDiscover)];

  const seen = new Set<number>();
  const quality = candidates.filter((c) => {
    if (seen.has(c.id)) return false;
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

  if (ranked.length === 0) return fallback;

  // Among the best-fit candidates, prefer the best the couple can actually watch.
  const withAvail = await attachAvailability(ranked.slice(0, TOP_TO_CHECK), region);
  const chosen =
    withAvail.find((c) => evaluateAvailability(c.availability, services, willingToPay).eligible) ??
    withAvail[0];

  return {
    id: chosen.id,
    title: chosen.title,
    year: chosen.year,
    posterUrl: chosen.posterUrl,
    genreIds: chosen.genreIds,
    availability: chosen.availability,
  };
}
