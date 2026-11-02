# Otto triage · Cato's 2.0 milestone review (E1 to E4, D1 to D5)

*2 Nov 2026 · Cato's report: `docs/HANDOFF.md` (code at `2f24bd5`) · Verdict: not cleared, three Majors*

Each finding checked against the code. All five are real. Lasse decides; Otto's recommendation per item.

| # | Cato | What it means in plain terms | Otto's call |
|---|---|---|---|
| 1 | 🟠 Double tap records an unseen film (`Round2Screen.tsx`) | Two quick taps count as two decisions: the second lands on a card the player never saw, so a film gets "liked" by accident and skews the matching | **Fix now** (F1). Note: the D6 draft had the same flaw ("a tap while a card is flying decides the next card"); corrected there too |
| 2 | 🟠 E4 judged films players can't pick (`app/api/eval/route.ts`) | The test players "picked" every available film, often 9 or 10, while the app only shows 8. In 4 cases the winner was a film neither player could have seen. So E4's 17/17 doesn't describe the real game. The June 17/17 used the same lane, so it carries the same flaw | **Fix the eval, then rerun E4** with the same bars (F2, F4) |
| 3 | 🟠 No overall deadline on the catalogue step (`lib/retrieve.ts`) | The 1.5 s limit covers the database only. If TMDB hangs during the availability checks, the step can run past the 25 s limit and the player sees the error screen | **Fix now** (F3): one deadline for the whole step |
| 4 | 🟡 Catalogue refresh ignores changed facts (`scripts/build-catalog.mjs`) | A future refresh would keep old ratings, posters and franchise links unless the description text changed | **Backlog.** Fix before the next catalogue refresh; today's catalogue is fine |
| 5 | 🟡 E4 file doesn't record why runs were retried (`eval/e4-gate.mjs`) | Cato could confirm 2 retries happened but not that both were database timeouts | **Fix with the rerun** (F2) |

## Arthur's fix round (in `docs/HANDOFF.md`)

Order: docs commit → F1 → F3 → F2 → F4. Separate commits. F1 is a screen fix in the same round as engine and eval work; Lasse's trigger of the handoff is his OK to mix them.

- **F1 · One decision per visible card.** Buttons and drag share one guard tied to the card on top. A new decision only counts once the next card is on top and visible. A regression test that fails without the fix: double tap, and drag plus button, asserting which film ids were recorded (component test or headless browser, Arthur's call, reason in the report).
- **F3 · One deadline for the whole catalogue step: 3 s,** availability included, with cancellation. Past it, both players get today's path, with one warning line (reason `deadline`). A route-level regression with a hanging availability lookup that fails without the fix. (3 s keeps the slowest game near 15 s, well inside the 25 s limit.)
- **F2 · E4 matches the real screen.** In the taste lane, each player is shown the first 8 eligible films, as the app does; picks, declines and the judge's context all come from that view, and a check asserts every pick was shown. The harness stores every attempt's reason and outcome.
- **F4 · Rerun E4.** Bars unchanged. A short amendment (the display fix and the 3 s deadline) committed before the run. Results committed to `eval/e4-results.md` so they're in the repo. Report back as usual.

## After the fix round

1. Otto reviews; Cato re-checks findings 1, 2, 3, 5 and the rerun.
2. The live speed check Cato asks for: switch embeddings on, play about 5 games, Otto compares the Vercel logs with flag-off games. Keep it on only if the median adds no more than 1.5 s and fallbacks are rare. Setting the flag back to false is the off switch.
3. Then D6.
