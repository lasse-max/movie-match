# Movie Match

**Bring the fun back to movie night.**

You sit down together to watch a film. Half an hour later, you're still switching between streaming apps, scrolling through unfamiliar titles, and trying to agree. Each service shows its own catalog through its own recommendation feed. What it knows about your viewing history is only part of the picture.

Movie Match brings that fragmented search together and centres it on two things that matter tonight: **your mood and the person sitting beside you**.

It turns choosing into a game for two people sharing one phone. Pick your moods, react to films, and discover recommendations drawn from across streaming services. Designed to be played in under three minutes, the game produces a shortlist of up to five recommendations with the platforms where you can watch them. Choosing the film becomes part of the night you were looking forward to.

**Beta 1.9 · focused user testing.** Strong early feedback is helping shape the experience ahead of launch.

**[Try the beta](https://movie-match-rho.vercel.app)**

Built by Lasse as part of Layline, with AI-assisted implementation and review.

## Built for tonight, together

A viewing history can tell you what someone watched before. It cannot tell the whole story of what two people want from this evening. Movie Match starts with both players' current preferences, then uses their reactions to find common ground.

The search spans providers, while the final recommendations respect the couple's region, subscriptions, and willingness to rent. The result is a short set of options you can act on together.

## Try it

Open the beta with another person and choose your region and services. Then pass the phone between players:

1. **Choose your mood.** Each player picks genres or moods they would enjoy tonight.
2. **React to titles.** Positive, negative, and neutral responses help refine each player's preferences.
3. **Choose your finalists.** Each player selects films they would watch. Shared picks lead to a match; a tiebreak or bridge recommendation handles the absence of a direct overlap.

See where each recommendation is available and explore the alternatives if the first suggestion does not land. Recommendations can include a mutual pick or a clearly labelled bridge between your tastes.

<!-- Optional: add a screenshot of the result and alternatives here.
Use a real product capture; add the image only after the asset exists.
-->

## Product decisions

| Decision | Why it matters |
|---|---|
| One phone, with explicit handoffs | Makes the shared session simple to start and keeps each player's turn clear. |
| Mood and reactions as inputs | Captures what someone wants tonight, without requiring viewing history. |
| A neutral response with no positive or negative weight | Avoids treating an unfamiliar title as a dislike. |
| Provider eligibility enforced in code | Keeps streaming constraints separate from the model's taste judgments. |
| Alternatives and a distinct bridge path | Supports a useful next step when tastes do not directly overlap. |

## How the system works

```text
Region + services + two players' mood choices
    → taste strategy
    → TMDB candidate pool
    → reactions from both players
    → mood inference and candidate ranking
    → provider eligibility checks
    → final picks → overlap / tiebreak / bridge
```

Claude has two stages of responsibility: interpret the initial preferences into a search strategy, then interpret reactions and rank supplied candidates. The application validates model output and provides deterministic fallbacks.

Movie identities, metadata, and watch-provider information come from TMDB. The model cannot introduce an arbitrary title into the result: selections are checked against the supplied candidate set. Eligibility and final selection rules live in application code.

**Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Claude via the Anthropic SDK, TMDB, Vitest, and Vercel.

## Evaluation and limitations

Beta feedback is informing the launch experience. Alongside those sessions, the [evaluation harness](https://github.com/lasse-max/movie-match/tree/main/eval) exercises the matching pipeline with fixed couple profiles and scripted reactions, helping compare whether recommendations plausibly fit both players.

- Streaming availability depends on third-party data and can differ from what a provider offers at the moment of playback.
- Limited subscriptions and strongly divergent tastes can leave a thin candidate pool.
- API latency and failures can affect a session; fallbacks preserve a usable path where possible.
- The current interaction uses one shared phone. Separate-device synchronisation is future work.

## Run locally

Requires Node.js 20.9 or later, matching the project's Next.js dependency.

```bash
git clone https://github.com/lasse-max/movie-match.git
cd movie-match
npm ci
cp .env.example .env.local
```

Set `TMDB_READ_ACCESS_TOKEN` and `ANTHROPIC_API_KEY` in `.env.local`, then run:

```bash
npm run dev
```

These credentials are read by server-side code. Keep `.env.local` out of Git.

Available checks:

```bash
npm run lint
npm test
npm run build
```

## Next

- Continue beta 1.9 testing and use feedback from couples to refine the launch experience.
- Improve candidate variety while preserving eligibility and mutual fit.
- Add a short visual walkthrough and broaden repeatable end-to-end checks.

## License

[MIT](https://github.com/lasse-max/movie-match/blob/main/LICENSE).
