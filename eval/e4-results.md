# E4 rerun results · embeddings off vs on

*2 Nov 2026 · Arthur (F4, after Cato's 2.0 review) · Bars pre-registered in `eval/e4-prereg.md` (amendments of 2 Oct and 2 Nov committed before each run) · Raw data: `eval/results/e4-gate.json` (this run) and `eval/results/e4-gate-2026-10-02.json` (2 Oct), both git-ignored, on disk*

**In plain English.** The corrected rerun fails the "fits both" bar: 16 of 17 with embeddings on. The one failing couple (Thriller + horror) gets the same film, judged 58, with embeddings on and off, so embeddings did not cause it: for this couple no catalogue film could even enter the list. This time Claude ranked each player's partner's likes first on both lists, so the two screens shared no film, and the bridge picked a 2026 film neither saw. On 2 Oct the same couple's lists shared a film. Bar 1 passes: no couple got a confirmed worse pick (worst gap −20, too close to call).

What changed from 2 Oct: the simulated players now see and pick only the 8 films the Round 3 screen shows (F2), and the catalogue step has a 3 s deadline (F3). Bars, couples, frozen pools and judge are unchanged.

## Bars

| Bar | Rerun (2 Nov) | 2 Oct run | |
|---|---|---|---|
| No confirmed regression (gap −24 or worse) | 0 of 17 (worst -20) | 0 of 17 (worst -15) | **PASS** |
| "Fits both" (judge 70+) with embeddings on | 16/17 (lowest 58) | 17/17 (lowest 78) | **FAIL** |

With embeddings off, "fits both" was 16/17 in the rerun (17/17 on 2 Oct).

## Per arm

| | Off (rerun) | On (rerun) | Off (2 Oct) | On (2 Oct) |
|---|---|---|---|---|
| Mean judge fit | 88.5 | 89.4 | 89.9 | 89.1 |
| Fits both (judge 70+) | 16/17 | 16/17 | 17/17 | 17/17 |
| Films from outside the pool in the two final 8s, per couple | 1.0 | 1.9 | 0.6 | 1.8 |
| Couples whose winner is from outside the pool | 0 | 1 | 0 | 1 |
| Liked films in the final 8, per player (own + other's) | 7.29 (2.62 + 4.68) | 6.85 (2.29 + 4.56) | 7.56 (2.68 + 4.88) | 6.94 (2.53 + 4.41) |
| Fresh films in the final 8, per player | 0.50 | 1.15 | 0.29 | 1.06 |
| Claude cost per game (inferMoods call) | $0.0091 | $0.0092 | $0.0090 | $0.0093 |
| inferMoods time on this Mac, median / slowest | 8.1 s / 15.8 s | 8.4 s / 14.4 s | 8.3 s / 12.3 s | 9.8 s / 12.1 s |
| Catalogue step on this Mac, median / slowest | n/a | 2.6 s / 3.0 s | n/a | 3.4 s / 4.7 s |
| Catalogue films per player: retrieved / passed every check / took a slot / in the final list | n/a | 77.6 / 9.2 / 6.0 / 1.1 | n/a | 77.6 / 9.2 / 6.0 / 1.1 |
| Players on today's path instead of the catalogue | n/a | 0 of 34 | n/a | 0 of 34 |

Variety gain after availability (films from outside the pool, on ÷ off): **1.88×** (17 → 32); 2 Oct: 3.00× (10 → 30).

## Run integrity

- Every simulated pick was on that player's screen (8 at most): yes, in all 68 player-turns.
- Overlap winners that were not on both screens: none (2 Oct: four winners absent from both screens, per Cato).
- Bridge winners (on neither list, which is the bridge's job when the lists share nothing): Fantasy adventure (off), Thriller + horror (off), Thriller + horror (on).
- Discarded arm attempts: 4 (1 × catalogue timeout, 3 × catalogue deadline). Discarded judge calls: 0. Every attempt is stored in `eval/results/e4-gate.json` (`attemptLog`).
  - Action buddies (on), attempt 1: catalogue fallback: timeout
  - Action buddies (on), attempt 2: catalogue fallback: deadline
  - Date-night clash (on), attempt 1: catalogue fallback: deadline
  - Cozy night in (on), attempt 1: catalogue fallback: deadline

## Per couple

| # | Couple | Off winner | Fit | On winner | Fit | Gap | Verdict | Gap on 2 Oct |
|---|---|---|---|---|---|---|---|---|
| 1 | Action buddies | What Happened to Monday | 88 | Nobody | 92 | +4 | tie | -5 |
| 2 | Date-night clash | Crimson Peak | 95 | Crimson Peak | 95 | 0 | tie | 0 |
| 3 | Cozy night in | The Intouchables | 94 | The Intouchables | 93 | -1 | tie | -7 |
| 4 | Cerebral pair | 10 Cloverfield Lane | 94 | Black Swan | 74 | -20 | too close to call (worse) | +1 |
| 5 | Tearjerker vs blockbuster | Crazy, Stupid, Love. | 90 | Crazy, Stupid, Love. | 92 | +2 | tie | 0 |
| 6 | Dark crime couple | The Usual Suspects | 93 | Heat * | 85 | -8 | tie | -9 |
| 7 | Family animation | Toy Story | 92 | Toy Story | 90 | -2 | tie | 0 |
| 8 | Apocalyptic sci-fi | Children of Men | 92 | Children of Men | 95 | +3 | tie | +3 |
| 9 | Rom-com classic | Crazy, Stupid, Love. | 95 | Crazy, Stupid, Love. | 95 | 0 | tie | +13 |
| 10 | Horror fans | Hereditary | 95 | Hereditary | 95 | 0 | tie | 0 |
| 11 | Crime drama | Nightcrawler | 92 | Nightcrawler | 92 | 0 | tie | -1 |
| 12 | Fantasy adventure | Flow | 72 | Howl's Moving Castle | 95 | +23 | too close to call (better) | -2 |
| 13 | Sunshine vs noir | Focus | 88 | Focus | 88 | 0 | tie | +2 |
| 14 | Sci-fi vs romance | Eternal Sunshine of the Spotless Mind | 95 | Eternal Sunshine of the Spotless Mind | 95 | 0 | tie | -2 |
| 15 | Mainstream blockbuster | John Wick: Chapter 2 | 82 | Spider-Man: Into the Spider-Verse | 92 | +10 | tie | +6 |
| 16 | Arthouse pair | The Invisible Guest | 90 | Joker | 93 | +3 | tie | +2 |
| 17 | Thriller + horror | Obsession | 58 | Obsession | 58 | 0 | tie | -15 |

\* winner from outside the couple's genre pool.


## What the failure is

Thriller + horror, both arms:

- Both scripted players liked all 8 of their cards, so each list starts with 16 liked films (the partner's 8, then their own 8). That fills all 16 candidate slots, so in the "on" arm no catalogue film could enter (E-9: fresh films never push out a like). The two arms ran the same game.
- The scripted swiper likes any card in one of the player's genres, and every card dealt here was, so neither player passed on anything. This time Claude ranked the partner's 8 likes first on both lists, so Player 1's screen is exactly Player 2's likes and Player 2's screen exactly Player 1's. The screens share no film.
- No overlap, so the bridge decides. It picked Obsession (2026), a film on neither screen. The judge: the genres fit, but "an unknown 2026 title" that "appears on neither shortlist nor swipe list". 58 in both arms.
- On 2 Oct Claude ranked the same couple's lists differently: Nightcrawler, a film Player 2 liked, sat 3rd on Player 1's list and 2nd on Player 2's, inside both screens, and won with 93. The engine's Claude call runs at temperature 0 but isn't fully deterministic (known since June: about a third of winners swing between runs).
- The 8-film view did not cause this one. Under the old pick-everything rule, today's two lists would have shared only their 9th and 10th films (Obsession, then The Gangster, the Cop, the Devil), so Obsession would most likely have won either way.

So this is the matching engine's run-to-run variance on one hard couple, the same in both arms. When both lists fill with the partner's likes and nothing overlaps, the game falls to the bridge, and here the bridge's pick is weak. Embeddings can't help in that case.

## Not decided here (for Otto and Lasse)

- The gate fails on the pre-registered rule. Nothing was tuned or re-run. Whether a failure that is identical in both arms blocks turning embeddings on is the owners' call.
- The engine question it raises (cross-player likes filling a whole list; the bridge's pick when the lists share nothing) is engine work for a later brief.
- Too close to call, for Lasse's blind pairwise: Cerebral pair (−20: 10 Cloverfield Lane 94 off, Black Swan 74 on) and Fantasy adventure (+23: Flow 72 off, Howl's Moving Castle 95 on).
