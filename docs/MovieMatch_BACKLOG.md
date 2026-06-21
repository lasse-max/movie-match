# Movie Match — Backlog (deferred / Phase 2+)

Items intentionally deferred during Phase 1. Not bugs to fix now — captured so they aren't lost.

## Features (Phase 2+)
- **Alternative picks on the match screen.** Show the winner prominently + 2-3 closely-related runner-ups ("or also…"). Low effort — falls out of the existing ranked finalists. Keep the "we found THE one" hook primary. *Strongest early candidate — a match-screen tweak, not a full feature.*
- **Saved streaming services.** Persist the user's services so they don't re-enter each session (replay friction). Device-local via localStorage = cheap, no backend, do early. Cross-device profiles need accounts = Phase 3 (with sync).
- **Persona / modes (normal ↔ cinephile slider).** Cinephile favors A24/foreign/high-critical and de-weights blockbusters — mostly tuning the existing popularity/quality guards + TMDB Discover params (production company e.g. A24, original-language, vote-average). Refinement: WEIGHT toward arthouse, don't hard-ban popularity (Parasite is both). Generalizes the Family guard into a mode system → Kid mode (include family/animation) and Anime mode (animation + JA original) are natural future extensions.
- **Share screen (social).** Shareable result card for IG stories etc. — the organic growth loop; the app's signature moment if done well.
- **Share persona ("who's watching").** Map each player's taste to a representative character/actor (action → Statham, rom-com → Cameron Diaz) on a couch with the chosen film. Could use a small AI call (infer character from swipes) + curated assets. Caveat: real-actor likenesses are fine for personal/portfolio use but raise IP/likeness questions if commercialized — revisit then.

## UX
- **Round 1 — mood/vibe input.** Let users pick characteristics ("light, funny, cozy, intense") instead of — or alongside — formal genres ("adventure, thriller"). Offer either/or. More natural for "what do I feel like watching," and feeds the AI blend (step 5) better than rigid genres. (BRD already frames Round 1 as "categories or moods.")
- **Round 2 — swipe animations.** Real swipe gestures/transitions (deferred from MVP, which uses basic buttons/swipe).

## Data / providers
- **Provider list curation.** Current setup shows the top ~8 providers by TMDB `display_priority` per region. This can surface niche services (e.g. Crunchyroll) while missing some mainstream ones (e.g. Max/HBO, Peacock absent from the US top 8). Consider increasing the count or lightly curating so major mainstream services always appear. (Confirmed working as region-specific — DE shows RTL+/Joyn, US shows Hulu/fuboTV — this is a refinement, not a bug.)

## Signal quality (Round 2 / 3)
- **"Seen it / not tonight" tick box in Round 2.** A small tick box ALONGSIDE the vibe swipe: the player swipes 👍 (likes the vibe) and ticks "already seen — not tonight." Behaviour: treat as a STRONG positive vibe signal, exclude that exact title from Round 3, and use it as a high-confidence seed for the similar-movie (fresh) expansion — turning "seen it" from a loss into the best "find me more like this I haven't seen" signal. Distinct from the 🤷 "Don't know" (unfamiliar → neutral / 0 weight). UI note: keep the card clean — the tick is secondary to the primary vibe swipe. Rewatch nuance: "seen" must NEVER be a hard/global exclude — rewatching is a real desire; only the explicit per-title "not tonight" tick removes a title (if you'd rewatch, just 👍 without ticking). The "alternative picks" feature also softens this — a seen/unwanted winner isn't a dead end if there are 2-3 close alternatives. Revisit seen/rewatch handling together. MVP ships the vibe-framed copy ("something like this?") as the 80/20; this is the robust version.
- **Watch-history awareness for Round 3.** MVP can't know what a couple has already seen beyond the few titles shown in Round 2. Needs persistent history (accounts) — Phase 3+. Important: history should INFORM/flag ("you've seen this"), NOT hard-exclude — rewatching is a real desire, so removing everything already seen would be wrong.

## AI matching depth (go beyond genre tags)
- **Enrich the AI calls with overview + TMDB keywords.** Today the blend/infer prompts see mostly title + genre tags — coarse (John Wick vs Saving Private Ryan are both "Action"). Feed each movie's `overview` + TMDB `keywords` so the AI matches on premise/theme/tone, not labels. Highest-ROI depth jump; stays inside facts/taste (TMDB supplies the text, AI reasons). First Phase-2 AI move.
- **Embeddings / semantic taste matching (whole-catalog search by feel).**
  - *Architecture:* keep Round 1 as the fast mood shortlist for the swipe rounds. Embeddings kick in AFTER Rounds 2–3 — where the taste signal is richest — to search BEYOND the ~40-movie session pool. Two highest-value uses: (a) the fresh expansion, and (b) the no-direct-match bridge — find the whole-catalog movie nearest the MIDPOINT of both players' taste vectors (the true semantic sweet spot).
  - *Storage:* precompute ONE vector per movie from overview+keywords, stored in a vector store. Natural fit: pgvector via Supabase (the same backend earmarked for the sync version) — embeddings ride along with it. A JSON/in-memory file works at small scale. The couple's taste vector is computed fresh each session from swipes (ephemeral unless accounts/history are added; movie vectors are the stored/precomputed "map").
  - *Scale:* embed a CURATED catalog (~10–30k most-relevant titles), not all ~900k TMDB movies — covers every realistic pick, keeps cost/storage sane.
  - The "maximum AI" version and a strong portfolio flex; lets the whole catalog compete on vibe instead of re-ranking a genre-pre-filtered shortlist. Phase 2/3 (pairs with the Supabase backend).
- **Critic scores (RT / Metacritic via OMDb).** A separate QUALITY signal (is it good), distinct from vibe matching. Lower priority than the depth items above. Note: TMDB has user ratings + keywords + overviews but NOT pro critic reviews.

## Variety / freshness
- **Variety across sessions.** The pool is anchored to TMDB popularity within the chosen genres/keywords, with no freshness mechanism — so repeat plays (and similar inputs) surface the same well-known titles, which hurts replay (the key retention variable). Levers: sample randomly within a larger quality-qualified set (not just top-N), vary the Discover `page`, rotate sort orders, and (with history/localStorage) exclude recently-shown titles. Cinephile mode also diversifies. Tuning, not a correctness bug — Phase 2.

## AI / blend (from step 5)
- **Smarter adult-animation handling.** MVP default-excludes the `Family` genre (unless a player explicitly picked an animation/family category) to stop kids' fare (Mario, Zootopia) surfacing. Cost: some adult-watchable Family-tagged animation (e.g. Studio Ghibli) drops too. Later: distinguish adult-watchable animation from kids' fare rather than blanket-excluding Family.
- **Richer keyword matching.** Multi-word/phrase keywords don't resolve to TMDB keyword IDs, so the prompt now requires single-concept keywords ("time travel", not "love across time"). Later: a curated keyword-concept map or embeddings for richer, less literal matching.

## Reliability
- **Fonts.** Swap `next/font/google` (Geist) for a local/system font. Production works on Vercel, but the Google-font fetch is network-fragile in restricted build environments. (Cato finding, P2.)

## Security / hardening
- **Rehydrate factual fields from TMDB IDs.** The infer/bridge routes (`lib/validate.ts`) validate the submitted pool's SHAPE, not its provenance — a client could pair a real TMDB id with a fabricated title/genres. Low-stakes today (stateless, single-session, the abuse is on the sender's own game), but the robust fix is to trust only the ids and re-fetch the factual fields (title, genres, votes) from TMDB server-side. (Cato finding, P2.)
