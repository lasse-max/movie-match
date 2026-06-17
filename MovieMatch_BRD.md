# Movie Match — Business Requirements Document (BRD)

*Gamified couples movie picker · Owner: Lasse · v1.0*

## 1. Purpose & Problem Statement

Picking a movie as a couple is a recurring, low-grade frustration. Three things make it worse: streaming recommendations are siloed per account (his feed is tuned to him, hers to her, and neither reflects the two of them together); what you want to watch swings hard with mood, which no static recommendation list captures; and the title you want may live on any of several services, forcing a manual hunt across apps.

Movie Match turns the decision into a fast, fun, ~2–3 minute game. Both people answer a short series of mood and taste prompts by passing one phone back and forth. The app blends their inputs, filters to what they can actually watch tonight, and lands on a film they're both happy with.

## 2. Goals & Success Criteria

Primary: reliably get two people to a movie they both want to watch in under three minutes, and make the process enjoyable. Secondary: a clean, demoable portfolio piece showing API integration, a stateful UX flow, and deliberate use of AI.

| Goal | Target | Why it matters |
|---|---|---|
| Time to a decision | < 3 minutes | Beats the status-quo scroll; the core promise |
| Mutual satisfaction | Both willing to watch the pick | A match nobody resents is the whole point |
| Mood fit | Recs match tonight's vibe, not your history | The gap generic recommenders can't close |
| Effort | Only show what's actually streamable | No post-pick hunt across services |

## 3. Scope

### In Scope (MVP — Pass-the-Phone)
- Single shared device; players pass the phone between turns with clear whose-turn cues
- A 3-round game flow (see Section 5)
- Candidate movies and streaming availability pulled from the TMDB API
- Subscription filter: configure which services you have; include/exclude paid rentals via an upfront question
- AI-assisted blending of both players' tastes and inference of their latent mood
- A final match screen, with a tiebreak round if no clean overlap
- Deep link out to JustWatch / the provider for the chosen film

### Out of Scope (later phases)
- Two-phone real-time sync (the "Ultimate" version)
- User accounts and persistent watch history
- Learning preferences across sessions
- Native mobile app (web-first for the MVP)

## 4. Architecture — Two Clean Layers

The design separates objective facts from subjective taste. This keeps the AI confined to the judgment calls it's good at, and keeps anything factual deterministic and hallucination-free.

| Layer | Responsibility | How |
|---|---|---|
| Facts layer | What exists & where it streams | TMDB API — metadata, genres, and watch providers (flatrate / rent / buy), powered by JustWatch. Region-specific, refreshed daily. |
| Taste layer | Blending tastes & reading mood | Claude API — at most two calls per session (see Section 5) |

API keys for TMDB and Claude must never ship to the client; all external calls run through serverless functions. TMDB availability is daily and region-specific and does not expose in-app deep links — the app links out to JustWatch for the final step.

## 5. Game Flow & Requirements

### Round 1 — Categories & Mood
Each player picks 2–3 categories or moods, passing the phone between turns. The AI takes both sets plus the stated mood and proposes the blended themes and a candidate pool to pull from TMDB. Simple overlaps are direct (Action ∩ Comedy → action-comedies); the value is in fuzzy blends a tag intersection misses — e.g. apocalyptic horror + action → Train to Busan, A Quiet Place, 28 Days Later. **(AI call #1.)**

### Round 2 — Swipe the Vibe
The app surfaces a handful of well-known films from the blended pool that hit slightly different sub-genres. Each player swipes "in the mood for this / not this," passing the phone. The three titles a player leans toward encode a latent preference — tone, pacing, darkness, era — that no genre tag captures. The AI infers that pattern to shape Round 3. **(AI call #2.)**

### Round 3 — Final Picks
Each player is shown ~5 recommendations and selects every title they'd be willing to watch. If the two selections overlap, that's the match. If not, a short Round 4 surfaces a few more candidates, or the closest near-match is held and offered as the tiebreak.

### Subscription & Pay Filter
On setup the user records which services they subscribe to, and is asked upfront whether they're willing to pay to rent/buy tonight. Candidate filtering includes or excludes paid results accordingly, so the final pick is always something they can actually watch.

## 6. Functional Requirements

- **FR-1** Run the full flow on a single shared device with clear turn indicators.
- **FR-2** Let each player select 2–3 categories/moods in Round 1.
- **FR-3** Call the AI once to produce a blended theme set and candidate pool.
- **FR-4** Present swipeable sub-genre samples in Round 2 and capture each player's leanings.
- **FR-5** Call the AI once to infer mood patterns and generate Round 3 recommendations.
- **FR-6** Let each player multi-select acceptable titles and compute the overlap.
- **FR-7** Run a tiebreak (Round 4 / nearest match) when no overlap exists.
- **FR-8** Filter all candidates to the user's subscribed services plus an optional paid tier.
- **FR-9** Fetch all movie data and availability from TMDB via serverless functions.
- **FR-10** Link out to JustWatch / the provider for the matched film.

## 7. Tech Stack

- **Frontend:** React (web-first, mobile-responsive, swipe interactions)
- **Movie data & availability:** TMDB API (free key)
- **AI:** Claude API (`claude-sonnet-4-6`) via the Anthropic SDK — 2 calls per session
- **Backend:** serverless functions (Vercel / Next.js API routes) to keep API keys server-side
- **Hosting:** Vercel free tier
- **Optional later:** vector embeddings of movie descriptions for similarity-based blending

## 8. Risks & Caveats

| Risk | Assessment | Mitigation |
|---|---|---|
| TMDB availability region-specific & daily | Built-in limitation | Set region on setup; treat availability as "today"; link out to JustWatch |
| No in-app deep links from TMDB | Expected | Hand off to JustWatch / provider for the final click |
| AI latency breaks the snappy feel | Real if calls stack up | Cap at 2 calls; prefetch the candidate pool; show playful loading states |
| Blends feel generic | Kills the core promise | Validate fuzzy-blend quality early; tune the AI prompts before polishing UI |
| Scope creep into two-phone sync | Likely temptation | Hard-defer sync to a later phase; ship pass-the-phone first |
| API keys exposed client-side | Security issue | Route every external call through serverless functions |
