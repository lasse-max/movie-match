# Matching eval harness

How Movie Match checks that a change to matching makes the picks better, not worse, before it ships.

## What it runs

- **A frozen set of test couples.** `couples.json` holds 18 couples: compatible, divergent, mainstream, niche and mood-led. Couple #11 "Cozy vs apocalyptic" was found to be an invalid test couple in June, so gates run on the other 17.
- **The same candidates every time.** Each couple's film pool is captured once to `fixtures/blends.json` and reused, so two versions are compared on the same TMDB snapshot. Delete that file to take a fresh snapshot.
- **The real game.** A dev-only route (`app/api/eval/route.ts`, 404 in production) runs one couple through the real pipeline: blend, scripted Round 2 swipes, mood read and ranking, scripted Round 3 picks, then the overlap or bridge pick. The scripted players see only the 8 films the Round 3 screen shows, and the route refuses a run where a pick was not on screen.
- **Two lanes.** The taste lane gives both players all the major US services plus rent or buy, and each picks every film on their screen, so it measures taste, not availability. The thin lane gives them one service and a selective picker: the realistic case, with one to three picks and more bridge picks.

## How picks are scored

1. **Variety.** How many films come from outside the couple's genre pool, counted after the availability check, so every one is watchable.
2. **An independent judge.** `claude-opus-4-8` rates how well the winner fits both players, from 0 to 100, given the whole game: moods, swipes and picks. The game itself runs on `claude-sonnet-4-6`. Both are Anthropic models, so some shared bias may remain. The judge was calibrated before it was trusted:
   - `judge.mjs` runs it on 14 hand-labelled picks (`calibration.json`), including planted bad ones. Good picks should score 70 or more, bad ones under 50.
   - `judge-nearmiss.mjs` runs it on 8 better-or-worse pairs (`calibration-nearmiss.json`) to find the smallest gap it can reliably tell apart: 18 points. With 6 points of run-to-run wobble on top, a difference only counts as real at 24 points or more.
3. **A blind side-by-side.** `pairwise.mjs` shows Lasse two winners unlabelled and in random order, he marks 1, 2 or tie, and a hidden key reveals which version was which. Judge gaps of 18 to 23 points are too close to call and go here.

## Bars are committed before the run

Each gate's pass bars are committed before any measurement exists, and nothing is tuned on the run. A failed bar is reported as a fail.

- **Step 3, embeddings de-risk:** [`step3-prereg.md`](step3-prereg.md), run by the throwaway prototype `step3-embed.mjs`.
- **E4, embeddings on vs off:** [`e4-prereg.md`](e4-prereg.md), results in [`e4-results.md`](e4-results.md). The 2 Nov rerun failed one bar: 16 of 17 couples fit both, not 17. The failing couple got the same film with embeddings on and off; the results explain why.

## What is and isn't repeatable

The inputs are fixed: frozen pools, scripted swipes and picks, and both of the game's Claude calls at temperature 0. Claude still isn't fully deterministic, though: about a third of winners change between runs. TMDB data also drifts, so compare versions that ran close together. Only the harness aims to be repeatable; the live game varies on purpose.

## Run it

The eval routes only run in development, so start the app first. They use the same `.env.local` as the app (see `.env.example`). E4's "on" arm also needs the Supabase variables, and `step3-embed.mjs` needs `OPENAI_API_KEY`.

```bash
npm run dev
```

| Command | What it does |
|---|---|
| `node eval/run.mjs baseline` | Taste lane, all couples, to `eval/results/baseline.md` and `.json` |
| `node eval/run.mjs thin-baseline thin` | Thin lane |
| `node eval/run.mjs baseline taste 3` | First 3 couples only, as a smoke test |
| `node eval/judge.mjs` | Judge calibration on the hand-labelled picks |
| `node eval/judge-nearmiss.mjs` | Judge resolution floor on the near-miss pairs |
| `node eval/judge-runs.mjs verA verB` | Judge two captured runs against each other |
| `node eval/pairwise.mjs verA verB` | Blind side-by-side report; mark it, then add `--tally` |
| `node eval/e4-gate.mjs` | The E4 gate; `--smoke` checks the plumbing on the excluded couple |

Each run makes real Claude and TMDB calls. Raw results in `eval/results/` stay on your machine (git-ignored); what they showed is written up in the committed docs, such as `e4-results.md`.
