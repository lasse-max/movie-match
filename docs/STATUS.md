# Project Status — movie-match

Living status doc. Single source of truth for *where things stand right now and who's holding what*. Complements `DECISIONS.md`/`docs/` (why & specs), the roadmap (direction), `docs/MovieMatch_BACKLOG.md` (deferred), and `PM Projects/Layline_Eval_Evidence.md` (eval audit trail). **Owner of this doc:** George (coordinator); **updated by:** Otto at each checkpoint.

**Last updated:** 2026-06-25 · **Branch:** `main`

---

## Headline

Matching engine is at a strong, **eval-proven** place (baseline **17/17** valid couples — binary "fits both?" is saturated). Marquee dark redesign shipped + Cato-cleared. **Step-3 embedding de-risk done → PARTIAL GO:** embeddings GO as **candidate sourcing / inventory expansion** (cheap source) feeding the existing overlap/bridge selector; **rich-source maximin rejected** as the final selector (compromise-mush). #8 data-integrity fix **shipped + Cato-cleared**; **Lasse is now running the first 3–4 friend tests** (clean swipe data). Next build: the **embeddings inventory-expansion layer** (next couple of days).

## Done (v1.0 → v1.5)

- v1.0 MVP shipped; **watchability invariant** hardened over 6 independent review rounds.
- Matching: round-dependent popularity, recency lean, match transparency (tags + %), franchise dedup.
- Brief 2: always-runner-ups + "see other matches" (Cato-validated; ineligible-guard proven by mutation testing).
- Round-3 availability backfill: 1-service mainstream players **8/34 → 33/34** ≥5 eligible.
- Marquee dark redesign: shipped + fixes Cato-cleared (zero-pick restored, dev strip removed, overflow scroll, tiebreak gold).
- Eval measurement layer: 18-couple set + thin lane, frozen pool, calibrated scalar judge (`opus-4-8`, confirmed-win floor 24), blind human pairwise.
- **Step-3 de-risk (~$1):** variety PASS (5.29× — upper bound), subgenre separation PASS, maximin single-pick FAIL → embeddings GO for sourcing; maximin rejected as selector. Cato-tightened.

## In flight

- **First real-user friend test** — *IN PROGRESS (Lasse running now)*; 3–4 testers, blind within-subject pairwise. Swipe data is clean. → collect feedback, then it informs the embeddings build.

## Recently closed

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
