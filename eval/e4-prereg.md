# E4 gate run · embeddings on vs off · PRE-REGISTERED (locked before running)

*2 Oct 2026 · Arthur · Brief: `docs/decisions/2026-10-01_embeddings-v1.md` section 5 (E4) plus the "E4 additions" in `docs/reviews/2026-10-01_otto-review-E3.md`.*

Committed before any E4 measurement exists, so the bars and definitions can't move to fit the outcome. No numbers get tuned on this run. If a bar fails, the run stops there and is reported as a fail.

## What is compared

- **Arms:** the same game with the catalogue retrieval forced **off** (`embeddings: false`, today's path: TMDB recommendations, up to 2 fresh films per player) and forced **on** (`embeddings: true`, up to 6 fresh films per player from the catalogue). The switch is the eval route's per-request override of `EMBEDDINGS_ENABLED` (dev-only route; the live game never sends it).
- **Couples:** the **17 valid couples**: all 18 in `eval/couples.json` except #11 "Cozy vs apocalyptic", which the June baseline excluded as an invalid test couple (`PM Projects/Layline_Eval_Evidence.md`, baseline tally 17/17 across the 17 valid couples).
- **Inputs held fixed:** each couple's frozen pool (`eval/fixtures/blends.json`), the scripted Round 2 swipes, and the taste lane (all eight major US services plus rent or buy, region US, each player picks every eligible shortlist title). The arms differ only by the switch.
- **Order:** one pass over the 17 couples. Each couple runs both arms back to back, alternating which goes first (off first on odd-numbered couples, on first on even), so warm TMDB caches don't favour one arm's timing. One unmeasured warm-up request per arm (with the excluded couple #11) runs first, so dev-server compile time doesn't land on a measured couple.
- **Judge:** the calibrated scalar judge (`/api/eval/judge`, `claude-opus-4-8`, independent of the engine's `claude-sonnet-4-6`), with the same game-path context as `eval/judge-runs.mjs` (Round 1 moods, mood reads, Round 2 swipes toward and away, Round 3 picks). One rating per arm's winner.

## Bars (gating)

1. **No confirmed regression.** For each couple, gap = judge fit (on) − judge fit (off). A confirmed regression is a gap of **−24 or worse** (calibrated floor 18 plus wobble 6, as in `eval/judge-runs.mjs`). **Pass: 0 of 17.**
   A gap from −18 to −23 is "too close to call": not a fail, listed for Lasse's blind pairwise (`eval/pairwise.mjs`).
2. **"Fits both" stays 17/17.** A couple fits both when its winner is judged **70 or higher**, the calibrated "good" band (`eval/judge.mjs`: good ≥ 70; the rubric's 70 to 84 is a good mutual fit, 85+ excellent). A couple with no winner does not fit. **Pass: 17/17 with embeddings on.** The off arm is reported alongside.

## Reported per arm (no pass bar)

- **Variety after availability:** distinct films across the couple's two final 8s that come from **outside the couple's genre pool**, so the old pool could never have shown them. Every counted film is eligible on the couple's services, and the engine has already deduplicated franchises. A film in both lists counts once. Reported as the mean per couple and the on-to-off ratio. Also reported: couples whose **winner** is from outside the pool, and with embeddings on, each player's catalogue supply (films that passed every check including availability, from the engine's `embeddings.retrieval` log line; capped by the 12 availability checks per player).
- **Liked films in the final 8**, average per player (34 players): films either player swiped "This vibe" on in Round 2, split into own and the other player's.
- **Fresh films in the final 8**, average per player: films not in the couple's genre pool (TMDB recommendations, catalogue films, or provider backfill).
- **Claude cost per game:** the input and output tokens of the `inferMoods` Claude call, from the API's usage, priced at Claude Sonnet 4.6 rates ($3 per million input, $15 per million output). Mean per game and the difference between arms. The game's other Claude call (the blend) runs before Round 2, is untouched by embeddings and isn't re-run on frozen pools, so it's the same in both arms and left out. Expected roughly unchanged: the candidate cap stays 16 per player.
- **How long `inferMoods` takes:** wall-clock of the `inferMoods` call inside the eval route, median and slowest per arm, plus the retrieval part with embeddings on. Measured on the dev server on this Mac (catalogue, TMDB and Claude calls over the internet), so it is indicative only. Per the E3 review, the binding latency read is Otto's, from the live Vercel logs. For reference: invariant 5 allows at most 1.5 s more at the median.

## Definitions

- **Final 8:** a player's first 8 titles that are eligible on the couple's services, in the engine's ranked order: what the Round 3 screen shows (`selectWatchable(..., 8)`).
- **Genre pool:** the couple's frozen blend pool (about 28 to 45 films).
- **Winner:** the engine's match (overlap, or the bridge when the two lists share nothing).

## Run integrity

- An arm is retried (up to 3 attempts) only for an infrastructure failure: an HTTP error from `/api/eval`, or no Claude response recorded for the `inferMoods` call (the engine quietly falls back to an unranked list when Claude fails, which would make the arms incomparable). Judge calls are retried the same way. Nothing is re-run to change a result.
- If any couple can't complete both arms and both judge calls, the gate is reported as incomplete, not passed.

## Not in this run

The thin lane, human pairwise, live latency (Otto, Vercel logs) and replay variety.
