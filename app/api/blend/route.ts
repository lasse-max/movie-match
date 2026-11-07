import { after, NextResponse } from "next/server";
import { blendTastes } from "@/lib/blend";
import { normalizeCategoryPicks } from "@/lib/categories";
import { DEFAULT_REGION } from "@/lib/constants";
import { embeddingsEnabled, warmCatalogue } from "@/lib/retrieve";
import { isSupportedRegion } from "@/lib/validate";

// AI call #1: blend both players' Round 1 vibes into themes + a real TMDB
// candidate pool. Body: { p1: string[], p2: string[], region }. Inputs are
// normalized/allowlisted before the Claude call.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const p1 = normalizeCategoryPicks(body?.p1);
    const p2 = normalizeCategoryPicks(body?.p2);

    if (p1.length === 0 || p2.length === 0) {
      return NextResponse.json(
        { error: "Each player needs 2–3 valid vibes from Round 1." },
        { status: 400 }
      );
    }

    const region = isSupportedRegion(body?.region) ? body.region : DEFAULT_REGION;
    // W1: Round 1 is locked in, so wake the catalogue for Round 3. after() runs it
    // once this response is sent, so it can't delay or break the blend. Flag off,
    // nothing is scheduled.
    if (embeddingsEnabled()) after(warmCatalogue);
    const result = await blendTastes(p1, p2, region);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/blend]", err);
    return NextResponse.json(
      { error: "We couldn't blend your picks just now. Please try again." },
      { status: 500 }
    );
  }
}
