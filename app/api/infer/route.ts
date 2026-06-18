import { NextResponse } from "next/server";
import { inferMoods, type Categories, type Swipes } from "@/lib/infer";
import type { PoolMovie } from "@/lib/blendTypes";

// AI call #2: infer each player's mood from Round 2 swipes → ranked ~5 Round 3
// recs per player. Body: { pool, swipes: {1:{yes,no},2:{yes,no}}, categories:{1,2} }.
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

    const result = await inferMoods(pool, swipes, categories);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
