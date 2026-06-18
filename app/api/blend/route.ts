import { NextResponse } from "next/server";
import { blendTastes } from "@/lib/blend";
import { normalizeCategoryPicks } from "@/lib/categories";

// AI call #1: blend both players' Round 1 vibes into themes + a real TMDB
// candidate pool. Body: { p1: string[], p2: string[] } (Round 1 category values).
// Inputs are normalized/allowlisted before the Claude call.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const p1 = normalizeCategoryPicks(body?.p1);
    const p2 = normalizeCategoryPicks(body?.p2);

    if (p1.length === 0 || p2.length === 0) {
      return NextResponse.json(
        { error: "Each player needs 1–3 valid vibes from Round 1." },
        { status: 400 }
      );
    }

    const result = await blendTastes(p1, p2);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
