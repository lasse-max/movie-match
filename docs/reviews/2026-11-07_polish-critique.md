# Polish critique · Round 2 wrap and the invisible details

*7 Nov 2026 · Design-engineering review (Emil Kowalski lens) · Read-only, no code changed · Code as on `main` at `7697e0e`*

Scope: polish inside the Picture Palace design (`docs/design/PICTURE_PALACE_BRIEF.md`, `docs/design/picture-palace/`). No new style, palette or fonts. Every fix below stays inside the design-brief scope from CLAUDE.md rule 10: `components/`, `app/globals.css`, `app/layout.tsx`.

Method: read every screen component, `palace.tsx`, `globals.css`, the D6 brief and boards (`D6Wrap`, `D6Swipe`, `D6Load`), and the `d6-homepage-motion` branch. Two claims were checked in the running app (dev server, 390 px): the ticket's focus ring and accent clipping on film titles. Both are confirmed. Not checked: feel on a real phone. That still needs Lasse's hands, as D6 §5 says.

Already covered by D6, so not repeated here: stamp timing and thud (§1), overlay dimming instead of the brightness filter (§1), solid control discs (§1), the centred loader stack (§2), short service names (§4), the stronger title fade (§4), homepage motion (§4b, parked on `d6-homepage-motion`, not on `main`).

Also covered elsewhere, so not repeated: Arthur's mobile-native audit from the same day (`docs/reviews/2026-11-07_mobile-native-audit.md`) owns pull-to-refresh, `touch-action`, long-press selection, double taps carrying into the next screen, and the Safari toolbar strip. Where the two reviews touch, this one points to it.

---

## Part A · The screen after swiping (D6 §3)

### Verdict

Right idea. Build it, with seven changes. The first one is a product risk, not a polish point.

### What the proposal gets right

- **It turns a receipt into a payoff.** "3 films you're into · 2 passed" is a number. Three of your own posters is a memory. The flat feeling comes from the screen reporting on the round instead of handing it back to you.
- **It reuses the round's one gesture.** The stamp has landed eight times. Landing it once more, across the fan, closes the round with its own punctuation. No new idea needed.
- **It costs nothing to load.** The fan uses the same `posterUrl` the deck just showed, so every poster is already in the browser cache. The fan never shows an empty frame.

### What to change

**1. The fan shows your likes at the exact moment the phone changes hands.** This matters more than it looks. Round 3 seeds each player's shortlist with the films the *other* player liked, silently and by design (`components/Round3Screen.tsx:15-18`, `lib/infer.ts:5`). A partner who glimpses the fan will recognise those posters in their own shortlist and know they're yours. The board's button says "Pass the phone", which invites handing over first and tapping second. Recommendation: the button reads **"Lock my swipes"** for both players (it rhymes with "Lock my picks" in Rounds 1 and 3), and the gate that follows already says "Pass the phone". The fan is gone the moment the button is tapped. Lasse's call, since it changes D6 copy.

**2. The newest like should be on top, in the middle.** The board fills slots in order (oldest left, middle on top, newest right; `D6Swipe.dc.html` line 166). The card you stamped seconds ago is the one you remember. Put it front and centre, the two before it behind.

**3. Two likes leave a hole.** With two, the board uses only the outer slots: two cards 160 px apart with a 56 px gap in the middle and the stamp floating in it. Two likes need their own layout (below), overlapping like a hand of cards.

**4. A symmetric fan reads as a widget, not a hand.** ±10° mirror-perfect is what a carousel does. The house already tilts paper by hand: the seat ticket at −4°, the stamps at −12°. Give the fan uneven angles so it reads as dealt (values below).

**5. The mini posters are not 2:3.** 104 × 150 is 0.693; a poster is 0.667, so `object-cover` crops 4%. Use **104 × 156** and grow the fan box from 184 to **190 px**.

**6. One animation per element.** The board animates the whole wrap at once (`.wrapin`, header and button included), and the app does the same with `pp-enter` on the screen root (`Round2Screen.tsx:129`). Layered under a fan that deals its own cards, each card would rise twice. Header and button stay still; the fan deals; the text column staggers (spec below).

**7. The tally ticket.** Two small things. Order the cells **Not it · Not sure · This vibe**, the same left-to-right order as the three buttons the player just pressed (`Round2Screen.tsx:194-202`), so the ticket reads as a record of those presses. Keep all three cells equal width (the "Not sure stays equal" rule). And print a count in velvet only when it's above zero (see the no-likes version).

### Layout

Cards are 104 × 156, radius 6 px, positioned from the fan box's centre. `--x`, `--y`, `--r` are each card's resting place. Stack order: newest on top.

| Likes | Card (oldest → newest) | `--x` | `--y` | `--r` |
| --- | --- | --- | --- | --- |
| 3 | left | −72 px | 14 px | −9° |
| 3 | right | 72 px | 10 px | 7° |
| 3 | centre, on top (newest) | 0 | 0 | −2° |
| 2 | back (older) | −34 px | 8 px | −6° |
| 2 | front (newer) | 30 px | 0 | 4° |
| 1 | single | 0 | 0 | −2° |

The fan stamp: "This vibe", brass-light, 22 px, border 3 px, same background as the board. Centred on the box, **bottom 18 px** (so it crosses the lower third of the front card), rotated **−12°**, the deck stamp's angle. The board's −8° makes it look like a different stamp.

No poster for a liked film (`posterUrl` null): a cream poster-stock card with the title in velvet display caps, 18 px, three lines max. Never the dark `bg-aisle` block the deck uses (`Round2Screen.tsx:386`), which reads as a hole in the fan.

### The entrance

The deal comes **from the right**. That's where every "This vibe" card just flew (`Round2Screen.tsx:301`, x = +1.3 × card width), so the fan reads as the pile you threw coming back. Spatial consistency, and it's specific to this screen.

`t = 0` is the moment the wrap mounts (the last card's exit has finished). `n` is the number of cards in the fan.

| Element | Starts at | Duration | Easing | From → to |
| --- | --- | --- | --- | --- |
| Header row ("Round 2 · The vibe") | already there | none | none | Doesn't move. Render it once, outside the deck/wrap branch |
| "Lock my swipes" button | 0 | none | none | Present and tappable from the first frame. Never block it |
| Fan card, deal order *i* (back to front: left, right, centre) | *i* × 70 ms | 520 ms | `cubic-bezier(0.16, 1, 0.3, 1)` | opacity 0, `translate(--x + 48px, --y + 18px) rotate(--r + 14deg) scale(0.92)` → resting place |
| Kicker "Player N · swipes locked" | 100 ms | 600 ms | entry curve | `pp-enter` (opacity 0, translateY 12px → rest) |
| Headline "That's a wrap." | 150 ms | 600 ms | entry curve | `pp-enter` |
| Tally ticket | 200 ms | 600 ms | entry curve | `pp-enter` |
| Line under the ticket | 250 ms | 600 ms | entry curve | `pp-enter` |
| Fan stamp | (n − 1) × 70 + 380 ms (3 cards: **520 ms**) | 180 ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | opacity 0, `scale(1.6)` → `scale(1)`, rotate −12° throughout |
| Thud, front card only | stamp start + 60 ms | 200 ms | entry curve | scale 1 → 0.97 at 35% → 1 |

Why these numbers:
- **70 ms, not the house 50 ms.** The house stagger is for lists. Three cards that overlap by two thirds need slightly more air or they arrive as one blob. 70 ms is still inside the 30 to 80 ms range where stagger reads as rhythm, not delay. The whole deal takes 140 ms to start and is still by 660 ms.
- **The stamp is the last beat.** It starts when the front card is about 97% settled, and by then the text column is still too (the entry curve does most of its work in the first 300 ms). So the stamp lands on a quiet screen and owns the moment. Everything is still by about 780 ms.
- **Same stamp curve and thud as the deck** (D6 §1: 1.6 → 1, 180 ms, that overshoot curve, a thud). The wrap repeats the round's gesture exactly, which is what makes it feel like an ending rather than a new screen.
- **Equal deal distance per card.** Each card starts 48 px right of its own resting place, not from one shared point off-screen, so all three travel the same distance at the same speed.

Implementation notes: CSS keyframes, not Motion. The animation is fixed and never interrupted, and CSS stays smooth if the main thread is busy. Use the popcorn pattern (static `--x/--y/--r` per card, `globals.css:263-306`). Put the deal on an outer wrapper and the thud on an inner one so the two transforms never fight. Fill mode `backwards`, like `pp-enter`. The last three likes are `yes.slice(-3)` (`yes` is already in decision order, `Round2Screen.tsx:117`); newest is last.

```css
.pp-fan-card {
  transform: translate(var(--x), var(--y)) rotate(var(--r));
  animation: mmDeal 520ms var(--ease-entry) backwards;
}
@keyframes mmDeal {
  from {
    opacity: 0;
    transform: translate(calc(var(--x) + 48px), calc(var(--y) + 18px)) rotate(calc(var(--r) + 14deg)) scale(0.92);
  }
}
.pp-fan-stamp {
  transform: translateX(-50%) rotate(-12deg);
  animation: mmStampLand 180ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards; /* delay set inline from n */
}
@keyframes mmStampLand {
  from { opacity: 0; transform: translateX(-50%) rotate(-12deg) scale(1.6); }
}
```

### The no-likes version

The board's answer is "no fan", which leaves the old flat screen plus a big **velvet 0** in the first cell of the tally. Red zero is the house colour for an alarm. The player hasn't failed: a round of "Not it" still steers their shortlist, and a round of "Not sure" hands over to their Round 1 moods (`lib/infer.ts:663-667`). The screen should say that, with the same ceremony.

- **No empty box.** Don't reserve the fan's 190 px. The column re-centres around the headline.
- **The ticket gets the fan's moment.** It deals in from the right like the cards, at a smaller swing for its width: starts 120 ms, 520 ms, entry curve, from opacity 0, `translate(32px, 14px) rotate(3deg) scale(0.96)` to rest at **rotate −3°**, a tilted piece of paper like the seat ticket at the gate (−4°). Kicker at 0 ms, headline at 50 ms, the line under the ticket at 170 ms (`pp-enter`). Still by about 640 ms. No stamp: there is nothing to stamp, and a stamp saying anything else would be a fourth stamp word the brief doesn't have.
- **No red zero.** All three numbers print in projection black when This vibe is 0. (With likes, This vibe keeps its velvet.)
- **One honest line**, above "Your picks stay hidden until the match.":
  - At least one Not it: **"Nothing grabbed you. That still steers your shortlist."**
  - All Not sure: **"No strong calls. Your Round 1 moods lead from here."**

Both lines are true to the engine as built; if the degrade rule in `lib/infer.ts` changes, these lines change with it.

### Reduced motion

Everything at its resting place on the first frame: fan dealt, stamp on, no thud, no rises. `globals.css:454-470` already cuts CSS animations to 0.001 s; check the stamp ends at `scale(1)` with opacity 1 under that rule, since `backwards` fill only covers the start.

---

## Part B · The invisible details, ranked

Ranked by how often players hit it times how much it shows. Effort: S under an hour, M a few hours, L a day or more. "D6" means it belongs to (or extends) the D6 brief; "New brief" means Otto would need to write it.

| # | Item | Effort | Brief |
| --- | --- | --- | --- |
| 1 | The header and button re-enter on every screen change | M | New brief (the Round 2 header part is D6 §3) |
| 2 | Presses take 300 ms on chips, rows and tiles | S | New brief (the Setup tile is D6 §4b, on the branch) |
| 3 | Loader to result is a hard cut, and a loader can flash | M | New brief |
| 4 | The match reveal: hint snaps off, the % stamp doesn't land | M | New brief |
| 5 | Accented titles lose their accents (confirmed) | S | New brief (Round 2 title can ride with D6 §4) |
| 6 | The ADMIT TWO ticket has no visible focus ring (confirmed) | S | New brief |
| 7 | The centred loader stack will jump when the second quote arrives | S | D6 §2 (add to its notes) |
| 8 | Selection marks pop in while their chip or row fades | S | New brief |
| 9 | Round 1's cascade runs past 1.5 s | S | New brief |
| 10 | Posters pop in with no fade | S | New brief |
| 11 | A screen can open part-scrolled | S | New brief |
| 12 | Balance titles and quotes; centre tracked labels truly | S | New brief |
| 13 | The genre tag still blurs the moving card | S | D6 §1 (extend) |
| 14 | Extra runner-ups appear in one frame | S | New brief |
| 15 | First paint swaps a wide fallback for the display face | S | New brief |

Items 2, 5 to 15 are each well under a day. Together they'd make a sensible D7 "finish" brief after D6.

### 1 · The header and button re-enter on every screen change · M

**Where:** `app/globals.css:58-60` (`.pp-enter`) on the screen roots: `SetupScreen.tsx:61`, `Round1Screen.tsx:93`, `Round2Screen.tsx:129` and `:152`, `Round3Screen.tsx:111`, `Projector.tsx:44`, `ErrorState.tsx:26`, `Notice.tsx:22`.

**Problem:** every screen root starts at opacity 0 and rises 12 px. The brass button sits in the same place at the bottom of almost every screen, so on each tap the button under the player's thumb vanishes and slides back up. Inside Round 2, "Round 2 · The vibe / Player 1 · 8/8" jumps when the deck turns into the wrap, though it never moved. `PassPhone.tsx:35-66` already does it right: no root animation, the parts stagger, bulbs and button stay put.

| Before | After | Why |
| --- | --- | --- |
| `pp-enter` on the screen root | `pp-enter` on the content blocks only, 50 ms apart (the house stagger) | What changed should move; what stayed shouldn't |
| Header row rises with the screen | No entrance | It's the same row in the same place on both screens |
| Bottom CTA / Ticket rises with the screen | No entrance (or opacity only, 150 ms, no translate) | Never move a target under the thumb that just pressed |
| `<Header>` rendered inside both Round 2 branches (`:130`, `:153`) | Rendered once above the branch | Persistent chrome persists |

Ship this together with the mobile-native audit's item 2 (`useArmed`, 450 ms). A button that is visibly still in the same spot invites the second tap of a double tap even more than today's fading one does.

### 2 · Presses take 300 ms on chips, rows and tiles · S

**Where:** `Round1Screen.tsx:71`, `Round3Screen.tsx:182`, `SetupScreen.tsx:143` (one `duration-300` covers transform too). Text buttons with no press at all: `palace.tsx:42`, `MatchScreen.tsx:114` and `:126`.

**Problem:** the CTAs press in 180 ms (`palace.tsx:33`); chips, rows and tiles press in 300 ms, which feels like the tap was heard late. The quiet text buttons (Play again, See other matches, Start over) have only a hover colour, so on a phone they give no feedback at all. (Hover is already limited to hover-capable devices by Tailwind v4, checked in the running app, so no sticky-hover issue.)

| Before | After | Why |
| --- | --- | --- |
| `transition-[background-color,box-shadow,transform] duration-300` | `[transition:background-color_300ms_var(--ease-entry),box-shadow_300ms_var(--ease-entry),transform_160ms_var(--ease-entry)]` | Press in 160 ms, let colour take its time. Same split as the `d6-homepage-motion` tiles |
| `press` at 180 ms (`palace.tsx:33`) | 160 ms | One press speed across the game |
| `textButton`: `transition-colors hover:text-bulb` | add `active:text-bulb` (the mobile-native audit's item 7; same fix, one answer) | Every pressable thing answers the press |

### 3 · Loader to result is a hard cut, and a loader can flash · M

**Where:** `Projector.tsx:115-129` (stops on the next whole second, then `onDone`), `BlendingScreen.tsx:78-83` and `:94`, `InferringScreen.tsx:71-76` and `:87`. Applies to the tiebreak loader too (`TiebreakScreen.tsx:191`).

**Problem:** (a) When the result is in, the whole loader, with the quote mid-sentence, is replaced in one frame. The quote is the brief's hero for the wait; it shouldn't be the thing that gets yanked. (b) Infer takes 5.8 to 10 s end to end (`2026-11-07_otto-live-speed-check.md`) and the gate hides part of it, so the result often lands soon after Player 1 taps "I'm Player 1". Then the loader shows for one number: a "3", a quote nobody can read, then a cut.

| Before | After | Why |
| --- | --- | --- |
| `onDone()` called on the tick | On the tick, fade the loader out: opacity 1 → 0, 180 ms, `cubic-bezier(0.23, 1, 0.32, 1)`, then `onDone()` | Exits are short and quiet; the next screen enters as usual |
| Gate tap with no result yet → loader at once | Hold on the gate up to 600 ms: button pressed (scale 0.97, held), the WarmingLeader's wedge starts sweeping (`pp-sweep`, `PassPhone.tsx:102`). Result in time → straight on; else → loader | Don't show a loader the player can't read |
| Reduced motion | Unchanged: instant | |

Do this after D6 §2 rebuilds the loader layout.

### 4 · The match reveal: hint snaps off, the % stamp doesn't land · M

**Where:** `MatchScreen.tsx:159-173` (the hint button is unmounted), `MatchScreen.tsx:73` with `PosterCard.tsx:61-64` (the stamp rides in with the card).

**Problem:** the climax has two slips. As the curtain starts its 1.9 s part, "We have a match / Tap to raise the curtain" disappears in one frame. And the brass "88% match" stamp, the same object the player has been stamping all game, arrives already stuck on, fused to the card's rise. The match is where the stamp should land hardest.

| Before | After | Why |
| --- | --- | --- |
| `{!open && <button>…}` | Keep it mounted; when open: opacity 0 over 150 ms `cubic-bezier(0.23, 1, 0.32, 1)`, `pointer-events: none`, then unmount | Nothing should vanish in one frame next to a 1.9 s curtain |
| Stamp rises with the card at 1.15 s | Stamp lands on its own at **1.75 s after open** (the card has settled): opacity 0 → 1, scale 1.6 → 1, 180 ms, `cubic-bezier(0.34, 1.56, 0.64, 1)`, rotate −12° throughout | The game's one gesture, at its biggest moment |
| No contact | Card thud: scale 1 → 0.985 → 1, 200 ms, entry curve, starting 60 ms after the stamp | Weight; matches the Round 2 thud (D6 §1) |
| Reduced motion | Stamp present, no thud | |

Popcorn fires at 1.55 s (`globals.css:261`). If stamp plus popcorn feels busy on the phone, keep the stamp: it's the system's gesture, and the brief marks popcorn as the optional one (§4.7).

### 5 · Accented titles lose their accents (confirmed) · S

**Where:** `Round2Screen.tsx:313` (48 px, `leading-[0.86]`, `line-clamp-3`), `Round3Screen.tsx:193` (19 px, `leading-none`, `truncate`), `MatchScreen.tsx:199` (21 px, same).

**Problem:** both clamping and truncating set `overflow: hidden`, and with leading at or below 1 the line box is shorter than an accented capital. Rendered in the app with the real face: **AMÉLIE shows as AMELIE** and **LÉON as LEON** on the Round 2 card; on the rows, É, Å and Ñ lose their tops. Amélie, Léon, Les Misérables, Pokémon, Y Tu Mamá También: these are common.

| Before | After | Why |
| --- | --- | --- |
| `line-clamp-3 … leading-[0.86]` | add `pt-[0.16em] -mt-[0.16em]` | Room for the accent inside the clip, no layout change (tested) |
| `truncate … leading-none` (both rows) | add `pt-[0.14em] -mt-[0.14em]` | Same (tested at 19 and 21 px) |

### 6 · The ADMIT TWO ticket has no visible focus ring (confirmed) · S

**Where:** `globals.css:94-99` (the notch `mask`) clips the outline from `globals.css:49-52`. Also `Round2Screen.tsx:365-376`, and every screen change.

**Problem:** checked in the app: the ticket reports `:focus-visible` with a 2 px brass outline, and nothing shows, because a mask clips everything outside the element. It's the main button on Setup, Round 1 and Round 3. Two related slips: on the Round 2 controls the ring is a rectangle around disc and label, not the round disc; and when a screen changes, focus falls back to the page, so a keyboard or screen-reader player starts from the top every time.

| Before | After | Why |
| --- | --- | --- |
| Outline on the masked `.pp-ticket` | Wrap the button in a span: `.pp-ticket-ring:has(> .pp-ticket:focus-visible) { outline: 2px solid var(--brass-light); outline-offset: 3px; border-radius: 10px }` | The wrapper isn't masked, so the ring shows |
| Control: outline around the whole button | `focus-visible:outline-none` on the button, `group-focus-visible:shadow-[0_0_0_2px_#0e0a09,0_0_0_4px_var(--brass-light)]` on the disc | The ring follows the shape you press |
| Focus lost on screen change | Each screen's `h1` gets `tabIndex={-1}`, focused with `{ preventScroll: true }` when phase or player changes | The next screen starts where the reader is |

### 7 · The centred loader stack will jump when the second quote arrives · S · D6 §2

**Where:** `LoadingQuote.tsx:9` (second quote at 8 s), `LoadingQuote.tsx:36-43` (`mode="wait"`, 0.5 s out then 0.5 s in).

**Problem:** today the quote is pinned to the bottom (`Projector.tsx:53`), so a taller second quote only grows upward. In D6's centred stack, the quote's height moves everything above it. Measured with the real face at 342 px: the curated quotes run 1 to 3 lines (39, 78, 118 px). A 1-line to 3-line swap would push the leader up about 40 px mid-wait. The swap itself leaves a full second with no quote.

| Before | After | Why |
| --- | --- | --- |
| Quote height follows the text | `blockquote` gets `min-h-[118px]`, quote top-aligned in it | The stack never moves during a wait |
| Exit 500 ms, enter 500 ms, sequential | Exit 200 ms `cubic-bezier(0.23, 1, 0.32, 1)`, enter 400 ms entry curve; `filter: blur(2px)` on both ends | Exits faster than entries; blur hides the seam |
| | Recheck the min-height if `lib/quotes.ts` gains a longer line (the quote list cleanup is planned before launch) | |

### 8 · Selection marks pop in while their chip or row fades · S

**Where:** `Round1Screen.tsx:82-87` (the lit bulb dot is mounted on select), `Round3Screen.tsx:207` (`{selected && <Check />}`).

**Problem:** the chip's fill and brass ring take 300 ms, but the dot and the check appear in one frame, ahead of their own background. Setup already does this right (`SetupScreen.tsx:170-175`).

| Before | After | Why |
| --- | --- | --- |
| `{on && <span … />}` / `{selected && <Check />}` | Always rendered; `transition-[opacity,transform] duration-200 ease-entry`; off `opacity-0 scale-[0.6]`, on `opacity-100 scale-100` | Mark and surface arrive together |

### 9 · Round 1's cascade runs past 1.5 s · S

**Where:** `Round1Screen.tsx:70` (`120 + i × 50` ms over 18 chips).

**Problem:** the last genre chip starts at 970 ms and settles at about 1.57 s. The screen feels like it's still loading, and chips can be tapped while still invisible (fill `backwards` holds them at opacity 0).

| Before | After | Why |
| --- | --- | --- |
| `120 + i * 50` per chip | Moods by row: `120 + Math.floor(i / 2) * 50` (4 rows: 120 to 270 ms). Genres as one group at 320 ms | Rhythm without a wait; all in by about 920 ms |

### 10 · Posters pop in with no fade · S

**Where:** `Round3Screen.tsx:189` (8 thumbnails, mostly new films, so not cached), `MatchScreen.tsx:195` (runner-ups), `PosterCard.tsx:29` (the match poster).

**Problem:** each image snaps in whenever it arrives, often after its row has finished entering. On a slow connection the match card can reveal with an empty frame and the poster lands late.

| Before | After | Why |
| --- | --- | --- |
| `<img … />` | `opacity-0` until `onLoad`, then `opacity-100`, `transition-opacity duration-300 ease-out`; on mount, if `img.complete`, start visible | Arrive, don't appear; cached images skip the fade |
| Match poster fetched when the card mounts | Preload on mount of `MatchScreen` (`new Image().src = movie.posterUrl`), about 2 s before the card reveals | The reveal never waits on the network |

### 11 · A screen can open part-scrolled · S

**Where:** `GameScreen.tsx:24-28`. `MatchScreen.tsx:31-32` resets scroll for itself only.

**Problem:** Round 1 (18 chips) and Round 3 (8 rows) run taller than a phone's visible area, so the lock tap often happens scrolled down. When the next view is also taller than the screen (the boundary gates with the four-line "Pass the phone back to Player 1", the tiebreak loader), it opens mid-page with its kicker above the fold. I haven't measured this on a phone; the fix is cheap and safe either way.

| Before | After | Why |
| --- | --- | --- |
| Scroll carries across screens | In `GameScreen`: `useLayoutEffect(() => window.scrollTo(0, 0), [state.phase, state.currentPlayer])` | Every screen starts at its top. Then drop the one-off in `MatchScreen` |

### 12 · Balance titles and quotes; centre tracked labels truly · S

**Where:** `Round2Screen.tsx:313`, `LoadingQuote.tsx:48`; centred labels at `Round1Screen.tsx:123`, `Projector.tsx:48`, `MatchScreen.tsx:165` and `:168`.

**Problem:** long film titles and the 40 px quote can end on one lonely word. The poster card and the match line already balance (`PosterCard.tsx:37`, `MatchScreen.tsx:78`). Separately, letter-spacing also adds space after the last letter, so the centred Courier labels (0.22 to 0.28 em tracking) sit 1 to 1.5 px left of centre.

| Before | After | Why |
| --- | --- | --- |
| No wrap rule on the card title and quote | `[text-wrap:balance]` | No orphan word under a 48 px title or the hero quote |
| Centred label with trailing tracking | `-mr-[0.28em]` (or `-mr-[0.22em]` to match each label's tracking) | Optical centre matches the real centre |

### 13 · The genre tag still blurs the moving card · S · D6 §1

**Where:** `Round2Screen.tsx:308` (`backdrop-blur-[8px]`).

**Problem:** D6 §1 swaps the control discs' backdrop blur for a solid fill because re-blurring under motion is heavy on phones. The genre tag rides on the card itself, so it re-blurs on every frame of every drag and flight. The board's tag has no blur (`D6Swipe .tag`).

| Before | After | Why |
| --- | --- | --- |
| `bg-[rgba(14,10,9,0.55)] … backdrop-blur-[8px]` | `bg-[rgba(14,10,9,0.72)]`, no blur | Same fix and value as the discs; matches the board |

### 14 · Extra runner-ups appear in one frame · S

**Where:** `MatchScreen.tsx:107-118`.

**Problem:** "See N other matches" mounts the extra rows instantly and shoves "Play again" down in the same frame. The button that was tapped disappears, so focus falls to the page.

| Before | After | Why |
| --- | --- | --- |
| New rows mount with no entrance | Each new row `pp-enter`, `animationDelay: i * 50ms` (the house list stagger) | A list that grows should show it growing |
| Focus lost when the button unmounts | Focus the first new row's link (`preventScroll: true`) | The reader lands on what they asked for |

### 15 · First paint swaps a wide fallback for the display face · S

**Where:** `app/layout.tsx:20` and `:30` (`fallback: ["Arial Narrow", "Arial", "sans-serif"]`, `adjustFontFallback: false`).

**Problem:** neither iOS nor Android ships Arial Narrow, so until Big Shoulders loads, "ONE FILM. TWO OF YOU." on the setup sign is drawn in plain Arial, far wider, then jumps. It's brief on a good connection, but it's on the first screen of the first session, which the brief says decides whether people come back. This doesn't change the font, only the stand-in.

| Before | After | Why |
| --- | --- | --- |
| `["Arial Narrow", "Arial", "sans-serif"]` | `["Avenir Next Condensed", "Roboto Condensed", "sans-serif-condensed", "Arial Narrow", "sans-serif"]` | A condensed stand-in on both platforms, so the swap barely moves. Check first paint on a throttled connection |

---

## Open for Lasse

- Part A, change 1: the wrap button reads "Lock my swipes" instead of "Pass the phone", so the fan is gone before the phone moves.
- Part A, no-likes lines: OK as written?
- Whether items 2 and 5 to 15 become one D7 "finish" brief after D6, or ride inside D6. If D7, fold in the mobile-native audit's design-brief items so Arthur builds one finishing pass, not two.
