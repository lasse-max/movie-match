import { NextResponse } from "next/server";
import { bridge } from "@/lib/bridge";
import { categoryGenreId } from "@/lib/categories";
import { DEFAULT_REGION } from "@/lib/constants";
import { sanitizePool, idsIn, boundedIds, isSupportedRegion } from "@/lib/validate";

// Zero-overlap tiebreak: bridge to a WATCHABLE film fitting both players' moods,
// excluding anything they declined in Round 3. Body: { pool, positives1,
// positives2, categories, allowKidsFare, region, services, willingToPay,
// declinedIds }. Responds { kind: "match", movie, reason } | { kind:
// "needs-rentals" } | { kind: "none" } — never an unavailable match.
const anchorOf = (cats: unknown): number[] =>
  (Array.isArray(cats) ? cats : [])
    .map((c) => (typeof c === "string" ? categoryGenreId(c) : null))
    .filter((g): g is number => g != null);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pool = sanitizePool(body?.pool);
    const poolIds = new Set(pool.map((m) => m.id));
    const positives1 = idsIn(body?.positives1, poolIds);
    const positives2 = idsIn(body?.positives2, poolIds);
    const anchor1 = anchorOf(body?.categories?.[1]);
    const anchor2 = anchorOf(body?.categories?.[2]);
    const allowKidsFare = body?.allowKidsFare === true;
    const region = isSupportedRegion(body?.region) ? body.region : DEFAULT_REGION;
    const services = boundedIds(body?.services, 20);
    const willingToPay = body?.willingToPay === true;
    // Round 3 rejections — may include fresh recs that weren't in the pool, so
    // these are bounded integers, not pool-constrained.
    const declinedIds = boundedIds(body?.declinedIds);

    const outcome = await bridge(
      pool,
      positives1,
      positives2,
      anchor1,
      anchor2,
      allowKidsFare,
      region,
      services,
      willingToPay,
      declinedIds
    );

    if (outcome.kind === "match") {
      return NextResponse.json({ kind: "match", movie: outcome.movie, reason: "bridge" });
    }
    return NextResponse.json({ kind: outcome.kind }); // "needs-rentals" | "none"
  } catch (err) {
    console.error("[/api/bridge]", err);
    return NextResponse.json(
      { error: "We couldn't settle the tiebreak just now. Please try again." },
      { status: 500 }
    );
  }
}
