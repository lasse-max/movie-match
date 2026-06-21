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

// Mainstream services that must always be selectable in a region, even if they
// fall outside the raw top-N by display_priority (US top-8 can drop Max/Peacock).
// Matched by name so it's robust to provider-id drift. Extend per region as needed.
const REGION_MAINSTREAM: Record<string, (name: string) => boolean> = {
  US: (name) => {
    const n = name.toLowerCase().trim();
    if (n === "max" || n === "hbo max") return true; // exact — don't match "Cinemax"
    return [
      "netflix",
      "amazon prime video",
      "disney plus",
      "hulu",
      "paramount plus",
      "peacock",
      "apple tv plus",
    ].some((fragment) => n.includes(fragment));
  },
};

// Streaming services available for movies in a region (setup service picker).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? DEFAULT_REGION;

  try {
    const data = await getRegionWatchProviders(region);
    const subs = data.results.filter((p) => isSubscriptionProvider(p.provider_name));

    // Always include the region's mainstream services, then fill the remaining
    // slots with the most prominent others by display_priority.
    const isMainstream = REGION_MAINSTREAM[region];
    const byPriority = (a: TmdbWatchProviderListItem, b: TmdbWatchProviderListItem) =>
      providerPriority(a, region) - providerPriority(b, region);
    const forced = isMainstream
      ? subs.filter((p) => isMainstream(p.provider_name)).sort(byPriority)
      : [];
    const forcedIds = new Set(forced.map((p) => p.provider_id));
    const rest = subs.filter((p) => !forcedIds.has(p.provider_id)).sort(byPriority);

    const providers = [...forced, ...rest].slice(0, MAX_PROVIDERS).map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logoUrl: tmdbImageUrl(p.logo_path),
    }));
    return NextResponse.json({ region, providers });
  } catch (err) {
    console.error("[/api/providers]", err);
    return NextResponse.json(
      { error: "We couldn't load streaming services just now. Please try again." },
      { status: 500 }
    );
  }
}
