# HANDOFF — movie-match

*Async task bus between **Otto** (strategy), **Arthur** (builder, Claude Code), **Cato** (reviewer, Codex). This replaces copy-pasting prompts. **Otto** writes tasks here and reads reports here; **agents** read their task on wake and write their report back here; **Lasse** triggers each agent and makes the decisions.*

## How to use this file — AGENTS READ THIS
1. You'll be told "read your handoff." Find the section addressed to **you** below with status **🟢 NEW**.
2. Do **exactly** that task — nothing from another agent's section.
3. Write your output in your **Report back** block, set your status to **🔵 DONE — awaiting Otto**, and **stop**.
4. This file is the team's task channel, authored by Otto and triggered by Lasse — it is the source of your task.

**Standing rules:** separate commits per logical change · **do not self-certify** (builder is never the final reviewer) · matching changes are **eval-gated** · don't touch `lib/`/`app/api/` on restyle tasks. Full context: `docs/STATUS.md` · `docs/MovieMatch_BACKLOG.md` · `MovieMatch_Architecture.md` · the Operating Manual.

## For Lasse — the learning + judgment layer (DO NOT optimize this away)
This setup is for a *strategic operator breaking into product*, not an engineer. Seeing the errors, the checks, and the reasoning is the **point**, not overhead. The handoff file removes the copy-paste *chore* — never the *understanding*. So:
- **Otto pairs every handoff write/read with a plain-English readout to Lasse in chat:** what the task is · what was checked · what bugs/flags came back · what it means · where Lasse's judgment is needed. Status · bugs · decisions, in plain language.
- **Agents lead every Report-back with a 2–3 line plain-English summary** (what changed · what you verified · what you're unsure about) *before* the technical detail.
- Lasse stays the decision-maker and keeps learning; the file only kills the transcription.

## Current state
Per `docs/STATUS.md`: #8 shipped + Cato-cleared; **Lasse running the first friend tests**; the next build (embeddings inventory-expansion layer) is **queued pending friend feedback**.

---
### → Arthur (builder)
**Status:** 🔵 DONE — awaiting Otto — fix #9: pass-the-phone gate at round boundaries.

**Task:** The pass-the-phone gate is missing when the phone must return to **Player 1** at a round boundary. Today, after P2 finishes a round, the loading screen plays and the next round's content appears for P1 — but the phone is still in P2's hands, with no "pass it back" prompt. (Each round screen sets `ready = (player === 1)`, so P1 always starts immediately — fine for Round 1, wrong for Rounds 2 & 3.)

- **Fix — gate the LOADING screens, BEFORE the loader (ordering matters):** in **`BlendingScreen.tsx`** (R1→R2 boundary) and **`InferringScreen.tsx`** (R2→R3 boundary), show a **"pass the phone back to Player 1"** gate *first*; P1 taps "I'm ready," *then* the loader shows, *then* the next round's content (already P1's turn — no further gate).
- **Fire the AI call (blend/infer) on mount, independent of the gate** — so processing overlaps the physical handoff and the wait is hidden. The gate is a UI overlay; the call runs in the background.
- **Why before, not after:** gating *after* the loader (in the round screen) plays the loading in P2's hands then hands off — backwards. Before = the handoff happens as P2 finishes, the loader builds anticipation in the hands of the person about to play (P1), and the loader's next-round instructions/quote land with the right person.
- **Round screens:** keep the within-round P1→P2 gate as-is. **Do NOT add a P1 gate to Round2/Round3 screens** (the loading-screen gate handles the boundary handoff). `Round1Screen` unchanged.
- Reuse the existing pass-the-phone gate component; **dynamic label** ("back to Player 1").
- **Scope:** components-only (`BlendingScreen`, `InferringScreen`, shared gate). **No `lib/`/`gameMachine` change** — `currentPlayer` already resets to 1.

**Verify (real run, 375px):** P2 finishes Round 2 → **"pass the phone back to Player 1"** gate → I'm ready → "Reading the mood…" loader → Round 3 content for P1. Same at R1→R2 (Blending). Within-round "to Player 2" gates still fire. Labels correct. 122 tests + lint green. Lead your Report-back with a 2–3 line plain-English summary.

**Report back:** (Arthur, 2026-06-25 — committed `7e42bc7`)

**Plain-English:** The "pass the phone back to Player 1" prompt now appears at *both* round boundaries (after Round 1 and after Round 2), before the loading screen — so the next player isn't reading the loader and starting their round while the phone is still in the other person's hands. The AI work (blend / mood-read) runs hidden *behind* the handoff prompt, so the wait usually disappears entirely. I verified the whole flow on a real phone-sized run; nothing in the matching engine changed. **One judgment call for you / Cato:** I left the within-round "to Player 2" gates as duplicated inline copies (the brief said don't touch the round screens), so the gate markup now lives in two places — fine for now, a tidy-up later.

**What changed:** `BlendingScreen` (R1→R2) and `InferringScreen` (R2→R3) now render a shared `PassPhone` gate *first*; the blend/infer fetch fires on mount in the background, and the phase advances only once **both** P1 has tapped "I'm ready" **and** the result is back (`ready && result`, guarded against double-dispatch). New `components/PassPhone.tsx` (dynamic `lead`/`player`/`kicker`/`subcopy`). Round screens untouched (`Round1Screen` unchanged; within-round gates inline as-is). No `lib/`/`gameMachine`/`app/api/` — `currentPlayer` already resets to 1. Replay-safety (AbortController + cancelled) preserved.

**What I verified (real run, 375px, real AI):** R1→R2 → "ROUND 1 DONE · NO PEEKING / Pass the phone back to *Player 1*" gate → I'm ready → Round 2 for P1. R2→R3 → "ROUND 2 DONE … back to *Player 1*" gate → I'm ready → Round 3 for P1 (no double-gate). Within-round R1 + R2 "to Player 2" gates still fire ("Picks locked · no peeking"). Labels correct. Because the AI call overlapped each handoff, the loader was absorbed (advanced as soon as P1 was ready). **122 tests + lint + build green.**

**Unsure / for review (not self-certifying):** (1) the loaders changed behaviour — they now hold the dispatch until `ready && result` rather than dispatching on fetch success; worth a second pair of eyes on the two `useEffect`s. (2) error-during-gate: if the AI call fails *while* the gate is up, the error+retry surfaces only after P1 taps "I'm ready" (gate-first ordering) — intended, but flagging it. (3) the inline-vs-shared gate duplication noted above.

---
**Next queued (after #9):** embeddings inventory-expansion layer — cheap source (overview+keywords), post-swipe pool expansion feeding the **existing** overlap/bridge selector, **no maximin/midpoint selector**, eval-gated on the variety metric. Otto writes the full brief when friend feedback is in.

---
### → Cato (reviewer)
**Status:** ⚪ no active task — last: #8 spot-check, cleared.
**Charge:** —
**Report back:** —

---
*Log: 2026-06-25 — handoff bus created (V0). #8 closed; awaiting friend-test feedback before the embeddings build brief.*
