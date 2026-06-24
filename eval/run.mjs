// Eval harness: run the frozen couples through the real matching pipeline
// (dev-only /api/eval) and write a scoreable markdown report per version.
//
//   1. start the app:   npm run dev
//   2. run a lane:       node eval/run.mjs <label> [lane] [limit]
//        taste lane (default): all services, pick every eligible title — best-case.
//        thin lane: 1 service + a selective picker — realistic ~1-3 picks, bridges.
//        e.g.  node eval/run.mjs baseline              (taste, all couples)
//              node eval/run.mjs thin-baseline thin    (thin lane)
//              node eval/run.mjs baseline taste 3      (taste, first 3 — smoke)
//   3. score each couple ✓ / ~ / ✗ in eval/results/<label>.md, then compare.
//
// Frozen pool: each couple's blend is captured to eval/fixtures/blends.json on
// first run and reused thereafter (BOTH lanes), so the candidates are an IDENTICAL
// TMDB snapshot — versions/lanes differ only by enrichment + services/picker. To
// take a fresh snapshot, delete eval/fixtures/blends.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const LANES = {
  taste: undefined, // route defaults: all services, pick every eligible title
  thin: { services: [8], willingToPay: false, picker: "threshold" }, // 1 service, selective
};
const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const label = process.argv[2] ?? "baseline";
const { couples } = JSON.parse(readFileSync(new URL("./couples.json", import.meta.url)));
// argv[3] is the lane (non-numeric) or the limit (numeric); argv[4] is the limit.
const a3 = process.argv[3];
const laneName = a3 && Number.isNaN(Number(a3)) ? a3 : "taste";
const laneCfg = LANES[laneName] ?? undefined;
const limit = Number(a3 && !Number.isNaN(Number(a3)) ? a3 : process.argv[4]) || couples.length;
const run = couples.slice(0, limit);

const fixtureUrl = new URL("./fixtures/blends.json", import.meta.url);
const frozen = existsSync(fixtureUrl) ? JSON.parse(readFileSync(fixtureUrl)) : {};
let frozenDirty = false;
const keyOf = (c) => `${c.p1.join(",")}__${c.p2.join(",")}`;

// Genres with a deep mainstream catalog on a single big service (the provider
// backfill should reliably fill these to ≥5); the rest may degrade gracefully.
const MAINSTREAM = new Set(["Action", "Comedy", "Thriller", "Drama", "Crime", "Horror", "Romance", "Sci-Fi", "Feel-good"]);
const isMainstream = (cats) => cats.some((c) => MAINSTREAM.has(c));
const eligOf = (sl) => (sl ?? []).filter((s) => s.eligible).length;
const ELIG_TARGET = 5; // the thin-lane floor a 1-service mainstream player should clear
const players = []; // thin-lane per-player eligibility data points

const fmt = (m) => (m ? `**${m.title}** (${m.year ?? "—"}) — ${m.percent}% · [${m.tags.join(" · ")}]` : "(no match)");
const lines = [
  `# Eval results — ${label} _(${laneName} lane)_`,
  `_${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${run.length} couples · ${laneName === "thin" ? "score: 2–3 inline if available, fewer gracefully if not" : "score each ✓ / ~ / ✗ (do the winner + runner-ups fit BOTH players?)"}_`,
  "",
];

for (let i = 0; i < run.length; i++) {
  const c = run[i];
  process.stdout.write(`[${i + 1}/${run.length}] ${c.name} … `);
  const key = keyOf(c);
  const body = { p1: c.p1, p2: c.p2 };
  if (frozen[key]) body.blend = frozen[key]; // reuse the frozen snapshot
  if (laneCfg) body.lane = laneCfg; // thin lane: constrained services + selective picker
  let r;
  try {
    r = await (
      await fetch(BASE + "/api/eval", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json();
  } catch (e) {
    r = { error: String(e) };
  }
  if (r.blend && !frozen[key]) {
    frozen[key] = r.blend; // capture a fresh blend so future runs match this snapshot
    frozenDirty = true;
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
  // Per-player eligible-title counts — the metric the provider backfill targets.
  const e1 = eligOf(r3[1].shortlist), t1 = (r3[1].shortlist ?? []).length;
  const e2 = eligOf(r3[2].shortlist), t2 = (r3[2].shortlist ?? []).length;
  const flag = (e, cats) => (isMainstream(cats) ? (e >= ELIG_TARGET ? " ✓" : " ✗") : e >= ELIG_TARGET ? " ✓" : " ~");
  lines.push(`- R3 · eligible — P1: **${e1}**/${t1}${flag(e1, c.p1)} · P2: **${e2}**/${t2}${flag(e2, c.p2)}`);
  if (laneName === "thin") {
    players.push({ e: e1, mainstream: isMainstream(c.p1) }, { e: e2, mainstream: isMainstream(c.p2) });
  }
  lines.push(`- **${r.reason}** → ${fmt(r.winner)}  ·  _${altCount} alternative${altCount === 1 ? "" : "s"}_`);
  for (const a of r.runnerUps) lines.push(`    - ${fmt(a)}`);
  lines.push("- **score:** `__`  (✓ / ~ / ✗)");
  lines.push("");
}

// Thin-lane eligibility summary — assert mainstream genres reach ≥5 per player,
// niche may degrade gracefully (the provider backfill's before/after metric).
if (laneName === "thin" && players.length) {
  const ms = players.filter((p) => p.mainstream);
  const ni = players.filter((p) => !p.mainstream);
  const ge = (arr) => arr.filter((p) => p.e >= ELIG_TARGET).length;
  const median = (arr) => {
    const v = arr.map((p) => p.e).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  };
  const summary = [
    `## Thin-lane eligibility (1 service, ≥${ELIG_TARGET} target)`,
    `- Mainstream-genre players ≥${ELIG_TARGET}: **${ge(ms)}/${ms.length}** · median ${median(ms)} · min ${Math.min(...ms.map((p) => p.e))}`,
    `- Niche-genre players ≥${ELIG_TARGET}: ${ge(ni)}/${ni.length} · median ${median(ni)} (graceful degradation expected)`,
    `- All players ≥${ELIG_TARGET}: ${ge(players)}/${players.length} · overall median ${median(players)}`,
    "",
  ];
  lines.splice(3, 0, ...summary);
  console.log(`\nThin eligibility — mainstream ≥${ELIG_TARGET}: ${ge(ms)}/${ms.length} · all: ${ge(players)}/${players.length}`);
}

if (frozenDirty) {
  mkdirSync(new URL("./fixtures/", import.meta.url), { recursive: true });
  writeFileSync(fixtureUrl, JSON.stringify(frozen));
  console.log(`Froze ${Object.keys(frozen).length} couple pools → fixtures/blends.json`);
}

mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const out = new URL(`./results/${label}.md`, import.meta.url);
writeFileSync(out, lines.join("\n"));
console.log(`\nWrote ${out.pathname}`);
