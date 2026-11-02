# Design pass 2 · D6 polish round

**Date:** 2 Oct 2026 · **Owner:** Otto · **Builder:** Arthur · **Review:** Otto, Lasse on his phone, then Cato
**Status:** DRAFT until Lasse OKs the three D6 boards. Queued in `docs/HANDOFF.md` after the Cato triage of D1 to D5.

Source: Lasse played the live game on his phone (2 Oct): "Overall good", three things to fix. Boards: `docs/design/picture-palace/D6Swipe.dc.html` (tap through), `D6Wrap.dc.html`, `D6Load.dc.html`. Scope and rules as in `docs/decisions/2026-10-01_design-pass-2-build.md`: components and styles only, nothing in `lib/` or `app/api/`.

## 1. The stamp isn't smooth (Round 2)

**Why it feels off.** The stamp's visibility is tied to how far the card has moved. On a tap the card starts flying at once, so the stamp only fades in while the card is already leaving and never lands. On top of that, two effects are heavy on phones: the cards behind animate a brightness filter, and the control discs blur whatever moves behind them.

**Fix (board D6Swipe):**
- Tap: the stamp lands first. Scale 1.6 to 1 in 180 ms with a small overshoot (`cubic-bezier(0.34, 1.56, 0.64, 1)`), and the card gives a slight thud (scale 0.965 and back, 220 ms). Hold 120 ms, then the card flies (420 ms, the entry curve). About 0.7 s per card.
- One decision per visible card: a tap only counts once the next card is on top and visible (Cato's 2.0 finding 1, fixed in F1 before D6). The D6Swipe board's demo accepts a tap during the flight; that part is superseded.
- Drag: the stamp still follows the drag. On release past the threshold it snaps to full, then the card flies with no extra hold.
- Animate only `transform` and `opacity`. Dim the waiting cards with a black overlay's opacity instead of a brightness filter. Give the control discs a solid background (`rgba(14,10,9,0.72)`) instead of a backdrop blur.
- Same three decisions as today, nothing else about recording changes.

## 2. The quote sits too low (all three loaders)

**Fix (board D6Load):** one centred stack instead of pinning the quote to the bottom: leader (124 px), status, the "Up next" line, a short brass rule, then the quote centred with its source under it. The stack sits slightly above the middle of the screen, so it stays clear of the phone's browser bar.

## 3. The screen after swiping is flat (Round 2 end)

**Fix (board D6Wrap):** replace "That's the read." with "That's a wrap.":
- The films the player stamped "This vibe" fanned out as small posters (up to the last three), with a small "This vibe" stamp across them. No likes: no fan.
- The headline, then a cream tally ticket: This vibe · Not it · Not sure.
- One line: "Your picks stay hidden until the match."
- Brass button "Pass the phone" for both players (Player 2 hands back to Player 1 next).

## 4. Smaller fixes from Otto's review

- Setup: short display names so service tiles don't cut off ("Prime Video", "Paramount+").
- Round 2 cards: a slightly stronger dark fade behind the title, so a poster's own title art doesn't compete with ours.
- Match card: no change. The whole poster stays and the Watch button can sit below the fold (Lasse, 2 Oct).

## 4b. Homepage motion (Arthur's side review, 2 Nov; branch `d6-homepage-motion`)

- Service tiles fade in when they load: opacity only, 300 ms, in rows of two 50 ms apart. No rise: the loading placeholders already hold their place.
- The grey placeholders breathe gently while services load (opacity 1 to 0.55 and back, 1.4 s), starting at full opacity so a fast load never flashes.
- The homepage sign's bulbs switch on left to right (about 0.66 s), then chase. First homepage visit per page load only, not on Play again.
- Existing motion: the bulb chase animates opacity only (no glow repaint on every frame, on every screen with bulbs); the tile press responds in 160 ms.
- Check on Lasse's phone: the power-on speed, the breathe depth, and whether the ticket's grey-to-colour fade stutters (if it does, dim with an overlay instead of a filter).

## 5. Done when

- Lasse plays it on his phone and the stamp feels right. Headless checks alone don't count for this one.
- Reduce-motion: stamps appear instantly, no thud, no fly.
- `npm test`, lint, `tsc` and build green; nothing changed under `lib/` or `app/api/`.
- Report back through `docs/HANDOFF.md` as usual.
