# 🎬 Movie Match

> Two people, one phone, three rounds, ~2 minutes — and a movie you both actually want to watch tonight.

**Live demo:** **[movie-match-rho.vercel.app](https://movie-match-rho.vercel.app)** · **Built by:** [Lasse](https://github.com/lasse-max)

---

## The problem

Picking a movie as a couple is a small daily frustration that streaming apps make worse:

- **Recommendations are siloed per account.** His feed is tuned to him, hers to her — neither reflects *the two of them together.*
- **Mood beats history.** What you want tonight swings hard with your mood, and no static "Recommended for You" row captures that.
- **The title lives somewhere else.** Even once you agree, you're hunting across services to find where it streams.

Movie Match turns the decision into a fast, fun game instead of a scroll.

## How it works

A ~2–3 minute game played by passing one phone back and forth:

1. **Round 1 — Categories & mood.** Each player picks 2–3 categories/moods. The app blends them — including fuzzy overlaps a genre tag can't (e.g. *apocalyptic horror + action → Train to Busan, A Quiet Place*).
2. **Round 2 — Swipe the vibe.** A few well-known titles from the blended pool, hitting different sub-genres. Each player swipes toward what fits — revealing tone, pacing, and darkness that genre labels miss.
3. **Round 3 — Final picks.** Each player selects every title they'd be willing to watch. Overlap = match. No overlap → a quick tiebreak round.

Throughout, results are filtered to **services you actually subscribe to** (plus an optional "willing to pay tonight?" tier), so the pick is always watchable right now.

## Architecture — two clean layers

The design deliberately separates objective facts from subjective taste. This keeps the AI confined to the judgment calls it's good at, and keeps anything factual deterministic.

| Layer | Responsibility | How |
|---|---|---|
| **Facts** | What exists & where it streams | [TMDB API](https://developer.themoviedb.org/) — metadata, genres, watch providers (powered by JustWatch) |
| **Taste** | Blending tastes & reading mood | Claude API — **exactly two calls** per session |

**Where the AI is — and isn't.** Genre intersection is plain logic. The AI earns its place only in the two spots rule-based code fails: blending fuzzy cross-genre vibes (Round 1 → 2) and inferring a latent mood pattern from a player's swipes (Round 2 → 3). Everything factual stays deterministic.

```
setup → Round 1 → [AI: blend] → Round 2 → [AI: infer pattern] → Round 3 → match / tiebreak
```

## Tech stack

- **Frontend:** React (web-first, mobile-responsive, swipe interactions)
- **Movie data & availability:** TMDB API
- **AI:** Claude API (`claude-sonnet-4-6`) — 2 calls/session
- **Backend:** serverless functions (keeps API keys off the client)
- **Hosting:** Vercel
- *Optional later:* vector embeddings for similarity-based blending

## Getting started

```bash
git clone https://github.com/lasse-max/movie-match.git
cd movie-match
npm install
cp .env.example .env.local   # add TMDB_READ_ACCESS_TOKEN and ANTHROPIC_API_KEY
npm run dev
```

### Environment variables

| Key | Where to get it |
|---|---|
| `TMDB_READ_ACCESS_TOKEN` | https://www.themoviedb.org/settings/api (free) — use the **v4 API Read Access Token** |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ |

> ⚠️ Both keys are used **server-side only** via serverless functions — never exposed to the browser.

## Roadmap

- [x] Phase 0 — Plan (BRD + roadmap)
- [ ] **Phase 1 — MVP (pass-the-phone):** 3-round flow, TMDB pool, subscription filter, 2 AI calls, deployed
- [ ] Phase 2 — Polish: swipe animations, tiebreak logic, loading states, this README + demo GIF
- [ ] Phase 3 — "Ultimate": two-phone real-time sync
- [ ] Phase 4 (optional): watch history, embeddings-based blending

## Notes & limitations

- TMDB streaming availability is **region-specific** and refreshed **daily** — treated as "what's streaming today."
- TMDB doesn't expose in-app deep links, so the final pick links out to JustWatch / the provider.

## License

MIT
