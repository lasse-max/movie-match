import { NextResponse } from "next/server";
import { inferMoods, type Categories, type Swipes } from "@/lib/infer";
import { DEFAULT_REGION } from "@/lib/constants";
import type { PoolMovie } from "@/lib/blendTypes";

// AI call #2: infer each player's mood from Round 2 swipes → ranked ~5 Round 3
// recs per player (with region availability attached to the finalists).
// Body: { pool, swipes, categories:{1,2}, region }.
const toIdArray = (x: unknown): number[] =>
  Array.isArray(x) ? x.filter((n): n is number => Number.isInteger(n)) : [];
const toStrArray = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : [];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pool = Array.isArray(body?.pool) ? (body.pool as PoolMovie[]) : [];
    if (pool.length === 0) {
      return NextResponse.json({ error: "Missing candidate pool." }, { status: 400 });
    }

    const swipes: Swipes = {
      1: { yes: toIdArray(body?.swipes?.[1]?.yes), no: toIdArray(body?.swipes?.[1]?.no) },
      2: { yes: toIdArray(body?.swipes?.[2]?.yes), no: toIdArray(body?.swipes?.[2]?.no) },
    };
    const categories: Categories = {
      1: toStrArray(body?.categories?.[1]),
      2: toStrArray(body?.categories?.[2]),
    };
    const region = typeof body?.region === "string" ? body.region : DEFAULT_REGION;

    const result = await inferMoods(pool, swipes, categories, region);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
