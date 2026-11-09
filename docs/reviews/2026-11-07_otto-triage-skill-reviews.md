# Otto triage · Skill reviews of 7 Nov (D6 input)

*7 Nov 2026 · Four read-only reviews by Arthur: `2026-11-07_motion-review-stamp.md` (motion), `2026-11-07_swipe-physics-review.md` (gesture physics), `2026-11-07_mobile-native-audit.md` (mobile), `2026-11-07_polish-critique.md` (polish and the wrap screen). All read in full. No code was changed by any of them.*

**Overall:** high quality, specific and mostly consistent. They explain why the stamp "isn't smooth" (it's a side effect of the card flying, so it never lands, and the flight wastes its time off-screen while input stays locked), and they find two real risks I hadn't: a downward drag can pull-to-refresh the page and lose the game, and a double tap can carry through to the next screen's button and skip the pass-the-phone gate. They also confirm an invariant breach: on a tap, "Not sure" shows a weaker stamp and leaves differently from the other two.

The accepted values are written into `docs/decisions/2026-10-02_design-pass-2-D6-polish.md`. The brief is the source of truth; report sections are cited only for code-level detail.

## Motion review (stamp)

| # | Finding | Call | Reason |
|---|---|---|---|
| 1 | Stamp tied to distance, so on a tap it never lands; Not sure's tap stamp peaks at ~40% | **Accept** | Root cause, and an invariant fix |
| 2 | Tap fly: 280 ms accelerate instead of 420 ms entry curve | **Accept** | No invisible tail, no 150 px first-frame jump |
| 3 | Reduce-motion: stamp holds 300 ms, card fades 150 ms; floor timed from the reveal | **Accept** | D6 as written showed no stamp; protects the F1 fix. Cato re-checks the guard |
| 4 | Tap timeline: stamp 50 ms opacity, 1.4 → 1 in 120 ms ease-in, no overshoot; thud at impact; fly at 240 ms | **Accept** | Replaces D6's overshoot and 1.6; one stamp scale everywhere |
| 5 | ~0.52 s from tap to input, not ~0.7 s | **Accept** | Same beat, no slower than today |
| 6 | Interruption rules; run the sequence as the leaving card's exit, keep `decide()` and the F1 guard | **Accept** | Keeps Cato's fix intact |
| 7 | Drag fly on a spring with release velocity | **Accept, merged** with physics 2 (values below) |
| 8 | Fly target clears any screen; `overflow-x: clip` on `main` | **Accept** | Also mobile item 6 |
| 9 | Black overlay instead of brightness filters, including the top card's entry | **Accept** | Extends D6 |
| 10 | Solid discs and genre pill, no backdrop blur | **Accept** | Extends D6 (also polish 13) |
| 11 | Next card steps up as the old one leaves, 400 ms | **Accept** | |
| 12 | `will-change` only if paint flashing shows a repaint | **Accept** | Don't add blind |

## Physics review (drag)

| # | Finding | Call | Reason |
|---|---|---|---|
| 1 | Drag can start anywhere on the card except the discs | **Accept** | Same as mobile item 1; the thumb zone |
| 2 | Drag exit springs carry velocity and heading | **Accept** | Values: stiffness 250, damping 32, release velocity per axis, trailing axis projected 0.15 s; target from motion 8 |
| 3 | Spring-back carries release velocity | **Accept** | Same spring, just the velocity |
| 4 | Nothing paint-heavy on a moving card | **Accept** | Same as motion 9 and 10 |
| 5 | Decide by where the throw is heading (projection), plus 12 px minimum travel | **Lasse's call** (Otto: accept into D6) | Biggest feel win; changes which releases count, so new tests for the table and a Cato check |
| 6 | Not sure thrown off the bottom like the other two, full opacity | **Lasse's call** (Otto: accept) | Today it shrinks and fades: the one place the gesture breaks "Not sure looks equal" |
| 7 | Next card rises with the drag | **Defer (D7)** | Real restructure; polish |
| 8 | Haptic tick | **Defer (backlog)** | No vibration on iPhone, so Lasse wouldn't feel it |
| 9 | Tilt around the thumb | **Defer (D7)** | Polish |
| 10 | Resist upward drags | **Defer (D7)** | Smallest; optional |
| (note) | "This vibe" disc is brass, the others dark | **Keep** | Agreed board design; the rule is size and weight, which holds |

## Mobile audit

| # | Finding | Call | Reason |
|---|---|---|---|
| 1 | Pull-to-refresh can reload mid-game | **Accept** | `overscroll-behavior: none`; a reload loses the game |
| 2 | Double tap lands on the next screen's button | **Accept** | Can skip the "no peeking" gate or lock a turn at 0 picks; `useArmed(450)` |
| 3 | Bottom buttons in Safari's toolbar strip; layout jumps | **Accept** | `viewportFit: cover`, `100svh` room, safe-area padding |
| 4 | Game state only in memory | **Defer, own brief** | Engine + components; pair with saved services in launch readiness |
| 5 | Long-press selects headline, link previews, image menus | **Accept** | |
| 6 | Flying card widens the page | **Accept** | `overflow-x: clip` on the room |
| 7 | Text buttons give no press feedback | **Accept** | `active:text-bulb` |
| 8 | Pinch then double-tap zoom | **Accept** | `touch-action: manipulation` on `html` |
| 9 | No `color-scheme: dark` | **Accept** | And readable option colours |
| 10 | Installable home-screen app | **Defer (backlog)** | Product call, later |
| 11 | Hover gate on stylus Androids | **Reject** | Not seen; low stakes |

## Polish critique

| Part | Finding | Call | Reason |
|---|---|---|---|
| A1 | Wrap button "Lock my swipes", not "Pass the phone", so the partner never sees your likes | **Lasse's call** (Otto: accept) | The partner would recognise those posters in their own Round 3 list |
| A2 to A5 | Newest like front and centre; a 2-like layout; uneven angles; 104 × 156 posters | **Accept** | |
| A6 | Header and button don't re-animate on the wrap | **Accept** | |
| A7 | Tally order Not it · Not sure · This vibe; equal cells | **Accept** | Matches the buttons |
| Entrance | Fan deals in from the right, then the stamp lands | **Accept, adjusted** | The fan stamp uses the new deck stamp values (motion 4), not the old overshoot |
| No likes | No fan; ticket deals in; no red zero; two honest lines | **Accept** | |
| B5 | Accented titles lose their accents | **Accept into D6** | Confirmed bug |
| B6 | ADMIT TWO ticket has no visible focus ring | **Accept into D6** | Confirmed, accessibility |
| B7 | Centred loader stack jumps on the second quote | **Accept into D6** | Belongs with D6 §2 |
| B13 | Genre tag blur | **Accept** | Same as motion 10 |
| B1 to B4, B8 to B12, B14, B15 | Finishing details | **Defer (D7 finish brief)** | Each small; one finishing pass after D6 |

## Decisions for Lasse

1. Decide drag releases by where the throw is heading (physics 5): Otto recommends yes, in D6.
2. "Not sure" thrown off the bottom like the other two (physics 6): Otto recommends yes.
3. The wrap button reads "Lock my swipes" (polish A1), and the two no-likes lines: Otto recommends yes.
4. The deferred finishing details become a D7 brief after D6: Otto recommends yes.
