// Judge calibration harness — the gate before the judge can be trusted.
//
// Runs the independent LLM-as-judge (/api/eval/judge) over the hand-labeled
// calibration set (eval/calibration.json), which has deliberate quality variance
// (good / mediocre / planted-bad picks), and reports agreement. The judge earns
// trust only if it rates good picks high and the PLANTED BAD picks low — with a
// clean separation. If it can't, fix the judge before using it.
//
//   1. start the app:  npm run dev
//   2. node eval/judge.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const { entries } = JSON.parse(readFileSync(new URL("./calibration.json", import.meta.url)));

// Expected rating bands per hand label.
const inBand = (label, r) =>
  label === "good" ? r >= 70 : label === "bad" ? r < 50 : r >= 45 && r <= 74;

const results = [];
for (const e of entries) {
  process.stdout.write(`judging ${e.id} (${e.label}) … `);
  const context = {
    p1cats: e.p1cats, p2cats: e.p2cats, p1mood: e.p1mood, p2mood: e.p2mood,
    p1Yes: e.p1Yes, p1No: e.p1No, p2Yes: e.p2Yes, p2No: e.p2No,
    p1picks: e.p1picks, p2picks: e.p2picks,
  };
  let r;
  try {
    r = await (
      await fetch(BASE + "/api/eval/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context, pick: e.pick }),
      })
    ).json();
  } catch (err) {
    r = { error: String(err) };
  }
  if (r.error) {
    console.log(`ERROR ${r.error}`);
    results.push({ ...e, rating: null, rationale: r.error, ok: false });
    continue;
  }
  const ok = inBand(e.label, r.rating);
  console.log(`${r.rating} ${ok ? "✓" : `✗ (expected ${e.label})`}`);
  results.push({ ...e, rating: r.rating, rationale: r.rationale, model: r.model, ok });
}

const by = (l) => results.filter((x) => x.label === l && x.rating != null);
const good = by("good"), bad = by("bad");
const agree = results.filter((x) => x.ok).length;
const ratedHigh = good.filter((x) => x.rating >= 70).length;
const ratedLow = bad.filter((x) => x.rating < 50).length;
const minGood = good.length ? Math.min(...good.map((x) => x.rating)) : null;
const maxBad = bad.length ? Math.max(...bad.map((x) => x.rating)) : null;
const gap = minGood != null && maxBad != null ? (minGood > maxBad ? "clean gap ✓" : "OVERLAP ✗") : "—";

const L = [
  `# Judge calibration — ${results[0]?.model ?? "judge"}`,
  `_${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${results.length} hand-labeled picks · bands: good≥70 · mediocre 45–74 · bad<50 · independent of the engine (sonnet-4-6); residual shared-Anthropic bias noted._`,
  ``,
  `## Agreement`,
  `- Overall in-band: **${agree}/${results.length}**`,
  `- Good rated ≥70: **${ratedHigh}/${good.length}**`,
  `- Bad rated <50 (the gate — does the judge CATCH bad picks?): **${ratedLow}/${bad.length}**`,
  `- Separation: lowest good = ${minGood} · highest bad = ${maxBad} → ${gap}`,
  ``,
  `## Per-pick`,
  `| id | label | rating | in-band | rationale |`,
  `|---|---|---|---|---|`,
  ...results.map(
    (x) => `| ${x.id} | ${x.label} | ${x.rating ?? "—"} | ${x.ok ? "✓" : "✗"} | ${(x.rationale ?? "").replace(/\|/g, "/")} |`
  ),
  ``,
];
mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
writeFileSync(new URL("./results/judge-calibration.md", import.meta.url), L.join("\n"));
console.log(
  `\nAgreement ${agree}/${results.length} · good≥70 ${ratedHigh}/${good.length} · bad<50 ${ratedLow}/${bad.length} · ${gap}`
);
console.log("Wrote eval/results/judge-calibration.md");
