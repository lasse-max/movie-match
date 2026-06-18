import { NextResponse } from "next/server";
import { blendTastes } from "@/lib/blend";

// AI call #1: blend both players' Round 1 vibes into themes + a real TMDB
// candidate pool. Body: { p1: string[], p2: string[] } (human-readable vibe labels).
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const p1 = Array.isArray(body?.p1) ? body.p1.map(String) : [];
    const p2 = Array.isArray(body?.p2) ? body.p2.map(String) : [];

    if (p1.length === 0 || p2.length === 0) {
      return NextResponse.json(
        { error: "Both players need at least one vibe." },
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
