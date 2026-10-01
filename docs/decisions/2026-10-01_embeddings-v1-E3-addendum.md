# Embeddings v1 · E3 addendum (the part that runs inside the game)

*1 Oct 2026 · Author: Otto · Status: DRAFT until Lasse OKs section 2 · Extends `2026-10-01_embeddings-v1.md`*

E1 and E2 are done: 15,162 films embedded, 0 failures, and the Knives Out check returned both sequels first, then the whodunit canon. This addendum pins down E3 so Arthur builds it without guessing.

## 1. What E3 does, in one paragraph

After Round 2, each player gets a taste fingerprint (the average of the films they swiped "This vibe" on). If the two players' likes are close somewhere (option A), the midpoint of their closest pair of likes becomes a **shared seed**. Films nearest the seed go to **both** players' lists, so a real match gets more likely. The rest of the fresh slots come from each player's own fingerprint. Every fresh film must pass the same checks as today before it takes a slot. Claude still ranks; the overlap and bridge logic still picks the winner.

## 2. Numbers to approve (Otto's defaults, tuned in E4)

| Setting | Default | Why |
|---|---|---|
| Fresh slots per player | up to **6** of 16 candidates (was 2) | Approved E-2 |
| Shared vs own | up to **3 shared + 3 own**; own fills any shared gap | Half the new films are common ground, half are personal |
| Shared seed threshold | closest cross-player pair must be at least **0.45** similar | The Knives Out neighbours scored 0.53 to 0.69. Below 0.45 the two tastes are too far apart to share, so own fingerprints fill all 6 |
| Films retrieved per query | **40** | Enough left after availability and dedup |
| Extra availability checks | at most **12 TMDB calls per player** for fresh films | Protects the latency budget |

## 3. Build rules

1. **Flag:** `EMBEDDINGS_ENABLED` (server env). Off means today's path exactly; a test proves it. The eval route can override the flag per request (eval only, never the live game).
2. **Where:** `lib/retrieve.ts` (server-only) replaces `freshExpansion` in `lib/infer.ts` when the flag is on. Talk to Supabase with plain `fetch` to the REST/RPC endpoints, as the build script does. No new dependency.
3. **Fingerprint:** load the stored vectors of the player's liked films by TMDB id. Films missing from the catalogue are skipped. No usable likes means that player gets today's path.
4. **Checks before a fresh film takes a slot:** not already in the pool or swiped this game; kids-fare rule; franchise dedup against everything already in the candidates; E-9; available to this couple (their services, or rent if they said yes). Use the existing availability helper.
5. **E-9 (on with or without the flag):** a film both players swiped "Not it" never reaches Round 3 by any path (padding, backfill, fresh, cross-player). A player's own "Not it" film never pads their own list. Fresh films replace padding only; they never push out a liked film.
6. **Fail safe:** any database error, empty result or timeout (1.5 s per call) falls back to today's path, with one structured warning in the server log. Never an error screen.
7. **Log per game (server only, no personal data):** fingerprints built, shared pair similarity, fresh retrieved / eligible / used per player, retrieval time.
8. **Tests:** unit (average, pair pick, threshold, slot split, each check, E-9); one end-to-end test on the real path with the database stubbed at the `fetch` boundary; a flag-off test proving today's output is unchanged; a regression test for the fallback that fails without its fix.
9. **Scope:** `lib/`, `app/api/`, `tests/`, `eval/` only. No components, no styles.

## 4. Before E4 (Lasse)

Test on the live game (Lasse, 1 Oct: traffic is low, no separate preview needed). Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Vercel (Production). Keep `EMBEDDINGS_ENABLED=false` until Otto has reviewed E3, then set it to `true` and redeploy. The flag stays the kill switch: set it back to `false` and redeploy (one click, about a minute) if anything looks off. The offline judge run on the 17 couples happens locally and doesn't touch the live game.

## 5. Then

Arthur stops and reports. Otto reviews. E4 (gate run), then Cato's milestone review of E1 to E4.
