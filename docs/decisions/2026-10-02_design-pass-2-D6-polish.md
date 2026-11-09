# Design pass 2 · D6 polish round

**Date:** 2 Oct 2026, revised 7 Nov after four skill reviews · **Owner:** Otto · **Builder:** Arthur · **Review:** Otto, Lasse on his phone, then Cato (together with W1)
**Status:** Approved by Lasse 7 Nov (all four decisions in §8). Runs after W1 is Otto-accepted, via `docs/HANDOFF.md`.

**Sources.** Lasse's phone feedback (2 Oct: "overall good"; the stamp isn't smooth, the quote sits too low, the screen after swiping is flat). Boards: `docs/design/picture-palace/D6Swipe.dc.html`, `D6Wrap.dc.html`, `D6Load.dc.html` (layout and look; where a value below differs, this brief wins). Skill reviews of 7 Nov and Otto's triage: `docs/reviews/2026-11-07_otto-triage-skill-reviews.md`. Report sections are cited for code-level detail only.

**Scope.** Design brief (CLAUDE.md rule 10): `components/`, `app/globals.css`, `app/layout.tsx`. Nothing in `lib/` or `app/api/`. What gets recorded per swipe doesn't change, except the release rule in §1.4 (approved).

## 1. Round 2: the swipe and the stamp

**Why it isn't smooth.** The stamp's visibility is tied to how far the card has moved, so on a tap it pops on a card that's already leaving and never lands. On a tap, "Not sure"'s stamp only reaches about 40% (it fades with the card). The flight spends its last ~300 ms off-screen while input stays locked. Three filters and two backdrop blurs repaint every frame something moves.

**1.1 Tap** (motion review findings 1, 2, 4 to 6). Record the decision and advance at the tap, exactly as today (the F1 guard stays untouched). Then play the sequence as the leaving card's exit:

| t from tap | What | Values |
|---|---|---|
| 0 | Stamp appears | opacity 0 → 1 in 50 ms, linear. The stamp has its own value: opacity = max(drag value, decision value) |
| 0 to 120 ms | Stamp lands | scale 1.4 → 1 in 120 ms, `cubic-bezier(0.32, 0, 0.67, 0)`. No overshoot |
| 120 ms | Card thud | scale [1, 0.965, 1], times [0, 0.3, 1], 200 ms (ease-out into the dip, entry curve back) |
| 240 ms | Card flies | 280 ms, `cubic-bezier(0.4, 0, 1, 1)`, to x = ±(window width / 2 + card diagonal / 2 + 24 px) |
| ~520 ms | Next card takes input | was ~560 ms today, ~720 ms in the old draft |

Same stamp, timing and exit for all three choices.

**1.2 Drag** (motion 7; physics 1 to 3).
- The stamp follows the finger: scale 1.4 → 1, full at the threshold. A decision short of the threshold (a flick) eases it to full in 80 ms, ease-out. No thud, no hold.
- The drag can start anywhere on the card except the three discs: the controls row is `pointer-events-none`, each button `pointer-events-auto`.
- Exit: each axis on a spring, stiffness 250, damping 32, mass 1, starting at the release velocity (`info.velocity`, passed in explicitly). Leading axis to the off-screen target in 1.1; trailing axis to its position + velocity × 0.15 s. Start the springs in `onDragEnd` so there's no two-frame stall (physics item 2, implementation notes).
- Spring-back (no decision): today's springs (500 / 34) with the release velocity added.

**1.3 Not sure leaves like the other two** (physics 6; approved, §8). Down is thrown off the bottom: y → 1.5 × card height, full opacity, no shrink, the same spring or tap curve as left and right.

**1.4 Release rule** (physics 5; approved, §8). A release decides when the projected rest point (position + velocity × 0.15 s) is past the threshold, with at least 12 px of real travel in that direction. Same rule for all three directions. Add tests for the table in physics item 5; the F1 tests must still pass.

**1.5 The cards behind** (motion 9, 11). Dim with a black overlay's opacity, never a filter: second card 0.4, third 0.6, top card 0. The new top card steps up as the old one leaves (y 14 → 0, scale 0.95 → 1, overlay 0.4 → 0, 400 ms, entry curve, starting with the fly). Waiting cards shift in 400 ms.

**1.6 Cheaper frames** (motion 10, 12). Control discs and the genre tag: solid `rgba(14,10,9,0.72)`, no backdrop blur. `will-change: transform` on the top card only, and only if paint flashing on the phone shows it repainting.

**1.7 Interruption** (motion 6). Taps during the stamp, thud or flight are dropped (one decision per visible card). The deciding card can't be grabbed. The next card can be grabbed during the flight; released before input reopens, it springs back.

**1.8 Reduce-motion** (motion 3). Tap: the stamp appears at full and holds 300 ms, then the card fades out in 150 ms, linear, over the next card. No thud, no fly, no step-up. Drag: the card follows the finger; on release past the threshold it fades out in 150 ms. **The 300 ms floor counts from when the next card is revealed, not from the tap.** New regression test: a double tap during the reduce-motion hold records one decision.

**1.9 Also on this screen.** A slightly stronger dark fade behind the card title. Accented titles keep their accents: add `pt-[0.16em] -mt-[0.16em]` to the clamped title (polish B5).

## 2. The loaders: quote moved up

Board D6Load: one centred stack, slightly above the middle: leader (124 px), status, the "Up next" line, a short brass rule, the quote centred with its source under it. The quote box has a fixed `min-h-[118px]`, top-aligned, so the stack never moves when the second quote arrives; the swap is 200 ms out, 400 ms in (polish B7). All three loaders.

## 3. The screen after swiping: "That's a wrap."

Board D6Wrap, with the polish critique's Part A changes:
- **Button:** "Lock my picks" for both players, the same velvet ticket button as Rounds 1 and 3 (Lasse, 7 Nov: one label for "my turn is done" in every round). The pass-the-phone gate that follows already says "Pass the phone", so the fan is gone before the phone moves and the partner never sees your likes.
- **The fan:** up to the last three "This vibe" films, newest front and centre. Posters 104 × 156, fan box 190 px tall. Uneven angles: 3 cards at (−72, 14, −9°), (72, 10, 7°), centre (0, 0, −2°) on top; 2 cards at (−34, 8, −6°) and (30, 0, 4°); 1 card at (0, 0, −2°). A film with no poster gets a cream card with its title in velvet caps.
- **Entrance:** the header and button don't move. The cards deal in from the right, 70 ms apart, 520 ms, entry curve (polish Part A "The entrance"). Kicker, headline, tally and line follow with `pp-enter` at 100, 150, 200 and 250 ms. The fan stamp ("This vibe", −12°) lands last, with **the deck's stamp values from 1.1** (1.4 → 1, 120 ms, ease-in, no overshoot), and the front card thuds.
- **Tally ticket:** Not it · Not sure · This vibe, in the order of the buttons; three equal cells.
- **No likes:** no fan and no empty space; the ticket deals in instead, tilted −3°; no red zero; one honest line above "Your picks stay hidden until the match.": "Nothing grabbed you. That still steers your shortlist." (at least one Not it) or "No strong calls. Your Round 1 moods lead from here." (all Not sure).
- **Reduce-motion:** everything at rest on the first frame.

## 4. Smaller fixes

- Setup: short display names so service tiles don't cut off ("Prime Video", "Paramount+").
- The ADMIT TWO ticket shows a focus ring (wrap it so the notch mask doesn't clip the outline); the Round 2 discs get a round ring (polish B6).
- Match card: no change. The whole poster stays; the Watch button can sit below the fold (Lasse, 2 Oct).

## 5. Homepage motion (branch `d6-homepage-motion`)

Merge the parked branch: service tiles fade in (opacity only, 300 ms, rows of two 50 ms apart); placeholders breathe while services load; the sign's bulbs switch on left to right on the first homepage visit per page load; the bulb chase animates opacity only; tile press in 160 ms. Check the ticket's grey-to-colour fade on the phone.

## 6. Mobile robustness (mobile-native audit; code in the report's sections)

- **No pull-to-refresh mid-game** (item 1): `overscroll-behavior: none` on `html, body`.
- **A double tap can't carry into the next screen** (item 2): `useArmed(450)` on the pass-the-phone gate, the Round 2 wrap button and Round 3's lock.
- **Clear of Safari's toolbar and the home indicator** (item 3): `viewportFit: "cover"`, the game's room at `min-height: 100svh` with safe-area padding.
- **No text selection, link previews or image menus on long-press** (item 5) on controls and the play screens; content stays selectable.
- **No sideways page slide** (item 6): `overflow-x: clip` on the room.
- **Text buttons answer a press** (item 7): `active:text-bulb`.
- **No double-tap zoom after a pinch** (item 8): `touch-action: manipulation` on `html`.
- **Dark browser parts** (item 9): `colorScheme: "dark"`, readable region-picker options.

## 7. How to build (skills, CLAUDE.md "Skills")

- `/animate` for the tap sequence (§1.1), the drag exit (§1.2) and the wrap's deal (§3). `/apple-design` for the drag physics (§1.2 to 1.4). Check the result with `/review-animations` before reporting. Build only what this brief says; list any extra suggestions under "not built".
- Slices, each pushed (it goes live): D6.1 Round 2 (§1) · D6.2 loaders (§2) · D6.3 the wrap (§3) · D6.4 smaller fixes and homepage motion (§4, §5) · D6.5 mobile robustness (§6).

## 8. Decisions (all approved by Lasse, 7 Nov)

1. Releases decide by where the throw is heading, §1.4: **yes**.
2. "Not sure" thrown off the bottom like the other two, §1.3: **yes**.
3. The wrap button reads **"Lock my picks"** (not "Lock my swipes"), and the two no-likes lines, §3: **yes**.
4. The deferred finishing details (polish B1 to B4, B8 to B12, B14, B15; physics 7, 9, 10) become a D7 "finish" brief after D6 (yes). **Decided, Lasse 7 Nov: all good fixes, D7 after D6.**

## 9. Done when

- Lasse plays it on his phone and the stamp and swipe feel right. Headless checks alone don't count here.
- On a tap, all three stamps show at the same strength for the same time.
- Reduce-motion: no movement anywhere; the stamp still shows; a double tap during the hold records one decision.
- Pull-to-refresh can't reload the game on Lasse's phone; a double tap on any "lock" button doesn't skip the next gate.
- `npm test`, lint, `tsc` and build green; nothing under `lib/` or `app/api/`. Report back through `docs/HANDOFF.md`.
- Cato reviews D6 together with W1, including the decision guard (the reduce-motion floor now counts from the reveal).
