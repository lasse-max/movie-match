// The no-overlap path. Seed TMDB's recommendation graph from BOTH players' R2
// positive swipes and surface a film linked to both sides — so Round 3 always
// ends in a decision rather than dead-ending or just grabbing a nearest pick.
import "server-only";
import { isKidsFare } from "./genres";
import { getRecommendations, tmdbImageUrl, type TmdbDiscoverMovie } from "./tmdb";
import type { MatchMovie } from "./inferTypes";

const MIN_VOTES = 100;
const MAX_SEEDS = 3;

const toMovie = (m: TmdbDiscoverMovie): MatchMovie => ({
  id: m.id,
  title: m.title,
  year: m.release_date ? m.release_date.slice(0, 4) : null,
  posterUrl: tmdbImageUrl(m.poster_path, "w342"),
  genreIds: m.genre_ids ?? [],
});

async function recommendationsFor(ids: number[]): Promise<Map<number, TmdbDiscoverMovie>> {
  const map = new Map<number, TmdbDiscoverMovie>();
  for (const id of ids.slice(0, MAX_SEEDS)) {
    try {
      for (const m of await getRecommendations(id)) map.set(m.id, m);
    } catch {
      /* skip a bad seed */
    }
  }
  return map;
}

/**
 * Bridge film for a zero-overlap Round 3. Prefers a title recommended for BOTH
 * sides; else the strongest single recommendation; else the provided fallback
 * (a nearest pick) so it never returns null.
 */
export async function bridge(
  positives1: number[],
  positives2: number[],
  allowKidsFare: boolean,
  fallback: MatchMovie | null
): Promise<MatchMovie | null> {
  const r1 = await recommendationsFor(positives1);
  const r2 = await recommendationsFor(positives2);
  const seedIds = new Set([...positives1, ...positives2]);

  const ok = (m: TmdbDiscoverMovie) =>
    !!m.poster_path &&
    m.vote_count >= MIN_VOTES &&
    !seedIds.has(m.id) &&
    (allowKidsFare || !isKidsFare(m.genre_ids));
  const best = (list: TmdbDiscoverMovie[]) =>
    list.filter(ok).sort((a, b) => b.vote_average - a.vote_average)[0];

  const shared = [...r1.values()].filter((m) => r2.has(m.id));
  const chosen = best(shared) ?? best([...r1.values(), ...r2.values()]);

  return chosen ? toMovie(chosen) : fallback;
}
