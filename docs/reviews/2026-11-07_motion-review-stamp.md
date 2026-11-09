# Motion review · Round 2 stamp and swipe card

**Date:** 7 Nov 2026 · **Reviewer:** Claude Code (read-only motion review, no code changed)
**Target:** `components/Round2Screen.tsx` (TopCard, Stamp, the waiting cards, the controls)
**Against:** D6 brief §1 (`docs/decisions/2026-10-02_design-pass-2-D6-polish.md`) and its board `docs/design/picture-palace/D6Swipe.dc.html`

**Method and limits.** Read the code, the brief and the board. Curve timings are computed from the cubic-bezier definitions; the drag spring is simulated. The stamp was measured in the D6Swipe board in a desktop browser. There is **no device recording** behind this review: anything marked "needs a device recording" is a hypothesis from the code until it is profiled on a mid-range Android phone over remote debugging. Card sizes used: 350 × 525 px on a 390 px wide phone, 300 × 450 px on an iPhone SE class phone (from `GameScreen.tsx:24-25` and `useCardSize`, `Round2Screen.tsx:399-414`).

**One correction to the question.** Each player swipes up to **8** cards, not about 15 (`selectSwipeSamples(pool, perPlayer = 8)`, `lib/blendTypes.ts:52`). That makes 16 a game.

## What animates on this screen

| Element | Driver | Properties | Plays during |
| --- | --- | --- | --- |
| Top card drag | Motion values x, y, rotate, written on the main thread each pointer move | transform | finger down |
| Stamps ×3 | `useTransform` of x and y | opacity, scale | drag and flight |
| Top card exit | Motion exit variant, 560 ms tween, entry curve | transform; opacity on down | the decision frame (React commit and mount) |
| Incoming top card | Motion `initial` to `animate`, 560 ms | y, scale, **filter** | same frame |
| Waiting cards ×2 | CSS transition, 560 ms | transform, **filter** | same frame |
| Control discs ×2 | static | **backdrop-filter** (blur 12 px, saturate), re-sampled whenever anything behind them moves | every frame something moves |
| Genre pill | static | **backdrop-filter** (blur 8 px), inside the moving card | every frame the card moves |
| Card shadow | static | box-shadow 0 30px 60px, on an element moved from JS | drag and flight |
| Snap-back | Motion `animate()`, spring 500 / 34 | transform | release short of the threshold |
| Control press | CSS, 180 ms | transform | tap |

## Findings, most important first

### 1. On a tap the stamp is a side effect of the flight, so it never lands (root cause)

**Problem.** The stamps have no timeline of their own. Their opacity is the card's distance divided by the threshold (`Round2Screen.tsx:257-261`), and their scale is derived from that opacity (`:340`). A tap calls `decide()` (`:194-202` → `:106-122`), which advances the index, so AnimatePresence starts the exit at once (`:297-303`). Left and right: the card goes to 1.3 × its width on the 560 ms entry curve (`:263`, `:301`). The stamp is full once x passes 0.35 × width, which is 27% of the travel. On that curve that happens **27 ms after the tap**, under two frames, and by then the card has already moved about 80 px in the first frame and 150 px by the second. The stamp pops to full on a card that's already leaving fast. It never sits on a still card. That's the "never lands" Lasse felt.

"Not sure" is worse. The down exit fades the card's opacity on the same curve as it moves (`:300`). The stamp only reaches full at 61% of the drop (77 ms in), when the card is at 0.39 opacity. So on a tap the Not sure stamp **never shows above about 0.41 effective opacity** (its peak, at 60 ms). This vibe and Not it show at full. The neutral choice gets weaker feedback than the other two, which goes against the CLAUDE.md invariant that Not sure "stays visually equal".

**Recommendation.** Give the stamp its own value, driven by the decision rather than the distance: stamp opacity = max(drag value, decision value). The drag mapping (`:257-261`) stays for the finger; the decision value runs the tap sequence in finding 4. All three directions share the stamp timing and the exit duration.

**vs D6:** agrees with the diagnosis. **Refines** it: adds the Not sure inequality, and that the fix needs a separate stamp value, not a retimed exit.
**Verified:** from code and computed timings.

### 2. The flight uses the entry curve: the motion is spent in the first frames, the tail is invisible, and it locks input

**Problem.** The flight is 560 ms on the entry curve, `cubic-bezier(0.16, 1, 0.3, 1)` (`:263`, `palace.tsx:47`). An entry curve starts at top speed and spends the rest of its time slowing down. Half the travel happens in the first 57 ms (43 ms at D6's 420 ms). On a 390 px phone the card has cleared the screen by about 235 ms (176 ms at 420). The remaining ~325 ms (~245 ms at 420) moves it through empty space off-screen. Input only reopens when the exit completes (`onExitComplete`, `:176-179`; guard `:110`), so the player's next tap is dropped for that whole invisible tail.

**Frame drops.** The fly's first frames are also its busiest. `decide()` sets five pieces of state (`:113-120`). In the same commit React mounts a new TopCard with three Stamps and their transforms (`:181-188`), re-keys the waiting cards (`:159-172`) and starts their transitions. Motion writes x, y and rotate per frame on the main thread, so the fly's first frame gets whatever time is left after that commit. On this curve a dropped first frame is a 150 to 190 px jump, the biggest jump the curve can produce.

**Recommendation.**
- Tap fly, all three directions: **280 ms, `cubic-bezier(0.4, 0, 1, 1)`** (accelerate). It starts gently (about 4 px in the first frame, 25 px by 50 ms), leaves the screen at full speed (clear at about 246 ms) and ends just after, so there's no invisible tail. A dropped first frame costs a few pixels, not 150.
- Down (Not sure): the same 280 ms and curve for y, scale and opacity, so it finishes at the same moment as the other two.
- Drag fly: a spring (finding 7).
- Keep the entry curve for entries: the incoming card's step-up (finding 11).

**vs D6:** **contradicts.** D6 keeps "420 ms, the entry curve" for the fly.
**Verified:** timings computed. The dropped frame on the commit needs a device recording.

### 3. Reduced motion: a tap shows no stamp today, D6 as written keeps it that way, and adding a hold would reopen Cato's double-tap finding

**Problem.**
- With reduce-motion on, the exit is instant today (`:263`) and there's no entry (`:294`). The stamp's opacity comes from x, which jumps to 1.3 × width in one frame, and the card is removed in that same frame. So a tap gives **no stamp at all**, just the next poster. Only Not sure gets the text line (`:209-212`). Drag is fine: the stamp follows the finger.
- What works today: the CSS reduced-motion block cuts every transition, including the waiting cards' 560 ms shift (`globals.css:454-462`). `MotionConfig reducedMotion="user"` (`MotionRoot.tsx:9`) only drops Motion's transform animations, but TopCard also checks `useReducedMotion()` itself (`:247`, `:263`). The imperative snap-back, which MotionConfig doesn't reach, is handled by hand (`:289`).
- D6 says "stamps appear instantly, no thud, no fly" (brief line 48). Taken literally, the stamp appears and the card is cut in the same frame, so it's still never seen. It needs a hold.
- The 300 ms floor (`MIN_ON_SCREEN_MS`, `:34`) is timed from the tap (`decidedAtRef`, `:110-112`). That works today only because the reduced-motion exit is instant, so "300 ms after the tap" is the same as "300 ms with the next card on screen" (comment at `:30-33`; Arthur's note at `HANDOFF.md:83`). Add a 300 ms stamp hold and the next card has been on screen for about 0 ms when taps start counting again. That is the "double tap records an unseen film" Major from Cato 2.0, which F1 fixed.

**Recommendation.**
- Reduce-motion tap: the stamp appears at full (opacity 1, scale 1, no slam) and holds **300 ms**. Then the outgoing card **fades out over 150 ms, linear**, over the next card, which is already in place. A fade isn't movement, so it belongs in reduced motion. No thud, no x or y, no step-up.
- Reduce-motion drag: the card still follows the finger, since the player is moving it. On release past the threshold the stamp is already full, so the card fades out in 150 ms with no hold. Snap-back stays instant.
- The same hold for all three choices.
- Whenever there's a hold before the card leaves, time the floor from when the next card is revealed (`onExitComplete`), not from the tap. In full motion the flight already covers it; in reduce-motion, start the 300 ms in `onExitComplete`. Keep `tests/round2-decisions.test.tsx:154` passing and add a case for a double tap during the reduce-motion hold.

**vs D6:** **refines** (the hold and the fade are missing) and flags a regression risk against F1 that D6 doesn't mention. This should go past Cato.
**Verified:** from code.

### 4. D6's order is right, but the timing and curves within it aren't

**Verdict on the sequence.** Stamp, thud, short hold, fly is the right order for a tap. It turns a button press into a physical act and gives the player a beat to read the result. Keep it.

**Problems** (brief §1; board `D6Swipe.dc.html:79-85` and `:134-141`):
- **The thud starts at t = 0**, together with the stamp: the board adds the `thud` class in the same state change as the stamp. On the entry curve the card is 94% of the way into its dip by 30 ms, but the stamp first reaches full size at 66 ms. The card reacts before it's hit, so the thud reads as a wobble, not an impact.
- **The overshoot stacks with the thud.** `cubic-bezier(0.34, 1.56, 0.64, 1)` takes the stamp from 1.6 down to 0.941 at 103 ms before it settles at 1. The stamp is a child of the card (`:317-325` inside `:266`), so the card's 0.965 multiplies in: about 0.91 combined at 100 ms. Squash, rebound, settle reads as cartoonish, and over 16 cards a game the bounce gets tiring. A rubber stamp doesn't bounce. It hits and stops.
- **1.6 is too big.** "This vibe" measures about 195 × 62 px, about 204 px wide at the -12° tilt. At 1.6 that's about 326 px, so on a 300 px card (iPhone SE class) the card's `overflow-hidden` (`:267`) clips it for the first frames.
- **Two scales for one stamp.** The drag stamp scales 1.5 to 1 (`:340`); D6's tap stamp scales 1.6 to 1.

**Recommendation: tap timeline** (t = the tap):

| t | What happens | Values |
| --- | --- | --- |
| 0 | Stamp opacity | 0 to 1 in **50 ms, linear**. It's visible at once: feedback within 100 ms. |
| 0 to 120 ms | Stamp scale | **1.4 to 1 in 120 ms, `cubic-bezier(0.32, 0, 0.67, 0)`** (ease-in: it speeds up into the card and stops dead). No overshoot. |
| 120 ms (impact) | Card thud | scale keyframes **[1, 0.965, 1], times [0, 0.3, 1], 200 ms**; `easeOut` into the dip (60 ms), entry curve back out (140 ms). |
| 240 ms | Fly starts | finding 2. The thud is at 0.998 by then; scale and x are separate values, so they overlap cleanly. |
| about 520 ms | Exit completes | input reopens. |

Why ease-in here when the house rule is ease-out: the response the player needs, the stamp appearing, is instant through opacity. The scale is a physical impact, and impacts speed up. 120 ms in the air is too short to read as a delay.

**Springs:** not for the stamp or the thud. Both are short, fixed and can't be interrupted, and the next beat is scheduled from their end. A tween gives an exact impact time; a spring's settle time doesn't.

**Fallback if Lasse prefers the bounce on his phone:** keep D6's curve, start the thud at 66 ms (first contact), and reduce it to 0.98 so the two don't stack.

**vs D6:** **refines** the order (keep it). **Contradicts** the overshoot curve and the 1.6. Pins down when the thud starts, which the brief leaves open and the board sets to 0.
**Verified:** timings computed, stamp measured in the board. The feel needs Lasse's phone, which is the brief's own done-when.

### 5. "About 0.7 s per card" makes input lock longer than it is today

**Problem.** Today input is locked for 560 ms per card, the length of the exit. D6 raises that to 720 ms (300 + 420), 29% longer, in the one area where the complaint is about feel. The total time isn't the issue: 8 cards × 0.72 s is about 6 s per player, and players spend most of a turn reading posters. The lock is. On obvious cards a player taps roughly every 0.5 s, and every tap inside the lock is dropped silently while the button still visibly presses (`:371`).

**Recommendation.** **About 520 ms from tap to input** on the finding 4 timeline. The stamp is visible from the first frame, sits about 120 ms on a still card, then rides the card out for about 250 ms. **About 250 ms on a drag** (finding 7). That gives D6's beat at today's speed.

**vs D6:** **contradicts** "about 0.7 s".
**Verified:** computed.

### 6. Interruption: what a second tap or touch does mid-sequence

D6 only covers taps during the flight. Recommended behavior for each moment:

- **Second tap during the stamp, thud or hold (0 to 240 ms):** drop it. It's a double tap, and the stamp landing shows the first tap counted. No fast-forward: it would save at most 120 ms and add a second path through the sequence.
- **Tap during the flight (240 to 520 ms):** drop it (Cato F1, D6 §1 bullet 2). Finding 5 keeps this window short.
- **Touch on the deciding card:** locked from the tap. Today `!present` already sets pointer-events to none (`:268`). Keep that by running the sequence as the card's exit.
- **Grabbing the incoming card during the flight:** allowed. Released after input reopens, it counts. Released before, it springs back on the existing spring. Rare once the lock is about 0.5 s.
- **Re-grabbing during a snap-back:** already right. The snap-back is a spring on the same x and y (`:289-291`), so the drag takes over from wherever the card is, at its current speed. Keep it.

**How to build it without touching the F1 guard.** Leave `decide()` as it is: record and advance at the tap. Run stamp, thud, hold and fly as the leaving card's exit, either imperatively through `usePresence()` (await each step, then `safeToRemove()`) or as per-value exit transitions with delays. Input still reopens on `onExitComplete` (`:176-179`), and the decision is still recorded once, synchronously. As a bonus, the React commit lands at t = 0, when only the stamp's opacity is moving, so a dropped frame there doesn't show. **Don't** run the hold before `decide()`: that opens a 240 ms window where the card is decided but the guard isn't set.

**vs D6:** **refines.** D6 says nothing about interruption beyond the flight.
**Verified:** from code.

### 7. Drag release: use a spring that keeps the finger's speed

**Problem.** On release the exit is a fixed tween (`:263`, `:301`). A slow, deliberate drag is yanked away at the curve's top speed, and a hard flick is slowed down to match it. The card stops behaving like a physical card at exactly the moment of release.

**Recommendation.**
- Left and right: x on a **spring, stiffness 300, damping 35** (damping ratio about 1.0, no bounce), **restDelta 40, restSpeed 400**, to the off-screen target in finding 8. In the simulation, releasing at 0.36 × width puts the card off-screen in 139 to 157 ms and finishes the exit in 235 to 252 ms, depending on release speed. The large restDelta ends the animation once the card is off-screen instead of waiting out the tail.
- Pass **`velocity: info.velocity.x`** (`.y` for down) into the exit explicitly. Motion normally reuses the value's own velocity, but that reads 0 once about 30 ms pass without an update, and the exit only starts after React commits.
- Down: y on the same spring with velocity, scale to 0.86 on the same spring, opacity **250 ms, `cubic-bezier(0.4, 0, 1, 1)`**.
- Stamp on a flick decided short of the threshold (`:280-283` allow that): ease the decision value to 1 in **80 ms, easeOut**, not in one frame. Past the threshold it's already full (`:257`), so there's nothing to do.
- No thud and no hold on a drag: agree with D6. The card is already moving, and a thud would fight it.
- Stamp scale for the finger: **1.4 to 1** (was 1.5, `:340`), to match the tap.

**vs D6:** agrees (no hold). **Refines** it: spring, velocity, 80 ms snap, one scale.
**Verified:** spring simulated; the feel needs the phone.

### 8. The fly target doesn't always clear the screen, and nothing clips sideways overflow

**Problem.** The target is 1.3 × the card's width (`:301`), measured from the card, not the screen. With the tilt of 12° per card width (`:29`, `:255`), a 390 px phone ends the flight with only 21 px to spare. On an iPhone SE class screen (300 px card) the trailing corner is **still 2 px on screen when the card unmounts**; on a tablet or desktop it's 147 px. That corner disappears in a single frame. Also, nothing clips horizontal overflow (`GameScreen.tsx:24-25`; no `overflow` rule in `globals.css`). A card moved past the edge widens the page's scrollable area while it flies, which on a phone can flash a sideways scroll indicator or let the page shift.

**Recommendation.** Target x = **`window.innerWidth / 2 + Math.hypot(w, h) / 2 + 24`** px. That clears the screen at any tilt; it's about 534 px on a 390 px phone. Add **`overflow-x: clip`** to `main` in `GameScreen`. Use clip rather than hidden so it doesn't create a scroll container.

**vs D6:** new.
**Verified:** geometry from code. The overflow behavior needs a device check.

### 9. Performance: the brightness filter (D6 suspect 1). Confirmed, plus a third filter D6 misses

**Problem.** Every decision animates three full-card filters at once: the two waiting cards' CSS filter transition (`:163`, `:167`) and the incoming top card's own entry from `brightness(0.6)` to 1 (`:294-295`). D6 names only the waiting cards. Whether the browser can run a filter animation off the main thread varies; even where it can, each filtered card needs its own offscreen surface, re-rendered every frame. The top card's filter also wraps the backdrop-blurred genre pill (`:308`): a filter around a backdrop filter, on a moving element. That's the most expensive combination on this screen.

**Recommendation.** Dim with an overlay. On an opaque poster, `brightness(b)` is exactly a black overlay at opacity 1 − b: **slot 1 = `#000` at 0.4, slot 2 = `#000` at 0.6, top card = 0**. The board's `#0E0A09` is close enough. Put the overlay inside each card's rounded, `overflow-hidden` box and transition only its `opacity`; the waiting cards then transition only `transform`. The incoming top card fades its overlay **from 0.4 to 0** instead of animating a filter.

**vs D6:** agrees. **Refines** it: the top card's entry filter (`:294-295`) has to go too, or the swap won't match.
**Verified:** the equivalence and the stacking are from code. The frame cost needs a device recording.

### 10. Performance: the backdrop blur (D6 suspect 2). Confirmed, and the blur barely shows

**Problem.** The Not it and Not sure discs use `backdrop-blur-[12px] backdrop-saturate-[1.2]` (`:374`). Every frame anything moves behind them (drag, flight, entry), the browser re-reads and blurs about 130 × 130 px per disc. And the area it blurs is mostly black already: the discs sit 18 to 80 px from the card's bottom, where the card's own gradient (`:306`) is about 90 to 96% opaque near-black. The blur buys almost nothing visible. The genre pill (`:308`, `backdrop-blur-[8px]`) is a second case: it rides inside the moving card, so it's recomposited on every drag and flight frame. There the blur does show, because the top of the poster has no gradient.

**Recommendation.** Discs: **solid `rgba(14,10,9,0.72)`**. Keep the 1 px inset ring and drop `backdrop-blur` and `backdrop-saturate`. Pill: **solid `rgba(14,10,9,0.72)`** as well. Cream 11 px mono stays clearly legible on that over a bright poster, but check 2 or 3 bright posters on the phone.

**vs D6:** agrees on the discs. Adds the pill.
**Verified:** from code. The cost needs a device recording.

### 11. The incoming card's step-up plays where nobody can see it

**Problem.** The new top card mounts at the moment of the decision and runs its 560 ms step-up (`:294-296`) underneath the departing card, which today hides most of it. With D6's hold before the fly, and the index still advancing at the tap (finding 6), the step-up would finish completely behind the still card. Separately, the waiting cards take 560 ms to shift up a slot (`:163`). Once input reopens sooner (about 250 ms on a drag), a card can be promoted to the top before its shift has finished. The new top card then starts from the final slot-1 pose and jumps the small remaining distance.

**Recommendation.** Run the incoming card's step-up (y 14 to 0, scale 0.95 to 1, overlay 0.4 to 0) at **400 ms on the entry curve, delayed to the fly start** (240 ms on a tap, 0 on a drag), so it's seen rising as the old card leaves. Waiting cards shift in **400 ms on the entry curve**. That curve is 99% there by 250 ms, so a mid-shift promotion doesn't show.

**vs D6:** new.
**Verified:** from code.

### 12. Performance: check the moving card has its own layer before adding anything

**Problem.** Motion writes the card's transform from the main thread (`:268`, through x, y and rotate). Browsers promote elements to their own layer automatically for CSS and WAAPI animations, not for style writes from JS. If the card isn't promoted, every drag frame repaints the poster, the gradient and the `0 30px 60px` shadow (`:267`). The board puts `will-change: transform` on every card (`D6Swipe.dc.html:73`).

**Recommendation.** On the phone, over remote debugging, turn on paint flashing and drag a card. If the card flashes, add `will-change: transform` to the `motion.article` **only**: not the waiting cards, the deck or the stamps. If it doesn't flash, leave it out.

**vs D6:** new.
**Verified:** needs a device recording. Don't add it blind.

### Keep as is

- Snap-back spring, stiffness 500, damping 34 (`:289`): damping ratio about 0.76, about 2.5% overshoot, settled in about 0.24 s. Right for a card that didn't make it.
- The stamp reaching full exactly at the decision threshold (`:25`, `:257`): a full stamp means "let go now and it counts". A good mapping.
- The tilt of 12° per card width, unclamped (`:29`, `:255`).
- The control press, 0.92 in 180 ms (`:371`).
- Transitions name their properties (`:163`); there's no `transition: all` in scope.
- No React state updates per frame: the drag runs on motion values only.

## Recommended changes to the D6 brief (for Otto)

**Replace the §1 "Fix" bullets with:**

- **Tap.** The decision is recorded and the next card committed at the tap, as today. The sequence then plays as the leaving card's exit:
  - Stamp: opacity 0 to 1 in 50 ms, linear; scale 1.4 to 1 in 120 ms, `cubic-bezier(0.32, 0, 0.67, 0)`. No overshoot.
  - Thud at impact (120 ms): scale 1 to 0.965 and back over 200 ms (60 ms down, ease-out; 140 ms back, the entry curve).
  - Fly at 240 ms: 280 ms, `cubic-bezier(0.4, 0, 1, 1)`, to half the window width plus half the card's diagonal plus 24 px. Down: y 0.38 × card height, scale 0.86, opacity 0, same duration and curve.
  - About 0.52 s from tap to the next card taking input (replaces "about 0.7 s").
- **Drag.** The stamp follows the finger (scale 1.4 to 1, full at the threshold). On a flick short of the threshold it eases to full in 80 ms. No thud, no hold. Fly: spring, stiffness 300, damping 35, restDelta 40, restSpeed 400, with the release velocity passed in. Down fades its opacity in 250 ms.
- **Next card.** Steps up as the old one leaves: 400 ms on the entry curve, starting with the fly. The waiting cards shift in 400 ms.
- **Dimming.** A black overlay's opacity (0.4 and 0.6; 0.4 to 0 on the step-up). No filter on any card, including the top card's entry.
- **Blur.** Solid `rgba(14,10,9,0.72)` on the control discs and the genre pill. No backdrop blur on this screen.
- **Edges.** `overflow-x: clip` on the game's `main`.
- **Interruption.** Taps during the stamp, hold or flight are dropped (one decision per visible card, Cato F1). The deciding card can't be grabbed. The next card can be grabbed during the flight; if it's released before input reopens, it springs back.
- **will-change.** Only on the top card, and only if paint flashing on the phone shows it repainting during a drag.

**Replace the §5 reduce-motion bullet with:**

- **Reduce-motion.** The stamp appears at full (no slam) and holds 300 ms, then the card fades out in 150 ms over the next one. No thud, no fly, no step-up. Drag still follows the finger; on release the card fades out in 150 ms. The 300 ms floor counts from when the next card is revealed, not from the tap. New regression test: a double tap during the reduce-motion hold records one decision.

**Add to §5:**

- On a tap, Not sure's stamp shows at the same strength and for the same time as the other two (today it peaks at about 40%).
- Cato re-checks the decision guard together with D6, because the reduce-motion hold changes what the 300 ms floor is timed from.
