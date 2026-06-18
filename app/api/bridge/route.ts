import { NextResponse } from "next/server";
import { bridge } from "@/lib/bridge";
import type { MatchMovie } from "@/lib/inferTypes";

// Zero-overlap tiebreak: surface a bridge film from both players' R2 positives.
// Body: { positives1, positives2, allowKidsFare, fallback }.
const toIdArray = (x: unknown): number[] =>
  Array.isArray(x) ? x.filter((n): n is number => Number.isInteger(n)) : [];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const positives1 = toIdArray(body?.positives1);
    const positives2 = toIdArray(body?.positives2);
    const allowKidsFare = body?.allowKidsFare === true;
    const fallback = (body?.fallback ?? null) as MatchMovie | null;

    const movie = await bridge(positives1, positives2, allowKidsFare, fallback);
    if (!movie) {
      return NextResponse.json({ error: "Couldn't find a bridge pick." }, { status: 404 });
    }
    return NextResponse.json({ movie, reason: "bridge" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
