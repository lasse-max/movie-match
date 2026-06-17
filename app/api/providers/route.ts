import { NextResponse } from "next/server";
import {
  DEFAULT_REGION,
  getRegionWatchProviders,
  providerPriority,
  tmdbImageUrl,
} from "@/lib/tmdb";

// The most prominent providers people actually subscribe to surface first;
// cap the list so setup stays a quick tap-tap rather than an endless scroll.
const MAX_PROVIDERS = 24;

// Streaming services available for movies in a region (setup service picker).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? DEFAULT_REGION;

  try {
    const data = await getRegionWatchProviders(region);
    const providers = [...data.results]
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
