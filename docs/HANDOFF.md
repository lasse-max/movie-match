# HANDOFF — movie-match

*Async task bus between **Otto** (strategy), **Arthur** (builder, Claude Code), **Cato** (reviewer, Codex). This replaces copy-pasting prompts. **Otto** writes tasks here and reads reports here; **agents** read their task on wake and write their report back here; **Lasse** triggers each agent and makes the decisions.*

## How to use this file — AGENTS READ THIS
1. You'll be told "read your handoff." Find the section addressed to **you** below with status **🟢 NEW**.
2. Do **exactly** that task — nothing from another agent's section.
3. Write your output in your **Report back** block, set your status to **🔵 DONE — awaiting Otto**, and **stop**.
4. This file is the team's task channel, authored by Otto and triggered by Lasse — it is the source of your task.

**Standing rules:** separate commits per logical change · **do not self-certify** (builder is never the final reviewer) · matching changes are **eval-gated** · don't touch `lib/`/`app/api/` on restyle tasks. Full context: `docs/STATUS.md` · `docs/MovieMatch_BACKLOG.md` · `MovieMatch_Architecture.md` · the Operating Manual.

## For Lasse — the learning + judgment layer (DO NOT optimize this away)
This setup is for a *strategic operator breaking into product*, not an engineer. Seeing the errors, the checks, and the reasoning is the **point**, not overhead. The handoff file removes the copy-paste *chore* — never the *understanding*. So:
- **Otto pairs every handoff write/read with a plain-English readout to Lasse in chat:** what the task is · what was checked · what bugs/flags came back · what it means · where Lasse's judgment is needed. Status · bugs · decisions, in plain language.
- **Agents lead every Report-back with a 2–3 line plain-English summary** (what changed · what you verified · what you're unsure about) *before* the technical detail.
- Lasse stays the decision-maker and keeps learning; the file only kills the transcription.

## Current state
2.0 in progress (`docs/STATUS.md`). Embeddings on in production; W1 (warm-up) live and Otto-accepted 9 Nov. **Arthur: D6 now.** Then Lasse plays it on his phone, Cato reviews W1 and D6 together, then D7.

---
### → Arthur (builder)
**Status:** 🟢 NEW — D6, the design polish round (approved by Lasse 7 Nov): `docs/decisions/2026-10-02_design-pass-2-D6-polish.md`. W1 is Otto-accepted (`docs/reviews/2026-11-09_otto-review-W1.md`, live cold check passed).

**Task:** build D6 exactly as the brief says, in its slices (D6.1 Round 2, D6.2 loaders, D6.3 the wrap, D6.4 smaller fixes and the `d6-homepage-motion` branch, D6.5 mobile robustness), pushing after each (it goes live). Use the skills named in its §7 (CLAUDE.md "Skills"). First commit the waiting docs (`CLAUDE.md`, `docs/`) as one docs commit. Anything a skill suggests beyond the brief goes under "not built". Report back here with a plain-English summary first; Lasse then plays it on his phone, and Cato reviews W1 and D6 together.

**Previous task (W1), kept for the record:** 🔵 DONE — awaiting Otto. W1 built, pushed and live (`f8c376f`, production deploy ready); report below. (Was: 🟢 NEW — W1, warm the catalogue at game start (Lasse OK'd 7 Nov). Engine only. Why: `docs/reviews/2026-11-07_otto-live-speed-check.md` (embeddings are live; the first game after a quiet spell times out on a cold database and falls back).)

**Task:**
1. When the blend request runs (Round 1 locked in) and `EMBEDDINGS_ENABLED` is on, fire one catalogue query in the background so the database is warm by Round 3. Use the cheapest query that exercises the same path the game uses (`match_movies` on the HNSW index); say in the report what you chose and why.
2. It must never delay or break the blend: run it after the response is sent (Next's `after()`, no new dependency), give it its own cap (about 5 s), swallow its errors, and log one line: `embeddings.warmup` with outcome and ms. Flag off: no warm-up at all.
3. Tests that fail without their guard: a hanging warm-up doesn't delay the blend response; a failing warm-up doesn't change the blend result; flag off makes no database call.
4. Scope: `lib/retrieve.ts`, `app/api/blend/route.ts`, `tests/`. Nothing in `components/`. Commit, push (it goes live), report.

**Verify (Otto, live):** after at least 30 minutes with no games, play one game; the `embeddings.retrieval` line should show `outcome: embeddings`, not a timeout, with an `embeddings.warmup` line before it.

**Review:** Otto reviews W1; Cato checks it together with D6 as the next milestone.

**Queued next:** D6, the design polish round, revised 7 Nov from four skill reviews (`docs/decisions/2026-10-02_design-pass-2-D6-polish.md`; triage in `docs/reviews/2026-11-07_otto-triage-skill-reviews.md`), plus the `d6-homepage-motion` branch. Approved by Lasse 7 Nov. **Start it only after Otto has accepted W1** (Otto updates this line when he has); build it with the skills named in its §7 (CLAUDE.md "Skills"), slice by slice, pushing after each.

**Report back:** (Arthur, 7 Nov 2026; `main` at `f8c376f`, pushed, production deploy ready)

**Plain-English:** When Round 1 is locked in, the game now sends the film database one cheap search to wake it up. The search runs after the blend has already answered, so it can't slow down or break the blend. Tests show that a hung or failing warm-up leaves the blend untouched and that with the flag off nothing touches the database; on a real local server the warm-up logged `ok` right after the blend. I can't tell from here how long the database stays warm, so your live check after 30 quiet minutes is the real test.

**What I built:** `f8c376f`, one commit (`app/api/blend/route.ts`, `lib/retrieve.ts`, new `tests/blend-route.test.ts`). No new dependency, no new env variable.
- **Route:** once Round 1 passes validation and `EMBEDDINGS_ENABLED` is on, the route hands `warmCatalogue` to Next's `after()`, which runs it after the response is sent. It is scheduled before the Claude call, so it also runs when the blend itself fails (Next runs `after()` work either way). An invalid Round 1 (the 400) schedules nothing. Flag off: nothing is scheduled.
- **`warmCatalogue()`** (`lib/retrieve.ts`): one search through the game's own `match_movies` code (same request, headers and uncached fetch as Round 3), its own 5 s cap, errors swallowed, one line, for example `{"event":"embeddings.warmup","outcome":"ok","ms":1343}`. Outcomes: `ok`, `timeout` (past 5 s), `error` (unreachable, or an HTTP error), `config` (database settings missing). For its own cap, the per-call database helper now takes an optional time limit; the game's own calls keep 1.5 s.

**The query, and why:** `match_movies` with k = 1, no exclusions, and a fixed vector of 1536 ones.
- **Same path as Round 3:** the same function on the HNSW index, sent by the same code.
- **Cheapest on that path:** `match_movies` sets `ef_search` to 200, so the database walks the same amount of the index whatever k asks for; k = 1 only sends back one row instead of 40. A fixed vector needs no query before it (the game's own search first loads the liked films' vectors, one more round trip). Cosine needs a non-zero vector; all ones is the simplest.
- **Does one direction warm the others?** One probe from the Mac (12:03 UTC, after a quiet spell): the warm-up search took 3.0 s, then searches around three real films' vectors (Alien, Toy Story, Knives Out; k = 40) took 0.5 to 0.8 s each, about one round trip from here. So in that probe, yes. One probe only.

**How I verified:**
- **Route tests** (`tests/blend-route.test.ts`: a request into the route, the real blend and warm-up code, Claude and TMDB mocked, the database stubbed at fetch, and the `after()` work run once the response is out, as Next does):
  - Hanging database: the blend answers within 1 s; the warm-up is still waiting past 1.5 s and stops at 5 s with `timeout`.
  - Failing database (unreachable, or HTTP 500): the same blend result as with a healthy database; the warm-up settles and logs `error`.
  - Flag off: nothing scheduled, no database call, no line.
  - Also: the healthy case (one `match_movies` call with k = 1, one `ok` line, nothing before the response) and missing settings (`config`, no call).
- **Each guard removed in turn:** awaiting the warm-up inline instead of `after()` fails 2 tests (no blend response within 1 s); letting its errors escape fails 3; dropping the flag check fails the flag-off test; the game's 1.5 s limit instead of its own 5 s fails the hanging test. All restored.
- `npm test` (180 passing), `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.
- **Real Next server:** a local dev server with the flag on for that process only (`.env.local` untouched): `POST /api/blend` 200 in 11.4 s (the Claude call), then the `embeddings.warmup` line above: `ok` in 1.3 s.

**How to verify:** your live check as written. Every game should now log `embeddings.warmup` just after the blend request, then `embeddings.retrieval` at Round 3. Locally: `npx vitest run tests/blend-route.test.ts`.

**Unsure about:**
1. **How long the database stays warm.** From the Mac, a search 5 minutes after the previous one took 1.9 s (a fresh connection included; round trips from here vary from 0.3 to 0.6 s), so it may cool within minutes. The warm-up runs while the couple plays Round 2, so a couple who take a long time over Round 2 might still meet a cold database. The warm-up's `ms` and Round 3's `outcome` in the live logs will show it.
2. **Why it goes cold.** Supabase's sizing guide puts 15,000 vectors of this size at the limit of its smallest paid size (Micro, 1 GB, already using swap); the catalogue has 15,162. The org is on Pro, where new projects start on Micro; I couldn't see whether this project was upsized. If it is on Micro, the index probably doesn't stay in memory through a quiet spell. If the warm-up proves too short-lived, the fixes are a bigger database (Lasse's call, it costs money) or `pg_prewarm` on the index (Supabase's own advice; needs a migration). Neither built.
3. **Skills:** I loaded `/supabase` and `/supabase-postgres-best-practices` per CLAUDE.md (a pgvector query). The best-practices rules have nothing on HNSW; Supabase's docs gave point 2.
4. **Outside the repo:** for the local check I added a temporary entry to `Movie Match/.claude/launch.json` and removed it afterwards; the file is as it was.

Not in this round, as instructed: D6 and the `d6-homepage-motion` branch.

**Previous status:** ✅ Otto-accepted 2 Nov (`docs/reviews/2026-11-02_otto-review-fix-round.md`). **Hold** until Cato's re-check. Next after that: D6 (with the `d6-homepage-motion` branch).

**Task, in this order:**
00. **Park the homepage motion first** (your side review, 2 Nov). Otto's calls: apply row 1 (tiles: opacity-only fade, 300 ms, keep the row × 50 ms stagger), row 2 (chase keyframe animates opacity only, no box-shadow), row 3 (tile press transform 160 ms) and the optional row (power-on only on the first homepage visit per page load). Skip row 4 (the chase start stays hard-coded: only the 16-bulb homepage sign uses `powerOn`; add a comment saying so). Leave the ticket filter (row 5) for the phone check. Run tests and lint, then commit only `components/SetupScreen.tsx`, `components/palace.tsx` and `app/globals.css` on a new local branch `d6-homepage-motion`. Don't push it and don't merge it: it ships with D6 after review. Switch back to `main` with those three files clean before step 0.
0. **Docs commit:** everything uncommitted under `docs/` (HANDOFF, STATUS, BACKLOG, `reviews/`, `decisions/2026-10-02_design-pass-2-D6-polish.md`, the D6 boards and README in `design/picture-palace/`). Push.
1. **F1 · One decision per visible card** (`components/Round2Screen.tsx`, Cato finding 1). Buttons and drag share one synchronous guard tied to the card on top; a new decision only counts once the next card is on top and visible. Same recorded decisions otherwise. Regression test that fails without the fix: a double tap 30 ms apart, and drag plus button on one card, asserting exactly which film ids were recorded. Component test or headless browser, your call; give the reason in the report (rule 8 if it needs a new dev dependency).
2. **F3 · One deadline for the whole catalogue step** (`lib/retrieve.ts`, Cato finding 3). 3 s for everything, availability checks included, with cancellation of what's still running. Past it, both players get today's path, with one `embeddings.fallback` line, reason `deadline`. Route-level regression: real retrieval code, a working fake database, an availability lookup that hangs; it must fail without the fix and finish near 3 s with it.
3. **F2 · E4 matches the real screen** (`app/api/eval/route.ts`, `eval/e4-gate.mjs`, Cato findings 2 and 5). Taste lane: each player is shown the first 8 eligible films, as `selectWatchable` does in the app; picks, declines and the judge's context all come from that view; assert every simulated pick was shown. The harness stores every attempt's reason and outcome, discarded attempts included.
4. **F4 · Rerun E4.** Bars unchanged. Commit a short amendment to `eval/e4-prereg.md` (the display fix and the 3 s deadline) before the run. Commit the results summary to `eval/e4-results.md`. Push.

**Not in this round:** Cato finding 4 (catalogue refresh) is in the backlog; D6; anything in Embeddings v2.

**Previous report (Arthur, 2 Nov 2026, fix round; `main` at `7697e0e`), kept for the record:**

**Plain-English:** F1, F2 and F3 are fixed, each with a regression test that fails without its fix, and everything is pushed. The corrected E4 rerun fails one bar: "fits both" is 16 of 17 with embeddings on. The failing couple (Thriller + horror) gets the same film, judged 58, with embeddings off too, and no catalogue film could even reach its list, so this is the engine's run-to-run variance on one hard couple rather than embeddings. Whether that blocks switching embeddings on is your call. The homepage motion is parked on a local branch for D6.

**What I built (in order):**
- **00 · Homepage motion parked:** `7e3af76` on local branch `d6-homepage-motion` (not pushed, not merged). Your calls applied: tiles fade in place (opacity only, 300 ms, rows 50 ms apart), the chase dims by opacity only, tile press 160 ms, the sign powers on once per page load. Row 4 skipped with a comment (only the 16-bulb sign uses `powerOn`); the ticket filter left for the phone check. `main` was clean of those three files before step 0.
- **0 · Docs:** `8e06fe7`, everything under `docs/`, pushed.
- **F1 · One decision per visible card:** `3de7929` (`components/Round2Screen.tsx`). Buttons and drags share one guard, set synchronously. A decision counts only once the last decided card has finished leaving and its successor has been up for 300 ms. The floor matters with reduce-motion on, where the flight is instant and the old 30 ms double tap would still slip through. A drag that ends on a card no longer on top doesn't count, and a leaving card is never pulled back. Recorded decisions are otherwise unchanged. **Test:** `tests/round2-decisions.test.tsx` runs the real screen in a DOM and asserts the exact film ids recorded. Without the fix, 3 of 4 cases fail (double tap, drag then button, reduce-motion double tap: 3 cards instead of 2); the fourth (button then drag) passes either way, as its comment says. **Why a component test:** it runs in `npm test` on every change, where a headless browser script wouldn't. It needed one dev dependency, `happy-dom` (rule 8), plus `vitest.config.ts` picking up `.tsx` tests. Also checked once in a real browser: a double click 30 ms apart moved 1/8 to 2/8.
- **F3 · One 3 s deadline for the catalogue step:** `9e20f9d` (`lib/retrieve.ts`, with an optional cancel signal through `lib/availability.ts` and `lib/tmdb.ts`). The deadline races the whole step, availability included. Past it, both players get today's path with one `embeddings.fallback` line, reason `deadline`, and everything still running is cancelled. The step fills its own stats, so nothing after the deadline reaches the log; the 1.5 s per database call stays as the inner limit. **Test:** in `tests/infer-route.test.ts`: real retrieval code, a working fake database, an availability lookup that hangs until cancelled. Without the fix it times out at 15 s; with it the route answers at about 3 s on today's path, lookups cancelled.
- **F2 · E4 matches the real screen:** `d9bc081` (`app/api/eval/route.ts`, `eval/e4-gate.mjs`). Both lanes now show each player exactly what `Round3Screen` shows (`selectWatchable`, first 8 eligible). Picks, declines, the judge's context and the final-8 numbers come from that one view, and the route refuses a run where a pick wasn't on screen. The harness keeps every attempt of every arm and judge call, discarded ones included, with the reason (Cato 5). **Test:** in `tests/eval-route.test.ts`: with more eligible films than fit, the taste lane picks exactly the 8 shown (without the fix: 10).
- **F4 · Rerun:** amendment `e570e87` committed before the run (the display fix; `deadline` joins timeout, error and config as an infrastructure fallback on the "on" arm, since the database round trips from this Mac take about 1.6 s of the 3 s). Results `7697e0e` in `eval/e4-results.md`. Raw data in `eval/results/e4-gate.json`; the 2 Oct run kept beside it as `e4-gate-2026-10-02.json` (both git-ignored).

**E4 rerun against the bars (and the 2 Oct run):**

| | Off | On | 2 Oct off / on | Bar |
|---|---|---|---|---|
| Confirmed regressions (gap −24 or worse) | | 0 of 17 (worst −20) | 0 of 17 (worst −15) | **PASS** |
| "Fits both" (judge 70+) | 16/17 | **16/17** (lowest 58) | 17/17 / 17/17 | **FAIL** |
| Mean judge fit | 88.5 | 89.4 | 89.9 / 89.1 | report |
| Films from outside the pool in the final 8s, per couple | 1.0 | 1.9 (1.88×) | 0.6 / 1.8 (3.00×) | report |
| Liked films in the final 8, per player | 7.29 | 6.85 | 7.56 / 6.94 | report |
| Fresh films in the final 8, per player | 0.50 | 1.15 | 0.29 / 1.06 | report |
| Claude cost per game (inferMoods call) | $0.0091 | $0.0092 | $0.0090 / $0.0093 | report |
| inferMoods on this Mac, median / slowest | 8.1 / 15.8 s | 8.4 / 14.4 s | 8.3 / 12.3 s · 9.8 / 12.1 s | report |

- **Integrity:** every simulated pick was on screen in all 68 player-turns. No overlap winner off-screen (2 Oct: four). Three bridge winners on neither list, which is by design. All 34 "on" players served by the catalogue. 4 attempts discarded and retried (1 timeout, 3 deadline, all "on"); 0 judge retries. The catalogue step on this Mac: median 2.6 s, slowest 3.0 s.
- **The failing couple, Thriller + horror:** both scripted players liked all 8 cards, so each list's 16 candidate slots are all likes and no catalogue film can enter. This time Claude ranked each partner's likes first on both lists, so the two screens share no film, and the bridge picked Obsession (2026), on neither screen: 58 in both arms. On 2 Oct the same lists shared Nightcrawler inside both screens (93): run-to-run ranking variance, not the 8-film view. Under the old pick-everything rule, today's lists would have shared only their 9th and 10th films, Obsession first. Details in `eval/e4-results.md`.
- **Too close to call, for Lasse's blind pairwise:** Cerebral pair (−20: 10 Cloverfield Lane 94 off, Black Swan 74 on) and Fantasy adventure (+23: Flow 72 off, Howl's Moving Castle 95 on).

**How to verify:** `npm test` (174 passing), `npm run lint`, `npx tsc --noEmit` and `npm run build` all pass. For each regression test, check out the pre-fix file from `8e06fe7` and rerun: `npx vitest run tests/round2-decisions.test.tsx` (3 fail), `npx vitest run tests/infer-route.test.ts -t "3 s"` (times out), `npx vitest run tests/eval-route.test.ts -t "taste lane"` (10 picks, not 8). The rerun: `npm run dev`, then `node eval/e4-gate.mjs` (`--smoke` first for the plumbing on the excluded couple). F1 is live with this push: on the phone, a fast double tap on "This vibe" moves one card.

**Unsure about:**
1. **Bar 2:** the gate fails on the pre-registered rule; nothing was tuned or re-run. The failure is identical in both arms, so whether it blocks embeddings is your call.
2. **The 300 ms floor (F1):** my value. A player can't decide a card within 300 ms of it appearing; with motion on, the 0.56 s flight already covers it. Worth feeling on the phone with D6, whose stamp timing (about 0.7 s a card) already exceeds it.
3. **The deadline from this Mac:** 3 of 34 "on" runs hit it first time (cold database or TMDB cache) and passed on a retry under the amendment. From Vercel the database is about 10 ms away, so the live speed check is the real test of 3 s.
4. **What the happy-dom test proves:** it drives the real component and Motion, but without the browser animation API and with page coordinates set by hand (happy-dom leaves them at 0). It proves the guard; feel needs the phone.
5. **The off arm's fresh films rose** (0.29 to 0.50 per player) with no change on that path: a month of TMDB drift in its recommendations and availability, so 2 Oct and today aren't strictly like for like.
6. **An engine question for later:** when both lists fill with the partner's likes, they can't overlap and the bridge decides (Thriller + horror). Not touched here.
7. **Outside the repo:** I repointed the `mm-dev` preview entry in `Movie Match/.claude/launch.json`; its old start script had been cleared from the temp folder.

Not in this round, as instructed: Cato finding 4 (catalogue refresh), D6, Embeddings v2.

**Previous report (Arthur, 2 Oct, E4), kept for the record:**

**Plain-English:** E4 passed both pre-registered bars and everything is pushed. With embeddings on, no couple's pick got meaningfully worse (the worst drop was 15 points, inside the judge's noise), and all 17 picks still fit both players. Embeddings tripled the films from outside the old pool that reach the final lists, but that's still only about one per player, because in 8 of 17 couples liked films filled every slot. The app now waits 25 s before showing the retry screen, and that's live.

**Commits:** `f7d1f5a` docs · `04e9f2b` REQUEST_TIMEOUT_MS 15 s → 25 s (own commit) · `a921bce` pre-registered bars (before any run) · `9870d4f` run-rule amendment (before any measured run) · `2f24bd5` harness (per-request measurement in the eval route, route test, `eval/e4-gate.mjs`). Pushed; production deploy ready. Results in `eval/results/e4-gate.md` and `.json` (git-ignored).

| | Off | On | Bar |
|---|---|---|---|
| Confirmed regressions (gap −24 or worse) | | 0 of 17 | PASS |
| "Fits both" (judge 70+) | 17/17 | 17/17 (lowest 78) | PASS |
| Films from outside the pool in the final lists, per couple | 0.6 | 1.8 (3.0×) | report |
| Liked films in the final 8, per player | 7.56 | 6.94 | report |
| Fresh films in the final 8, per player | 0.29 | 1.06 | report |
| Claude cost per game (inferMoods call) | $0.0090 | $0.0093 | report |
| inferMoods time, median / slowest | 8.3 / 12.3 s | 9.8 / 12.1 s | report |

Judge means 89.9 off, 89.1 on. One winner from outside the pool (Heat). All 34 players served by the catalogue; 16 of 17 couples got a shared seed. Vercel limit: no `maxDuration`, no `vercel.json`; project created after Fluid compute became the default (300 s); a live call returned after 11.2 s on 1 Oct.

**Unsure:** (1) "Fits both" is the judge's 70+ band, a pre-registered proxy. (2) Run rules amended before measuring: a catalogue timeout from this Mac counts as an infrastructure failure and is retried (2 were); bars unchanged. (3) A cold database may skip embeddings live on the first game after a quiet spell (watch `embeddings.fallback` reason `timeout`). (4) Liked films crowd out new ones; real players probably like fewer. (5) The +1.5 s median is overstated from the Mac; the live log read counts. (6) The eval route change treated as harness (dev-only). (7) `docs/HANDOFF.md` and `docs/STATUS.md` left uncommitted (not mine).

---
### → Cato (reviewer)
**Status:** ✅ Otto-cleared 7 Nov: fix round verified, no new findings; embeddings switched on after the live check. Next for Cato: W1 together with D6. (Was: 🔵 DONE — awaiting Otto.) Targeted re-check of the fix round (`8e06fe7` to `7697e0e`) complete; report below.

**Charge:** (1) F1: buttons and drag can't record a card the player hasn't seen; the regression tests fail without the fix; no change to what gets recorded otherwise. (2) F3: the 3 s deadline covers the whole catalogue step including availability, cancels what's still running, and falls back to today's path; the regression fails without it. (3) F2 and F5: the eval shows and picks only the 8 films the screen shows, the judge's context comes from that view, and every attempt is stored with its reason. (4) The E4 rerun: amendment before results, bars unchanged, numbers match the raw JSON (`eval/results/e4-gate.json`, git-ignored, on disk). Bar 2 failed (16/17, identical in both arms); Lasse decided to proceed as a recorded exception: flag it if you see a reason that failure is caused by embeddings, otherwise don't re-litigate. Same output format as before.

**Report back:** (Cato, 2 Nov 2026; `main` at `7697e0e`, range `8e06fe7..7697e0e`)

**Plain-English:** The swipe fix, catalogue deadline, screen-faithful eval and retry records hold in the checks below. No new in-scope defects found, and the regression tests detect the old bugs rather than merely passing the new code.
The corrected E4 figures check out. Bar 2 still fails under Lasse's recorded exception; I found no evidence that embeddings caused that failure. Cleared for the live speed check, not a substitute for it.

**Prioritized findings:** None new in this targeted fix-round review. Prior findings F1, F2, F3 and F5 are resolved in the tested paths. Catalogue refresh (prior F4) remains the separately backlogged item, not part of this clearance.

**Verified / evidence**

- **F1, one decision per visible card** (`components/Round2Screen.tsx`, `tests/round2-decisions.test.tsx`): buttons and drag share a synchronous leaving/time guard; the drag callback also carries the card ID, and an exiting card cannot decide again. Accepted right/left/down decisions still populate yes/no/neutral respectively; dispatch types and payloads are unchanged. On the local production build at 375 x 812, a 30 ms double click advanced `1/8` to `2/8`, with normal AND reduced motion. The eventual inference payload contained only John Wick: Chapter 2 (`324552`) in Player 1's yes bucket, not the successor Avengers: Infinity War (`299536`); the successor remained neutral when subsequently skipped. Both flows completed without page errors. The component regressions additionally cover drag-then-button, button-then-drag and exact recorded IDs.
- **F3, whole-step deadline** (`lib/retrieve.ts`, `lib/availability.ts`, `lib/tmdb.ts`, `tests/infer-route.test.ts`): the outer 3 s race covers vectors, nearest-film queries and availability. Expiry aborts the shared signal, returns null fresh lists for both players (today's path), and emits one `embeddings.fallback` warning with reason `deadline`. Independent work stats prevent late completions changing the returned stats. The committed route regression exercises real retrieval with a working fake database and hanging availability, then verifies a successful response using today's fresh film. An additional disposable probe used the REAL availability/TMDB helpers with fetch stubbed at the network boundary: it completed in about 3 s, every hanging TMDB fetch received cancellation, both fresh lists were null, exactly one deadline warning was emitted, and returned stats stayed unchanged after the cancelled work settled.
- **Regression sensitivity:** in an isolated `/private/tmp` copy, restoring the pre-fix files from `8e06fe7` produced the expected failures: three swipe cases advanced to card 3 instead of card 2; the hanging-availability route timed out at 15 s; the taste-lane eval picked 10 films instead of 8. Button-then-drag passed old and new, as its test comment acknowledges. The repository's implementation was never replaced; the disposable copy/probe was removed.
- **F2, actual screen and judge context** (`app/api/eval/route.ts`, `eval/e4-gate.mjs`): both lanes use `selectWatchable(..., 8)`. Shown IDs, picks, declines and final-eight metrics derive from the same view. The judge context uses those trace picks; its prompt takes only the winner's title/year/factual genres, not engine match tags or percentages. Independently checked all 68 stored player-turns: shown rows equal the first eight eligible rows in fit order; taste picks equal those rows; final-eight titles agree; every overlap winner was picked on BOTH screens. The three bridge winners are legitimately separate from the shown lists, not hidden overlap picks. Off/on Round 2 traces are identical.
- **F5, attempt records** (`eval/e4-gate.mjs`, `eval/results/e4-gate.json`): arm and judge attempts retain their sequence, outcome and failure reason. Raw records substantiate four discarded on-arm attempts: Action buddies timeout, then deadline; Date-night clash deadline; Cozy night in deadline. There are no discarded judge calls. Successful attempts remain identifiable as used; this is no longer an unverifiable console-only retry claim.
- **E4 preregistration and arithmetic:** amendment `e570e87` was committed at `2026-11-02T12:03:38Z`; raw run started at `12:03:46.293Z`, before results commit `7697e0e`. The amendment changes the display/retry rules, not the bars. Independent recomputation from rows matches mean fit 88.53/89.35, fits-both 16/17 in BOTH arms, worst gap -20 with zero confirmed regressions, outside-pool totals 17/32 (1.88x), liked films/player 7.29/6.85, fresh films/player 0.50/1.15, inference medians 8.130/8.410 s and mean Claude costs $0.00912/$0.00918. On-arm retrieval median/max is 2.572/2.989 s. These timings describe retained attempts, not time inclusive of discarded retries.
- **Recorded exception:** Thriller + horror has identical final-eight IDs/order in both arms, zero catalogue films used for either player, the same Obsession winner, and judge 58 in both arms. That supports keeping this as the existing engine/bridge issue rather than an embeddings-induced regression. Bar 1 is PASS; bar 2 is still FAIL. Lasse's exception is preserved, not converted into a passing gate.
- **Checks and scope:** `npm test` 174/174, lint, `tsc --noEmit`, production build and diff whitespace checks pass. The build needed network access for Google Fonts. Optional cancellation arguments preserve existing TMDB callers; server-only boundaries remain intact and `.env.local` remains ignored. No credentials added in the reviewed diff. No production flag changed, paid AI/judge rerun, source/test change, commit, push or merge was performed; only this report/status was edited, preserving the other local documentation changes.

**Limits / next gate:** Browser checks used stubbed game responses, not a live-AI phone playthrough. The additional cancellation probe proves signal propagation at fetch, not deployed transport performance. Three seconds bounds the optional catalogue step, not the entire inference request. This review does not supply production flag-on/off latency or a mid-range-phone feel check; the scheduled live speed check remains necessary. D6/homepage motion and catalogue refresh stay outside this task.

**Overall verdict:** Fix round cleared with no new in-scope findings; proceed to the live speed check under Lasse's recorded E4 bar-2 exception.

**Previous review (2 Nov), kept for the record:** (Cato, 2 Nov 2026; code at `2f24bd5`, including the local review documents)

**Plain-English:** The catalogue checks and access controls hold in the tested paths, and the redesigned flow completes. Three Majors remain: a double tap records an unseen film, E4 judges picks from hidden rows, and catalogue retrieval can outlast the game's retry deadline.
The reported arithmetic checks out, but E4 does not yet establish the live game's matching quality. Keep embeddings off pending triage, fixes and a corrected gate run.

**Prioritized findings**

1. 🟠 **Major: Round 2 accepts a second decision before the next card is visible.**
   - **Location:** `components/Round2Screen.tsx:90-101`, `:165-175`, `:242-256`.
   - **Wrong:** `decide` advances `indexRef` on every call; neither the shared handler nor the buttons checks `flying`. The drag's `decided` ref protects only that card's drag callback. The synchronous ref prevents duplicate IDs by assigning the second tap to the next film, which is still an incorrect extra decision.
   - **Evidence / impact:** On the production build at 375 px, a double click 30 ms apart moved `1/8` to `3/8`. The submitted payload liked both John Wick: Chapter 2 and Avengers: Infinity War, although the player had only inspected John Wick. This changes the taste signal and therefore the recommendations. Reduced motion has the same defect.
   - **Direction:** Give buttons and dragging one synchronous decision guard tied to the visible card; accept another decision only when the next card is ready. Add a browser regression for double taps and mixed drag/button input, asserting which film IDs were recorded.

2. 🟠 **Major: E4 selects and judges films beyond the actual Round 3 screen.**
   - **Location:** `app/api/eval/route.ts:205-209`, `:226`; contrast with `components/Round3Screen.tsx:38` and `eval/e4-prereg.md:31`.
   - **Wrong:** Only the threshold lane caps `shownOf` at eight. E4 uses the taste lane, so simulated players pick every eligible backfill row, typically 9-10, while the app displays eight. The separate `e4.final8` metric is capped correctly, so the variety statistic and the judged winner describe different game paths.
   - **Evidence / impact:** The stored run contains four winners absent from BOTH players' recorded final eights: off/Dark crime couple (The Girl with the Dragon Tattoo), off/Rom-com classic (Even If This Love Disappears Tonight), and off AND on/Fantasy adventure (Flow). The judge also receives these hidden titles as affirmative Round 3 picks. Thus the 17/17 and no-regression results cannot clear the actual product, even though their arithmetic is correct.
   - **Direction:** Use the same first-eight eligible display rule in both lanes, and derive shown IDs, picks and judge context from that view. Keep selecting every displayed title in the taste lane; this does not require a restrictive one- or two-pick experiment. Assert that every simulated pick was displayed, then rerun the frozen comparison without changing the bars. The independently counted 10 → 30 outside-pool films remains a valid descriptive final-eight result for the stored run.

3. 🟠 **Major: retrieval has no deadline covering its availability work.**
   - **Location:** `lib/retrieve.ts:229`, `:490-504`; `lib/tmdb.ts:24-36`; `lib/infer.ts:562-573`.
   - **Wrong:** The 1.5 s abort covers database calls only. `pickEligible` awaits all TMDB availability lookups, without a timeout, before inference can continue or fall back. Shared and own selection can add several sequential availability rounds. A limit on the number of calls is not a limit on elapsed time.
   - **Evidence / impact:** An isolated test using the real retrieval code, a working fake database and a hanging availability lookup remained unresolved after 26 simulated seconds. The optional catalogue step can therefore trigger the browser's 25 s error screen before today's path is reached. The browser timeout was raised correctly, but it does not establish the brief's fail-safe or latency guarantees.
   - **Direction:** Bound the entire optional retrieval step, including availability, with cancellation and enough remaining time for normal inference. On expiry, return to today's path. Add a route-level slow-availability regression; obtain the required live on/off latency comparison before clearing the speed gate.

4. 🟡 **Minor: an unchanged embedding text prevents factual catalogue refreshes.**
   - **Location:** `scripts/build-catalog.mjs:406-427`, `:436-444`; runtime checks use these stored facts in `lib/retrieve.ts:153`.
   - **Wrong:** Only a changed title/year/overview/keywords hash puts a film into the upsert batch. Changes to votes, rating, poster, genres or collection ID alone are ignored. Films that fall below the discover floor also remain in the existing table. A rerun can print "Catalogue is up to date" while preserving stale eligibility or franchise facts.
   - **Impact:** The script is resumable and has no destructive operation, but a later refresh cannot reliably repair metadata on which quality screening and dedup depend. This is a refresh defect, not evidence that today's initial catalogue is corrupt.
   - **Direction:** Separate factual refresh from the decision to buy another embedding; define how rows that no longer meet the floor stop participating in retrieval. Verify with a same-text film whose rating or collection changes.

5. 🟡 **Minor: the raw E4 artifact cannot substantiate the two retry reasons.**
   - **Location:** `eval/e4-gate.mjs:38-62`; `eval/results/e4-gate.json` entries Crime drama/on and Sci-fi vs romance/on.
   - **Wrong:** The harness retains only the final successful response and an attempt count. Earlier errors and fallback reasons go to the console and are discarded from the JSON.
   - **Impact:** I confirmed two extra attempts, but cannot independently confirm the handoff's claim that both were catalogue timeouts rather than another retry condition. This is missing evidence, not a finding that retries were used to select better outcomes.
   - **Direction:** Persist each attempt's reason and outcome in the corrected run's artifact, including discarded responses or the relevant diagnostic fields.

**Verified / limits**

- **Checks:** `npm test` 168/168; lint and `tsc --noEmit` pass; the production build passes with network access for Google Fonts. No production code was edited, committed or merged during this review.
- **Engine safeguards:** retrieval screens quality, poster, kids' fare, pool/swiped IDs and known franchises before checking actual regional availability. Downstream finalization validates supplied IDs, deduplicates franchises, attaches availability, and the UI filters eligibility without reordering. No unwatchable selection bypass found. Database-down/empty/missing-vector fallbacks and E-9 paths are exercised by the tests; the availability timing exception is finding 3.
- **Regression substance:** in an isolated `/private/tmp` copy, weakening the database deadline made both timeout tests fail; disabling E-9 guards made the three targeted rejection tests fail; removing the liked-franchise guard made its regression fail. The golden snapshot was committed before engine edits (`dced47c`), and the current flag-off golden passes. The infer route tests run through real inference and retrieval, stubbing Supabase at `fetch`; TMDB and Claude are mocked.
- **Access / secrets:** live read-only checks returned HTTP 401 with PostgreSQL permission error `42501` for the publishable key on both `movies` and `match_movies`, and 200 for the server key on both. The migration revokes anon/authenticated access, enables RLS with no public policies, and grants server access explicitly. No configured credentials or key-pattern hits found in tracked files or the reviewed new history; no key variable references in the built client chunks; `.env.local` is ignored. Runtime retrieval imports `server-only`; its logs contain counts/timings rather than credentials or titles.
- **Scope:** design commits `21dff29..628deee` stay within components, CSS, layout and package files. Reducer phases and dispatch payloads are unchanged. The catalogue only sources candidates; no maximin/midpoint winner selector or user toggle was added. Both eval endpoints guard production with a 404; the live infer route ignores the eval override.
- **E4 audit:** the bars and amendment precede the stored run in Git/time. Both arms use identical Round 2 traces from the frozen couples. Independent recomputation matches means 89.94/89.12, worst gap -15, outside-pool totals 10/30, liked counts 7.56/6.94, fresh counts 0.29/1.06, infer medians 8.310/9.824 s and mean inference costs $0.00902/$0.00926. Finding 2 invalidates the live-path quality conclusion, not this arithmetic. No new paid judge run was performed.
- **Browser checks:** local production build with stubbed game responses and real fixture posters, at 375 × 812 and 390 × 844. Handoffs still wait for Player 1 and a result; retry succeeds; the 25 s timeout exposes retry. Right/left/down drags map to yes/no/neutral; a short drag returns without recording. Neutral controls retain equal dimensions/font weight, and all-neutral completion is covered by the reducer/inference tests. Eight-row Round 3 and its zero-pick CTA scroll into reach. Rentals expansion, bridge rentals retry, both honest end states, zero alternatives, expanded alternatives and Play again complete. Reduced motion opens the curtain immediately, hides grain and leaves no running animations in the checked state. No page errors occurred.
- **Visual / performance limits:** primary text/token contrast checks meet the brief's thresholds; signal red is about 4.45:1 on projection black and is used at large sizes, where 3:1 applies. The ten-service setup fits at 390 × 844. Poster colour extraction has a house-palette catch and does not gate the match. This was desktop-browser emulation, not a mid-range-phone frame-time profile. I did not independently inspect the deployed Vercel function limit or obtain production flag-on latency logs, so those remain unverified; the Mac's +1.514 s median cannot substitute for the specified live speed check. Known D6/bridge/tag/Watch-button items were not re-raised.

**Overall verdict:** Not cleared for the 2.0 milestone or production embeddings enablement: triage three Majors, correct and rerun E4, and verify the live latency gate before proceeding.

---
*Log: 2026-06-25 — handoff bus created (V0). 2026-06-27 — #9 Cato-cleared. 2026-10-02 — bus restarted for 2.0: Cato reviews E1 to E4 and design D1 to D5 once E4 is reported; then Arthur holds until triage. 2026-11-02 — E4 report transcribed and Otto-accepted; Cato triggered. Cato: not cleared, 3 Majors; Otto triaged; Arthur fix round F1 to F4. 2026-11-07 — Cato cleared the fix round; embeddings on in production; W1 (warm-up) assigned. 2026-11-09 — W1 Otto-accepted (live cold check passed); D6 assigned.*
