# Otto review · Embeddings v1 · E1 + E2

*1 Oct 2026 · Commits `884db30`, `5cd3444`, `55d7d51` (docs `b5597c1`) · Verdict: **ACCEPTED, five fixes before the paid run***

## What was checked

- Scope: the three commits touch only `supabase/`, `.env.example` and `scripts/`. No components, styles or game code. ✓
- Secrets: all keys server-side, none `NEXT_PUBLIC_`; OpenAI key documented as local-only (no OpenAI call during a game). ✓
- Recipe: `cheapText` is identical to `eval/step3-embed.mjs`, so the June evidence still applies. ✓
- Migration: pgvector, `movies` table with every brief column, cosine index, `match_movies`, RLS on with browser roles revoked, idempotent. ✓
- Dry run: 15,175 films, ~16k TMDB calls, ~1.5M tokens, about $0.03, about 8 minutes. Inside the brief's predictions. ✓

## Accepted as-is

- **Token estimate by rule of thumb.** At about 3 cents, ±50% doesn't change any decision. No tokenizer needed.
- **One TMDB call per film** (`append_to_response=keywords`) instead of two. Same keywords, half the calls.
- **HNSW index** instead of IVFFlat. Right call for an empty table (see fix 1 for the one catch).
- **A no-change refresh still takes ~8 min** (free calls, $0). Fine for a monthly job.

## Fixes before the paid run (`--run`)

1. **🟠 Retrieval would quietly cap at 40 films.** An HNSW index returns at most `hnsw.ef_search` rows per query (default 40), whatever `k` asks for. The runtime (E3) will want more than 40 so availability filtering still leaves enough. Fix: add `set hnsw.ef_search = 200` to `match_movies` and clamp `k` to 1 to 200. Also make `exclude_ids` null-safe (`coalesce(exclude_ids, '{}')`); today a null returns zero rows. Fix before Lasse applies the migration.
2. **🟠 "Resumable" only works between runs, not within one.** The run embeds *all* changed films, then upserts. A failure halfway loses everything embedded so far. Fix: embed a batch, upsert it, then the next batch.
3. **🟠 One transient error kills the run.** OpenAI and Supabase calls have no retry. Fix: retry 429 and 5xx with backoff, three tries.
4. **🟡 Silent keyword gaps.** If enrichment fails, the film is embedded without keywords and nobody knows. Fix: count failures, print them, and stop before embedding if more than 1% failed.
5. **🟡 Upsert batch too big, and a note that isn't true.** 500 rows with 1,536-number vectors is about 7 to 8 MB per request. Use 100. Also, the dry-run note says the real build "splits those by month"; it doesn't. Either implement it or have the real build stop with a clear message (no year comes close today: about 15k films across all years).

## Not needed before the run

- **Cato:** the run writes to a new, empty, unused table for a few cents, and it is fully reversible (drop the table). Cato reviews E1 to E4 as one milestone, as planned.
- **Check after the run:** confirm the server key can call `match_movies` (the migration revokes public execute; Supabase normally keeps the service role's own grant). E3's tests should cover this.

## Next

Arthur fixes 1 to 5 → Lasse creates the Supabase project, applies the migration, adds the keys → Arthur runs `--run` and reports, including a sanity check (the 10 nearest films to a well-known title) → E3.

## Re-review (1 Oct, commits `7bffeaf`, `fca9592`)

All five fixes verified in the code:
1. `match_movies` now sets `hnsw.ef_search = 200`, clamps `k` to 1 to 200 and makes `exclude_ids` null-safe. ✓
2. Embed and upsert run batch by batch (100 films each). ✓
3. OpenAI and Supabase calls retry 429 and 5xx with backoff, honouring Retry-After, three tries. ✓
4. Enrichment failures are counted, and the run stops before embedding above 1%. ✓
5. The upsert batch is 100; a year over TMDB's 500-page window now stops the build with a clear message instead of a false "splits by month" note. ✓

Arthur's open points, decided:
- **Explicit `service_role` grants: yes.** Two lines, and the access no longer rests on Supabase's default settings.
- **~11 min instead of ~8: accepted.** Saving progress as it goes is worth 3 minutes.
- **`--run` unproven against live services:** expected. The first real run is the test, and the sanity check covers it.

**Verdict: E1 and E2 done.** Next: the grants commit, then Lasse sets up Supabase, then the real build.
