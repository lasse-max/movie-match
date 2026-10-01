# Prompt for Claude Design (design pass 2, remaining screens)

*Written by Otto, 1 Oct 2026. Paste everything below the line into Claude Design, ideally with the "Movie Match Picture Palace" canvas open.*

---

Continue the Movie Match "Picture Palace" design on this canvas: https://claude.ai/artifact/AE59eteidWx9ctRQRFk5A8

Read first:
- Design brief, the source of truth: https://raw.githubusercontent.com/lasse-max/movie-match/main/docs/design/PICTURE_PALACE_BRIEF.md
- On the canvas: "Setup A2" is the agreed landing page. "Game flow" shows the swipe, the projector countdown and the curtain reveal. "Style sheet" holds the colours, type and motion rules. "Share card" is the match poster. Match all of them exactly. Setups B and C are rejected references; ignore them.
- What each screen does today (real content and states), one file per screen: https://raw.githubusercontent.com/lasse-max/movie-match/main/components/Round1Screen.tsx · PassPhone.tsx · BlendingScreen.tsx · InferringScreen.tsx · Round2Screen.tsx · Round3Screen.tsx · TiebreakScreen.tsx · MatchScreen.tsx (same folder). The mood and genre list: https://raw.githubusercontent.com/lasse-max/movie-match/main/lib/categories.ts
- The live app, for the flow: https://movie-match-rho.vercel.app

Task: add the missing screens as new 390 x 844 artboards in the same system, one artboard per screen or state:
1. Round 1: each player picks 2 to 3 moods or genres (moods on top, genres below)
2. Pass the phone: to Player 2, and back to Player 1 at round boundaries
3. Loader after Round 1 ("Blending your tastes"): projector countdown plus an iconic film or actor quote, Total War loading-screen style (lines from lib/quotes.ts)
4. Round 2 swipe: all three choices and their stamps. "Not sure" stays the same size and weight as the other two
5. Loader after Round 2 ("Reading the mood")
6. Round 3 shortlist: up to 8 films, pick every film you'd watch, with labels "Included with X" or "Rent on X"
7. Match: curtain closed, curtain open, the poster card, why it matched, Watch button, 2 to 3 runner-ups, play again. There is always a match; bridge picks use this same reveal
8. Share card, 9:16 (refine the existing one)
9. Error with retry (AI or network failure)

Rules:
- Colours. Light: brass #D6A24A and bulb #FFE9B0, for buttons, stamps and glow. Fabric: house velvet #B8141E, oxblood #6E0B12 and signal red #E3312D, for curtains, tickets and titles (signal red is the only red for text on black). Paper and the room: poster cream #F2E8D5, aisle #17100E, projection black #0E0A09. Surfaces step in tone; no grey divider lines.
- Type: Big Shoulders Display 900 for headlines and film titles (caps, tight). Big Shoulders Inline Display only for marquee signage. Libre Franklin for UI and body. Courier Prime 700 for tickets, labels and credits.
- Real TMDB posters and real service logos (logos muted until selected). Our graphics never replace a film's own art.
- Every fact on screen comes from TMDB. No invented trivia. Loader quotes only from the curated list in lib/quotes.ts.
- Motion: one entry curve, cubic-bezier(0.16, 1, 0.3, 1) at 0.5 to 0.6 s. Curtain 1.9 s. The countdown loops while the AI works and never adds wait. Press scales to 0.97. Every big moment is skippable on replay. With reduced motion on, everything is an instant cut.
- Touch targets at least 44 px. Text contrast at least 4.5:1. Copy short and plain: no em dashes, no emoji.
- Inspired by picture palaces and mid-century posters only: no real poster artwork, cinema names or logos.

When done, add a short table of the tokens and note any motion that differs from these rules.
