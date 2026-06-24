// Near-miss calibration — establishes the judge's RESOLUTION FLOOR.
//
// For each authored pair (same couple, a BETTER and a WORSE pick), score both under
// the same game-path context and measure: ordered-pair accuracy (does better
// outscore worse?) and the score-gap distribution. The floor is the smallest gap
// that reliably signals a real difference vs the judge's discrimination noise — a
// Step-3 lift only counts as real if its per-couple gap clears the floor.
//
//   1. start the app:  npm run dev
//   2. node eval/judge-nearmiss.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const { pairs } = JSON.parse(readFileSync(new URL("./calibration-nearmiss.json", import.meta.url)));

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
for (const p of pairs) {
  process.stdout.write(`judging ${p.id} (${p.delta}) … `);
  const context = {
    p1cats: p.p1cats, p2cats: p.p2cats, p1mood: p.p1mood, p2mood: p.p2mood,
    p1Yes: p.p1Yes, p1No: p.p1No, p2Yes: p.p2Yes, p2No: p.p2No,
    p1picks: p.p1picks, p2picks: p.p2picks,
  };
  let better, worse;
  try {
    better = await judge(context, p.better);
    worse = await judge(context, p.worse);
  } catch (e) {
    console.log(`ERROR ${e.message}`);
    continue;
  }
  const gap = better - worse;
  const verdict = gap > 0 ? "✓" : gap === 0 ? "= tie" : "✗ inverted";
  console.log(`better ${better} vs worse ${worse} → gap ${gap} ${verdict}`);
  rows.push({ id: p.id, delta: p.delta, better, worse, gap, correct: gap > 0 });
}

const by = (d) => rows.filter((r) => r.delta === d);
const acc = (arr) => (arr.length ? Math.round((100 * arr.filter((r) => r.correct).length) / arr.length) : 0);
const gstat = (arr) => {
  const g = arr.map((r) => r.gap).sort((a, b) => a - b);
  return g.length ? `min ${g[0]} · median ${g[Math.floor(g.length / 2)]} · max ${g[g.length - 1]}` : "—";
};
const clear = by("clear"), subtle = by("subtle");

// Resolution floor (conservative coarse gate). The judge has NO inversions (it never
// scored the worse pick higher) but DOES tie/under-resolve some subtle differences
// (false ties). So a small gap can't be trusted as a real difference, while a large
// gap reliably is. The floor = the smallest gap for an UNAMBIGUOUS (clear) quality
// difference — clear differences separate above it; subtle ones below it defer to
// human blind pairwise (which is why we don't automate the subtle A/B/tie judge yet).
const inversions = rows.filter((r) => r.gap < 0).length;
const falseTies = rows.filter((r) => r.gap === 0).length;
const clearGaps = clear.map((r) => r.gap);
const subtleGaps = subtle.map((r) => r.gap);
const floor = clearGaps.length ? Math.min(...clearGaps) : null;
const subtleMax = subtleGaps.length ? Math.max(...subtleGaps) : 0;

const L = [
  `# Judge near-miss calibration — resolution floor`,
  `_${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${rows.length} same-couple BETTER/WORSE pairs · ordered-pair accuracy + gap distribution_`,
  ``,
  `## Resolution floor: **${floor ?? "—"}** points`,
  `- Clear (unambiguous) quality differences reliably produce gaps ≥ **${floor ?? "—"}**; subtle differences land at ≤ ${subtleMax} with ${falseTies} false tie(s) and **${inversions} inversions**.`,
  `- Coarse Step-3 gate: count a per-couple judge gap as a REAL difference only if it is ≥ ${floor ?? "—"}. Treat smaller gaps as "needs human blind pairwise" — the judge can miss a subtle difference (false tie) but never reverses one.`,
  ``,
  `## Ordered-pair accuracy (does the better pick outscore the worse?)`,
  `- Overall: **${acc(rows)}%** (${rows.filter((r) => r.correct).length}/${rows.length}) · inversions: ${inversions} · false ties: ${falseTies}`,
  `- Clear pairs (good vs mediocre): ${acc(clear)}% (${clear.filter((r) => r.correct).length}/${clear.length})`,
  `- Subtle pairs (good vs slightly-better): ${acc(subtle)}% (${subtle.filter((r) => r.correct).length}/${subtle.length})`,
  ``,
  `## Gap distribution`,
  `- Clear pairs: ${gstat(clear)}`,
  `- Subtle pairs: ${gstat(subtle)}`,
  ``,
  `## Per-pair`,
  `| pair | delta | better | worse | gap | ordered |`,
  `|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.id} | ${r.delta} | ${r.better} | ${r.worse} | ${r.gap} | ${r.correct ? "✓" : r.gap === 0 ? "tie" : "✗"} |`),
  ``,
];
mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
writeFileSync(new URL("./results/judge-nearmiss.md", import.meta.url), L.join("\n"));
console.log(
  `\nResolution floor ${floor} · accuracy overall ${acc(rows)}% (clear ${acc(clear)}% · subtle ${acc(subtle)}%) · clear gaps ${gstat(clear)} · subtle gaps ${gstat(subtle)}`
);
console.log("Wrote eval/results/judge-nearmiss.md");
