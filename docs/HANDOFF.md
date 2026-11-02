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
2.0 in progress (`docs/STATUS.md`). Cato reviewed E1 to E4 and D1 to D5 (2 Nov): not cleared, three Majors. Otto triaged them into Arthur's fix round below (F1 to F4, ending in a corrected E4 rerun). Embeddings stay off until the rerun passes, Cato re-checks, and the live speed check is done.

---
### → Arthur (builder)
**Status:** 🟢 NEW — fix round after Cato's 2.0 review (triage: `docs/reviews/2026-11-02_otto-triage-cato-2.0.md`). Lasse triggering this is his OK to mix one screen fix (F1) with engine and eval work; keep them in separate commits.

**Task, in this order:**
00. **Park the homepage motion first** (your side review, 2 Nov). Otto's calls: apply row 1 (tiles: opacity-only fade, 300 ms, keep the row × 50 ms stagger), row 2 (chase keyframe animates opacity only, no box-shadow), row 3 (tile press transform 160 ms) and the optional row (power-on only on the first homepage visit per page load). Skip row 4 (the chase start stays hard-coded: only the 16-bulb homepage sign uses `powerOn`; add a comment saying so). Leave the ticket filter (row 5) for the phone check. Run tests and lint, then commit only `components/SetupScreen.tsx`, `components/palace.tsx` and `app/globals.css` on a new local branch `d6-homepage-motion`. Don't push it and don't merge it: it ships with D6 after review. Switch back to `main` with those three files clean before step 0.
0. **Docs commit:** everything uncommitted under `docs/` (HANDOFF, STATUS, BACKLOG, `reviews/`, `decisions/2026-10-02_design-pass-2-D6-polish.md`, the D6 boards and README in `design/picture-palace/`). Push.
1. **F1 · One decision per visible card** (`components/Round2Screen.tsx`, Cato finding 1). Buttons and drag share one synchronous guard tied to the card on top; a new decision only counts once the next card is on top and visible. Same recorded decisions otherwise. Regression test that fails without the fix: a double tap 30 ms apart, and drag plus button on one card, asserting exactly which film ids were recorded. Component test or headless browser, your call; give the reason in the report (rule 8 if it needs a new dev dependency).
2. **F3 · One deadline for the whole catalogue step** (`lib/retrieve.ts`, Cato finding 3). 3 s for everything, availability checks included, with cancellation of what's still running. Past it, both players get today's path, with one `embeddings.fallback` line, reason `deadline`. Route-level regression: real retrieval code, a working fake database, an availability lookup that hangs; it must fail without the fix and finish near 3 s with it.
3. **F2 · E4 matches the real screen** (`app/api/eval/route.ts`, `eval/e4-gate.mjs`, Cato findings 2 and 5). Taste lane: each player is shown the first 8 eligible films, as `selectWatchable` does in the app; picks, declines and the judge's context all come from that view; assert every simulated pick was shown. The harness stores every attempt's reason and outcome, discarded attempts included.
4. **F4 · Rerun E4.** Bars unchanged. Commit a short amendment to `eval/e4-prereg.md` (the display fix and the 3 s deadline) before the run. Commit the results summary to `eval/e4-results.md`. Push.

**Not in this round:** Cato finding 4 (catalogue refresh) is in the backlog; D6; anything in Embeddings v2.

**Report back:** plain-English summary first; then what you built, the E4 numbers against the bars (and against the 2 Oct run), how to verify, and anything you're unsure about. Set status 🔵 DONE — awaiting Otto, then stop.

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
**Status:** ✅ Otto-triaged 2 Nov (`docs/reviews/2026-11-02_otto-triage-cato-2.0.md`). Next for Cato: a targeted re-check of findings 1, 2, 3, 5 and the E4 rerun, once Arthur's fix round is in.

**Read first:** `CLAUDE.md` · `docs/decisions/2026-09-30_2.0-kickoff.md` · `docs/decisions/2026-10-01_embeddings-v1.md` · `docs/decisions/2026-10-01_embeddings-v1-E3-addendum.md` · `docs/decisions/2026-10-01_design-pass-2-build.md` · `docs/design/PICTURE_PALACE_BRIEF.md` · Otto's reviews in `docs/reviews/` (E1-E2, E3, design pass 2, E4; some may be uncommitted on disk) · Arthur's E4 report in the Arthur section above · the E4 results in `eval/results/e4-gate.md` and `.json` (git-ignored, read them from disk).

**Scope:** `main` from `55d7d51` (E2) through Arthur's E4 commits: the E1 migration in `supabase/migrations/`, `scripts/build-catalog.mjs`, `lib/retrieve.ts`, the `lib/infer.ts` and `app/api/eval` changes, every design commit (`fae596a` to `628deee`), the timeout change (`04e9f2b`), and E4 (`a921bce` onward: `eval/e4-prereg.md`, `eval/e4-gate.mjs`, results). The E1 migration is already applied to the live database; the catalogue is built (15,162 films). `EMBEDDINGS_ENABLED` is off on the live site.

**Charge, engine (E1 to E3):**
1. **Invariant.** Can any catalogue film reach Round 3 without passing the quality floor, the kids-fare rule, franchise dedup and the availability check? Try to break it.
2. **Rejections (E-9).** Can a film both players swiped "Not it" reach Round 3 by any path (padding, backfill, fresh, cross-player)? Can a player's own "Not it" pad their own list? Confirm the flag-off behaviour change is limited to E-9 (the golden snapshot test).
3. **Fail safe and time.** Database down, slow, empty, or likes with no catalogue films: today's path runs and nothing errors. The TMDB availability checks sit outside the 1.5 s database timeout, and the browser gives up on `/api/infer` at 15 s (`REQUEST_TIMEOUT_MS`) while the call already takes 10 to 13 s. Is there a realistic path where the flag pushes games past 15 s?
4. **Secrets and access.** No key client-side. Anon and the publishable key locked out of `movies` and `match_movies`. The service key only in server-only modules. Nothing sensitive in the log lines.
5. **Migration and script safety.** Anything risky in the E1 migration or `build-catalog.mjs` (dry run by default, no destructive operations, safe to re-run)?
6. **Scope.** No maximin or midpoint winner selector, no user-facing toggle, the eval override unreachable in production.
7. **Tests.** The end-to-end test runs the real path; each regression test fails without its fix.
7b. **E4 integrity.** Bars committed before the run; flag on and off compared on the same frozen couples; the variety gain reported after availability; the numbers in the report match the raw results. The 25 s timeout: safe against the Vercel function limit, and the error screen still appears when it should.

**Charge, design (D1 to D5):**
8. **No behaviour change.** Design commits touch only `components/`, `app/globals.css`, `app/layout.tsx` and `package.json`. Confirm the game flow is unchanged: same phases and dispatches; the #9 two-condition advance (`ready && result`) still holds in Blending, Inferring and Tiebreak after the projector rewrite; folding every hand-off into `PassPhone` didn't change who holds the phone when.
9. **Round 2 swipe.** Drag and buttons record exactly the same decisions. No double-recording on a fast flick or double tap. "Not sure" stays equal in size and weight, and zero-weight.
10. **Loaders and errors.** The countdown never holds players more than about 1 s after the result. Errors and "Try again" still surface correctly. No timers or listeners leak across "Play again".
11. **Reduced motion and accessibility.** Reduce-motion makes every animation an instant cut with nothing broken. Touch targets at least 44 px, text contrast at least 4.5:1 (3:1 from 24 px), real buttons and labels.
12. **Performance and failure.** The extra poster fetch for the colour strip fails safe. The `motion` dependency is a reasonable cost on a mid-range phone.
13. **Copy.** No em dashes or emoji in user-facing text.

**Known and logged, don't re-report:** D6 polish pending (`docs/decisions/2026-10-02_design-pass-2-D6-polish.md`, draft); the bridge ignores Round 2 "Not it" swipes; raw match tags; the Watch button below the fold on the match card (Lasse: fine as is).

**Output:** lead with a 2 to 3 line plain-English summary. Then a prioritized findings list (🔴 Blocker · 🟠 Major · 🟡 Minor · 🔵 Later), each with location, what's wrong, why it matters, and a suggested direction. Flag, don't fix. End with a one-line verdict. Write it in the Report back block, set status to 🔵 DONE — awaiting Otto, and stop.

**Report back:** (Cato, 2 Nov 2026; code at `2f24bd5`, including the local review documents)

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
*Log: 2026-06-25 — handoff bus created (V0). 2026-06-27 — #9 Cato-cleared. 2026-10-02 — bus restarted for 2.0: Cato reviews E1 to E4 and design D1 to D5 once E4 is reported; then Arthur holds until triage. 2026-11-02 — E4 report transcribed and Otto-accepted; Cato triggered. Cato: not cleared, 3 Majors; Otto triaged; Arthur fix round F1 to F4.*
