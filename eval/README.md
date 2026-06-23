# Matching eval harness (Pass 2)

Eval-driven measurement of matching quality. Build the measurement first, then
improve against it — the **✓-rate** (do the winner + runner-ups plausibly fit
BOTH players' stated taste?) is the number to beat.

## How it works

- `couples.json` — the **frozen** test set (~18 diverse couples: compatible /
  divergent / mainstream / niche / mood-led). A reusable asset, not throwaway.
- `app/api/eval/route.ts` — a **dev-only** route that runs ONE couple through the
  real pipeline: blend → scripted Round-2 swipes → infer → scripted Round-3 picks
  → overlap/bridge. Returns the mood reads + winner + runner-ups (with tags/%).
- `run.mjs` — runs every couple and writes a scoreable `results/<label>.md`.

**Reproducibility:** inputs are fixed; the swipe rule (lean toward your anchor
genres) and pick rule (pick every eligible shortlist title) are deterministic;
the AI calls run at `temperature: 0`. Availability is maxed (all major US services
+ willing-to-pay) so the eval measures TASTE, not where it streams. Residual
variation: TMDB catalog/popularity drift over time — run versions close together.

## Run it

```bash
npm run dev                      # start the app (eval route is dev-only)
node eval/run.mjs baseline       # all couples → eval/results/baseline.md
node eval/run.mjs enriched       # after the enrichment step → compare
node eval/run.mjs baseline 3     # first 3 only (smoke test)
```

Then score each couple `✓ / ~ / ✗` in the generated markdown and compare the
✓-rate across versions.
