# Picture Palace · screen boards

The agreed screens for design pass 2, exported from Lasse's design canvas on 1 Oct 2026. They are reference markup for exact values (colours, sizes, spacing, copy, keyframes). They are not app code: rebuild them as React components, don't copy them in.

Build brief: `docs/decisions/2026-10-01_design-pass-2-build.md`. Direction and rules: `docs/design/PICTURE_PALACE_BRIEF.md`.

## How to open them

They run on `docs/design/support.js`. From `docs/design/`, start a static server (`python3 -m http.server`) and open `http://localhost:8000/picture-palace/SetupA.dc.html` at a 390 x 844 viewport. Service logos show as broken images; that's expected, because in the app they come from TMDB (`logoUrl`).

## The boards

| File | Screen |
|---|---|
| `Main.dc.html` | Tap-through prototype of the whole flow (timing and motion reference) |
| `StyleSheet.dc.html` | Colours, type, materials |
| `SetupA.dc.html` | Landing and setup (layout A2, the agreed one) |
| `R1Mood.dc.html` | Round 1, pick the mood |
| `Pass2.dc.html`, `Pass1.dc.html` | Pass the phone, to Player 2 and back to Player 1 |
| `Load1.dc.html`, `Load2.dc.html` | Loaders: projector countdown plus an iconic quote |
| `SwipeStamp.dc.html`, `Stamps.dc.html` | Round 2 swipe and the three equal stamps |
| `R3Shortlist.dc.html` | Round 3 shortlist |
| `MatchClosed.dc.html`, `MatchOpen.dc.html` | The match: curtain closed, then open |
| `ShareCard.dc.html` | The match as a poster card, 9:16 (sharing comes in Track C) |
| `Error.dc.html` | AI or network error with retry |

Text in square brackets (for example `[TMDB poster]`, `[Date]`) is a placeholder for real data. The films on the boards are fictional.
