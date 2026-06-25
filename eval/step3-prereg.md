# Step-3 embedding de-risk — PRE-REGISTERED bars (locked before running)

Offline throwaway prototype (`eval/step3-embed.mjs`). Goal: cheap go/no-go on building a
live embeddings engine, BEFORE any rebuild. Committed before any results exist so the bars
can't be moved to fit the outcome. ~$2 cap; no product/engine changes.

## Couple set (frozen pools from eval/fixtures/blends.json)
- **Hard (6):** Date-night clash (#2), Tearjerker vs blockbuster (#5), Dark crime couple (#6),
  Horror fans (#10), Fantasy adventure (#13), Sci-fi vs romance (#15).
- **Stable-taste (1, variety test):** Action buddies (#1).
- **Easy regression guard (2):** Cozy night in (#3), Rom-com classic (#9).

## Sources (source ladder, cheapest first; cached by TMDB id; ~600–700-title slice, NOT the whole catalog)
- **a. cheap:** TMDB `overview` + `keywords`.
- **b. rich:** an LLM-written structured tone/subgenre descriptor per film (dread↔gore,
  cerebral↔visceral, pacing, tone), then embedded.
- Embedding model: OpenAI `text-embedding-3-small`. Similarity = cosine.

## Operational definitions (fixed now — no post-hoc tuning)
- **Taste vector** per player = mean embedding of that player's Round-2 swipe-positives
  (realistic swiper, same as the eval). Couple maximin sim of a candidate = `min(cos(cand,P1), cos(cand,P2))`.
- **Quality floor (the "strong" in "distinct strong"):** voteCount ≥ 100 AND voteAverage ≥ 6.2
  (the engine's MIN_VOTES / MIN_VOTE_AVERAGE).
- **Watchable:** has a poster (real release). Availability is assumed maxed (as in the eval taste
  lane) — this offline prototype does not model per-service availability.
- **Distinct:** franchise/collection-deduped (one per collectionId).
- **On-taste band (τ):** a candidate is on-taste if its couple maximin sim ≥ τ, where
  **τ = the 60th-percentile maximin sim of THIS couple's own genre-pool titles** — i.e. an
  embedding neighbor must be at least as good a fit as a solid genre-pool title. τ is anchored
  to the genre pool, not hand-picked, and is identical for both sides of the comparison.

## Bars

### 1. Variety — PRIMARY (the "worth a rebuild" bar)
For the stable couple, count **distinct strong on-taste watchable** candidates:
- genre pool (the ~41 genre-discovered titles) vs embedding taste-neighbors (the ~600–700 slice).
- **PASS = ratio ≥ 2.0×.** (1.2× is NOT a pass.)
- **Replay durability:** simulate 4 replays of "show top-8, exclude already-shown." Count the
  replay at which each side can no longer field 8 distinct strong on-taste picks (repeats/degrades).
  Genre pool is expected to run dry by replay ~3; embeddings must sustain all 4.

### 2. Subgenre separation — STRUCTURAL GATE (must pass for the concept to be real)
On the hard couples, the space must visibly separate the subgenre axis:
- **PASS** = dread-anchor films (Hereditary, The Witch, …) are measurably CLOSER to each other
  than to gore-anchor films (Saw, Terrifier, Hostel) — `mean(dread↔dread) < mean(dread↔gore)`
  with a clear margin — AND a dread-leaning couple's top neighbors skew dread, not gore.
  Checked for the cheap vs rich source. If neither separates, the concept fails.

### 3. Single-pick quality — SECONDARY
Maximin pick (the slice title maximizing couple maximin sim) per hard couple:
- **PASS** = judged ≥ baseline (the engine's frozen winner) — scalar judge gap ≥ 24 confirmed,
  or human pairwise prefers it on close calls (gap in [18,24)).
- **No easy-couple regression:** on #3/#9 the maximin pick must not be judged worse than baseline.

## Decision rule (pre-registered)
- **GO** — build with the cheapest source that passes — if variety ≥ 2× AND separation passes AND
  no easy-couple regression.
- **GO (rich source)** — if the cheap source is mushy but the LLM-descriptor source clears the bars.
- **NO-GO / park** — if even the rich source fails variety + separation. Revisit once real-user data
  exposes the hard cases. (See [[eval-metric-hierarchy]] — variety is the primary Step-3 metric.)

Single-pick is secondary: a single-pick win alone does NOT earn a GO; variety + separation do.
