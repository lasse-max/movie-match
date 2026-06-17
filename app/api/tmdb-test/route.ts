import { NextResponse } from "next/server";
import {
  DEFAULT_REGION,
  getMovie,
  getWatchProvidersForRegion,
  type TmdbProvider,
} from "@/lib/tmdb";

// Step-1 diagnostic route: confirms end-to-end that TMDB watch/providers data
// exists for our region (the data the subscription filter will depend on).
// Temporary — removed once the real game flow is wired up.
//
// Try: /api/tmdb-test            (defaults to Inception, region US)
//      /api/tmdb-test?id=603     (The Matrix)
//      /api/tmdb-test?region=GB

const names = (list?: TmdbProvider[]) => (list ?? []).map((p) => p.provider_name);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id") ?? 27205); // 27205 = Inception
  const region = searchParams.get("region") ?? DEFAULT_REGION;

  try {
    const [movie, providers] = await Promise.all([
      getMovie(id),
      getWatchProvidersForRegion(id, region),
    ]);

    return NextResponse.json({
      ok: true,
      region,
      movie: { id: movie.id, title: movie.title, year: movie.release_date?.slice(0, 4) },
      hasAvailability: providers !== null,
      providers: providers
        ? {
            stream: names(providers.flatrate), // subscription / "included with"
            rent: names(providers.rent),
            buy: names(providers.buy),
            justWatchLink: providers.link,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
