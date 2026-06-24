import { NextResponse } from "next/server";
import { blendTastes } from "@/lib/blend";
import { inferMoods, type Categories, type Swipes } from "@/lib/infer";
import { bridge } from "@/lib/bridge";
import { pickMatch, declinedFrom } from "@/lib/overlap";
import { evaluateAvailability } from "@/lib/filter";
import { matchPercent } from "@/lib/matchInsight";
import { categoryGenreId, normalizeCategoryPicks } from "@/lib/categories";
import { isKidsFare } from "@/lib/genres";
import { selectSwipeSamples, type BlendResult, type PoolMovie } from "@/lib/blendTypes";
import { DEFAULT_REGION } from "@/lib/constants";
import type { MatchMovie, PlayerRec } from "@/lib/inferTypes";

// EVAL-ONLY pipeline runner (dev only — 404 in production). Runs one couple's
// Round-1 picks through the REAL matching pipeline (blend → scripted Round-2
// swipes → infer → scripted Round-3 picks → overlap/bridge) and returns the mood
// reads + winner + runner-ups. Two LANES (selected per request via `lane`):
//   • taste (default): all major US services + willing-to-pay, pick every eligible
//     title — max-cooperation best-case taste eval.
//   • thin: constrained services + a selective threshold picker — a realistic
//     session that yields ~1-3 picks and exercises the no-overlap → bridge tail.
const EVAL_REGION = DEFAULT_REGION;
const TASTE_SERVICES = [8, 9, 337, 15, 1899, 531, 386, 350]; // all major US subs
const PICK_THRESHOLD = 90; // thin lane: pick recs whose position-fit % clears this (→ ~1-3)

const anchorOf = (cats: string[]): number[] =>
  cats.map(categoryGenreId).filter((g): g is number => g != null);

// Tone affinities for the MOOD-ONLY categories (no TMDB genre id of their own).
// A mood-only player swipes by TONE — leaning toward genres their mood implies and
// away from clashing ones — instead of raw popularity, which made a cozy viewer
// "like" a horror hit (the "cozy swipes yes on It" artifact, couple #11). Genre ids:
// 28 Action 12 Adventure 16 Animation 35 Comedy 80 Crime 18 Drama 10751 Family
// 14 Fantasy 36 History 27 Horror 10402 Music 9648 Mystery 10749 Romance 878 SciFi
// 53 Thriller 10752 War 37 Western.
const MOOD_TONE: Record<string, { prefer: number[]; avoid: number[] }> = {
  "Feel-good": { prefer: [35, 10751, 10749, 16, 12, 10402, 14], avoid: [27, 53, 80, 10752] },
  Cozy: { prefer: [35, 10751, 10749, 16, 18, 10402], avoid: [27, 53, 28, 80, 10752, 878] },
  Apocalyptic: { prefer: [878, 28, 53, 27, 12], avoid: [35, 10749, 10751, 16, 10402] },
  "Mind-bending": { prefer: [878, 53, 9648, 18], avoid: [35, 10751, 10402, 16] },
  Tearjerker: { prefer: [18, 10749, 10751, 36], avoid: [28, 27, 35, 878] },
  "Dark & gritty": { prefer: [80, 53, 27, 18, 10752, 37], avoid: [35, 10751, 16, 10749] },
};

function moodTone(cats: string[]): { prefer: Set<number>; avoid: Set<number> } {
  const prefer = new Set<number>();
  const avoid = new Set<number>();
  for (const c of cats) {
    const t = MOOD_TONE[c];
    if (!t) continue;
    t.prefer.forEach((g) => prefer.add(g));
    t.avoid.forEach((g) => avoid.add(g));
  }
  return { prefer, avoid };
}

/**
 * Deterministic Round-2 swipe rule (test-data simulation, not the product). A
 * genre-anchored player swipes TOWARD cards whose genre overlaps their Round-1
 * anchor. A mood-only player (no genre anchor) swipes by TONE — net of their mood's
 * preferred vs clashing genres — so a cozy viewer leans toward warm/light titles
 * and away from horror, giving the harness human-realistic divergent behavior
 * rather than a popularity fallback. Fixed so runs are comparable.
 */
function scriptedSwipes(
  samples: { 1: PoolMovie[]; 2: PoolMovie[] },
  cat1: string[],
  cat2: string[]
): Swipes {
  const swipeFor = (cards: PoolMovie[], cats: string[]) => {
    const anchor = new Set(anchorOf(cats));
    const { prefer, avoid } = moodTone(cats);
    const yes: number[] = [];
    const no: number[] = [];
    for (const c of cards) {
      const likes =
        anchor.size > 0
          ? c.genreIds.some((g) => anchor.has(g)) // genre-anchored: confirm the genre
          : c.genreIds.reduce((s, g) => s + (prefer.has(g) ? 1 : 0) - (avoid.has(g) ? 1 : 0), 0) > 0;
      (likes ? yes : no).push(c.id);
    }
    return { yes, no };
  };
  return { 1: swipeFor(samples[1], cat1), 2: swipeFor(samples[2], cat2) };
}

const slim = (m: MatchMovie) => ({
  title: m.title,
  year: m.year,
  genreIds: m.genreIds, // factual genres (for the blind report + the judge); not engine "why"
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
    // Lane: taste (default — all services, pick every eligible title) or thin
    // (constrained services + a selective threshold picker → realistic ~1-3 picks
    // that exercise the no-overlap → bridge tail). Same frozen pool either way.
    const lane = (body?.lane ?? {}) as { services?: number[]; willingToPay?: boolean; picker?: string };
    const services = Array.isArray(lane.services) ? lane.services : TASTE_SERVICES;
    const willingToPay = typeof lane.willingToPay === "boolean" ? lane.willingToPay : true;
    const threshold = lane.picker === "threshold";
    const TARGET = 8; // Round 3 display size (matches the UI)

    const inf = await inferMoods(pool, swipes, categories, EVAL_REGION, services, willingToPay);
    const isEligible = (r: PlayerRec) =>
      evaluateAvailability(r.availability, services, willingToPay).eligible;

    // What each player is SHOWN and PICKS. Taste: every eligible title, pick all.
    // Thin: the top-TARGET eligible (as the UI displays), pick those whose
    // position-fit % clears the bar (naturally ~1-3) — the rest count as declined.
    const shownOf = (recs: PlayerRec[]) =>
      threshold ? recs.filter(isEligible).slice(0, TARGET) : recs.filter(isEligible);
    const pickOf = (recs: PlayerRec[]) => {
      const shown = shownOf(recs);
      if (!threshold) return shown.map((r) => r.id);
      const n = Math.max(shown.length, 1);
      return shown.filter((_, i) => matchPercent(1 - i / n) >= PICK_THRESHOLD).map((r) => r.id);
    };
    const picks1 = pickOf(inf[1].recs);
    const picks2 = pickOf(inf[2].recs);
    const declined = declinedFrom(
      { 1: shownOf(inf[1].recs).map((r) => r.id), 2: shownOf(inf[2].recs).map((r) => r.id) },
      { 1: picks1, 2: picks2 }
    );
    const moodAxes = [...new Set([...inf[1].moodRead.axes, ...inf[2].moodRead.axes])];

    let reason: string;
    let winner: ReturnType<typeof slim> | null = null;
    let runnerUps: ReturnType<typeof slim>[] = [];

    const overlap = pickMatch(inf[1].recs, inf[2].recs, picks1, picks2, {
      services,
      willingToPay,
      declined,
      moodAxes,
    });
    if (overlap) {
      reason = "overlap";
      winner = slim(overlap.movie);
      runnerUps = overlap.alternatives.map(slim);
    } else {
      const outcome = await bridge(
        pool, swipes[1].yes, swipes[2].yes, anchorOf(p1), anchorOf(p2),
        pool.some((m) => isKidsFare(m.genreIds)), EVAL_REGION, services, willingToPay, declined, moodAxes
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
    const round3 = (p: 1 | 2, picks: number[]) => ({
      picks: inf[p].recs.filter((r) => picks.includes(r.id)).map(titleYear),
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
      // Per-player anchor genre IDs (Round 1 categories → TMDB genres). Empty =
      // mood-only pick → not provider-backfillable, so excluded from the eval's ≥5
      // eligibility target (graceful degradation, not a failure).
      anchorGenres: { 1: anchorOf(p1), 2: anchorOf(p2) },
      trace: {
        round2: { 1: round2(1), 2: round2(2) },
        round3: { 1: round3(1, picks1), 2: round3(2, picks2) },
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
