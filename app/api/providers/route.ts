import { NextResponse } from "next/server";
import {
  DEFAULT_REGION,
  getRegionWatchProviders,
  providerPriority,
  tmdbImageUrl,
  type TmdbWatchProviderListItem,
} from "@/lib/tmdb";

// Show just the major subscription services people actually have, so setup is a
// quick tap-tap. TMDB's movie-provider list mixes in rent/buy storefronts,
// Amazon/Apple add-on "channels", and free ad-supported apps; none of those are
// the kind of subscription this picker is about. Filter them out by name, then
// fill the slots with a region's mainstream services first, others by priority.
const MAX_PROVIDERS = 10;

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

// Curated, pinned-by-id canonical set per region — ONE checkbox per mainstream
// service. Pinning by provider id (not name) deterministically excludes every
// tier/variant TMDB lists ("Netflix Standard with Ads", "Netflix Kids",
// "Paramount Plus Essential" dup of Premium, "…Free with Ads") and guarantees
// services the raw top-N drops (Max, Apple TV+) are always present.
const PINNED_PROVIDERS: Record<string, { id: number; name: string }[]> = {
  US: [
    { id: 8, name: "Netflix" },
    { id: 9, name: "Amazon Prime Video" },
    { id: 337, name: "Disney+" },
    { id: 15, name: "Hulu" },
    { id: 1899, name: "Max" },
    { id: 531, name: "Paramount+" },
    { id: 386, name: "Peacock" },
    { id: 350, name: "Apple TV+" },
  ],
};

// Streaming services available for movies in a region (setup service picker).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? DEFAULT_REGION;

  try {
    const data = await getRegionWatchProviders(region);

    // Pinned region → exactly the canonical set, with TMDB logos where available.
    const pinned = PINNED_PROVIDERS[region];
    if (pinned) {
      const byId = new Map(data.results.map((p) => [p.provider_id, p]));
      const providers = pinned.map((p) => ({
        id: p.id,
        name: p.name,
        logoUrl: tmdbImageUrl(byId.get(p.id)?.logo_path ?? null),
      }));
      return NextResponse.json({ region, providers });
    }

    // Other regions → top mainstream subscriptions by display_priority.
    const byPriority = (a: TmdbWatchProviderListItem, b: TmdbWatchProviderListItem) =>
      providerPriority(a, region) - providerPriority(b, region);
    const providers = data.results
      .filter((p) => isSubscriptionProvider(p.provider_name))
      .sort(byPriority)
      .slice(0, MAX_PROVIDERS)
      .map((p) => ({ id: p.provider_id, name: p.provider_name, logoUrl: tmdbImageUrl(p.logo_path) }));
    return NextResponse.json({ region, providers });
  } catch (err) {
    console.error("[/api/providers]", err);
    return NextResponse.json(
      { error: "We couldn't load streaming services just now. Please try again." },
      { status: 500 }
    );
  }
}
