import { NextResponse } from "next/server";
import { getWatchProviderRegions } from "@/lib/tmdb";

// Lists the countries TMDB has watch-provider data for (setup region picker).
export async function GET() {
  try {
    const data = await getWatchProviderRegions();
    const regions = data.results
      .map((r) => ({ code: r.iso_3166_1, name: r.english_name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ regions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
