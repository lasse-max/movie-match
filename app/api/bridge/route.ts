import { NextResponse } from "next/server";
import { bridge } from "@/lib/bridge";
import { categoryGenreId } from "@/lib/categories";
import type { MatchMovie } from "@/lib/inferTypes";
import type { PoolMovie } from "@/lib/blendTypes";

// Zero-overlap tiebreak: bridge to a film fitting both players' moods.
// Body: { pool, positives1, positives2, categories:{1,2}, allowKidsFare, fallback }.
const toIdArray = (x: unknown): number[] =>
  Array.isArray(x) ? x.filter((n): n is number => Number.isInteger(n)) : [];
const anchorOf = (cats: unknown): number[] =>
  (Array.isArray(cats) ? cats : [])
    .map((c) => (typeof c === "string" ? categoryGenreId(c) : null))
    .filter((g): g is number => g != null);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pool = Array.isArray(body?.pool) ? (body.pool as PoolMovie[]) : [];
    const positives1 = toIdArray(body?.positives1);
    const positives2 = toIdArray(body?.positives2);
    const anchor1 = anchorOf(body?.categories?.[1]);
    const anchor2 = anchorOf(body?.categories?.[2]);
    const allowKidsFare = body?.allowKidsFare === true;
    const fallback = (body?.fallback ?? null) as MatchMovie | null;

    const movie = await bridge(
      pool,
      positives1,
      positives2,
      anchor1,
      anchor2,
      allowKidsFare,
      fallback
    );
    if (!movie) {
      return NextResponse.json({ error: "Couldn't find a bridge pick." }, { status: 404 });
    }
    return NextResponse.json({ movie, reason: "bridge" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
