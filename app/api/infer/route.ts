import { NextResponse } from "next/server";
import { inferMoods, type Categories, type Swipes } from "@/lib/infer";
import { DEFAULT_REGION } from "@/lib/constants";
import { sanitizePool, idsIn, boundedIds, isSupportedRegion } from "@/lib/validate";

// AI call #2: infer each player's mood from Round 2 swipes → ranked ~5 Round 3
// recs per player (with region availability attached to the finalists, biased
// eligible-first for the couple's services). Body: { pool, swipes, categories,
// region, services, willingToPay }.
const toStrArray = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === "string").slice(0, 5) : [];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pool = sanitizePool(body?.pool);
    if (pool.length === 0) {
      return NextResponse.json({ error: "Missing or invalid candidate pool." }, { status: 400 });
    }
    const poolIds = new Set(pool.map((m) => m.id));

    // Swipe ids must reference the submitted pool (Round 2 cards came from it).
    const swipes: Swipes = {
      1: { yes: idsIn(body?.swipes?.[1]?.yes, poolIds), no: idsIn(body?.swipes?.[1]?.no, poolIds) },
      2: { yes: idsIn(body?.swipes?.[2]?.yes, poolIds), no: idsIn(body?.swipes?.[2]?.no, poolIds) },
    };
    const categories: Categories = {
      1: toStrArray(body?.categories?.[1]),
      2: toStrArray(body?.categories?.[2]),
    };
    const region = isSupportedRegion(body?.region) ? body.region : DEFAULT_REGION;
    const services = boundedIds(body?.services, 20);
    const willingToPay = body?.willingToPay === true;

    const result = await inferMoods(pool, swipes, categories, region, services, willingToPay);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/infer]", err);
    return NextResponse.json(
      { error: "We couldn't read the room just now. Please try again." },
      { status: 500 }
    );
  }
}
