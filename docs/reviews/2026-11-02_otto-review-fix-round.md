# Otto review · Fix round F1 to F4 and the E4 rerun

*2 Nov 2026 · Reviewer: Otto · Commits `8e06fe7` to `7697e0e` · Results: `eval/e4-results.md` · Triage: `docs/reviews/2026-11-02_otto-triage-cato-2.0.md`*

## Verdict

**Accepted, with an owner decision on bar 2.** Next: Cato re-checks findings 1, 2, 3 and 5 and the rerun. Then the live speed check with the flag on.

## What I checked

- `npm test` 174/174, `npx tsc --noEmit` and lint clean on a fresh checkout. One new test-only dependency (`happy-dom`), reason given in Arthur's report.
- F1: put the old `Round2Screen.tsx` back and the three new regression tests fail (double tap, drag then button, reduce-motion double tap); restored, green.
- F2 and F5: the rerun reports every pick on the player's screen in all 68 turns, no overlap winner off both screens, and every attempt stored with its reason (4 discarded: 1 timeout, 3 deadline, all on the "on" arm, all from the Mac's distance to the database).
- F4: the amendment (`e570e87`) was committed before the results (`7697e0e`). Bars unchanged. Arthur corrected his own first-draft explanation of the failure against the raw data before committing.
- The homepage motion is parked on the local branch `d6-homepage-motion`, not pushed.

## The rerun against the bars

| Bar | Result |
|---|---|
| No confirmed regression (gap −24 or worse) | 0 of 17 (worst −20), PASS |
| "Fits both" (judge 70+) with embeddings on | 16/17, FAIL. Off was also 16/17, on the same couple |

## Owner decision (Lasse, 2 Nov)

**Proceed despite bar 2.** The failing couple (Thriller + horror) got the same film, scored 58, in both arms, so embeddings didn't cause it. Its scripted players liked all 8 of their cards, so each Round 3 list was just the partner's likes, the lists shared nothing, and the bridge picked a weak unknown film. Lasse: "if they like everything we can't draw great conclusions and there won't be great matches. In practice people will like 3 to 4." The bar is not changed; the gate is recorded as failed on bar 2 with this exception.

## Follow-ups (in the backlog)

- **Engine:** when both lists are only the partner's likes and share nothing, the bridge's pick can be weak. Embeddings v2 Part A (shared cards in Round 2) should make this rarer.
- **Eval:** the scripted swiper likes every card in its genres. Real players like about 3 to 4 of 8 (Lasse). Make the swiper realistic before the next gate (Embeddings v2), because the number of likes changes how many slots new films get.
- **Lasse's blind pairwise** on the two "too close to call" couples (Cerebral pair −20, Fantasy adventure +23): not gating, still worth recording.

## Live now

F1 is live: a new decision counts only once the next card has been visible for 300 ms (Arthur's choice). Lasse to feel it on his phone.
