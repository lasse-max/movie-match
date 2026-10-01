# Design pass 2 · Picture Palace · build brief (Track B)

**Date:** 1 Oct 2026 · **Owner:** Otto · **Builder:** Arthur · **Review:** Otto, Lasse plays it, then Cato
**Status:** Approved by Lasse to build ("we should build it so I can play around with it", 1 Oct)

## 1. Goal

Lasse can play the whole game in the new look on his own phone and give feedback. It builds straight onto the live game: nobody is using it yet, so there is no need for a separate preview (Lasse, 1 Oct). This pass changes look and motion only. The engine, the AI calls, the rounds and the rules stay exactly as they are.

## 2. Sources, in this order

1. `docs/design/PICTURE_PALACE_BRIEF.md`: the direction, materials, type, signature moments and the non-negotiable rules (section 5). Read it first.
2. `docs/design/picture-palace/*.dc.html`: the agreed screens as markup. Use them for exact colours, sizes, spacing, copy and keyframes. See the README in that folder for how to open them.
3. `Main.dc.html`: the tap-through prototype. Use it for flow and timing.

If the boards and the brief disagree, the brief wins. If something isn't covered, pick the simplest option and list it under "unsure" in your report.

## 3. Scope

- **In:** `components/`, `app/globals.css`, `app/layout.tsx`, `package.json` and its lockfile (one new dependency: `motion`, pre-approved).
- **Out:** `lib/`, `app/api/`, `lib/gameMachine.ts`, prompts, matching, eval. No new TMDB or AI calls. `lib/quotes.ts` stays as it is (the list cleanup is a separate session).
- **Deferred:** share button, share link and image export (Track C). Saved services (Track C).

## 4. Board to component map

| Board | Component | Notes |
|---|---|---|
| StyleSheet | `app/globals.css`, `app/layout.tsx` | Replace the Marquee tokens and fonts with Picture Palace (table in section 6) |
| (none) | `GameScreen.tsx` | Backdrop becomes projection black plus film grain (about 8%). Drop the gold glow |
| (none) | `marquee.tsx` | Shared primitives (CTA, chips, icons, loader column). Restyle in place or replace with a new shared file. Your call |
| SetupA | `SetupScreen.tsx` | Marquee sign with chasing bulbs, the plain-words line, region, two-column logo grid with every service visible without scrolling at 390 x 844, renting toggle, ADMIT TWO ticket CTA |
| R1Mood | `Round1Screen.tsx` | Moods on top, genres below |
| Pass2, Pass1 | `PassPhone.tsx` | One gate component for every hand-off. Fold the three inline gate copies in `Round1Screen`, `Round2Screen` and `Round3Screen` into it (the dedupe logged after fix #9). Same behaviour, one place |
| Load1 | `BlendingScreen.tsx`, `LoadingQuote.tsx` | Gate first, then countdown plus quote |
| Load2 | `InferringScreen.tsx`, `LoadingQuote.tsx` | Same pattern |
| SwipeStamp, Stamps | `Round2Screen.tsx` | Drag to swipe, stamps, three equal buttons (section 5) |
| R3Shortlist | `Round3Screen.tsx` | Multi-select shortlist, availability labels |
| (none) | `TiebreakScreen.tsx` | Loading state uses the Load2 pattern. Error uses the Error board. The "Nothing's included tonight" state: restyle in place, keep its behaviour |
| MatchClosed, MatchOpen | `MatchScreen.tsx` | Curtain, valance, poster card, why it matched, Watch CTA, runner-ups, play again |
| ShareCard | poster card component | Build the match card as its own component so Track C can reuse it for sharing. No share button yet |
| Error | one shared error state | Used by Blending, Inferring and Tiebreak. One line, one retry button |

## 5. Behaviour

**Drag to swipe (Round 2).** New; the prototype only has buttons.
- The top card follows the finger and tilts with it (up to about 12 degrees).
- Release past about 35% of the card width, or a fast flick: right is This vibe, left is Not it, down is Not sure (the prototype's down exit).
- The matching stamp fades in while dragging and is fully on at the threshold. Release before the threshold and the card springs back.
- The three round buttons stay, float over the poster, and do the same thing. Same size and weight. "Not sure" stays equal (fix #8 data rule).
- It records exactly the same decision as today. No change to what gets dispatched.

**Countdown loader (after Round 1, after Round 2, tiebreak).**
- Keep the fix #9 order: the pass-back gate shows first, the AI call fires on mount behind it, then the loader.
- The 3-2-1 leader (sweep, crosshair, flicker, scratches) loops while the call runs. When the result is in, finish the current number and move on. Never hold players more than about 1 s after the result.
- The quote is the hero, Total War style: big, in quotation marks, the film or actor under it in Courier caps. One quote per wait from `randomQuote()`. If the wait passes about 8 s, fade to a second quote.
- The countdown only appears while the AI works. The match goes straight to the curtain, no countdown before it.

**Curtain (match).**
- MatchClosed holds for about 0.9 s, then the curtain parts in about 1.9 s, `cubic-bezier(0.65, 0, 0.25, 1)`, under a valance that reads "Tonight's feature". Tap anywhere to open it early.
- Popcorn burst as it opens: build it behind one constant so we can switch it off after Lasse plays.

**Poster card.**
- Real TMDB poster, title in big red caps, the brass stamp with `matchPercent`, where to watch.
- Show only fields the match object already has. If runtime or genre isn't there, leave it out. Don't add a call for it in this pass.
- The colour strip from the poster is a nice-to-have. If pulling colours from the poster is fiddly, use a fixed house strip and flag it.

**Bridge pick.** There is always a match, so a bridge pick uses the same reveal and the same "It's a match" badge. Only the one-line "why it matched" changes (it sits between your tastes). Drop the separate gold "Your bridge pick" treatment and the rose versus gold glow split.

**Reduced motion.** With the phone's reduce-motion setting on, everything is an instant cut: `MotionConfig reducedMotion="user"` at the root, plus a `prefers-reduced-motion` block for the CSS animations (bulbs, sweep, flicker, scratches). The curtain shows open; the loader shows a still leader with the quote.

## 6. Tokens and type

| Token | Value | Job |
|---|---|---|
| Brass | `#D6A24A` | CTAs, selected state, stamps |
| Bulb | `#FFE9B0` | Bulbs and glow |
| House velvet | `#B8141E` | Curtain, ticket, poster titles on cream |
| Oxblood | `#6E0B12` | Curtain folds, pressed velvet |
| Signal red | `#E3312D` | Red text on black (contrast-safe) |
| Poster cream | `#F2E8D5` | Cards, posters, main text on black |
| Aisle | `#17100E` | Raised surfaces |
| Projection black | `#0E0A09` | The room |

- Fonts via `next/font/google`: Big Shoulders Display 900 (headlines, titles), Big Shoulders Inline Display (signage only: setup sign, valance, "It's a match"), Libre Franklin (UI and body), Courier Prime 700 (tickets, labels, credits). If a family isn't available under that name in `next/font`, use the nearest and flag it.
- Motion: entry `cubic-bezier(0.16, 1, 0.3, 1)` at 0.5 to 0.6 s, lists stagger 50 ms, press scales to 0.97.
- Muted service logos: `filter: grayscale(1) sepia(.3) brightness(.72) contrast(1.05)` until picked, then full colour. Selected tile: brass ring and a check, no borders on tiles.

## 7. Slices (push after each, so the live game updates as you go)

- **D1 Foundation:** `motion` installed, tokens, fonts, backdrop, shared primitives, reduced-motion setup.
- **D2 Setup, Round 1, PassPhone:** including the gate dedupe.
- **D3 Loaders and errors:** countdown, quote hero, shared error state, wired into Blending, Inferring and Tiebreak.
- **D4 Round 2:** drag to swipe, stamps, buttons.
- **D5 Round 3 and the match:** shortlist, curtain, poster card, bridge on the same reveal, runner-ups, play again.

## 8. How Lasse plays it

- Build on `main`, after E3 is committed. Every push to `main` deploys to the live game, so Lasse plays the real thing on his phone.
- Keep each push playable start to finish. Between slices some screens will be in the new look and some in the old; that's fine for now.
- If a push breaks the game, roll back in Vercel first, then fix.
- Keep design commits separate from E3 and E4 commits, so if something breaks it's clear which one did it.

## 9. Done when

- The full game plays on the live site, start to match, on a 375 px viewport and on Lasse's phone. Also a bridge game, and one forced error with retry.
- Reduce-motion on: no animation anywhere, nothing broken.
- "Not sure" is the same size and weight as the other two. Touch targets at least 44 px. Text contrast at least 4.5:1 (3:1 from 24 px).
- Setup fits without scrolling at 390 x 844 for the region with the most services.
- No em dashes and no emoji in any copy.
- `npm test` and lint green. `git diff main --stat` shows nothing under `lib/` or `app/api/`.
- One screenshot per screen next to its board, in the report.

## 10. Report back

Lead with two or three lines in plain English. Then: what you built, what you didn't, how to verify, anything you're unsure about. Don't self-certify: Otto reviews, Lasse plays and gives feedback, then Cato reviews.

## 11. Paste to Arthur (after Lasse has the E3 report)

> You are Arthur, the builder on Movie Match. Finish and commit E3 first if anything is open. Then commit the uncommitted design docs (`docs/design/PICTURE_PALACE_BRIEF.md`, `docs/design/CLAUDE_DESIGN_PROMPT.md`, `docs/design/picture-palace/`, `docs/decisions/2026-10-01_design-pass-2-build.md`, `docs/STATUS.md`) to `main` as one docs commit and push. Then read `CLAUDE.md`, then `docs/decisions/2026-10-01_design-pass-2-build.md` (this brief), then `docs/design/PICTURE_PALACE_BRIEF.md`, then the README in `docs/design/picture-palace/`. Build slices D1 to D5 on `main`, pushing after each so the live game updates; keep every push playable. Look and motion only: touch only `components/`, `app/globals.css`, `app/layout.tsx` and `package.json`; nothing in `lib/` or `app/api/`. When D5 is done, stop and report: two or three plain-English lines first, then what you built, what you didn't, how to verify, and anything you're unsure about.
