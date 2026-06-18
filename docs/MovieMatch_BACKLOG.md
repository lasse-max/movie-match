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
- **"Seen it" affordance in Round 2.** A third tap recording "I like this vibe but have seen this title" — counts as a POSITIVE vibe signal AND excludes that exact title from Round 3. The complete fix for "seen-it pollutes the swipe." MVP uses vibe-framed copy ("something like this?") as the 80/20; this is the robust version.
- **Watch-history awareness for Round 3.** MVP can't know what a couple has already seen beyond the few titles shown in Round 2. Full "exclude already-seen" recommendations needs persistent history (accounts) — Phase 3+.

## AI / blend (from step 5)
- **Smarter adult-animation handling.** MVP default-excludes the `Family` genre (unless a player explicitly picked an animation/family category) to stop kids' fare (Mario, Zootopia) surfacing. Cost: some adult-watchable Family-tagged animation (e.g. Studio Ghibli) drops too. Later: distinguish adult-watchable animation from kids' fare rather than blanket-excluding Family.
- **Richer keyword matching.** Multi-word/phrase keywords don't resolve to TMDB keyword IDs, so the prompt now requires single-concept keywords ("time travel", not "love across time"). Later: a curated keyword-concept map or embeddings for richer, less literal matching.

## Reliability
- **Fonts.** Swap `next/font/google` (Geist) for a local/system font. Production works on Vercel, but the Google-font fetch is network-fragile in restricted build environments. (Cato finding, P2.)
