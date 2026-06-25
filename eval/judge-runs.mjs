// Scalar judge over captured runs — the coarse gate for the Step-3 A/B.
//
// Runs the calibrated judge (/api/eval/judge) over two captured eval runs
// (eval/results/<label>.json from run.mjs) and emits a per-couple fit score for
// each version's winner, built from that run's own game path. A version "wins" a
// couple only if its score beats the other by at least the RESOLUTION FLOOR (from
// judge-nearmiss.mjs) — gaps below the floor are noise, not a real difference.
//
//   node eval/judge-runs.mjs <baseline-label> <variant-label> [floor]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const [labelA, labelB, floorArg] = process.argv.slice(2);
if (!labelA || !labelB) {
  console.error("usage: node eval/judge-runs.mjs <labelA> <labelB> [floor]");
  process.exit(1);
}
// Calibrated from eval/judge-nearmiss.mjs — do NOT silently fall back to anything else.
const CALIBRATED_FLOOR = 18; // min clear-pair gap (the judge's resolution floor)
const WOBBLE = 6; // judge run-to-run wobble observed in near-miss; confirm = floor + wobble
let FLOOR = CALIBRATED_FLOOR;
if (floorArg !== undefined) {
  const f = Number(floorArg);
  if (!Number.isFinite(f) || f <= 0) {
    console.error(`invalid floor "${floorArg}" — must be a positive number`);
    process.exit(1);
  }
  FLOOR = f;
}
const CONFIRM = FLOOR + WOBBLE; // judge-confirmed win threshold; [FLOOR, CONFIRM) is "too close to call"
console.log(
  `Floor: ${FLOOR}${FLOOR === CALIBRATED_FLOOR ? " (calibrated)" : " (override)"} · confirmed win ≥ ${CONFIRM} · too-close [${FLOOR}, ${CONFIRM}) → human pairwise\n`
);
const rd = (l) => JSON.parse(readFileSync(new URL(`./results/${l}.json`, import.meta.url)));
const A = rd(labelA);
const B = new Map(rd(labelB).map((r) => [r.name, r]));

// Rebuild the judge's game-path context from a captured run.
const ctxOf = (rec) => {
  const r2 = rec.trace?.round2 ?? { 1: [], 2: [] };
  const r3 = rec.trace?.round3 ?? { 1: { picks: [] }, 2: { picks: [] } };
  const swiped = (p, dir) => (r2[p] ?? []).filter((c) => c.swipe === dir).map((c) => c.title);
  return {
    p1cats: rec.p1, p2cats: rec.p2,
    p1mood: rec.moods?.p1?.summary, p2mood: rec.moods?.p2?.summary,
    p1Yes: swiped(1, "yes"), p1No: swiped(1, "no"),
    p2Yes: swiped(2, "yes"), p2No: swiped(2, "no"),
    p1picks: r3[1].picks ?? [], p2picks: r3[2].picks ?? [],
  };
};
const judge = async (context, pick) => {
  const r = await (
    await fetch(BASE + "/api/eval/judge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ context, pick }),
    })
  ).json();
  if (r.error) throw new Error(r.error);
  return r.rating;
};

const rows = [];
for (const a of A) {
  const b = B.get(a.name);
  if (!b) continue;
  if (!a.winner || !b.winner) {
    rows.push({ name: a.name, sa: null, sb: null });
    continue;
  }
  process.stdout.write(`${a.name} … `);
  let sa, sb;
  try {
    sa = await judge(ctxOf(a), a.winner);
    sb = await judge(ctxOf(b), b.winner);
  } catch (e) {
    console.log(`ERROR ${e.message}`);
    continue;
  }
  const gap = sb - sa;
  // A win is judge-CONFIRMED only past floor + wobble; the [floor, confirm) band is
  // too close to call (route to human pairwise); below floor is within-noise tie.
  const verdict =
    gap >= CONFIRM ? labelB : gap <= -CONFIRM ? labelA : Math.abs(gap) >= FLOOR ? "too-close" : "tie";
  console.log(`${a.winner.title} ${sa}  vs  ${b.winner.title} ${sb}  → ${gap > 0 ? "+" : ""}${gap} (${verdict})`);
  rows.push({ name: a.name, wa: a.winner.title, wb: b.winner.title, sa, sb, gap, verdict });
}

const scored = rows.filter((r) => r.sa != null && r.sb != null);
const mean = (k) => (scored.length ? Math.round((10 * scored.reduce((s, r) => s + r[k], 0)) / scored.length) / 10 : 0);
const winsA = scored.filter((r) => r.verdict === labelA).length;
const winsB = scored.filter((r) => r.verdict === labelB).length;
const tooClose = scored.filter((r) => r.verdict === "too-close").length;
const ties = scored.filter((r) => r.verdict === "tie").length;
const net = winsB - winsA;

const L = [
  `# Judge run-scoring — ${labelA} vs ${labelB}`,
  `_${new Date().toISOString().slice(0, 16).replace("T", " ")} · per-couple fit score from the calibrated judge_`,
  ``,
  `## Coarse A/B gate`,
  `- Floor **${FLOOR}**${FLOOR === CALIBRATED_FLOOR ? " (calibrated)" : " (override)"} · judge-confirmed win at gap ≥ **${CONFIRM}** (floor + ~${WOBBLE} wobble) · [${FLOOR}, ${CONFIRM}) = too close to call`,
  `- Mean fit — ${labelA}: **${mean("sa")}** · ${labelB}: **${mean("sb")}**`,
  `- Judge-confirmed wins (gap ≥ ${CONFIRM}) — ${labelB}: ${winsB} · ${labelA}: ${winsA}`,
  `- **Too close to call** ([${FLOOR}, ${CONFIRM}) gap) → **human blind pairwise**: ${tooClose}`,
  `- Within-noise ties (< ${FLOOR}): ${ties}`,
  `- **Net judge-confirmed lift (${labelB} − ${labelA}): ${net > 0 ? "+" : ""}${net}** couples${tooClose ? ` (+ ${tooClose} too-close → human pairwise, not counted)` : ""}.`,
  ``,
  `## Per-couple`,
  `| couple | ${labelA} winner | fit | ${labelB} winner | fit | gap | verdict |`,
  `|---|---|---|---|---|---|---|`,
  ...rows.map((r) =>
    r.sa == null
      ? `| ${r.name} | — | — | — | — | — | (no winner) |`
      : `| ${r.name} | ${r.wa} | ${r.sa} | ${r.wb} | ${r.sb} | ${r.gap > 0 ? "+" : ""}${r.gap} | ${r.verdict} |`
  ),
  ``,
];
mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
writeFileSync(new URL(`./results/judge-runs-${labelA}-vs-${labelB}.md`, import.meta.url), L.join("\n"));
console.log(
  `\nMean fit ${labelA} ${mean("sa")} · ${labelB} ${mean("sb")} · confirmed (≥${CONFIRM}) ${labelB} ${winsB} / ${labelA} ${winsA} · too-close ${tooClose} → human · tie ${ties} · net ${net > 0 ? "+" : ""}${net}`
);
console.log(`Wrote eval/results/judge-runs-${labelA}-vs-${labelB}.md`);
