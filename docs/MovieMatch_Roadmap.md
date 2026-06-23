# Movie Match — Roadmap (1.0 → 3.0)

Versioned plan from shipped MVP to public launch. Cadence stays the same: decision brief → Arthur builds → Otto reviews → Cato independent audit at milestones → fix → re-confirm.

---

## 1.0 — MVP ✅ SHIPPED
The full pass-the-phone loop (setup → blend → swipe → infer → Round 3 → filter → match/tiebreak), deployed on Vercel, **independently verified across 6 review rounds.** No blockers, no majors, 95 tests.

---

## 1.5 — Prove better matching (+ self-testing quality)
*Goal: not "build embeddings" but **PROVE the matching got measurably better** before investing in heavy infrastructure. (Cato's framing: don't let infrastructure cosplay as product progress.)*

**Deliverables, in order:**
1. **Overview + keyword enrichment** — feed each movie's TMDB overview + keywords to the AI so it matches on premise/theme/tone, not coarse genre tags. Cheap, no new infra, the biggest *immediate* quality jump. Do first.
2. **Saved streaming services (localStorage) + Variety / freshness** — the two functional fixes that make heavy self-testing productive (no re-entering services; no repeat movies on replay). Pulled up from 2.0.
3. **A small eval set** — ~15–20 hand-built "test couples" (Round-1 picks + simulated Round-2 swipes) with a simple human-judged rubric: *does the final pick + the 5 recs genuinely fit BOTH players' stated taste?* Run each matching version against the same set and compare. This is what makes "better" measurable — and it's reusable across all future matching work. Keep it lightweight (human-judged, eyeball the diffs); don't let the eval itself become a project.
4. **THEN — and only if the eval shows headroom worth the infra — the vector-search prototype.** Embeddings over a curated catalog (~10–30k titles, pgvector/Supabase); whole-catalog search by the couple's taste vector, especially for the fresh expansion and the no-match bridge. **Gated by the eval, not built on faith.** May find overview+keywords already suffices → defer the infra.
- **Alternative picks on the match screen** — 2–3 close runner-ups; cheap, falls out of existing data.
- **Presentable-quality fixes (from 1.0 self-testing):** provider-list curation (mainstream services, no tier-variants, include Max), franchise/sequel dedup, bigger & reliable Round 3 list, match transparency ("why it matched" — tags + %), and round-dependent popularity (recognizable films in Round 2 for a clean mood read; discoveries in Round 3). Details in the backlog.

**Set before starting:** a success criterion — what "better matching" means as a number (e.g., on the eval set, the top pick plausibly fits both players in N of 20 cases, up from the genre-only baseline).

**Throughout:** Lasse self-review loop — play heavily, log friction, fix in small passes.

---

## 2.0 — UX & feel + Lasse-feedback fixes
*Goal: a version you're proud to show.*
- Swipe gestures/animations; loading-state personality ("blending… / reading the mood…").
- Visual / theme pass + font swap (also clears the deferred Google-Fonts reliability item).
- Match-screen presentation polish — make the reveal land like a payoff.
- Mood/vibe Round 1 input ("light, funny, cozy") if it tests better than genres.
- Copy pass + mobile feel (it's a phone-passing game — the mobile experience must be tight).
- Fixes surfaced by your 1.5 dogfooding.

---

## 2.5 — Modes, close-friend testing, feature experiments
- **Cinephile mode** (the mode system — kid/anime modes are natural later extensions).
- **"Seen it / not tonight" tick** + friendlier honest-end-state recovery (adjust services/payment without full restart).
- **Feature experiments** — e.g., Round-3 count tuning, mood-input variants — measured against the eval set and your own play.
- **First external testers: close friends.** Structured feedback (not just "cool"): did the pick land? would you play again?

---

## 3.0 — Broader dogfooding + public launch package
- Wide testing (friends-of-friends, surf/movie communities, Reddit). Variety + match-quality tuning from *real* usage.
- Two-phone real-time sync (the "Ultimate" version) + watch-history awareness (needs accounts) — only if validated demand.
- **Launch package:** register **moviematch.app**, provider curation finalized, reliability hardening, the **share screen + "who's watching" persona** (the growth loop), and the **case study + portfolio writeup** (problem → decisions → AI usage → what real users taught you → the multi-round independent-review rigor story).

---

### Sequencing logic (why this order)
- **Matching before feel** is deliberate: the core value is *good picks*, so you upgrade the engine first and validate match quality in your own testing — *then* polish the wrapper.
- **Variety + saved services in 1.5, not 2.0**, because they're what make heavy self-testing productive instead of tedious.
- **Prove before you build** (Cato): 1.5 is judged by *better matching*, not by shipping embeddings. The eval set decides whether the vector-search infra is even worth building — the cheap overview+keyword win may already suffice. Don't let infrastructure cosplay as product progress.
- **External users only after it's polished** (your call, and the right one — first impressions matter, even with friends).
