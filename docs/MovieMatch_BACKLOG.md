# Movie Match — Backlog (deferred / Phase 2+)

Items intentionally deferred during Phase 1. Not bugs to fix now — captured so they aren't lost.

## UX
- **Round 1 — mood/vibe input.** Let users pick characteristics ("light, funny, cozy, intense") instead of — or alongside — formal genres ("adventure, thriller"). Offer either/or. More natural for "what do I feel like watching," and feeds the AI blend (step 5) better than rigid genres. (BRD already frames Round 1 as "categories or moods.")
- **Round 2 — swipe animations.** Real swipe gestures/transitions (deferred from MVP, which uses basic buttons/swipe).

## Data / providers
- **Provider list curation.** Current setup shows the top ~8 providers by TMDB `display_priority` per region. This can surface niche services (e.g. Crunchyroll) while missing some mainstream ones (e.g. Max/HBO, Peacock absent from the US top 8). Consider increasing the count or lightly curating so major mainstream services always appear. (Confirmed working as region-specific — DE shows RTL+/Joyn, US shows Hulu/fuboTV — this is a refinement, not a bug.)

## AI / blend (from step 5)
- **Smarter adult-animation handling.** MVP default-excludes the `Family` genre (unless a player explicitly picked an animation/family category) to stop kids' fare (Mario, Zootopia) surfacing. Cost: some adult-watchable Family-tagged animation (e.g. Studio Ghibli) drops too. Later: distinguish adult-watchable animation from kids' fare rather than blanket-excluding Family.
- **Richer keyword matching.** Multi-word/phrase keywords don't resolve to TMDB keyword IDs, so the prompt now requires single-concept keywords ("time travel", not "love across time"). Later: a curated keyword-concept map or embeddings for richer, less literal matching.

## Reliability
- **Fonts.** Swap `next/font/google` (Geist) for a local/system font. Production works on Vercel, but the Google-font fetch is network-fragile in restricted build environments. (Cato finding, P2.)
