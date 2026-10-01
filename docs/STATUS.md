# Project Status — movie-match

Living status doc. Single source of truth for *where things stand right now and who's holding what*. Complements `DECISIONS.md`/`docs/` (why & specs), the roadmap (direction), `docs/MovieMatch_BACKLOG.md` (deferred), and `PM Projects/Layline_Eval_Evidence.md` (eval audit trail). **Owner of this doc:** George (coordinator); **updated by:** Otto at each checkpoint.

**Last updated:** 2026-09-30 · **Branch:** `main`

---

## Headline

**2.0 kickoff (30 Sep 2026).** Beta testing is done. Main finding: the ~45-film pool feels small, so a film the couple hasn't heard of rarely wins. Next: the embeddings build (Track A), the "Picture Palace" redesign (Track B, prototype plus `docs/design/PICTURE_PALACE_BRIEF.md`), and launch readiness (Track C: rate limit, event log, saved services). Plan and open decisions: `docs/decisions/2026-09-30_2.0-kickoff.md`.

## Done (v1.0 → v1.5)

- v1.0 MVP shipped; **watchability invariant** hardened over 6 independent review rounds.
- Matching: round-dependent popularity, recency lean, match transparency (tags + %), franchise dedup.
- Brief 2: always-runner-ups + "see other matches" (Cato-validated; ineligible-guard proven by mutation testing).
- Round-3 availability backfill: 1-service mainstream players **8/34 → 33/34** ≥5 eligible.
- Marquee dark redesign: shipped + fixes Cato-cleared (zero-pick restored, dev strip removed, overflow scroll, tiebreak gold).
- Eval measurement layer: 18-couple set + thin lane, frozen pool, calibrated scalar judge (`opus-4-8`, confirmed-win floor 24), blind human pairwise.
- **Step-3 de-risk (~$1):** variety PASS (5.29× — upper bound), subgenre separation PASS, maximin single-pick FAIL → embeddings GO for sourcing; maximin rejected as selector. Cato-tightened.

## In flight

- **2.0 kickoff:** decisions locked 1 Oct (parallel tracks, Supabase project, share card in 2.0, CLAUDE.md added).
- **Track A · Embeddings v1:** brief written (`docs/decisions/2026-10-01_embeddings-v1.md`), awaiting Lasse's approval and the new Supabase project. Then Arthur builds E1 and E2.
- **Track B · Design pass 2 (Picture Palace):** prototype built, plus three landing page options (A marquee sign, B quiet house, C poster). Lasse to pick, then take the brief to Claude Design or Figma.
- *Closed:* first friend or beta test, done 30 Sep (Lasse). Full notes still to be written up.

## Recently closed

- **#9 Pass-the-phone gate at round boundaries** — fixed + Cato-cleared (`7e42bc7`). "Pass back to Player 1" gate now on the loading screens (Blending/Inferring) *before* the loader; AI call fires in the background so the wait hides behind the handoff. New shared `PassPhone.tsx`. Friend-test prerequisite ✓. (First full V0 handoff-bus cycle — zero copy-paste.)
- **#8 Round-2 neutral-button visibility** — fixed + Cato-confirmed (`9ac0913`). Neutral is now a balanced, labeled third option; **0-weight semantics verified at runtime** (8 taps → "0 into · 0 passed · 8 skipped"). Swipe signal is now clean for matching / eval / the data flywheel.
- *Git hygiene (George):* commit the stranded `docs/` working-tree changes (backlog correction + this STATUS).

## Next (couple of days)

- **Build the embeddings inventory-expansion layer:** cheap source (overview+keywords), post-swipe pool expansion feeding the **existing** overlap/bridge selector. **No maximin/midpoint selector.** Eval-gated on the variety metric. Nail the *real* (availability-filtered, fully-deduped) variety multiple — 5.29× is an upper bound.

## Not-until / guardrails

- **No user-facing "Engine A/B" toggle** — differences surface as **modes** (a taste choice), not engines.
- **No midpoint/maximin winner selector** (de-risk rejected — compromise-mush).
- Movie Match "Live →" link on the Layline site held until the app ships publicly.
- Determinism stays in the eval harness only; the live product keeps replay variety.

## Open decisions for owner

- Embedding provider for prod (default OpenAI `text-embedding-3-small`; Voyage alt).
- Curated catalog size to embed (~10–30k).
- (Site) real LinkedIn URL · (George) daily report time.

## Team & flow

Lasse = owner (decides) · Otto = product/strategy (plans, briefs, triage) · Arthur = builder (Claude Code) · Cato = independent reviewer (Codex) · George = coordinator.
Flow: Otto brief → Arthur builds (separate commits, self-report) → Otto triages → Cato independent review → Otto triages flags → fix → **eval-gated done**.

## Key docs

`PM Projects/Layline_Eval_Evidence.md` (eval audit trail) · `PM Projects/MovieMatch_Architecture.md` (system map) · `docs/MovieMatch_BACKLOG.md` (deferred) · roadmap & BRD · `eval/` (harness + results).
