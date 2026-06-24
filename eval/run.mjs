// Eval harness: run the frozen couples through the real matching pipeline
// (dev-only /api/eval) and write a scoreable markdown report per version.
//
//   1. start the app:   npm run dev
//   2. run a version:    node eval/run.mjs <label> [limit]
//        e.g.  node eval/run.mjs baseline        (all couples)
//              node eval/run.mjs enriched 3      (first 3, smoke test)
//   3. score each couple ✓ / ~ / ✗ in eval/results/<label>.md, then compare versions.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const label = process.argv[2] ?? "baseline";
const { couples } = JSON.parse(readFileSync(new URL("./couples.json", import.meta.url)));
const limit = process.argv[3] ? Number(process.argv[3]) : couples.length;
const run = couples.slice(0, limit);

const fmt = (m) => (m ? `**${m.title}** (${m.year ?? "—"}) — ${m.percent}% · [${m.tags.join(" · ")}]` : "(no match)");
const lines = [
  `# Eval results — ${label}`,
  `_${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${run.length} couples · score each ✓ / ~ / ✗ (do the winner + runner-ups fit BOTH players?)_`,
  "",
];

for (let i = 0; i < run.length; i++) {
  const c = run[i];
  process.stdout.write(`[${i + 1}/${run.length}] ${c.name} … `);
  let r;
  try {
    r = await (
      await fetch(BASE + "/api/eval", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ p1: c.p1, p2: c.p2 }),
      })
    ).json();
  } catch (e) {
    r = { error: String(e) };
  }

  lines.push(`### ${i + 1}. ${c.name}  _(${c.kind})_`);
  lines.push(`- **P1:** ${c.p1.join(", ")}  ·  **P2:** ${c.p2.join(", ")}`);
  if (r.error) {
    console.log(`ERROR: ${r.error}`);
    lines.push(`- ⚠️ ERROR: ${r.error}`, "");
    continue;
  }
  const altCount = r.altCount ?? r.runnerUps?.length ?? 0;
  console.log(`${r.reason} · ${altCount} alt`);
  lines.push(`- couple mood: _${r.blendMood.summary}_`);
  lines.push(`- P1 mood: _${r.p1Mood.summary}_  ·  P2 mood: _${r.p2Mood.summary}_`);
  // Per-round signal trace: what each couple actually expressed.
  const r2 = r.trace?.round2 ?? { 1: [], 2: [] };
  const r3 = r.trace?.round3 ?? { 1: { picks: [] }, 2: { picks: [] } };
  const r2line = (cards) => {
    const yes = cards.filter((c) => c.swipe === "yes").map((c) => c.title);
    const no = cards.filter((c) => c.swipe === "no").map((c) => c.title);
    return `✓ ${yes.join(", ") || "—"}  ✗ ${no.join(", ") || "—"}`;
  };
  lines.push(`- R2 · P1 ${r2line(r2[1])}`);
  lines.push(`- R2 · P2 ${r2line(r2[2])}`);
  lines.push(
    `- R3 · P1 picks: ${(r3[1].picks ?? []).join(", ") || "—"} · P2 picks: ${(r3[2].picks ?? []).join(", ") || "—"}`
  );
  lines.push(`- **${r.reason}** → ${fmt(r.winner)}  ·  _${altCount} alternative${altCount === 1 ? "" : "s"}_`);
  for (const a of r.runnerUps) lines.push(`    - ${fmt(a)}`);
  lines.push("- **score:** `__`  (✓ / ~ / ✗)");
  lines.push("");
}

mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const out = new URL(`./results/${label}.md`, import.meta.url);
writeFileSync(out, lines.join("\n"));
console.log(`\nWrote ${out.pathname}`);
