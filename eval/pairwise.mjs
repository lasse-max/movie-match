// Blind pairwise A/B harness — the headline "which pick is better" instrument.
//
// Reads two captured eval runs (eval/results/<label>.json, written by run.mjs) and
// emits a report that shows each couple's two winning picks UNLABELED and
// position-randomized (baseline vs variant hidden), with the inputs/trace and a
// slot to mark 1 / 2 / tie. A separate hidden key de-blinds at tally time.
//
//   1. capture two versions (e.g. two git revisions, same frozen pool):
//        node eval/run.mjs verA taste   # on revision A
//        node eval/run.mjs verB taste   # on revision B
//   2. generate the blind report:   node eval/pairwise.mjs verA verB
//   3. score each couple's `choice:` 1 / 2 / tie in the .md (you can't see which
//      engine is which), then tally:  node eval/pairwise.mjs --tally verA verB
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const tally = args[0] === "--tally";
const [labelA, labelB] = tally ? args.slice(1) : args;
if (!labelA || !labelB) {
  console.error("usage: node eval/pairwise.mjs [--tally] <labelA> <labelB>");
  process.exit(1);
}

const url = (name) => new URL(`./results/${name}`, import.meta.url);
const readJson = (label) => JSON.parse(readFileSync(url(`${label}.json`)));
const reportUrl = url(`pairwise-${labelA}-vs-${labelB}.md`);
const keyUrl = url(`pairwise-${labelA}-vs-${labelB}.key.json`);

// Deterministic per-couple coin flip (stable report + key across re-generation).
const flip = (name) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2;
};
const fmtPick = (w) =>
  w ? `${w.title} (${w.year ?? "—"})${w.tags?.length ? ` — [${w.tags.join(" · ")}]` : ""}` : "(no pick)";
const swipeLine = (cards) => {
  const y = (cards || []).filter((c) => c.swipe === "yes").map((c) => c.title);
  const n = (cards || []).filter((c) => c.swipe === "no").map((c) => c.title);
  return `✓ ${y.join(", ") || "—"}  ✗ ${n.join(", ") || "—"}`;
};

if (!tally) {
  const A = readJson(labelA);
  const byName = new Map(readJson(labelB).map((r) => [r.name, r]));
  const key = {};
  const lines = [
    `# Blind pairwise — ${labelA} vs ${labelB}`,
    `_${new Date().toISOString().slice(0, 16).replace("T", " ")} · which pick is better for each couple? The two engines are hidden + position-randomized. Mark \`choice:\` 1 / 2 / tie, then run --tally._`,
    "",
  ];
  let n = 0;
  for (const a of A) {
    const b = byName.get(a.name);
    if (!b) continue;
    n++;
    const swap = flip(a.name) === 1; // swap → Pick 1 comes from version B
    key[a.name] = { 1: swap ? labelB : labelA, 2: swap ? labelA : labelB };
    const t = a.trace ?? {};
    const r2 = t.round2 ?? { 1: [], 2: [] };
    const r3 = t.round3 ?? { 1: { picks: [] }, 2: { picks: [] } };
    lines.push(`### ${n}. ${a.name} — _${a.kind}_`);
    lines.push(`- **P1:** ${a.p1.join(", ")} · **P2:** ${a.p2.join(", ")}`);
    lines.push(`- R2 · P1 ${swipeLine(r2[1])}`);
    lines.push(`- R2 · P2 ${swipeLine(r2[2])}`);
    lines.push(`- R3 picks — P1: ${(r3[1].picks ?? []).join(", ") || "—"} · P2: ${(r3[2].picks ?? []).join(", ") || "—"}`);
    lines.push(`- mood — P1: _${a.moods?.p1?.summary ?? "—"}_ · P2: _${a.moods?.p2?.summary ?? "—"}_`);
    lines.push(`- **Pick 1:** ${fmtPick(swap ? b.winner : a.winner)}`);
    lines.push(`- **Pick 2:** ${fmtPick(swap ? a.winner : b.winner)}`);
    lines.push("- choice: `__`   (1 / 2 / tie)");
    lines.push("");
  }
  mkdirSync(url(""), { recursive: true });
  writeFileSync(reportUrl, lines.join("\n"));
  writeFileSync(keyUrl, JSON.stringify(key, null, 2));
  console.log(`Wrote ${reportUrl.pathname} (${n} couples) + hidden key.`);
} else {
  if (!existsSync(keyUrl)) {
    console.error("no key file — generate the report first");
    process.exit(1);
  }
  const key = JSON.parse(readFileSync(keyUrl));
  const md = readFileSync(reportUrl, "utf8");
  const t = { [labelA]: 0, [labelB]: 0, tie: 0, unscored: 0 };
  for (const blk of md.split(/^### /m).slice(1)) {
    const name = (blk.match(/^\d+\.\s*(.+?)\s*—/) ?? [])[1]?.trim();
    const choice = (blk.match(/choice:\s*`?\s*(1|2|tie)\s*`?/i) ?? [])[1]?.toLowerCase();
    if (!name || !choice) {
      t.unscored++;
      continue;
    }
    if (choice === "tie") t.tie++;
    else if (key[name]) t[key[name][choice]] = (t[key[name][choice]] ?? 0) + 1;
    else t.unscored++;
  }
  const scored = t[labelA] + t[labelB] + t.tie;
  console.log(`Pairwise tally — ${labelA} vs ${labelB}`);
  console.log(`  ${labelA}: ${t[labelA]}   ${labelB}: ${t[labelB]}   tie: ${t.tie}   unscored: ${t.unscored}`);
  if (scored)
    console.log(
      `  win-rate — ${labelA}: ${((100 * t[labelA]) / scored).toFixed(0)}% · ${labelB}: ${((100 * t[labelB]) / scored).toFixed(0)}% · tie: ${((100 * t.tie) / scored).toFixed(0)}%`
    );
}
