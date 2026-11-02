# Otto review · Embeddings v1 · E4 gate run

*2 Nov 2026 · Reviewer: Otto · Commits `04e9f2b`, `a921bce`, `9870d4f`, `2f24bd5` (pushed 2 Oct) · Results: `eval/results/e4-gate.md` and `.json` (git-ignored, on Lasse's Mac) · Arthur's report: `docs/HANDOFF.md`*

## Verdict

**Accepted. E4 passes both pre-registered bars.** Next: Cato reviews E1 to E4 with design D1 to D5. The flag goes on in production once Cato has cleared it.

| Bar | Result |
|---|---|
| No confirmed regression (gap −24 or worse) | 0 of 17, PASS (worst −15, inside the judge's noise) |
| "Fits both" with embeddings on (judge 70+) | 17/17, PASS (lowest 78) |

## What I checked

- The bars (`a921bce`) and the amendment (`9870d4f`) were both committed before the harness and the measured run (`2f24bd5`).
- The results file matches Arthur's report: means 89.9 off and 89.1 on, variety 0.6 to 1.8 per couple (3.0×), all 34 players served by the catalogue, a shared seed in 16 of 17 couples, 2 infrastructure retries.
- Cost is unchanged ($0.0090 to $0.0093 per game).

## Rulings on Arthur's questions

1. **"Fits both" is a proxy.** Accepted; it was pre-registered. No couple landed in the "too close to call" band, so Lasse's blind pairwise isn't needed.
2. **The run-rule amendment.** Accepted. It was committed before any measured run, the bars didn't move, and it only retries catalogue timeouts caused by the Mac's distance from the database. Cato to confirm from the JSON that both retries were timeouts and nothing else.
3. **A cold database may skip embeddings live.** Real risk. Once the flag is on, Otto counts `embeddings.fallback` lines with reason `timeout` against `embeddings.retrieval` lines in the Vercel logs. More than about 1 in 10 games falling back means a small engine fix (a warm-up call, or a longer first-call allowance).
4. **Latency.** The +1.5 s median on the Mac is overstated by the database round trips. The live log read decides; the invariant allows +1.5 s at the median.
5. **The eval route change.** Harness, not engine: the route is dev-only and returns 404 in production. Accepted.
6. **Vercel function limit.** Accepted. A live call already took 11.2 s, so the limit is above the old 10 s default; the 25 s timeout is safe on Fluid compute (300 s default). No action needed.

## What the numbers mean for the product

Embeddings are safe: picks hold up, cost is flat. But the discovery effect is small. About one new film reaches each player's final 8 (0.3 before), the winner came from outside the pool in only 1 of 17 couples, and in 8 of 17 couples liked films filled every slot. Real players probably like fewer films than the scripted ones, so the live effect may be larger, but this run can't show that.

It also doesn't touch the repeat problem Lasse raised (2 Nov): the ~40-film pool behind the Round 2 cards is still the most popular films in the chosen genres, in the same order, every game. That needs its own brief (proposed to Lasse: shuffle from a bigger pool, plus remembering recently shown films on the phone).
