// E4 gate run: embeddings off vs on, on the 17 valid couples, judged by the
// calibrated scalar judge. Bars and definitions are pre-registered in
// eval/e4-prereg.md (committed before this ran). Nothing here tunes the engine.
//
//   1. start the app:  npm run dev        (the eval routes are dev-only)
//   2. node eval/e4-gate.mjs              → eval/results/e4-gate.md (+ .json)
//      node eval/e4-gate.mjs --smoke      plumbing check on the excluded couple only
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const SMOKE = process.argv.includes("--smoke");

// The June baseline excluded #11 as an invalid test couple (PM Projects/Layline_Eval_Evidence.md).
const EXCLUDED = "Cozy vs apocalyptic";
const FLOOR = 18; // the judge's calibrated resolution floor (eval/judge-nearmiss.mjs)
const CONFIRM = FLOOR + 6; // floor + observed wobble, as in eval/judge-runs.mjs
const FITS_BOTH = 70; // the calibrated "good" band (eval/judge.mjs)
const PRICE = { input: 3 / 1e6, output: 15 / 1e6 }; // claude-sonnet-4-6, $ per token
const ATTEMPTS = 3;

const { couples } = JSON.parse(readFileSync(new URL("./couples.json", import.meta.url)));
const frozen = JSON.parse(readFileSync(new URL("./fixtures/blends.json", import.meta.url)));
const keyOf = (c) => `${c.p1.join(",")}__${c.p2.join(",")}`;
const valid = couples.filter((c) => c.name !== EXCLUDED);
const warmup = couples.find((c) => c.name === EXCLUDED);

const post = async (path, body) => (await fetch(BASE + path, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})).json();

// Catalogue fallbacks caused by the database round trip from this machine, not by
// the engine's design (prereg amendment). "empty" is by design and is kept.
const INFRA_FALLBACK = new Set(["timeout", "error", "config"]);

/** One arm of one couple. Retried only for infrastructure failures (prereg). */
async function runArm(c, embeddings, attempts = ATTEMPTS) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let r;
    try {
      r = await post("/api/eval", { p1: c.p1, p2: c.p2, blend: frozen[keyOf(c)], embeddings });
    } catch (e) {
      r = { error: String(e) };
    }
    const claude = r?.e4?.claude;
    const reason = r?.e4?.retrieval?.reason;
    const problem = r.error
      ? `HTTP: ${r.error}`
      : r.embeddings !== embeddings
        ? `arm mismatch (asked ${embeddings}, ran ${r.embeddings})`
        : !claude || claude.calls !== 1 || claude.stopReasons[0] !== "end_turn"
          ? `no usable Claude response (${JSON.stringify(claude)})`
          : embeddings && INFRA_FALLBACK.has(reason)
            ? `catalogue fallback: ${reason}`
            : null;
    if (!problem) return { ...r, attempts: attempt };
    last = problem;
    console.log(`    retry (${embeddings ? "on" : "off"}, attempt ${attempt}): ${problem}`);
  }
  return { error: last, attempts };
}

// The judge's game-path context, built exactly as eval/judge-runs.mjs does.
const contextOf = (c, r) => {
  const r2 = r.trace?.round2 ?? { 1: [], 2: [] };
  const r3 = r.trace?.round3 ?? { 1: { picks: [] }, 2: { picks: [] } };
  const swiped = (p, dir) => (r2[p] ?? []).filter((x) => x.swipe === dir).map((x) => x.title);
  return {
    p1cats: c.p1, p2cats: c.p2,
    p1mood: r.p1Mood?.summary, p2mood: r.p2Mood?.summary,
    p1Yes: swiped(1, "yes"), p1No: swiped(1, "no"),
    p2Yes: swiped(2, "yes"), p2No: swiped(2, "no"),
    p1picks: r3[1].picks ?? [], p2picks: r3[2].picks ?? [],
  };
};

async function judge(c, r) {
  if (!r.winner) return { rating: null, rationale: "no winner", attempts: 0 };
  let last = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const j = await post("/api/eval/judge", { context: contextOf(c, r), pick: r.winner });
      if (!j.error && Number.isFinite(j.rating)) return { rating: j.rating, rationale: j.rationale, attempts: attempt };
      last = j.error ?? "no rating";
    } catch (e) {
      last = String(e);
    }
    console.log(`    judge retry (attempt ${attempt}): ${last}`);
  }
  return { rating: null, rationale: `judge failed: ${last}`, attempts: ATTEMPTS, error: true };
}

// ---- metrics (definitions: eval/e4-prereg.md) -------------------------------

const players = (r) => [r.e4.final8[1], r.e4.final8[2]];
const offPoolFilms = (r) => new Set(players(r).flat().filter((f) => f.offPool).map((f) => f.id)).size;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const cost = (r) => r.e4.claude.inputTokens * PRICE.input + r.e4.claude.outputTokens * PRICE.output;
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "n/a");
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "n/a");
const secs = (ms) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)} s` : "n/a");
const usd = (x) => (Number.isFinite(x) ? `$${x.toFixed(4)}` : "n/a");

function verdict(gap) {
  if (gap == null) return "incomplete";
  if (gap <= -CONFIRM) return "REGRESSION (confirmed)";
  if (gap >= CONFIRM) return "better (confirmed)";
  if (Math.abs(gap) >= FLOOR) return gap < 0 ? "too close to call (worse)" : "too close to call (better)";
  return "tie";
}

function armSummary(rows, arm) {
  const runs = rows.map((x) => x[arm]).filter((r) => r && !r.error);
  const ps = runs.flatMap(players);
  const fits = rows.map((x) => x.judge[arm]?.rating);
  const retrieval = runs.map((r) => r.e4.retrieval).filter(Boolean);
  const perPlayer = (k) => retrieval.flatMap((s) => [s[k]?.[1], s[k]?.[2]]).filter(Number.isFinite);
  return {
    runs: runs.length,
    meanFit: mean(fits.filter(Number.isFinite)),
    fitsBoth: rows.filter((x) => x[arm]?.winner && Number.isFinite(x.judge[arm]?.rating) && x.judge[arm].rating >= FITS_BOTH).length,
    offPoolPerCouple: mean(runs.map(offPoolFilms)),
    offPoolTotal: runs.map(offPoolFilms).reduce((a, b) => a + b, 0),
    offPoolWinners: runs.filter((r) => r.e4.winnerOffPool).length,
    likedPerPlayer: mean(ps.map((l) => l.filter((f) => f.liked).length)),
    ownPerPlayer: mean(ps.map((l) => l.filter((f) => f.liked === "own").length)),
    otherPerPlayer: mean(ps.map((l) => l.filter((f) => f.liked === "other").length)),
    freshPerPlayer: mean(ps.map((l) => l.filter((f) => f.offPool).length)),
    shownPerPlayer: mean(ps.map((l) => l.length)),
    costPerGame: mean(runs.map(cost)),
    inTokens: mean(runs.map((r) => r.e4.claude.inputTokens)),
    outTokens: mean(runs.map((r) => r.e4.claude.outputTokens)),
    inferMedian: median(runs.map((r) => r.e4.inferMs)),
    inferMax: Math.max(...runs.map((r) => r.e4.inferMs)),
    retrievalMedian: retrieval.length ? median(retrieval.map((s) => s.ms)) : NaN,
    retrievalMax: retrieval.length ? Math.max(...retrieval.map((s) => s.ms)) : NaN,
    retrievedPerPlayer: mean(perPlayer("retrieved")),
    eligiblePerPlayer: mean(perPlayer("eligible")),
    selectedPerPlayer: mean(perPlayer("selected")),
    usedPerPlayer: mean(perPlayer("used")),
    servedByToday: retrieval.reduce((n, s) => n + [1, 2].filter((p) => s.servedBy?.[p] === "today").length, 0),
    sharedSeeds: retrieval.filter((s) => s.sharedSeed).length,
    fallbacks: runs.filter((r) => r.e4.fallback).length,
    retries: rows.reduce((n, x) => n + Math.max(0, (x[arm]?.attempts ?? 1) - 1), 0),
  };
}

// ---- run ------------------------------------------------------------------

async function playCouple(c, n, attempts = ATTEMPTS) {
  // Alternate which arm goes first, so warm TMDB caches don't favour one arm's timing.
  const order = n % 2 === 1 ? [false, true] : [true, false];
  const out = { name: c.name, kind: c.kind, p1: c.p1, p2: c.p2, order: order.map((e) => (e ? "on" : "off")) };
  for (const e of order) out[e ? "on" : "off"] = await runArm(c, e, attempts);
  out.judge = { off: await judge(c, out.off), on: await judge(c, out.on) };
  const a = out.judge.off.rating;
  const b = out.judge.on.rating;
  out.gap = Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
  out.verdict = verdict(out.gap);
  return out;
}

const started = new Date();
console.log(`E4 gate run · ${SMOKE ? "SMOKE (excluded couple only)" : `${valid.length} valid couples`} · ${BASE}`);
console.log(`warm-up (unmeasured): ${warmup.name}`);
// The warm-up gets extra attempts, so the database is warm before couple 1 (prereg amendment).
const warm = await playCouple(warmup, 1, 6);
if (SMOKE) {
  for (const arm of ["off", "on"]) {
    const r = warm[arm];
    if (r.error) { console.log(`${arm}: ERROR ${r.error}`); continue; }
    console.log(`${arm}: ${r.reason} → ${r.winner?.title} · judge ${warm.judge[arm].rating} · infer ${r.e4.inferMs} ms · ` +
      `claude ${JSON.stringify(r.e4.claude)} · off-pool films ${offPoolFilms(r)} · retrieval ${r.e4.retrieval ? JSON.stringify(r.e4.retrieval) : "none"}`);
    for (const p of [1, 2]) console.log(`  P${p} final 8: ${r.e4.final8[p].map((f) => `${f.title}${f.offPool ? " [new]" : ""}${f.liked ? ` (${f.liked})` : ""}`).join(" · ")}`);
  }
  console.log(`gap ${warm.gap} → ${warm.verdict}`);
  process.exit(0);
}

const rows = [];
mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const jsonOut = new URL("./results/e4-gate.json", import.meta.url);
for (let i = 0; i < valid.length; i++) {
  const c = valid[i];
  process.stdout.write(`[${i + 1}/${valid.length}] ${c.name} … `);
  const row = await playCouple(c, i + 1);
  rows.push(row);
  writeFileSync(jsonOut, JSON.stringify({ started: started.toISOString(), rows }, null, 2)); // keep progress
  console.log(
    `off ${row.off.winner?.title ?? row.off.error} (${row.judge.off.rating}) · on ${row.on.winner?.title ?? row.on.error} (${row.judge.on.rating}) · gap ${row.gap} ${row.verdict}`
  );
}

// ---- report -----------------------------------------------------------------

const complete = rows.filter((x) => !x.off.error && !x.on.error && Number.isFinite(x.judge.off.rating) && Number.isFinite(x.judge.on.rating));
const incomplete = rows.length - complete.length;
const off = armSummary(rows, "off");
const on = armSummary(rows, "on");
const regressions = rows.filter((x) => x.gap != null && x.gap <= -CONFIRM);
const tooClose = rows.filter((x) => x.gap != null && x.gap < 0 && -x.gap >= FLOOR && -x.gap < CONFIRM);
const bar1 = incomplete ? "INCOMPLETE" : regressions.length === 0 ? "PASS" : "FAIL";
const bar2 = incomplete ? "INCOMPLETE" : on.fitsBoth === valid.length ? "PASS" : "FAIL";
const gain = off.offPoolTotal > 0 ? on.offPoolTotal / off.offPoolTotal : NaN;

const L = [
  `# E4 gate run · embeddings off vs on`,
  ``,
  `_${started.toISOString().slice(0, 16).replace("T", " ")} UTC · ${valid.length} valid couples (#11 excluded) · frozen pools · taste lane · judge claude-opus-4-8 · bars pre-registered in \`eval/e4-prereg.md\`_`,
  ``,
  `## Bars`,
  ``,
  `| Bar | Result | |`,
  `|---|---|---|`,
  `| No confirmed regression (gap −${CONFIRM} or worse) | ${regressions.length} of ${valid.length} | **${bar1}** |`,
  `| "Fits both" (judge ${FITS_BOTH}+) with embeddings on | ${on.fitsBoth}/${valid.length} | **${bar2}** |`,
  ``,
  `With embeddings off, "fits both" was ${off.fitsBoth}/${valid.length}. Too close to call (worse by ${FLOOR} to ${CONFIRM - 1}, for Lasse's blind pairwise): ${tooClose.length ? tooClose.map((x) => x.name).join(", ") : "none"}.${incomplete ? ` **${incomplete} couple(s) incomplete.**` : ""}`,
  ``,
  `## Per arm`,
  ``,
  `| | Off | On |`,
  `|---|---|---|`,
  `| Mean judge fit | ${f1(off.meanFit)} | ${f1(on.meanFit)} |`,
  `| Fits both (judge ${FITS_BOTH}+) | ${off.fitsBoth}/${valid.length} | ${on.fitsBoth}/${valid.length} |`,
  `| Variety: films from outside the pool in the two final 8s, per couple | ${f1(off.offPoolPerCouple)} | ${f1(on.offPoolPerCouple)} |`,
  `| Couples whose winner is from outside the pool | ${off.offPoolWinners} | ${on.offPoolWinners} |`,
  `| Liked films in the final 8, per player (own + other's) | ${f2(off.likedPerPlayer)} (${f2(off.ownPerPlayer)} + ${f2(off.otherPerPlayer)}) | ${f2(on.likedPerPlayer)} (${f2(on.ownPerPlayer)} + ${f2(on.otherPerPlayer)}) |`,
  `| Fresh films in the final 8, per player | ${f2(off.freshPerPlayer)} | ${f2(on.freshPerPlayer)} |`,
  `| Films shown per player (final 8) | ${f2(off.shownPerPlayer)} | ${f2(on.shownPerPlayer)} |`,
  `| Claude cost per game (inferMoods call) | ${usd(off.costPerGame)} | ${usd(on.costPerGame)} |`,
  `| Tokens per game, in / out | ${Math.round(off.inTokens)} / ${Math.round(off.outTokens)} | ${Math.round(on.inTokens)} / ${Math.round(on.outTokens)} |`,
  `| inferMoods time, median / slowest | ${secs(off.inferMedian)} / ${secs(off.inferMax)} | ${secs(on.inferMedian)} / ${secs(on.inferMax)} |`,
  `| Catalogue retrieval time, median / slowest | n/a | ${secs(on.retrievalMedian)} / ${secs(on.retrievalMax)} |`,
  `| Catalogue films per player: retrieved / passed every check / took a slot / in the final list | n/a | ${f1(on.retrievedPerPlayer)} / ${f1(on.eligiblePerPlayer)} / ${f1(on.selectedPerPlayer)} / ${f1(on.usedPerPlayer)} |`,
  `| Players served by today's path instead of the catalogue | n/a | ${on.servedByToday} of ${2 * on.runs} |`,
  `| Couples with a shared seed | n/a | ${on.sharedSeeds} of ${on.runs} |`,
  `| Retries (infrastructure) | ${off.retries} | ${on.retries} |`,
  ``,
  `Variety gain after availability (films from outside the pool, on ÷ off): **${Number.isFinite(gain) ? `${gain.toFixed(2)}×` : "n/a"}** (${off.offPoolTotal} → ${on.offPoolTotal} across ${valid.length} couples). inferMoods median difference (on − off): ${secs(on.inferMedian - off.inferMedian)}, measured on the dev server on this Mac (indicative; the live read is Otto's). The blend call, the game's other Claude call, is the same in both arms and not counted.`,
  ``,
  `## Per couple`,
  ``,
  `| # | Couple | Off winner | Fit | On winner | Fit | Gap | Verdict | Outside-pool films, off → on | inferMoods, off / on |`,
  `|---|---|---|---|---|---|---|---|---|---|`,
  ...rows.map((x, i) => {
    const w = (arm) => (x[arm].error ? `ERROR` : `${x[arm].winner?.title ?? "(none)"}${x[arm].e4?.winnerOffPool ? " *" : ""}`);
    const fit = (arm) => x.judge[arm].rating ?? "n/a";
    const op = (arm) => (x[arm].error ? "n/a" : offPoolFilms(x[arm]));
    const t = (arm) => (x[arm].error ? "n/a" : secs(x[arm].e4.inferMs));
    return `| ${i + 1} | ${x.name} | ${w("off")} | ${fit("off")} | ${w("on")} | ${fit("on")} | ${x.gap == null ? "n/a" : `${x.gap > 0 ? "+" : ""}${x.gap}`} | ${x.verdict} | ${op("off")} → ${op("on")} | ${t("off")} / ${t("on")} |`;
  }),
  ``,
  `\\* winner from outside the couple's genre pool.`,
  ``,
  `## Judge rationales`,
  ``,
  ...rows.flatMap((x) => [
    `- **${x.name}.** Off (${x.judge.off.rating ?? "n/a"}): ${x.judge.off.rationale ?? "n/a"} On (${x.judge.on.rating ?? "n/a"}): ${x.judge.on.rationale ?? "n/a"}`,
  ]),
  ``,
];
writeFileSync(new URL("./results/e4-gate.md", import.meta.url), L.join("\n"));
writeFileSync(jsonOut, JSON.stringify({ started: started.toISOString(), finished: new Date().toISOString(), rows, summary: { off, on, bar1, bar2, gain } }, null, 2));
console.log(`\nBar 1 (no confirmed regression): ${bar1} · Bar 2 (fits both on): ${bar2} (${on.fitsBoth}/${valid.length}) · variety gain ${f2(gain)}×`);
console.log("Wrote eval/results/e4-gate.md (+ .json)");
