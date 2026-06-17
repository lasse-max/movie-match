// Server-only TMDB client. Importing this from a Client Component will fail the
// build, guaranteeing the API key never ends up in browser code.
import "server-only";

const TMDB_BASE = "https://api.themoviedb.org/3";

// Re-exported for convenience so server callers can import it alongside the
// client; the single source of truth lives in lib/constants.ts.
export { DEFAULT_REGION } from "./constants";
import { DEFAULT_REGION } from "./constants";

function authHeaders(): Record<string, string> {
  // TMDB v4 Read Access Token, used as a bearer token. Server-side only — it is
  // NOT prefixed with NEXT_PUBLIC_, so it is never bundled into client code.
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is not set. Add it to .env.local (see .env.example)."
    );
  }
  return { Authorization: `Bearer ${token}` };
}

/** Low-level GET against the TMDB v3 REST API. Throws on a non-OK response. */
export async function tmdbGet<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { accept: "application/json", ...authHeaders() },
    // Availability data refreshes daily; cache for an hour to stay snappy.
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TMDB ${path} failed: ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json() as Promise<T>;
}

// ---- Watch providers -------------------------------------------------------

export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface TmdbRegionProviders {
  link: string;
  flatrate?: TmdbProvider[]; // subscription ("included with")
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
}

export interface TmdbWatchProvidersResponse {
  id: number;
  results: Record<string, TmdbRegionProviders | undefined>;
}

/** Raw watch/providers payload (all regions) for a movie. */
export function getWatchProviders(movieId: number) {
  return tmdbGet<TmdbWatchProvidersResponse>(`/movie/${movieId}/watch/providers`);
}

/** Watch providers for a single region (e.g. "US"), or null if none listed. */
export async function getWatchProvidersForRegion(
  movieId: number,
  region: string = DEFAULT_REGION
): Promise<TmdbRegionProviders | null> {
  const data = await getWatchProviders(movieId);
  return data.results[region] ?? null;
}

// ---- Movie details ---------------------------------------------------------

export interface TmdbMovie {
  id: number;
  title: string;
  release_date: string;
  overview: string;
}

export function getMovie(movieId: number) {
  return tmdbGet<TmdbMovie>(`/movie/${movieId}`);
}

// ---- Images ----------------------------------------------------------------

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/** Full URL for a TMDB image path (e.g. a provider logo), or null if absent. */
export function tmdbImageUrl(path: string | null, size = "w92"): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

// ---- Watch-provider regions & per-region provider list ---------------------

export interface TmdbWatchRegion {
  iso_3166_1: string;
  english_name: string;
  native_name: string;
}

/** Countries TMDB has watch-provider data for. */
export function getWatchProviderRegions() {
  return tmdbGet<{ results: TmdbWatchRegion[] }>("/watch/providers/regions", {
    language: "en-US",
  });
}

export interface TmdbWatchProviderListItem {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
  /** Per-region popularity ranking (lower = more prominent). */
  display_priorities?: Record<string, number>;
}

/** All movie watch providers available in a region (subscription, rent, buy). */
export function getRegionWatchProviders(region: string) {
  return tmdbGet<{ results: TmdbWatchProviderListItem[] }>("/watch/providers/movie", {
    language: "en-US",
    watch_region: region,
  });
}

/** Region-specific popularity rank for a provider (lower sorts first). */
export function providerPriority(p: TmdbWatchProviderListItem, region: string): number {
  return p.display_priorities?.[region] ?? p.display_priority ?? Number.MAX_SAFE_INTEGER;
}
