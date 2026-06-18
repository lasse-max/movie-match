// Server-only: fetch region-scoped availability for the FINALISTS only (Round 3
// recs + bridge), not the whole pool — keeps latency down. The deterministic
// eligibility decision lives in lib/filter.ts (pure, isomorphic).
import "server-only";
import { getWatchProvidersForRegion, type TmdbProvider } from "./tmdb";
import { NO_AVAILABILITY, type MovieAvailability, type Provider } from "./filter";

const toProviders = (list?: TmdbProvider[]): Provider[] =>
  (list ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name }));

export async function fetchAvailability(
  movieId: number,
  region: string
): Promise<MovieAvailability> {
  try {
    const r = await getWatchProvidersForRegion(movieId, region);
    if (!r) return NO_AVAILABILITY;
    return {
      flatrate: toProviders(r.flatrate),
      rent: toProviders(r.rent),
      buy: toProviders(r.buy),
      justWatchLink: r.link ?? null,
    };
  } catch {
    return NO_AVAILABILITY;
  }
}

/** Attach availability to a set of movies in parallel. */
export async function attachAvailability<T extends { id: number }>(
  movies: T[],
  region: string
): Promise<(T & { availability: MovieAvailability })[]> {
  return Promise.all(
    movies.map(async (m) => ({ ...m, availability: await fetchAvailability(m.id, region) }))
  );
}
