import { NextResponse } from "next/server";
import { blendTastes } from "@/lib/blend";
import { inferMoods, type Categories, type Swipes } from "@/lib/infer";
import { bridge } from "@/lib/bridge";
import { pickMatch, declinedFrom } from "@/lib/overlap";
import { evaluateAvailability } from "@/lib/filter";
import { categoryGenreId, normalizeCategoryPicks } from "@/lib/categories";
import { isKidsFare } from "@/lib/genres";
import { selectSwipeSamples, type BlendResult, type PoolMovie } from "@/lib/blendTypes";
import { DEFAULT_REGION } from "@/lib/constants";
import type { MatchMovie, PlayerRec } from "@/lib/inferTypes";

// EVAL-ONLY pipeline runner (dev only — 404 in production). Runs one couple's
// Round-1 picks through the REAL matching pipeline (blend → scripted Round-2
// swipes → infer → scripted Round-3 picks → overlap/bridge) and returns the mood
// reads + winner + runner-ups. Inputs are FIXED and the swipe/pick rules are
// deterministic, so versions are comparable. Availability is maxed out (all major
// US services + willing-to-pay) so the eval measures TASTE, not where it streams.

// Max eligibility — the eval is about matching, not availability.
const EVAL_SERVICES = [8, 9, 337, 15, 1899, 531, 386, 350];
const EVAL_REGION = DEFAULT_REGION;
const WILLING_TO_PAY = true;

const anchorOf = (cats: string[]): number[] =>
  cats.map(categoryGenreId).filter((g): g is number => g != null);

/**
 * Deterministic Round-2 swipe rule: a player swipes TOWARD cards that fit their
 * stated taste (a genre that overlaps their Round-1 anchor); a mood-only player
 * (no genre anchor) leans toward the more recognizable half (voteCount). Fixed so
 * runs are comparable.
 */
function scriptedSwipes(
  samples: { 1: PoolMovie[]; 2: PoolMovie[] },
  cat1: string[],
  cat2: string[]
): Swipes {
  const swipeFor = (cards: PoolMovie[], cats: string[]) => {
    const anchor = new Set(anchorOf(cats));
    const medianVotes = [...cards].sort((a, b) => a.voteCount - b.voteCount)[
      Math.floor(cards.length / 2)
    ]?.voteCount ?? 0;
    const yes: number[] = [];
    const no: number[] = [];
    for (const c of cards) {
      const likes =
        anchor.size > 0 ? c.genreIds.some((g) => anchor.has(g)) : c.voteCount >= medianVotes;
      (likes ? yes : no).push(c.id);
    }
    return { yes, no };
  };
  return { 1: swipeFor(samples[1], cat1), 2: swipeFor(samples[2], cat2) };
}

const slim = (m: MatchMovie) => ({
  title: m.title,
  year: m.year,
  tags: m.matchTags,
  percent: m.matchPercent,
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("eval is dev-only", { status: 404 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const p1 = normalizeCategoryPicks(body?.p1);
    const p2 = normalizeCategoryPicks(body?.p2);
    if (p1.length === 0 || p2.length === 0) {
      return NextResponse.json({ error: "each player needs 1–3 valid picks" }, { status: 400 });
    }

    // Frozen-pool A/B: when the harness supplies a previously-captured blend, reuse
    // it (identical TMDB snapshot) so baseline vs enriched differ ONLY by
    // enrichment, never by catalog drift. Otherwise blend fresh and return it for
    // the harness to freeze.
    const frozen = body?.blend as BlendResult | undefined;
    const usingFrozen = Array.isArray(frozen?.pool) && frozen.pool.length > 0;
    const blend: BlendResult = usingFrozen ? frozen! : await blendTastes(p1, p2, EVAL_REGION);
    const pool = blend.pool;
    const samples = selectSwipeSamples(pool);
    const swipes = scriptedSwipes(samples, p1, p2);
    const categories: Categories = { 1: p1, 2: p2 };
    const inf = await inferMoods(pool, swipes, categories, EVAL_REGION, EVAL_SERVICES, WILLING_TO_PAY);

    // Scripted Round 3: each player "picks" every eligible title on their shortlist.
    const isEligible = (r: PlayerRec) =>
      evaluateAvailability(r.availability, EVAL_SERVICES, WILLING_TO_PAY).eligible;
    const eligibleIds = (recs: PlayerRec[]) => recs.filter(isEligible).map((r) => r.id);
    const picks1 = eligibleIds(inf[1].recs);
    const picks2 = eligibleIds(inf[2].recs);
    const moodAxes = [...new Set([...inf[1].moodRead.axes, ...inf[2].moodRead.axes])];

    let reason: string;
    let winner: ReturnType<typeof slim> | null = null;
    let runnerUps: ReturnType<typeof slim>[] = [];

    const overlap = pickMatch(inf[1].recs, inf[2].recs, picks1, picks2, {
      services: EVAL_SERVICES,
      willingToPay: WILLING_TO_PAY,
      declined: [], // the eval picks every eligible title, so nothing eligible is declined
      moodAxes,
    });
    if (overlap) {
      reason = "overlap";
      winner = slim(overlap.movie);
      runnerUps = overlap.alternatives.map(slim);
    } else {
      const declined = declinedFrom(
        { 1: inf[1].recs.map((r) => r.id), 2: inf[2].recs.map((r) => r.id) },
        { 1: picks1, 2: picks2 }
      );
      const outcome = await bridge(
        pool, swipes[1].yes, swipes[2].yes, anchorOf(p1), anchorOf(p2),
        pool.some((m) => isKidsFare(m.genreIds)), EVAL_REGION, EVAL_SERVICES, WILLING_TO_PAY, declined, moodAxes
      );
      reason = `bridge:${outcome.kind}`;
      if (outcome.kind === "match") {
        winner = slim(outcome.movie);
        runnerUps = outcome.alternatives.map(slim);
      }
    }

    // Full per-round signal trace so finalists can be scored against what each
    // couple actually expressed (Round-2 swipes + Round-3 picks), not just Round 1.
    const titleYear = (r: { title: string; year: string | null }) =>
      `${r.title}${r.year ? ` (${r.year})` : ""}`;
    const round2 = (p: 1 | 2) =>
      samples[p].map((c) => ({ title: c.title, year: c.year, swipe: swipes[p].yes.includes(c.id) ? "yes" : "no" }));
    const round3 = (p: 1 | 2) => ({
      picks: inf[p].recs.filter(isEligible).map(titleYear),
      shortlist: inf[p].recs.map((r) => ({ title: r.title, year: r.year, eligible: isEligible(r) })),
    });

    return NextResponse.json({
      p1,
      p2,
      blendMood: blend.moodRead,
      p1Mood: inf[1].moodRead,
      p2Mood: inf[2].moodRead,
      reason,
      winner,
      runnerUps,
      altCount: runnerUps.length,
      trace: {
        round2: { 1: round2(1), 2: round2(2) },
        round3: { 1: round3(1), 2: round3(2) },
        resolution: reason,
      },
      // Only when freshly blended — the harness captures this to freeze the snapshot.
      blend: usingFrozen ? null : blend,
    });
  } catch (err) {
    console.error("[/api/eval]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "eval error" }, { status: 500 });
  }
}
