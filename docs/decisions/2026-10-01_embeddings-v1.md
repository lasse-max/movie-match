# Decision Brief · Embeddings v1 (Track A)

*1 Oct 2026 · Owner: Lasse · Author: Otto · Status: DRAFT. Lasse approves sections 3 and 6, then section 9 goes to Arthur.*

---

## 1. Goal in plain English

Make the final shortlist feel like it came from the whole film library, not the same small pool, so a film the couple hadn't thought of can show up and win. We do this without making picks worse, slower or more expensive.

**How, in one picture:** we give every film a "taste fingerprint" (an embedding: a list of numbers that places similar films close together). Each player's fingerprint for tonight is the average of the films they swiped "This vibe" on. We then pull the films nearest to that fingerprint from a catalogue of thousands. Those films join the candidates. Everything after that stays as it is today: Claude ranks, TMDB checks availability, and the overlap and bridge logic picks the winner.

## 2. Why the pool feels small (what the code does today)

In `lib/infer.ts`, each player's Round 3 shortlist (`TARGET_RECS = 8`) comes from at most 16 candidates (`MAX_CANDIDATES`), assembled in this order: (a) films the *other* player liked in Round 2 that fit this player's mood, (b) this player's own Round 2 likes, (c) **at most 2 "fresh" films** (`MAX_FRESH = 2`, TMDB's "recommendations" for the player's top liked films), (d) padding from the same ~45-film pool. So Round 3 is mostly films the couple has already seen in the game. That matches the beta finding exactly.

Round 2 is already used: Claude reads all swipes to rank, likes go straight into Round 3, and likes seed the 2 fresh films. **"Not it" swipes are only a hint to Claude**; nothing in the code stops a film both players swiped "Not it" from returning in Round 3 as padding.

Evidence we already have (June de-risk, `eval/results/step3-embed.md`): embeddings found **5.29x** more distinct, strong, on-taste films than the genre pool (an upper bound: availability wasn't applied), and kept producing fresh picks over 4 replays where the pool ran dry after 1. Using embeddings to *pick the winner* (maximin) failed and stays rejected.

## 3. Decisions in this brief (Otto recommends; Lasse approves)

| # | Decision | Recommendation |
|---|---|---|
| E-1 | Where it plugs in | Replace `freshExpansion` (TMDB recommendations) with embedding retrieval. Nothing downstream changes |
| E-2 | How much "fresh" | Raise fresh candidates from **2 to 6 of 16** per player as the starting value, then tune by the eval. This is the dial between magic and safety |
| E-3 | The catalogue | Films above today's quality floor (100+ votes, 6.2+ average) with a poster and an overview. Expect about 10 to 15k films; Arthur reports the real count before any paid step |
| E-4 | Model and text | OpenAI `text-embedding-3-small`, with the exact text recipe from the de-risk (`cheapText` in `eval/step3-embed.mjs`: title, year, overview, keywords), so the June evidence still applies |
| E-5 | Storage | The new Supabase project for Movie Match with pgvector (approved 1 Oct). Server-side access only |
| E-6 | Tonight's fingerprint | Average of the player's "This vibe" films that are in the catalogue. If none are, that player gets today's path. **No OpenAI call during a game** |
| E-7 | Kill switch | `EMBEDDINGS_ENABLED` environment flag, off until the gate passes. It is never a user-facing toggle |
| E-8 | No separate measurement step (**Lasse, 1 Oct**) | The June test already proved embeddings work. Arthur goes straight from catalogue to building. The final gate (E4) stays: picks no worse, game no slower |
| E-9 | Rejections go first (**Lasse, 1 Oct**) | A film **both** players swiped "Not it" never appears in Round 3. A film a player swiped "Not it" never pads that player's own list. Fresh films take the padding slots first; they never push out a film either player liked. Applies with or without embeddings |
| E-10 | Shared taste (**Lasse's idea, 1 Oct**) | Today the two players never swipe the same film in Round 2 (cards are dealt alternately, `selectSwipeSamples`; checked on all 18 frozen eval pools: 0 shared cards). The same film does reach both players in Round 3, because each list includes films the other player liked. **Option A (agreed with Lasse 1 Oct, in this build):** find the closest pair of likes across the two players and fill *both* Round 3 lists with films near that pair, so both see the same new films and a real match is more likely. **Option B (parked, optional experiment later):** make 2 of the 8 Round 2 cards the same for both players; a film both like becomes the strongest seed, even if already seen |

## 4. Rules that must hold (invariants)

1. **Always ends in a watchable decision.** Retrieved films pass the same quality floor, kids-fare rule, franchise dedup and availability check as today. They only ever add candidates; they never remove the genre pool.
2. **Fail safe.** Any retrieval problem (database down, timeout, empty result) falls back to today's path and is logged. Embeddings can never cause an error screen.
3. **Facts deterministic, AI for judgment.** TMDB owns titles, metadata and availability. Claude ranks. Geometry only sources. No maximin, no midpoint pick.
4. **Secrets server-side only.** No `NEXT_PUBLIC_` on any key; the Supabase service key never reaches the browser; the database has row-level security on with no public access.
5. **Speed.** The Round 2 to Round 3 step may grow by at most 1.5 s at the median (measured on a preview deploy). The countdown hides the wait, but it shouldn't have to hide much.

## 5. Build slices (Arthur stops after E2)

- **E1 · Schema.** One SQL migration file: enable `vector`; a `movies` table (TMDB id, title, year, overview, keywords, genre ids, collection id, vote count and average, popularity, poster path, language, embedding, model name, text hash, updated at); a cosine index; a `match_movies(query, k, exclude_ids)` function; RLS on. **Arthur writes it; Lasse applies it** in the Supabase SQL editor.
- **E2 · Catalogue build script** (`scripts/build-catalog.mjs`). A dry run first prints: film count, TMDB calls, tokens, cost and time estimate. The real run is idempotent and resumable (skips films whose text hasn't changed), batches embeddings and respects TMDB rate limits. **Stop and report the dry-run numbers.**
- **E3 · Runtime.** `lib/retrieve.ts` (server-only) wired into `inferMoods` behind the flag. Unit tests for the fingerprint and the fallback; one end-to-end test along the real path (route in, response out, database stubbed at the client boundary); a regression test for the fallback that fails without the fix.
- **E4 · Gate run.** The judge on the 17 valid couples, flag on vs off: no couple with a confirmed regression (a gap of -24 or worse), "fits both" stays 17/17. Report the real variety gain after availability (no pass bar; June already proved it). Latency on a preview deploy. Claude cost per game unchanged (still 16 candidates).
- Then **Cato** reviews E1 to E4 as one milestone (charge in section 8).

## 6. Lasse's actions

1. Create the Supabase project "movie-match" (Pro plan). **Region:** put the database in the same region as the Vercel functions (Vercel default is US East, `iad1`; check Project → Settings → Functions). If the launch audience will be Australian, move both to Sydney together later.
2. Put these in `.env.local` (and later in Vercel): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMBEDDINGS_ENABLED=false`. `OPENAI_API_KEY` only in `.env.local`: it's needed for the catalogue build, not in production.
3. Apply the E1 migration when Arthur hands it over. OK the E2 run after seeing the dry-run numbers.

## 7. Cost

- **Catalogue, once:** roughly 1 to 2 million tokens at $0.02 per million, so a few cents. A monthly refresh costs the same.
- **Per game:** no OpenAI call; one database query per player; Claude cost unchanged.
- **Supabase Pro:** from $25 a month (approved).

## 8. Cato charge (after E4)

1. **Invariant:** can any retrieved film reach Round 3 without passing the quality floor, kids-fare rule, franchise dedup and availability check? Try to break it.
1b. **Rejections (E-9):** can a film both players swiped "Not it" reach Round 3 by any path (padding, backfill, fresh, cross-player)? Can a player's own "Not it" film pad their list?
2. **Fallback:** database down, slow, empty, or a fingerprint with zero catalogue films: confirm today's path runs and nothing errors.
3. **Secrets and access:** no key client-side; RLS on; the service key only in server-only modules.
4. **Eval integrity:** on and off compared on the same frozen couples; the variety gain reported *after* availability.
5. **Scope:** no maximin or midpoint selector, no user-facing toggle, no component or style changes.
6. **Tests:** the end-to-end test exercises the real path; the regression test fails without its fix.

## 9. Paste to Arthur (once Lasse approves)

> You are Arthur, the builder on Movie Match. First run `git pull`, then commit the uncommitted docs (`CLAUDE.md`, `docs/decisions/`, `docs/design/PICTURE_PALACE_BRIEF.md` and the edits to `docs/HANDOFF.md`, `docs/MovieMatch_BACKLOG.md`, `docs/STATUS.md`) as one docs commit and push. Then read `CLAUDE.md`, then `docs/decisions/2026-09-30_2.0-kickoff.md` and `docs/decisions/2026-10-01_embeddings-v1.md`. Build **slices E1 and E2 only**: the schema migration (write it, do not apply it) and the catalogue build script with its dry run. Run the dry run and report the film count, TMDB calls, tokens, cost and time estimate. Do not run the paid build. Do not touch `components/` or styles. Commit in small steps, push, then stop and report: what you built, what you didn't, how to verify, and anything you're unsure about.
