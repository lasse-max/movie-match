// Embeddings v1 · Track A · slice E2 — catalogue build script.
//
// Builds the film catalogue the matching engine retrieves from: every TMDB film
// above the quality floor (100+ votes, 6.2+ average, a poster and an overview),
// embedded once with OpenAI text-embedding-3-small from `cheapText` (title, year,
// overview, keywords — the exact recipe the June de-risk proved, eval/step3-embed.mjs),
// upserted into the Supabase `movies` table (schema: supabase/migrations/..._embeddings_v1.sql).
//
// Two modes:
//   node scripts/build-catalog.mjs            # DRY RUN (default): no paid calls.
//   node scripts/build-catalog.mjs --dry-run  #   prints film count, TMDB calls,
//                                              #   tokens, cost and time estimate.
//   node scripts/build-catalog.mjs --run      # REAL build: embeds + writes Supabase.
//                                              #   Idempotent + resumable (skips films
//                                              #   whose text hasn't changed). Run only
//                                              #   after Lasse OKs the dry-run numbers.
//
// Keys are read from .env.local (never logged, never committed). The dry run needs
// only TMDB_READ_ACCESS_TOKEN. The real run also needs OPENAI_API_KEY, SUPABASE_URL
// and SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// ---- env (local script; read straight from .env.local) ---------------------
const env = {};
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("Could not read .env.local — copy .env.example and fill it in.");
  process.exit(1);
}
const TMDB = env.TMDB_READ_ACCESS_TOKEN;
if (!TMDB) {
  console.error("Missing TMDB_READ_ACCESS_TOKEN in .env.local.");
  process.exit(1);
}

// ---- config ----------------------------------------------------------------
// Quality floor — must match lib/infer.ts (MIN_VOTES / MIN_VOTE_AVERAGE).
const MIN_VOTES = 100;
const MIN_VOTE_AVERAGE = 6.2;
const FIRST_YEAR = 1900; // covers everything above the floor; empty years cost 1 call
const THIS_YEAR = new Date().getFullYear();
const MODEL = "text-embedding-3-small";
const EMBED_PRICE_PER_MTOK = 0.02; // USD per 1M tokens (text-embedding-3-small)
const CHARS_PER_TOKEN = 4; // cl100k_base English approximation (stated, not exact)
const UPSERT_BATCH = 100; // films per embed+upsert batch. 100 x 1536-float vectors
                          // is ~1.5 MB/request; 500 was ~7-8 MB (Otto fix 5).
const TMDB_CONCURRENCY = 16; // parallel TMDB requests
const TMDB_RATE = 40; // assumed sustained req/s for the time estimate (conservative)
const SAMPLE_KEYWORDS = 250; // films sampled for the token estimate (dry run)

const args = new Set(process.argv.slice(2));
const REAL = args.has("--run");

// ---- helpers ---------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => n.toLocaleString("en-US");
const usd = (n) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

async function tmdb(path, params = {}, tries = 4) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  for (let attempt = 1; ; attempt++) {
    let r;
    try {
      r = await fetch(u, {
        headers: { accept: "application/json", Authorization: `Bearer ${TMDB}` },
      });
    } catch (e) {
      // A thrown network error ("fetch failed": reset/timeout/DNS) is transient at
      // this concurrency — retry with backoff rather than killing the whole run.
      if (attempt > tries) throw new Error(`tmdb ${path} network error: ${e.message}`);
      await sleep(500 * attempt);
      continue;
    }
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && attempt <= tries) {
      const retryAfter = Number(r.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * attempt;
      await sleep(wait);
      continue;
    }
    if (attempt <= tries) { await sleep(300 * attempt); continue; }
    throw new Error(`tmdb ${path} ${r.status}`);
  }
}

// Retrying fetch for OpenAI + Supabase (real build only). Retries 429 and 5xx with
// exponential backoff (honouring Retry-After), 3 tries, then throws a labelled error.
async function fetchRetry(url, options, label, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    let r;
    try {
      r = await fetch(url, options);
    } catch (e) {
      if (attempt > tries) throw new Error(`${label} network error: ${e.message}`);
      await sleep(500 * attempt);
      continue;
    }
    if (r.ok) return r;
    if ((r.status === 429 || r.status >= 500) && attempt <= tries) {
      const retryAfter = Number(r.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 500 * 2 ** (attempt - 1);
      await sleep(wait);
      continue;
    }
    throw new Error(`${label} ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`.trim());
  }
}

// Bounded-concurrency map — keeps TMDB happy and the build resumable-friendly.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

// Discover one release year: floors + popularity order, mirroring lib/tmdb.ts.
function discoverParams(year, page) {
  return {
    include_adult: "false",
    language: "en-US",
    sort_by: "popularity.desc",
    "vote_count.gte": String(MIN_VOTES),
    "vote_average.gte": String(MIN_VOTE_AVERAGE),
    primary_release_year: String(year),
    page: String(page),
  };
}

const yearOf = (release_date) => {
  const y = Number((release_date ?? "").slice(0, 4));
  return Number.isFinite(y) && y > 0 ? y : null;
};

// Row shape from a discover result (keywords + collection id fetched separately).
const toFilm = (m) => ({
  tmdb_id: m.id,
  title: m.title,
  year: yearOf(m.release_date),
  overview: m.overview ?? "",
  genre_ids: m.genre_ids ?? [],
  vote_count: m.vote_count ?? 0,
  vote_average: m.vote_average ?? 0,
  popularity: m.popularity ?? 0,
  poster_path: m.poster_path ?? null,
  language: m.original_language ?? null,
});

const passesFloor = (m) =>
  (m.vote_count ?? 0) >= MIN_VOTES &&
  (m.vote_average ?? 0) >= MIN_VOTE_AVERAGE &&
  !!m.poster_path &&
  !!(m.overview && m.overview.trim());

// THE recipe — identical to `cheapText` in eval/step3-embed.mjs (line 164) so the
// June variety/separation evidence still applies. Do not "improve" it here.
const cheapText = (f, keywords) =>
  `${f.title} (${f.year ?? "—"}). ${f.overview || ""} Keywords: ${(keywords ?? []).join(", ")}`.trim();

const textHash = (text) => createHash("sha256").update(`${MODEL}\n${text}`).digest("hex");

// One TMDB call for BOTH the franchise id and the keywords (append_to_response),
// the exact call the real build makes. Never throws — an enrichment gap degrades
// to empty, never an error. Keywords are identical to the /keywords endpoint, so
// the cheapText recipe is unchanged.
async function enrich(tmdbId) {
  try {
    const d = await tmdb(`/movie/${tmdbId}`, { append_to_response: "keywords" });
    return {
      ok: true,
      keywords: (d.keywords?.keywords ?? []).map((k) => k.name),
      collection_id: d.belongs_to_collection?.id ?? null,
    };
  } catch {
    // tmdb() already retried; a throw here is a real failure, not just "no keywords".
    return { ok: false, keywords: [], collection_id: null };
  }
}

// ===========================================================================
// DRY RUN — real film count + honest estimates, no paid calls.
// ===========================================================================
async function dryRun() {
  console.log(`Dry run · quality floor ${MIN_VOTES}+ votes, ${MIN_VOTE_AVERAGE}+ average, poster + overview`);
  console.log(`Enumerating TMDB by release year ${FIRST_YEAR}-${THIS_YEAR} (page-1 per year)…`);

  const years = Array.from({ length: THIS_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  let gross = 0; // films above the vote/rating floor (poster/overview not yet filtered)
  let discoverPages = 0; // total discover pages the REAL build would page through
  let countCalls = 0; // discover calls this dry run makes
  const headFilms = []; // page-1 films, reused as the retention/token sample head
  const deepTargets = []; // {year, totalPages} for tail sampling
  let overCap = 0; // years whose totals exceed TMDB's 10k/500-page window

  await mapLimit(years, TMDB_CONCURRENCY, async (year) => {
    const data = await tmdb("/discover/movie", discoverParams(year, 1));
    countCalls++;
    const total = data.total_results ?? 0;
    if (!total) return;
    gross += total;
    const pages = Math.min(data.total_pages ?? 0, 500);
    discoverPages += pages;
    if ((data.total_pages ?? 0) > 500) overCap++;
    for (const m of data.results ?? []) headFilms.push(toFilm(m));
    if (pages >= 3) deepTargets.push({ year, pages });
  });

  // ---- retention: fraction with a poster AND an overview --------------------
  // Head (page-1) films skew popular (near-100% have metadata). Sample some deep
  // pages too so the estimate reflects the long tail, which more often lacks them.
  const headRetention = headFilms.length
    ? headFilms.filter(passesFloor).length / headFilms.length
    : 1;
  const tailFilms = [];
  const tailPick = deepTargets
    .sort((a, b) => b.pages - a.pages)
    .filter((_, idx) => idx % Math.max(1, Math.floor(deepTargets.length / 15)) === 0)
    .slice(0, 15);
  await mapLimit(tailPick, TMDB_CONCURRENCY, async ({ year, pages }) => {
    const mid = Math.max(2, Math.floor(pages / 2));
    for (const p of new Set([mid, pages])) {
      const data = await tmdb("/discover/movie", discoverParams(year, p));
      countCalls++;
      for (const m of data.results ?? []) tailFilms.push(toFilm(m));
    }
  });
  const tailRetention = tailFilms.length
    ? tailFilms.filter(passesFloor).length / tailFilms.length
    : headRetention;
  // Weight toward the tail: most of the catalogue lives in deep pages.
  const retention = Math.min(1, headFilms.length + tailFilms.length
    ? (headRetention * 0.3 + tailRetention * 0.7)
    : 1);
  const net = Math.round(gross * retention);

  // ---- token estimate: real cheapText over a keyword sample ----------------
  const samplePool = [...headFilms, ...tailFilms].filter(passesFloor);
  // de-dup and take a spread
  const byId = new Map(samplePool.map((f) => [f.tmdb_id, f]));
  const sample = [...byId.values()].slice(0, SAMPLE_KEYWORDS);
  console.log(`Sampling keywords for ${sample.length} films to size the text…`);
  let sampleChars = 0;
  let sampleKwCount = 0;
  await mapLimit(sample, TMDB_CONCURRENCY, async (f) => {
    const { keywords } = await enrich(f.tmdb_id); // the same single call the real build makes
    countCalls++;
    sampleKwCount += keywords.length;
    sampleChars += cheapText(f, keywords).length;
  });
  const meanChars = sample.length ? sampleChars / sample.length : 0;
  const meanTokens = meanChars / CHARS_PER_TOKEN;
  const totalTokens = Math.round(net * meanTokens);

  // ---- real-build TMDB call + time estimate --------------------------------
  // Real build: page every year fully (discoverPages) + ONE enrichment call per
  // NET film (/movie/{id}?append_to_response=keywords gives franchise id AND
  // keywords together).
  const realTmdbCalls = discoverPages + net;
  // Real build embeds + upserts coupled, one request each per UPSERT_BATCH chunk.
  const batches = Math.ceil(net / UPSERT_BATCH);
  const tmdbSeconds = realTmdbCalls / TMDB_RATE;
  const embedSeconds = batches * 1.2; // ~1.2s/embed request (network + compute)
  const upsertSeconds = batches * 0.5;
  const totalMinutes = (tmdbSeconds + embedSeconds + upsertSeconds) / 60;
  const cost = (totalTokens / 1_000_000) * EMBED_PRICE_PER_MTOK;

  // ---- report ---------------------------------------------------------------
  const line = "─".repeat(64);
  console.log(`\n${line}`);
  console.log(`CATALOGUE BUILD · DRY RUN`);
  console.log(line);
  console.log(`Film count (net, poster+overview)   ${fmt(net)}`);
  console.log(`  above vote/rating floor (gross)   ${fmt(gross)}`);
  console.log(`  poster+overview retention          ${(retention * 100).toFixed(1)}%  (head ${(headRetention * 100).toFixed(1)}% / tail ${(tailRetention * 100).toFixed(1)}%)`);
  console.log(`TMDB calls (real build)             ${fmt(realTmdbCalls)}`);
  console.log(`  discover paging                    ${fmt(discoverPages)}`);
  console.log(`  per-film detail + keywords         ${fmt(net)}  (1 call, append_to_response)`);
  console.log(`Tokens (embedding input)            ~${fmt(totalTokens)}`);
  console.log(`  mean per film                      ~${meanTokens.toFixed(0)} tokens (${meanChars.toFixed(0)} chars, ${CHARS_PER_TOKEN} chars/token)`);
  console.log(`  mean keywords per film             ${sample.length ? (sampleKwCount / sample.length).toFixed(1) : 0}`);
  console.log(`Embedding cost (${MODEL}) ${usd(cost)}  (@ ${usd(EMBED_PRICE_PER_MTOK)}/1M tokens)`);
  console.log(`Time estimate (real build)          ~${totalMinutes.toFixed(0)} min`);
  console.log(`  TMDB @ ${TMDB_RATE}/s                        ~${(tmdbSeconds / 60).toFixed(0)} min`);
  console.log(`  OpenAI ${fmt(batches)} batches               ~${(embedSeconds / 60).toFixed(1)} min`);
  console.log(line);
  console.log(`Dry-run TMDB calls made: ${fmt(countCalls)} (all free). No OpenAI or Supabase calls.`);
  if (overCap) {
    console.log(`NOTE: ${overCap} year(s) exceed TMDB's 10k/500-page window. The real build`);
    console.log(`      STOPS with a clear message for such a year (month-splitting is not`);
    console.log(`      implemented; no year is close today).`);
  }
  console.log(`\nAssumptions: ${CHARS_PER_TOKEN} chars/token (cl100k_base approx); TMDB ${TMDB_RATE} req/s sustained;`);
  console.log(`retention blended 30% head / 70% tail. Numbers are estimates for sign-off, not a quote.`);
}

// ===========================================================================
// REAL BUILD — embeds + writes Supabase. Idempotent + resumable.
// (Written for completeness; run only after Lasse OKs the dry-run numbers and
//  the E1 migration is applied. NOT executed by this slice.)
// ===========================================================================
async function realRun() {
  const OPENAI = env.OPENAI_API_KEY;
  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    ["OPENAI_API_KEY", OPENAI],
    ["SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`Real build needs ${missing.join(", ")} in .env.local. Aborting.`);
    process.exit(1);
  }
  const rest = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
  // Supabase key formats: a legacy JWT (eyJ...) goes in BOTH the apikey and the
  // Authorization: Bearer headers; a new secret key (sb_secret_...) is not a JWT and
  // goes in the apikey header ONLY (sent as Bearer it would be rejected). Detect both.
  const sbHeaders = {
    apikey: SERVICE_KEY,
    "content-type": "application/json",
    ...(SERVICE_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SERVICE_KEY}` } : {}),
  };

  // OpenAI + Supabase helpers, both retry 429/5xx (fetchRetry). One embed request
  // per batch (<= UPSERT_BATCH films, well under OpenAI's input cap).
  const embed = async (texts) => {
    const r = await fetchRetry("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${OPENAI}` },
      body: JSON.stringify({ model: MODEL, input: texts }),
    }, "openai");
    return (await r.json()).data.map((e) => e.embedding);
  };
  const upsert = async (rows) => {
    await fetchRetry(`${rest}/movies?on_conflict=tmdb_id`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    }, "supabase upsert");
  };

  // 1. Enumerate the full catalogue (every page per year, floor + poster + overview).
  console.log(`Enumerating catalogue (${FIRST_YEAR}-${THIS_YEAR})…`);
  const films = new Map();
  for (let year = FIRST_YEAR; year <= THIS_YEAR; year++) {
    const first = await tmdb("/discover/movie", discoverParams(year, 1));
    const totalPages = first.total_pages ?? 0;
    if (!totalPages) continue;
    // TMDB caps discover at 10,000 results / 500 pages per query. Month-splitting
    // is not implemented (no single year is close today: ~15k films across ALL
    // years). If a year ever exceeds the window, stop with a clear message rather
    // than silently dropping its tail.
    if (totalPages > 500) {
      throw new Error(
        `Year ${year} has ${first.total_results} films above the floor, past TMDB's ` +
        `10,000-result / 500-page window. Add month segmentation for this year before building.`
      );
    }
    const collect = (results) => {
      for (const m of results ?? []) if (passesFloor(m)) films.set(m.id, toFilm(m));
    };
    collect(first.results);
    const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    await mapLimit(pages, TMDB_CONCURRENCY, async (p) => {
      collect((await tmdb("/discover/movie", discoverParams(year, p))).results);
    });
    process.stdout.write(`  ${year}: ${films.size} films so far\r`);
  }
  console.log(`\nCatalogue: ${films.size} films.`);

  // 2. Load existing hashes for resumability (skip films whose text is unchanged).
  const existing = new Map();
  for (let from = 0; ; from += 1000) {
    const r = await fetchRetry(`${rest}/movies?select=tmdb_id,text_hash`, {
      headers: { ...sbHeaders, Range: `${from}-${from + 999}` },
    }, "supabase select");
    const rows = await r.json();
    for (const row of rows) existing.set(row.tmdb_id, row.text_hash);
    if (rows.length < 1000) break;
  }
  console.log(`Already stored: ${existing.size} films.`);

  // 3. Enrich (keywords + collection id), compute text + hash, keep the changed.
  //    Count enrichment failures — a catalogue full of keyword-less films is worse
  //    than no build, so stop before paying if too many failed.
  const all = [...films.values()];
  let processed = 0;
  let enrichFailures = 0;
  const changed = [];
  await mapLimit(all, TMDB_CONCURRENCY, async (f) => {
    const { ok, keywords, collection_id } = await enrich(f.tmdb_id);
    if (!ok) enrichFailures++;
    const text = cheapText(f, keywords);
    const hash = textHash(text);
    if (existing.get(f.tmdb_id) !== hash) {
      changed.push({ ...f, keywords, collection_id, _text: text, text_hash: hash });
    }
    if (++processed % 500 === 0) process.stdout.write(`  enriched ${processed}/${all.length}\r`);
  });
  console.log(`\nChanged (need embedding): ${changed.length} of ${all.length}.`);

  // Stop before the paid step if enrichment was too lossy (> 1% failed): those films
  // would be embedded with missing keywords. They self-heal on a healthy re-run
  // (text changes -> hash changes -> re-embedded).
  const failPct = all.length ? (enrichFailures / all.length) * 100 : 0;
  if (enrichFailures) console.log(`Enrichment failures: ${enrichFailures}/${all.length} (${failPct.toFixed(2)}%).`);
  if (failPct > 1) {
    console.error(`Aborting before embedding: more than 1% of films failed enrichment. Re-run when TMDB is healthy.`);
    process.exit(1);
  }
  if (!changed.length) { console.log("Nothing to do. Catalogue is up to date."); return; }

  // 4. Embed + upsert BATCH BY BATCH, so a failure partway keeps every batch already
  //    stored (resumable within a run, not only between runs).
  console.log(`Embedding + upserting ${changed.length} films in batches of ${UPSERT_BATCH}…`);
  let stored = 0;
  for (let i = 0; i < changed.length; i += UPSERT_BATCH) {
    const batch = changed.slice(i, i + UPSERT_BATCH);
    const vectors = await embed(batch.map((f) => f._text));
    const rows = batch.map((f, j) => ({
      tmdb_id: f.tmdb_id, title: f.title, year: f.year, overview: f.overview,
      keywords: f.keywords, genre_ids: f.genre_ids, collection_id: f.collection_id,
      vote_count: f.vote_count, vote_average: f.vote_average, popularity: f.popularity,
      poster_path: f.poster_path, language: f.language,
      embedding: `[${vectors[j].join(",")}]`,
      model: MODEL, text_hash: f.text_hash, updated_at: new Date().toISOString(),
    }));
    await upsert(rows);
    stored += batch.length;
    process.stdout.write(`  embedded + stored ${stored}/${changed.length}\r`);
  }
  console.log(`\nDone. ${changed.length} films embedded and stored.`);
}

// ---- main ------------------------------------------------------------------
(REAL ? realRun() : dryRun()).catch((e) => {
  console.error("\nFailed:", e.message);
  process.exit(1);
});
