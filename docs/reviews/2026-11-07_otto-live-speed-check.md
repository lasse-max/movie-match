# Otto · Live speed check, embeddings on

*7 Nov 2026 · Production deploy `dpl_98EkCX4ysVFToJ21sGpTwp7wGAr6` (commit `7697e0e`, `EMBEDDINGS_ENABLED=true`) · Source: Vercel runtime logs, `embeddings.retrieval` lines*

## What ran

8 games on the live site between 11:40 and 11:47 UTC: 5 scripted by Otto (390 px, real services, each player liking 3 of 8 cards) and 3 others in the same window. Vercel functions run in `iad1` (Virginia); the Movie Match database is in `us-east-2` (Ohio), so they're close.

## Results against the pass criteria

| Criterion | Result | |
|---|---|---|
| Catalogue step adds at most 1.5 s at the median | Median 1.4 s for the whole catalogue step (0.6 to 2.4 s). This is an upper bound on the added time: it replaces the old TMDB recommendations step, which also took time | PASS, close to the line |
| Fallbacks under about 1 in 10 games | 1 of 8: the first game, after a long quiet spell, timed out on the database (reason `timeout`, 2.1 s spent, then today's path). All 7 later games were served by the catalogue | Borderline |
| No errors | No error screens; the 25 s limit was never near (the step before Round 3 took 5.8 to 10.0 s end to end in Otto's games) | PASS |

Also seen: 2 games had one player with nothing eligible from the catalogue (reason `empty`, by design: that player got today's path). The Supabase settings in Vercel are correct: every game loaded the players' likes from the database.

## The finding that matters

The one fallback is the "cold database" risk Arthur flagged. After a quiet spell the database's first search is slow, past the 1.5 s limit. At today's traffic most real games are the first one after a quiet spell, so most real couples would get today's path, and the cold game is also about 2 s slower for nothing.

**Proposed fix (small engine task):** warm the database up when the game starts. When Round 1 is locked in, the blend step fires one cheap catalogue query in the background, without waiting for it. Round 3 comes a minute or two later, by which point the database is warm. No new service, no cost. Same fallback rules; a test proves the warm-up never delays or breaks the blend.

## A good sign

Across the 7 games the catalogue served, about 1.9 catalogue films per player reached the final 8 (E4: about 1.1). Otto's scripted players liked 3 of 8 cards rather than nearly all of them; the like counts in the 3 other games aren't known. That fits Lasse's point that real players leave new films more room than the test players did.

## Recommendation

Keep embeddings on: picks are no worse, and a fallback is safe (it just uses the old way). Add the warm-up as a small engine task before D6.
