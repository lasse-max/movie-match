# Movie Match — Project Roadmap

*v1.0*

## Overview

Movie Match ships web-first and pass-the-phone, then earns its way to the synced two-device "Ultimate" version. The MVP is deliberately the fastest to finish: the data problem is solved by TMDB, the scope is tight, and there is no legal or data-access risk. Goal: a finished, deployed repo first.

## Phases at a Glance

| Phase | Timeline | Goal | Key Outputs |
|---|---|---|---|
| 0 — Plan | Done | Lock scope, flow, architecture | BRD + roadmap |
| 1 — MVP (Pass-the-Phone) | ~1 week | Working game, deployed | 3-round flow, TMDB pool, subscription filter, 2 AI calls, live on Vercel |
| 2 — Polish | +1–2 weeks | Make it feel great | Swipe animations, tiebreak round, edge cases, loading states, README |
| 3 — Ultimate (Sync) | Later | Two phones, real-time | Realtime backend, sessions, optional accounts |
| 4 — Smarter (optional) | Later | Learn over time | Watch history, embeddings-based blending, per-couple tuning |

## Phase 1 — MVP (Pass-the-Phone) · ~1 week

The finishable core. One shared device, the full 3-round flow, real data, deployed.

### Build Order
1. Scaffold React + serverless on Vercel; wire a TMDB test call end-to-end
2. Build the round state machine (setup → R1 → R2 → R3 → match/tiebreak)
3. Round 1: category/mood selection with pass-the-phone turn cues
4. AI call #1: blend both players' picks into themes + a TMDB candidate pool
5. Round 2: swipeable sub-genre samples; capture each player's leanings
6. AI call #2: infer mood pattern → generate Round 3 recommendations
7. Round 3: multi-select acceptable titles; compute overlap; tiebreak if none
8. Subscription + pay filter applied across all candidates
9. Match screen with deep link out to JustWatch / provider

### Definition of Done
Two people can go from launch to an agreed movie in under three minutes on one phone, seeing only titles they can actually stream tonight — deployed at a public URL.

## Phase 2 — Polish · +1–2 weeks
- Swipe gestures and transitions that make Round 2 feel like a game
- Tiebreak / "close one stays" logic refined and tested
- Edge cases: no overlap, tiny candidate pools, missing availability
- Playful loading states to mask AI latency
- A strong README: problem, the two-layer architecture, where AI is and isn't used, a short demo GIF

## Phase 3 — Ultimate (Two-Phone Sync) · Later
A separate, bigger build — intentionally deferred. Both players open the app on their own phones and play in sync.
- Real-time backend (e.g. Supabase Realtime, Firebase, or websockets)
- Shared session/room model so two devices stay in lockstep
- Optional lightweight accounts to remember subscriptions
- Reconnect / dropped-turn handling

## Phase 4 — Smarter (Optional) · Later
- Persist watch history and outcomes per couple
- Swap or augment the LLM blend with vector embeddings for similarity matching
- Tune recommendations to a couple's evolving taste over time

