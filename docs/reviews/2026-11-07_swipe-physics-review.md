# Arthur · Swipe physics review (Round 2 drag)

*7 Nov 2026 · Read-only side review, no code changed · Lens: Apple's fluid-interface guidance (Designing Fluid Interfaces; Designing Audio-Haptic Experiences), translated to Motion 13.5 · Target: `components/Round2Screen.tsx` on `main` at `7697e0e`*

**Plain-English:** The card already tracks the finger properly and springs back with good values. What lets it down is the moment the finger lifts: the spring-back starts from a standstill, the fly-off always launches at the same speed whatever the throw was, and "Not sure" leaves slower and softer than the other two. There is also a dead zone: the strip that holds the three buttons blocks drags across the bottom of the card, which is where a thumb lands. Four fixes slot into D6 without touching what a swipe records. Six more need a brief; one of them (how "Not sure" leaves) is Lasse's call.

## Ground rules for this review

- **Equal choices.** Every recommendation uses the same numbers for right, left and down. None makes one direction feel more rewarding. Where the current code is unequal, I say so.
- **"Fits D6"** means it can be folded into D6 §1 (still a draft, not built) without changing what a swipe records and without adding behaviour D6 doesn't describe. **"New, needs a brief"** means it adds behaviour or changes which releases record a decision. Otto and Lasse decide.
- **Numbers assume a 390 px phone:** the screen is `max-w-sm` with 20 px gutters (`GameScreen.tsx:24-25`), so the card is width-bound at w ≈ 350 px, h ≈ 525 px, and the threshold t = 0.35w ≈ 122 px.
- **Spring maths:** damping ratio = damping / (2·√(stiffness·mass)); response (Apple's term) = 2π / √(stiffness/mass).
- **What's verified:** claims about Motion's behaviour come from reading its source in `node_modules` (motion 13.5.0). Nothing here was measured on a device. D6's done-when still applies: Lasse plays it on his phone.

## The nine questions, answered

| Question | Today | Verdict |
|---|---|---|
| 1:1 tracking | Motion drag writes the `x`/`y` motion values every frame, with no React render per frame; the grab offset is kept; `touch-none` stops browser panning (`:267`); window-level listeners keep tracking off the card | Sound. Three leaks: drags can't start across much of the bottom strip (item 1); paint-heavy effects share the drag's frames in each card's first 0.56 s (item 4); a low thumb slides on the poster as it tilts (item 9) |
| Tilt | 12° per card width, linear, unclamped (`:29`, `:255`): 4.2° at the threshold | Restrained, keep the amount. The pivot is the issue (item 9) |
| Commit threshold | Distance past 0.35w (`:25`) **or** release speed over 600 px/s on the dominant axis (`:27`, `:279-283`), tested independently | Two cliffs instead of one rule (item 5) |
| Release below threshold | Separate x and y springs, stiffness 500, damping 34, mass 1 (`:289-291`): ratio 0.76, response 0.28 s | Right values (Apple's momentum spring is about 0.8 / 0.3). But it starts at zero velocity (item 3) |
| Fly-off | Fixed 0.56 s tween on the entry curve (`:263`, `:297-302`) whatever the release | Doesn't carry velocity or direction; down can reverse (item 2) |
| Interruption | Grabbing mid-spring stops the spring at its on-screen value, no jump (Motion `VisualElementDragControls.mjs:45`). Grabbing mid-entry works too. A leaving card can't be grabbed (`:268`) | Keep all three. Catching a flying card would be an undo, because its decision is already recorded |
| Down resistance | None | Correct, and keep it that way: resistance would make "Not sure" cost more effort than the other two. Only upward, which has no outcome, could resist (item 10) |
| Next card | Static during the drag; on a decision a fixed 0.56 s rise (`:159-172`, `:294-296`). The hand-off values match exactly (14 px / 0.95 / 0.6) | Clean but disconnected from the gesture (items 4, 7) |
| Haptics | None | One equal tick at the threshold, with a visual twin for iOS (item 8) |

## Already right (keep)

- Separate x and y springs on the spring-back (`:290-291`): Apple's rule for 2D motion.
- Spring-back stiffness 500 / damping 34 / mass 1. Don't make it bouncier: with a damping ratio below about 0.75 the card overshoots past centre and starts fading in the opposite stamp.
- The same distance threshold in px for all three directions (down uses 0.35 × width too, not height), so each choice costs the same thumb travel. Any new rule must stay this symmetric.
- A decided card is untouchable (`:268`, `:274`) and the F1 guard (`:106-122`) is unchanged by everything below.
- Reduce-motion: instant flights with the 300 ms floor still guarding (`:34`, `:263`).

## Shared definitions (used by several items)

```ts
const t = width * THRESHOLD;   // ≈ 122 px, unchanged
// Drag progress toward a decision, the same formula for all three directions:
const p = Math.min(Math.max(Math.abs(x), Math.max(y, 0)) / t, 1);
// Apple's project() with decelerationRate ≈ 0.9934, i.e. where the throw would come to rest:
const PROJECTION_S = 0.15;     // projected = position + velocity * 0.15
```

## Recommendations

### Fold into D6

#### 1. Let a drag start anywhere on the card except the three discs · **fits D6**

- **Current:** the control strip (`:193`, `absolute inset-x-0 bottom-[18px] z-10`) spans the card's full width and about 84 px of height, and it sits above the card (z-10 over the card's z-3, `:268`). It catches every press that isn't on a button: the two 51 px side margins and the two 28 px gaps between discs. That is the bottom-corner zone where a one-handed thumb naturally lands, so the card sometimes "won't move".
- **Proposed:** `pointer-events-none` on the strip, `pointer-events-auto` on each `Control` button (`:365-369`). The discs keep their 62 px targets; everything else on the card drags.
- **Values:** none (hit-testing only).
- **Equality:** the three buttons are untouched and identical.

#### 2. The fly-off carries the release velocity and direction · **fits D6**

- **Current:** every exit is a 0.56 s tween on the entry curve (`:263`; curve `palace.tsx:47`). The curve's opening slope is 1/0.16 = 6.25 times its average speed, so a side exit from 135 px to ±1.3w (`:301`) starts at about 3,500 px/s whatever the finger was doing. A slow, deliberate release at 300 px/s visibly lurches; a fast one at 2,000 px/s is still jerked to a new speed. Side exits animate x only, so a diagonal throw stops moving vertically the instant the finger lifts. Down (`:300`) goes to a fixed y = 0.38h ≈ 200 px, so a down drag released past 200 px moves back up while it fades: against the throw.
- **Proposed:** on a drag decision, each axis gets its own spring that starts at the release velocity, from the release point, and never heads back. The leading axis goes off-screen; the other axis keeps the throw's heading. Taps keep D6's spec (stamp lands, thud, hold, 420 ms entry curve): there is no release velocity to carry.
- **Values:**

  ```ts
  // ≈ Apple's reposition spring: damping ratio 1.0, response 0.4 s
  const exitSpring = { type: "spring", stiffness: 250, damping: 32, mass: 1 } as const;
  const v = info.velocity; // Motion's 100 ms-averaged release velocity, px/s

  // Right / left: leading axis x, trailing axis y
  x → ±1.5 * w                    { ...exitSpring, velocity: v.x, restDelta: 20, restSpeed: 400 }
  y → py + v.y * PROJECTION_S     { ...exitSpring, velocity: v.y, restDelta: 2,  restSpeed: 50 }

  // Down, keeping today's look until item 6 is decided: leading axis y
  y → Math.max(0.38 * h, py + v.y * PROJECTION_S)   { ...exitSpring, velocity: v.y }
  x → px + v.x * PROJECTION_S                       { ...exitSpring, velocity: v.x, restDelta: 2, restSpeed: 50 }
  scale → 0.86, opacity → 0                         { ...exitSpring }
  ```

  On a 390 px phone a side exit clears the screen in about 0.17 s and completes in about 0.3 s (today 0.56 s); with `restDelta: 20` the card's nearest edge is still about 65 px past the screen edge when Motion snaps it to the target. The next decision unlocks at whichever is later, exit complete (`:177`) or the 300 ms floor (`:34`), so the floor becomes the real limit, as F1 intended. Fast players hit fewer swipes that silently spring back.
- **Implementation notes:** pass `info.velocity` through `onDecide` into `ExitTarget` (taps pass none and take the D6 tween). Motion calls `onDragEnd` one frame after release (`VisualElementDragControls.mjs:169-172`) and the exit only starts after React re-renders, so the card stands still for about two frames before flying. To remove that stall, start the same springs on `x` and `y` inside `onDragEnd` as soon as `onDecide` returns true, and give the exit variant the same targets and spring with no `velocity`: Motion then re-targets from the live value and its live velocity (`motion-value.mjs:28`). Reduce-motion stays `duration: 0`.
- **Equality:** the same spring, projection and off-screen rule in all three directions. D6 §1 only says a drag decision "flies with no extra hold"; this defines that flight. Nothing about recording changes.

#### 3. The spring-back carries the release velocity · **fits D6**

- **Current:** `animate(x, 0, back)` and `animate(y, 0, back)` (`:289-291`) pass no velocity, so Motion falls back to the motion value's own velocity (`motion-value.mjs:28`). But on release, with `dragMomentum={false}`, Motion first runs a zero-velocity momentum step (`VisualElementDragControls.mjs:315`) that finishes at once and re-sets x and y where they already are (`inertia.mjs:17-30`). `onDragEnd` runs a frame later and reads a velocity of 0. Every spring-back therefore starts from rest: a card released while still moving outward stops dead, then returns.
- **Proposed:** keep the springs exactly, and hand them the release velocity.
- **Values:** `{ type: "spring", stiffness: 500, damping: 34, mass: 1, velocity: info.velocity.x }` for x, `.y` for y (ratio 0.76, response 0.28 s). A card released at 150 px still moving out at 1,500 px/s now travels about 10 px further before turning home, then overshoots centre by about 3 px (the opposite stamp stays under 3% opacity, invisible).
- **Equality:** identical in every direction.

#### 4. Nothing paint-heavy on or over a moving card · **fits D6** (extends D6 §1)

- **Current:** the top card enters animating `filter: brightness(0.6 → 1)` for 0.56 s (`:294-296`); the waiting cards transition `filter` (`:163`, `:167`); the control discs blur what moves behind them (`:374`); the genre chip carries its own `backdrop-blur-[8px]` on the card (`:308`). Filters and backdrop blurs re-render on every frame that something under or inside them moves. A player who grabs a card in its first 0.56 s shares every drag frame with a full-poster repaint and three blurs, which is where a mid-range phone drops frames.
- **Proposed:** D6 §1 already swaps the waiting cards' filter for a black overlay and gives the discs a solid background. Apply the same rule in the two places D6 misses: (a) the top card's entry dims with the same overlay, otherwise the hand-off from an overlay-dimmed waiting card to a filter-dimmed top card won't match; (b) the genre chip drops its blur. The poster under the chip moves with it, so the blur never shows anything new; it only costs a re-sample every frame.
- **Values:** overlay `absolute inset-0 bg-black pointer-events-none`, above the title and below the stamps (z-[5]); opacity 0.40 on the second card (equals brightness 0.6), 0.60 on the third (equals brightness 0.4); top card overlay 0.40 → 0 on the existing entry transition. Chip `bg-[rgba(14,10,9,0.72)]` with no backdrop blur (D6's disc value).
- **Equality:** not direction-specific.

### Needs a brief

#### 5. Decide by where the throw is heading, not by two separate cliffs · **new, needs a brief**

- **Current:** `:279-283` decides if the card is past t **or** the release is faster than 600 px/s on the dominant axis. The two tests don't know about each other, so outcomes jump: 110 px at 550 px/s springs back, while a 5 px twitch at 610 px/s decides. A card past t still decides when the player is pulling it back.
- **Proposed:** one rule (Apple's momentum projection): work out where the throw would come to rest and decide if that point is past t. Require 12 px of real travel in that direction so a twitch can't decide. When a release decides before the stamp was fully on, D6's "snaps to full at release" covers it.
- **Values:**

  ```ts
  const MIN_TRAVEL = 12; // px
  const ex = px + v.x * PROJECTION_S;
  const ey = py + v.y * PROJECTION_S;
  let dir: Dir | null = null;
  if (Math.abs(ex) >= Math.max(ey, 0)) {
    if (ex > t && px >= MIN_TRAVEL) dir = "right";
    else if (ex < -t && px <= -MIN_TRAVEL) dir = "left";
  } else if (ey > t && py >= MIN_TRAVEL) dir = "down";
  ```

  PROJECTION_S = 0.15 is tuned so a short flick needs about today's speed (about 730 px/s from 12 px, against today's 600) while the cliff goes away.

  | Release (t ≈ 122 px) | Today | Proposed |
  |---|---|---|
  | 12 px at 750 px/s (short flick) | decides | decides (12 + 112 = 124) |
  | 5 px at 900 px/s (twitch) | decides | springs back (under 12 px) |
  | 80 px at 300 px/s (slow, confident push) | springs back | decides (80 + 45 = 125) |
  | 110 px at 550 px/s | springs back | decides (110 + 82 = 192) |
  | 110 px, held still | springs back | springs back |
  | 135 px, pulling back at 250 px/s | decides | springs back (135 − 37 = 98) |

- **Equality:** the same t, PROJECTION_S and MIN_TRAVEL for all three; down stays measured in px, like the sides.
- **Why a brief:** it changes which releases record a decision, and D6 says "nothing else about recording changes". The F1 tests drag 100 px (`tests/round2-decisions.test.tsx:79-94`), so they still pass; the brief should add cases for the table above.

#### 6. The same exit for all three directions · **new, needs a brief** (Lasse's call)

- **Current:** right and left are thrown: full opacity, about 320 px to ±1.3w, starting at about 3,500 px/s (`:301`). Down shrinks to 0.86 and fades out over about 65 px, starting at about 725 px/s (`:300`). "Not sure" leaves slower, shorter and dissolving, so it reads as a softer, lesser action. That is a visual weighting, whichever way it nudges players, and it is the one place the gesture breaks the "Not sure looks equal" invariant.
- **Proposed:** down is thrown like the other two: off the bottom edge, full opacity, no scale change, the same spring as item 2. Taps do the same on D6's tween.
- **Values:** y → 1.5h (≈ 790 px, clears the bottom with margin) with `{ ...exitSpring, velocity: v.y, restDelta: 20, restSpeed: 400 }`; x → px + v.x × 0.15 with `{ ...exitSpring, velocity: v.x, restDelta: 2, restSpeed: 50 }`. The card passes under the discs (z-10 over its in-flight z-4).
- **Why a brief:** it changes the prototype's down exit (SwipeStamp board; build brief §5, "the prototype's down exit").

#### 7. The next card rises with the drag · **new, needs a brief**

- **Current:** the waiting card is static while the top card is dragged (`:159-172`). Only on a decision does it start a fixed 0.56 s rise, as a fresh `TopCard` from a fixed `initial` (`:294`), however far the top card had already gone.
- **Proposed:** the card behind tracks drag progress, a hint that a decision is coming. On a decision it springs the rest of the way from wherever it is; on a cancel it follows the top card back automatically, because it is derived from the same values.
- **Values:**

  ```ts
  // second card, from p (shared definitions):
  y = 14 - 6 * p;  scale = 0.95 + 0.02 * p;  overlay = 0.40 - 0.15 * p;
  // on a decision, to y 0, scale 1, overlay 0:
  { type: "spring", stiffness: 400, damping: 40, mass: 1 } // ratio 1.0, response 0.31 s
  // third → second: same spring, (26, 0.90, 0.60) → (14, 0.95, 0.40)
  ```

  The new top card's `initial` must be the waiting card's live values at the moment of decision, not the fixed 14 / 0.95, or it jumps back. That needs one shared progress motion value in `PlayerSwipe` and the waiting cards as motion elements: components only, but a real restructure. On taps p stays 0 (D6: the card doesn't move before the stamp lands), so the rise just uses the spring. Reduce-motion: no tracking, instant.
- **Equality:** p uses the same t and formula for all three directions.

#### 8. One haptic tick at the threshold (Android), with a visual twin for everyone · **new, needs a brief**

- **Current:** no haptics in Round 2. The stamp's opacity climbs linearly to 1 at t (`:257-261`) and nothing marks the moment a release would count.
- **Proposed:** one tick at the moment a still release would decide, identical for every direction, with the stamp giving a small detent on the same frame (Apple's harmony rule: sight and touch together). iOS has no Vibration API in WebKit, so the detent is the iOS feedback.
- **Values:**

  ```ts
  // only while dragging (not during the spring-back or the flight):
  // p reaches 1 →
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
  // stamp detent: multiply its scale by 1.06 → 1
  { type: "spring", stiffness: 600, damping: 30, mass: 1 } // ratio 0.61, response 0.26 s
  // re-arm only once p < 0.8 (about 24 px of hysteresis, so it never buzzes on the line)
  // button taps: the same vibrate(10) on the frame D6's stamp lands (end of its 180 ms), all three buttons
  ```

  The drag counts as the user activation Chrome requires. Reduce-motion: the vibration stays (it isn't motion), the detent goes (D6: stamps appear instantly).
- **Not:** a different pattern per direction (a longer buzz on "This vibe" would make it feel more rewarding); a tick when backing out; the hidden `<input type="checkbox" switch>` trick some sites use for haptics on iOS Safari (an unofficial side effect that any iOS update can break).
- **Equality:** one pulse, one detent, all three directions and all three buttons.

#### 9. Tilt around the thumb, not the card's centre · **new, needs a brief**

- **Current:** the card rotates around its centre (the default transform origin) with a fixed sign (`:255`). A thumb that grabs 75% of the way down the card (131 px below centre) slides off its spot by r·sin θ: about 10 px at the threshold (4.2°) and about 27 px at a full card-width drag (12°). Grabbed high, the card runs ahead of the thumb by the same amount.
- **Proposed:** pivot at the grab point, with the far end trailing: tilt sign +1 when grabbed above centre, −1 below. The point under the thumb then stays under the thumb for the whole drag. The 12° amount is unchanged.
- **Values:** on `pointerdown`, only when the card is at rest (|x| < 1 px and |y| < 1 px; otherwise keep the previous origin, so grabbing mid-spring can't jump): `originX = (clientX − rect.left) / rect.width`, `originY = (clientY − rect.top) / rect.height`, as motion values on the article; `rotate = sign * (x / width) * TILT`.
- **Equality:** tilt stays horizontal-only, left and right mirror exactly, down is untouched.

#### 10. Resist upward drags only · **new, needs a brief** (optional, the smallest)

- **Current:** an upward drag follows 1:1 even though up means nothing; the card can cover the header, then springs back.
- **Proposed:** resist upward only, so the three live directions feel equally free and the dead one says "nothing here". Never resist down: it would make "Not sure" cost more effort.
- **Values:** `dragConstraints={{ top: 0 }}` with `dragElastic={{ top: 0.2 }}` (Motion's built-in, linear: 100 px of thumb moves the card 20 px up). Left, right and down stay unconstrained and 1:1. Motion runs its own boundary spring on release; `onDragEnd`'s spring replaces it a frame later, which is harmless. Check on the phone: Motion measures the card at drag start once constraints are set.
- **Equality:** applies only to the direction with no outcome.

## Deliberately not recommended

- **Catching a flying card.** Apple would allow it, but here the decision is recorded at release; catching would be an undo, a product change.
- **Loosening the F1 guard or the 300 ms floor** in a design brief. Item 2 shortens the flight, which is the honest way to make it bite less.
- **Bouncier springs** on the spring-back or the exit (damping ratio below about 0.75): overshoot past centre fades in the wrong stamp.
- **Anything per-direction:** no distinct haptic, sound, colour flash or exit flourish for one choice.
- **Reduce-motion changes** beyond what D6 already says.

## For Otto and Lasse

- **Suggested order:** items 1 to 4 drop into D6 as a few lines each, with no recording change. Of the rest, item 5 does the most for feel, item 6 is Lasse's call, and items 7 to 10 are polish.
- **Observed, outside this review's scope:** the "This vibe" disc is brass with a glow (`:200`, `:373`) and its stamp is brass-light (`:317`), while the other two are dark and cream. The rule as written ("same size and weight", build brief §5) is met, and colour isn't covered. I'm flagging it only because the invariant is about all three looking equal; I haven't proposed a change.
