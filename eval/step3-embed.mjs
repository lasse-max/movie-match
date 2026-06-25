// THROWAWAY Step-3 de-risk prototype (research, not the live rebuild). Embeds two
// sources (cheap: TMDB overview+keywords · rich: an LLM tone/subgenre descriptor) over
// a small catalog slice, then runs the PRE-REGISTERED bars (eval/step3-prereg.md):
// variety (primary), subgenre separation (structural gate), single-pick maximin (secondary).
// Scrappy on purpose. Caches everything by TMDB id so re-runs are free.
//
//   1. npm run dev   (for the judge route)
//   2. node eval/step3-embed.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

// ---- keys (local research script; read from .env.local, never logged/committed) ----
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const OPENAI = env.OPENAI_API_KEY, ANTHROPIC = env.ANTHROPIC_API_KEY, TMDB = env.TMDB_READ_ACCESS_TOKEN;
if (!OPENAI || !ANTHROPIC || !TMDB) {
  console.error("missing key(s) in .env.local (need OPENAI_API_KEY, ANTHROPIC_API_KEY, TMDB_READ_ACCESS_TOKEN)");
  process.exit(1);
}
const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";

// ---- math ----
const cos = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};
const mean = (vecs) => {
  if (!vecs.length) return null;
  const n = vecs[0].length, out = new Array(n).fill(0);
  for (const v of vecs) for (let i = 0; i < n; i++) out[i] += v[i];
  for (let i = 0; i < n; i++) out[i] /= vecs.length;
  return out;
};
const pctile = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.floor((p / 100) * (s.length - 1))] : 0;
};
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

// ---- APIs ----
const tmdb = async (path, params = {}) => {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { accept: "application/json", Authorization: `Bearer ${TMDB}` } });
  if (!r.ok) throw new Error(`tmdb ${path} ${r.status}`);
  return r.json();
};
const embed = async (texts) => {
  const out = [];
  for (let i = 0; i < texts.length; i += 96) {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${OPENAI}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texts.slice(i, i + 96) }),
    });
    if (!r.ok) throw new Error(`openai ${r.status} ${await r.text()}`);
    for (const e of (await r.json()).data) out.push(e.embedding);
  }
  return out;
};
const DESC_SYS = `For each film, write a compact 2–3 sentence tone/subgenre PROFILE — what it FEELS like to watch, placing it on axes like dread vs gore, cerebral vs visceral, grounded vs fantastical, bleak vs warm, slow-burn vs kinetic — plus its specific subgenre and emotional texture. Focus on tone and subgenre, not plot. Return JSON {"profiles":[{"n":<number>,"profile":"<text>"}]}.`;
const descriptors = async (films) => {
  const out = {};
  for (let i = 0; i < films.length; i += 15) {
    const batch = films.slice(i, i + 15);
    const list = batch.map((f, j) => `${j + 1}. ${f.title} (${f.year ?? "—"}) [${f.genres.join(", ")}]: ${f.overview || "(no overview)"}`).join("\n");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 3000, temperature: 0, thinking: { type: "disabled" },
        system: DESC_SYS, messages: [{ role: "user", content: list }],
        output_config: { format: { type: "json_schema", schema: { type: "object", additionalProperties: false, properties: { profiles: { type: "array", items: { type: "object", additionalProperties: false, properties: { n: { type: "integer" }, profile: { type: "string" } }, required: ["n", "profile"] } } }, required: ["profiles"] } } },
      }),
    });
    if (!r.ok) throw new Error(`anthropic ${r.status} ${await r.text()}`);
    const text = (await r.json()).content.find((b) => b.type === "text")?.text;
    for (const p of JSON.parse(text).profiles) { const f = batch[p.n - 1]; if (f) out[f.id] = p.profile; }
    process.stdout.write(`  descriptors ${Math.min(i + 15, films.length)}/${films.length}\r`);
  }
  console.log("");
  return out;
};
const GEN = { 28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV", 53: "Thriller", 10752: "War", 37: "Western" };
const gnames = (ids) => (ids ?? []).map((g) => GEN[g]).filter(Boolean);

// ---- data ----
const { couples } = JSON.parse(readFileSync(new URL("./couples.json", import.meta.url)));
const blends = JSON.parse(readFileSync(new URL("./fixtures/blends.json", import.meta.url)));
const keyOf = (c) => `${c.p1.join(",")}__${c.p2.join(",")}`;
if (!existsSync(new URL("./results/taste-after-swiper.json", import.meta.url))) {
  console.error("missing eval/results/taste-after-swiper.json — run: node eval/run.mjs taste-after-swiper");
  process.exit(1);
}
const runs = new Map(JSON.parse(readFileSync(new URL("./results/taste-after-swiper.json", import.meta.url))).map((r) => [r.name, r]));

const HARD = ["Date-night clash", "Tearjerker vs blockbuster", "Dark crime couple", "Horror fans", "Fantasy adventure", "Sci-fi vs romance"];
const STABLE = "Action buddies";
const EASY = ["Cozy night in", "Rom-com classic"];
const NAMES = [...HARD, STABLE, ...EASY];
const selected = couples.filter((c) => NAMES.includes(c.name));

// ---- build the catalog slice ----
const slice = new Map();
const addMovie = (m) => { if (!slice.has(m.id)) slice.set(m.id, m); };
for (const c of selected) for (const m of blends[keyOf(c)]?.pool ?? []) addMovie(m);
// neighbors for the stable couple (broaden the catalog the embedding can mine)
const stable = couples.find((c) => c.name === STABLE);
for (const seed of (blends[keyOf(stable)]?.pool ?? []).slice(0, 12)) {
  try {
    for (const m of (await tmdb(`/movie/${seed.id}/recommendations`)).results.slice(0, 20))
      addMovie({ id: m.id, title: m.title, year: m.release_date?.slice(0, 4) ?? null, overview: m.overview, genreIds: m.genre_ids ?? [], voteAverage: m.vote_average, voteCount: m.vote_count, posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null, collectionId: null });
  } catch { /* skip */ }
}
// subgenre anchors for the separation gate
const ANCHORS = [
  ["Hereditary", "dread"], ["The Witch", "dread"], ["The Babadook", "dread"], ["It Follows", "dread"], ["Midsommar", "dread"],
  ["Saw", "gore"], ["Terrifier", "gore"], ["Hostel", "gore"], ["The Human Centipede", "gore"],
];
const anchorIds = { dread: [], gore: [] };
for (const [q, sub] of ANCHORS) {
  try {
    const m = (await tmdb("/search/movie", { query: q })).results?.[0];
    if (m) {
      anchorIds[sub].push(m.id);
      addMovie({ id: m.id, title: m.title, year: m.release_date?.slice(0, 4) ?? null, overview: m.overview, genreIds: m.genre_ids ?? [], voteAverage: m.vote_average, voteCount: m.vote_count, posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null, collectionId: null });
    }
  } catch { /* skip */ }
}
console.log(`catalog slice: ${slice.size} titles`);

// ---- build/cache cheap + rich text + embeddings ----
mkdirSync(new URL("./cache/", import.meta.url), { recursive: true });
const CACHE = new URL("./cache/step3.json", import.meta.url);
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE)) : {};
const need = [...slice.values()].filter((m) => !cache[m.id]?.cheapEmb);
let richAvailable = [...slice.values()].some((m) => cache[m.id]?.richEmb);
if (need.length) {
  console.log(`building text + embeddings for ${need.length} titles…`);
  // keywords (cheap source) — chunked parallel
  const kw = {};
  for (let i = 0; i < need.length; i += 20) {
    await Promise.all(need.slice(i, i + 20).map(async (m) => {
      try { kw[m.id] = ((await tmdb(`/movie/${m.id}/keywords`)).keywords ?? []).map((k) => k.name); } catch { kw[m.id] = []; }
    }));
    process.stdout.write(`  keywords ${Math.min(i + 20, need.length)}/${need.length}\r`);
  }
  console.log("");
  // rich descriptors (Claude) — OPTIONAL: skip if the LLM API is unavailable (e.g. no credits)
  let desc = {};
  try {
    desc = await descriptors(need.map((m) => ({ id: m.id, title: m.title, year: m.year, overview: m.overview, genres: gnames(m.genreIds) })));
    richAvailable = true;
  } catch (e) {
    console.log(`\n  rich source SKIPPED — ${e.message.slice(0, 90)}`);
    richAvailable = false;
  }
  for (const m of need) {
    cache[m.id] = {
      ...cache[m.id], title: m.title, year: m.year, genreIds: m.genreIds, voteAverage: m.voteAverage, voteCount: m.voteCount, posterUrl: m.posterUrl, collectionId: m.collectionId ?? null,
      cheapText: `${m.title} (${m.year ?? "—"}). ${m.overview || ""} Keywords: ${(kw[m.id] ?? []).join(", ")}`.trim(),
      ...(richAvailable ? { richText: desc[m.id] ?? `${m.title}. ${m.overview || ""}` } : {}),
    };
  }
  console.log("embedding cheap…");
  const cheapEmb = await embed(need.map((m) => cache[m.id].cheapText));
  need.forEach((m, i) => { cache[m.id].cheapEmb = cheapEmb[i]; });
  if (richAvailable) {
    console.log("embedding rich…");
    const richEmb = await embed(need.map((m) => cache[m.id].richText));
    need.forEach((m, i) => { cache[m.id].richEmb = richEmb[i]; });
  }
  writeFileSync(CACHE, JSON.stringify(cache));
  console.log("cached.");
} else {
  console.log("using cached embeddings.");
}
const SOURCES = richAvailable ? ["cheap", "rich"] : ["cheap"];
console.log(richAvailable ? "sources: cheap + rich\n" : "sources: CHEAP ONLY (rich/LLM-descriptor source unavailable)\n");

// ---- analysis helpers ----
const strong = (m) => m && m.voteCount >= 100 && m.voteAverage >= 6.2 && !!m.posterUrl; // quality floor + watchable
const dedupe = (list) => { const seen = new Set(), out = []; for (const m of list) { if (m.collectionId != null) { if (seen.has(m.collectionId)) continue; seen.add(m.collectionId); } out.push(m); } return out; };
const embOf = (id, src) => cache[id]?.[src + "Emb"];
const tasteVecs = (couple, src) => {
  const run = runs.get(couple.name);
  const pool = blends[keyOf(couple)].pool;
  const t2id = new Map(pool.map((m) => [m.title, m.id]));
  const yesVec = (p) => {
    const yes = (run.trace.round2[p] ?? []).filter((c) => c.swipe === "yes").map((c) => c.title);
    return mean(yes.map((t) => t2id.get(t)).filter(Boolean).map((id) => embOf(id, src)).filter(Boolean));
  };
  return [yesVec(1), yesVec(2)];
};
const sliceStrong = [...slice.values()].filter(strong);

const out = [];
const log = (s) => { console.log(s); out.push(s); };
log(`# Step-3 embedding de-risk — results\n`);
log(`_${new Date().toISOString().slice(0, 16).replace("T", " ")} · slice ${slice.size} titles · text-embedding-3-small · cheap (overview+keywords) vs rich (LLM descriptor)_\n`);

// ===== BAR 2: subgenre separation (structural gate) =====
log(`## Bar 2 — subgenre separation (STRUCTURAL GATE)`);
const pairMean = (A, B, src) => {
  const va = A.map((id) => embOf(id, src)).filter(Boolean), vb = B.map((id) => embOf(id, src)).filter(Boolean);
  let s = 0, n = 0;
  for (const a of va) for (const b of vb) { if (a === b) continue; s += cos(a, b); n++; }
  return n ? s / n : 0;
};
for (const src of SOURCES) {
  const dd = pairMean(anchorIds.dread, anchorIds.dread, src);
  const dg = pairMean(anchorIds.dread, anchorIds.gore, src);
  const margin = dd - dg;
  log(`- **${src}**: dread↔dread sim ${round(dd)} · dread↔gore sim ${round(dg)} · margin **${round(margin)}** ${margin > 0.03 ? "→ separates ✓" : "→ mushy ✗"}`);
}
// Horror-fans top neighbors (manual dread/gore skew inspection)
const horror = couples.find((c) => c.name === "Horror fans");
for (const src of SOURCES) {
  const [p1, p2] = tasteVecs(horror, src);
  const top = sliceStrong.map((m) => ({ m, s: Math.min(cos(embOf(m.id, src), p1), cos(embOf(m.id, src), p2)) })).sort((a, b) => b.s - a.s).slice(0, 6);
  log(`- Horror-fans top neighbors (${src}): ${top.map((t) => `${t.m.title} ${round(t.s, 2)}`).join(" · ")}`);
}
log("");

// ===== BAR 1: variety (primary) =====
log(`## Bar 1 — variety (PRIMARY) · stable couple "${STABLE}"`);
for (const src of SOURCES) {
  const [p1, p2] = tasteVecs(stable, src);
  const maximin = (id) => { const e = embOf(id, src); return e && p1 && p2 ? Math.min(cos(e, p1), cos(e, p2)) : -1; };
  const genrePool = blends[keyOf(stable)].pool.filter(strong);
  const tau = pctile(genrePool.map((m) => maximin(m.id)), 60);
  const genreOnTaste = dedupe(genrePool.filter((m) => maximin(m.id) >= tau).sort((a, b) => maximin(b.id) - maximin(a.id)));
  const embOnTaste = dedupe(sliceStrong.filter((m) => maximin(m.id) >= tau).sort((a, b) => maximin(b.id) - maximin(a.id)));
  const ratio = embOnTaste.length / Math.max(genreOnTaste.length, 1);
  const replays = (pool) => { let avail = [...pool], r = 0; for (; r < 4; r++) { if (avail.length < 8) break; avail = avail.slice(8); } return r; };
  log(`- **${src}**: τ=${round(tau)} · genre-pool on-taste **${genreOnTaste.length}** · embedding on-taste **${embOnTaste.length}** · ratio **${round(ratio, 2)}×** ${ratio >= 2 ? "✓ (≥2×)" : "✗ (<2×)"}`);
  log(`    - replays sustained (8/replay): genre ${replays(genreOnTaste)} · embedding ${replays(embOnTaste)}`);
}
log("");

// ===== BAR 3: single-pick maximin (secondary) =====
log(`## Bar 3 — single-pick maximin (SECONDARY) · judge gap vs baseline`);
const ctxOf = (couple) => {
  const run = runs.get(couple.name), r2 = run.trace.round2, r3 = run.trace.round3;
  const sw = (p, d) => (r2[p] ?? []).filter((c) => c.swipe === d).map((c) => c.title);
  return { p1cats: couple.p1, p2cats: couple.p2, p1mood: run.moods?.p1?.summary, p2mood: run.moods?.p2?.summary, p1Yes: sw(1, "yes"), p1No: sw(1, "no"), p2Yes: sw(2, "yes"), p2No: sw(2, "no"), p1picks: r3[1].picks ?? [], p2picks: r3[2].picks ?? [] };
};
const judge = async (ctx, pick) => {
  const r = await (await fetch(BASE + "/api/eval/judge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: ctx, pick }) })).json();
  if (r.error) throw new Error(r.error);
  return r.rating;
};
const src = SOURCES[SOURCES.length - 1]; // richest available source (rich if present, else cheap)
let judgeUp = true;
for (const couple of [...HARD, ...EASY].map((n) => couples.find((c) => c.name === n))) {
  if (!judgeUp) break;
  const run = runs.get(couple.name);
  if (!run?.winner) { log(`- ${couple.name}: (no baseline winner)`); continue; }
  const [p1, p2] = tasteVecs(couple, src);
  if (!p1 || !p2) { log(`- ${couple.name}: (no taste vector)`); continue; }
  const best = sliceStrong.map((m) => ({ m, s: Math.min(cos(embOf(m.id, src), p1), cos(embOf(m.id, src), p2)) })).sort((a, b) => b.s - a.s)[0];
  const ctx = ctxOf(couple);
  let baseS, embS;
  try {
    baseS = await judge(ctx, { title: run.winner.title, year: run.winner.year, genreIds: run.winner.genreIds });
    embS = await judge(ctx, { title: best.m.title, year: best.m.year, genreIds: best.m.genreIds });
  } catch (e) {
    log(`- _judge unavailable (${e.message.slice(0, 70)}) — Bar 3 deferred_`);
    judgeUp = false;
    break;
  }
  const gap = embS - baseS;
  const tag = EASY.includes(couple.name) ? "easy" : "hard";
  const verdict = gap >= 24 ? "embedding win ✓" : gap <= -24 ? "REGRESSION ✗" : gap >= 18 ? "too-close → human" : gap <= -18 ? "too-close (worse) → human" : "tie";
  log(`- ${couple.name} (${tag}, ${src}): baseline "${run.winner.title}" ${baseS} · maximin "${best.m.title}" ${embS} · gap ${gap > 0 ? "+" : ""}${gap} (${verdict})`);
}
log("");

writeFileSync(new URL("./results/step3-embed.md", import.meta.url), out.join("\n"));
console.log("\nWrote eval/results/step3-embed.md");
