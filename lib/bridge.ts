// The no-overlap path. Rank candidates by fit to BOTH players' moods and prefer
// the INTERSECTION of their tastes — a sci-fi + action couple should bridge on a
// sci-fi-action hybrid (The Matrix), not a one-lane pick (The Equalizer). Pool
// titles and TMDB recommendations from both players' positives both compete;
// fit-to-both wins, quality (vote average) breaks ties. Always a decision.
import "server-only";
import { isKidsFare } from "./genres";
import { getRecommendations, tmdbImageUrl, type TmdbDiscoverMovie } from "./tmdb";
import type { PoolMovie } from "./blendTypes";
import type { MatchMovie } from "./inferTypes";

const MIN_VOTES = 100;
const MIN_VOTE_AVERAGE = 6.2;
const MAX_SEEDS = 3;

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

// Fits a player's core if it shares an anchor genre — or if they picked no genre
// (mood-only), in which case they're open and any candidate fits them.
const fitsAnchor = (genreIds: number[], anchor: number[]) =>
  anchor.length === 0 || genreIds.some((g) => anchor.includes(g));

export async function bridge(
  pool: PoolMovie[],
  positives1: number[],
  positives2: number[],
  anchor1: number[],
  anchor2: number[],
  allowKidsFare: boolean,
  fallback: MatchMovie | null
): Promise<MatchMovie | null> {
  const fresh = await recommendationsFor([...positives1, ...positives2]);
  const candidates = [...pool.map(fromPool), ...fresh.map(fromDiscover)];

  const seen = new Set<number>();
  const eligible = candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return (
      !!c.posterUrl &&
      c.voteCount >= MIN_VOTES &&
      c.voteAverage >= MIN_VOTE_AVERAGE &&
      (allowKidsFare || !isKidsFare(c.genreIds))
    );
  });

  // Prefer titles hitting BOTH players' cores; quality breaks ties.
  const score = (c: BridgeCand) =>
    (fitsAnchor(c.genreIds, anchor1) ? 1 : 0) + (fitsAnchor(c.genreIds, anchor2) ? 1 : 0);
  const best = eligible
    .map((c) => ({ c, s: score(c) }))
    .filter(({ s }) => s >= 1)
    .sort((a, b) => b.s - a.s || b.c.voteAverage - a.c.voteAverage)[0]?.c;

  if (!best) return fallback;
  return {
    id: best.id,
    title: best.title,
    year: best.year,
    posterUrl: best.posterUrl,
    genreIds: best.genreIds,
  };
}
