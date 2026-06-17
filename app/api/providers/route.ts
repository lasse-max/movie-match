import { NextResponse } from "next/server";
import {
  DEFAULT_REGION,
  getRegionWatchProviders,
  providerPriority,
  tmdbImageUrl,
} from "@/lib/tmdb";

// Show just the major subscription services people actually have, so setup is a
// quick tap-tap. TMDB's movie-provider list mixes in rent/buy storefronts,
// Amazon/Apple add-on "channels", and free ad-supported apps; none of those are
// the kind of subscription this picker is about. Filter them out by name, then
// keep the top few by the region's display_priority.
const MAX_PROVIDERS = 8;

// Name fragments (lowercased) that mark a NON-subscription entry: rent/buy
// stores, add-on channels, and well-known free ad-supported services.
const NON_SUBSCRIPTION = [
  "amazon channel",
  "apple tv channel",
  "store", // Apple TV Store, Microsoft Store, Sky Store, PlayStation Store…
  "amazon video",
  "google play",
  "rakuten",
  "justwatch",
  "fandango",
  "vudu",
  "spectrum",
  "cineplex",
  "telstra",
  "fetch tv",
  "microsoft",
  "verizon",
  "directv",
  "tubi",
  "pluto",
  "roku",
  "freevee",
  "plex",
  "crackle",
  "hoopla",
  "kanopy",
];

function isSubscriptionProvider(name: string): boolean {
  const n = name.toLowerCase();
  if (n === "youtube") return false; // rent/buy, but keep "YouTube Premium"
  return !NON_SUBSCRIPTION.some((fragment) => n.includes(fragment));
}

// Streaming services available for movies in a region (setup service picker).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? DEFAULT_REGION;

  try {
    const data = await getRegionWatchProviders(region);
    const providers = data.results
      .filter((p) => isSubscriptionProvider(p.provider_name))
      .sort((a, b) => providerPriority(a, region) - providerPriority(b, region))
      .slice(0, MAX_PROVIDERS)
      .map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logoUrl: tmdbImageUrl(p.logo_path),
      }));
    return NextResponse.json({ region, providers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
