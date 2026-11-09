# Arthur · Mobile-native audit

*7 Nov 2026 · Read-only audit, no code changed · Scope: every screen in `components/`, plus `app/layout.tsx` and `app/globals.css` · Target: iOS Safari and Android Chrome, one phone passed between two people in a dim room*

## Summary

The Picture Palace build already gets several of the classic tells right. Tailwind v4 kills the tap flash and gates `hover:`. Motion's `drag` protects the swipe card from long-press. No input is small enough to zoom the page, and nothing disables zoom.

What is left is mostly about the handover and the browser chrome. The worst risk is that **the whole game lives in memory** (`GameProvider.tsx:14`, a plain `useReducer`, nothing stored anywhere). Any reload sends both players back to setup with every pick gone, and the page currently lets a downward drag pull-to-refresh it. The second risk is that **a double tap carries through to the next screen**: it can skip the pass-the-phone gate, or lock a Round 3 turn at zero picks.

Everything below is read from the code. Nothing was run on a phone; the in-app browser is desktop Chromium and reproduces none of this. Each item says what still needs a real device.

**"Design brief"** below means the fix only touches `components/`, `app/globals.css` or `app/layout.tsx` (CLAUDE.md rule 10). Two items don't fit that and are marked **Ask first**.

## Ranked findings

| # | Issue | Hurts the night by | Design brief |
|---|---|---|---|
| 1 | Pull-to-refresh and rubber band can reload the page mid-game | Game lost, start over | Yes |
| 2 | A double tap lands on the next screen's button | Gate skipped, or a turn locked at 0 picks | Yes |
| 3 | Bottom buttons sit in Safari's collapsed-toolbar strip; layout jumps when the bar toggles | First tap eaten, button moves under the thumb | Yes |
| 4 | Game state only lives in memory | Any reload, tab eviction or back swipe loses the game | **Ask first** |
| 5 | Long-press selects the handover headline, previews links, opens image menus | "This is a website" moment during the handover | Yes |
| 6 | The "This vibe" card makes the page wider while it flies | Page can slide sideways between swipes | Yes |
| 7 | Text buttons give no feedback on touch | "Did that work?" taps on Play again, Start over | Yes |
| 8 | After an accidental pinch, double-tap zoom and the tap delay come back | Zoomed, laggy game after an awkward grab | Yes |
| 9 | No `color-scheme: dark` | Light region picker, white flash on reload | Yes |
| 10 | Not installable (optional) | Keeps all the browser chrome above | **Ask first** |
| 11 | Hover gate is `(hover: hover)` only (optional) | Rare sticky hover on stylus Androids | Yes |

---

### 1. Pull-to-refresh can reload the page mid-game

**Where**
- `app/globals.css:43`: no `overscroll-behavior` anywhere.
- `components/Round2Screen.tsx:193`: the controls row is `absolute inset-x-0` and takes pointer events across the card's full width.
- `components/Round2Screen.tsx:155`: the deck area around the card.

**Why it matters here.** Down is a real swipe ("Not sure"). A drag that starts *on* the card is safe, because Motion sets `touch-action: none` on it (`framer-motion/dist/es/render/html/use-props.mjs`). A drag that starts anywhere else goes to the browser. That includes the bottom strip of the card where the three controls sit, which is about 85 px tall and spans the card's full width. One-handed, that strip is exactly where the thumb rests.

At the top of the page, a downward drag means pull-to-refresh on Android Chrome, and the rubber band plus pull-to-refresh on iOS Safari. The same thing happens in Round 3, where the 8-row list scrolls and an overshoot past the top reloads the page. Because of item 4, a reload means starting the whole game over.

**Fix**

```css
/* app/globals.css, inside @layer base */
html,
body {
  overscroll-behavior: none; /* no pull-to-refresh, no rubber band: a reload loses the game */
}
```

Then make the gaps between the controls part of the card, so a thumb at the bottom of the card drags it:

```tsx
// Round2Screen.tsx:193
<div className="pointer-events-none absolute inset-x-0 bottom-[18px] z-10 flex justify-center gap-7">

// Round2Screen.tsx:368 (Control's button), add pointer-events-auto
className="pointer-events-auto group flex min-w-16 flex-col items-center gap-[7px] text-[12px] font-semibold text-cream"
```

Don't put `touch-action: none` on the whole deck. In landscape the deck is taller than the screen, and that would stop people scrolling down to reach the buttons.

**Needs a phone.** Android: the code says this kills pull-to-refresh. iOS: Safari 16+ supports `overscroll-behavior` on the root, but confirm it stops the bounce and refresh on your iOS version.

---

### 2. A double tap lands on the next screen's button

**Where**
- `components/PassPhone.tsx:66`: the gate's button can be tapped the moment it renders.
- `components/Round1Screen.tsx:126`, `components/Round2Screen.tsx:142` and `components/Round3Screen.tsx:144`: each screen's last button sits in the same bottom slot as the gate's.

**Why it matters here.** Player 1 double-taps "Lock my picks" or "Done, pass the phone". The first tap swaps in the gate in the same frame, and the second tap lands on "I'm Player 2" in the same place. Player 2's turn then opens in Player 1's hands, which is the "no peeking" moment the gate exists for.

It also works in the other direction. If the AI result is already back, "I'm Player 1" goes straight into Round 3. When the shortlist is short, the "Lock my picks" ticket sits in the bottom slot and is live at 0 picks by design (`Round3Screen.tsx:141`), so the second tap submits an empty turn the player never saw. Round 2 already guards between cards (`MIN_ON_SCREEN_MS`, `Round2Screen.tsx:34`). The screen-to-screen hops have no guard.

**Fix.** Add one small hook to `palace.tsx` and use it on the buttons that change who holds the phone:

```tsx
// components/palace.tsx (add useEffect, useState to the react import)
/** Ignores taps for a moment after a screen appears, so the second tap of a double
 * tap on the previous screen's button can't land on this one. */
export function useArmed(ms = 450) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return armed;
}
```

```tsx
// PassPhone.tsx: add "use client" at the top, then
const armed = useArmed();
<button type="button" className={brassCta} onClick={() => armed && onReady()}>

// Round3Screen.tsx (PlayerPicks) and Round2Screen.tsx's done screen: same guard on lockIn / finishTurn.
```

The button looks normal the whole time. It just ignores taps for 450 ms. Round 1's ticket doesn't need the guard, because it stays disabled until two picks are made.

**Needs a phone.** Confirm the double tap is caught and that a normal single tap never feels ignored.

---

### 3. Bottom buttons sit in Safari's collapsed-toolbar strip, and the layout jumps when the bar toggles

**Where**
- `app/layout.tsx:55-57`: no `viewportFit`, so every `env(safe-area-inset-*)` is `0`.
- `components/GameScreen.tsx:24`: `min-h-dvh` with a flat `py-6`.
- `components/MatchScreen.tsx:163`: "Tap to raise the curtain" uses a fixed `pb-[34px]`.

**Why it matters here.** Every main button sits at the bottom of the screen (`mt-auto` inside `min-h-dvh`). Scrolling Round 3 collapses Safari's toolbar, and it stays collapsed on the next screen. Then:

- `dvh` grows, so the gate's "I'm Player 2" moves down into the strip where the minimized address bar and home indicator sit, with only 24 px of padding.
- A tap there tends to bring Safari's toolbar back instead of pressing the button. The bar then expands, `dvh` shrinks, and the button jumps up under the second player's thumb. They tap again and miss.
- On short phones (SE, mini) the swipe deck's height also follows `dvh`. `useCardSize` (`Round2Screen.tsx:399`) then resizes the card between swipes.

**Fix.** Let the page reach the edges, size the room to the *smallest* viewport so nothing moves when the bar toggles, and pad the content clear of the home indicator:

```ts
// app/layout.tsx:55
export const viewport: Viewport = {
  themeColor: "#0e0a09",
  colorScheme: "dark", // item 9
  viewportFit: "cover",
};
```

```css
/* app/globals.css, inside @layer components */
/* The room: the smallest viewport, padded clear of the notch and the home indicator. */
.pp-room {
  min-height: 100svh;
  padding-top: calc(1.5rem + env(safe-area-inset-top, 0px));
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
  padding-left: max(1.25rem, env(safe-area-inset-left, 0px));
  padding-right: max(1.25rem, env(safe-area-inset-right, 0px));
  overflow-x: clip; /* item 6 */
}
```

```tsx
// GameScreen.tsx:24 (replaces min-h-dvh px-5 py-6)
<main className="pp-room flex flex-col">

// MatchScreen.tsx:163
... pb-[calc(34px_+_env(safe-area-inset-bottom))]
```

Why `svh` and not `dvh`: this is a page that grows with its content, not a fixed shell. With `svh` the bottom buttons are always laid out above the full toolbar, so they never sit in the strip and never move when the bar changes. The cost is a band of empty black below the button while the bar is collapsed, which is invisible against the room.

**Needs a phone.** All of it. Emulation shows no toolbar and no home indicator.

---

### 4. Game state only lives in memory

**Where:** `components/GameProvider.tsx:14`. A search for `sessionStorage`, `localStorage`, `pagehide` and `pushState` found nothing in `components/`, `lib/` or `app/`.

**Why it matters here.** Item 1 closes the most likely way to reload by accident, but not all of them:
- iOS can reload a background tab when someone checks a message mid-game.
- A swipe from the left edge on iOS (or either edge with Android gestures) goes back, and the app has no history entry of its own to land on.
- People sometimes reload on purpose when an AI wait feels stuck.

Each of these sends both players back to setup with every pick gone. Even after the CSS fixes, this is the biggest single thing that can ruin the night.

**Fix (shape, not code).** Save `GameState` to `sessionStorage` on every change, and restore it after mount. Restoring after mount avoids a hydration mismatch, because the server always renders setup. That needs a new `RESTORE` action in `lib/gameMachine.ts`, which is engine code, alongside the `GameProvider` change in `components/`.

Two decisions for Otto:
- **Where a restored game resumes.** In-progress picks inside a turn live in component state, so the natural resume point is the start of the current player's turn, behind the gate.
- **Whether this sits alongside the "Saved streaming services" backlog item,** which also plans to use device storage.

**Brief:** **Ask first.** It needs both `lib/` and `components/`, which rule 10 says to stop and ask about, and it changes game behaviour rather than design.

---

### 5. Long-press selects the handover headline, previews links, opens image menus

**Where**
- `components/PassPhone.tsx:42`: the 76 px "Pass the phone to Player N" headline fills most of the screen.
- `components/MatchScreen.tsx:96` and `:207`: the "Watch on X" and runner-up links.
- `components/Round3Screen.tsx:189` and `components/SetupScreen.tsx:151`: posters and logos inside buttons.
- Labels on every button, chip and row.

**Why it matters here.** When the phone is handed over, the receiving player often holds a thumb on the screen while getting a grip. On the gate screen, that thumb is on the headline. iOS and Android then select a word, show the loupe and selection handles, and pop "Copy / Look Up".

On the match screen, a long-press on "Watch on Netflix" opens iOS's link preview of the JustWatch page. In Round 3, holding a row while deciding can open the image menu on its poster thumbnail. The swipe card is already protected by Motion's drag styles, and its poster has `draggable={false}`, `pointer-events-none` and `select-none` (`Round2Screen.tsx:389-393`).

**Fix.** Controls are not text:

```css
/* app/globals.css, inside @layer base (layered, so a utility can still opt back in) */
:where(button, a, label, select, [role="button"]) {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none; /* no link preview or image menu on iOS */
}
```

Then add `select-none` to the roots of the play screens, where nothing is worth copying:
- `PassPhone.tsx:35`
- `Round1Screen.tsx:93`
- `Round2Screen.tsx:129` and `:152`
- `Round3Screen.tsx:111`

Leave the match screen, notices, errors and the loader quote selectable: a title or a quote is content someone might copy. Never put it on `body`. Android Chrome's long-press menu on links is not affected by `-webkit-touch-callout`; that one is acceptable.

**Needs a phone.** The callout and link preview are iOS-only behaviour.

---

### 6. The "This vibe" card makes the page wider while it flies

**Where:** `components/Round2Screen.tsx:301` (exit `x: w * 1.3`) and the drag itself. No ancestor clips overflow.

**Why it matters here.** A transformed element counts toward the page's scrollable area. So every right swipe makes the page about 450 px wider for the 560 ms flight. In that window, a quick next drag that starts beside the card can slide the whole page sideways. The page then snaps back when the card unmounts.

**Fix.** `overflow-x: clip` on the room (already in the `.pp-room` block in item 3). Use `clip`, not `hidden`. `clip` doesn't create a scroll container, so vertical scrolling and the fixed curtains, grain and spotlights are unaffected. The card is clipped at the screen edge, where it disappears anyway.

**Needs a phone.** The sideways slide only shows on touch.

---

### 7. Text buttons give no feedback on touch

**Where:** `components/palace.tsx:42` (`textButton`), `components/MatchScreen.tsx:114` and `:126`.

**Why it matters here.** Their only state is `hover:text-bulb`. Tailwind v4 gates that behind `(hover: hover)`, so on a phone there is none, and the tap flash is already off. "Play again", "Start over and add a service" and "See N other matches" give nothing until the screen changes. Every other control has an `active:` press.

**Fix:** add `active:text-bulb` next to each `hover:text-bulb`. The existing `transition-colors` (150 ms) is already the right speed.

**Needs a phone.** Confirm the press shows. iOS only paints `:active` when a touch listener exists up the tree. React's root listeners should cover it, and the other buttons' press scale will show the same thing.

---

### 8. After an accidental pinch, double-tap zoom and the tap delay come back

**Where:** `app/globals.css`, with no `touch-action` outside the swipe card.

**Why it matters here.** Next's default viewport (`width=device-width, initial-scale=1`) gives fast taps with no double-tap zoom at normal scale. But two fingers on the glass during a clumsy handover can pinch-zoom the page. Once zoomed in, browsers turn double-tap zoom back on, along with the delay that comes with it. Quick chip toggles in Round 1 then zoom the page further, and on a black screen it's hard to tell you're zoomed.

**Fix**

```css
/* app/globals.css, inside @layer base */
html {
  touch-action: manipulation; /* pan and pinch stay; double-tap zoom and its delay go */
}
```

Pinch zoom stays on purpose. Never add `maximum-scale` or `user-scalable=no`. Recovery from a pinch is a pinch out.

**Needs a phone.**

---

### 9. No `color-scheme: dark`

**Where:** `app/layout.tsx:55`, and `components/SetupScreen.tsx:99` (`<option className="text-[16px] text-projection">`).

**Why it matters here.** The browser assumes a light page until told otherwise. The region picker opens light on Android. A reload paints white for a moment before the CSS arrives, which is harsh in a dark living room.

Once `colorScheme: "dark"` is set (item 3's viewport block), the option text must change too. Near-black `text-projection` on a dark picker is unreadable in desktop Chrome, which respects option colours.

```tsx
// SetupScreen.tsx:99
<option key={r.code} value={r.code} className="bg-aisle text-[16px] text-cream">
```

**Theme colour.** `themeColor: "#0e0a09"` matches the body, so Android Chrome's address bar already blends in. One value is right because the app is dark-only. Recent iOS Safari tints its bars from the page's own background and fixed elements rather than `theme-color`. The body is the same black, so that should match too. The match screen's fixed velvet valance may tint the toolbar oxblood, which would suit it; check on the phone.

**Needs a phone** for the picker and the tint.

---

### 10. Not installable (optional)

**Where:** no `app/manifest.ts`, no `appleWebApp` in `app/layout.tsx:49`.

**Why it matters here.** Game night usually runs on one person's own phone. If Lasse adds Movie Match to that phone's home screen once, it opens full screen every time. There is no address bar to collapse (item 3), no pull-to-refresh (item 1), and no history to swipe back through (item 4), and on Android it can be locked to portrait.

**Fix (shape).**
- **`app/manifest.ts`:** `display: "standalone"`, `orientation: "portrait"`, `background_color` and `theme_color` set to `"#0e0a09"`, plus 192 and 512 px icons.
- **`app/layout.tsx` metadata:** `appleWebApp: { capable: true, title: "Movie Match", statusBarStyle: "black-translucent" }`.
- **Status bar:** with a translucent status bar the page runs under it, so item 3's `safe-area-inset-top` padding becomes required. The match screen's fixed valance (`MatchScreen.tsx:145`) also needs `padding-top: env(safe-area-inset-top)`.

**Brief:** **Ask first.** `app/manifest.ts` and the icons in `public/` are outside both of rule 10's file lists, and it's a product call.

---

### 11. Hover gate is `(hover: hover)` only (optional)

**Where:** `components/palace.tsx:40` and `:42`, `components/MatchScreen.tsx:114` and `:126`.

**Why it matters here.** Tailwind 4.3.1 compiles `hover:` to `@media (hover: hover)` (checked in `node_modules/tailwindcss/dist`). So iPhones and nearly all Androids never get a stuck hover. A few stylus Androids report `hover: hover` with a coarse pointer and can stick. Low stakes, since the only hover effect is a text colour.

**Fix (only if you see it):**

```css
/* app/globals.css */
@custom-variant hover {
  @media (hover: hover) and (pointer: fine) {
    &:hover {
      @slot;
    }
  }
}
```

---

## Checked and fine

| Concern | Why it's fine | Evidence |
|---|---|---|
| Gray/blue tap flash | Tailwind v4 preflight sets `-webkit-tap-highlight-color: transparent` on `html`, and it inherits | `node_modules/tailwindcss/preflight.css:45`; present in the built CSS |
| Inputs zooming the page | Region select is 28 px, options 16 px; renting is a checkbox; services are buttons; there are no text inputs | `SetupScreen.tsx:96`, `:99`, `:194` |
| Sticky hover on iPhone | Tailwind v4 wraps every `hover:` in `@media (hover: hover)`; no raw `:hover` in `globals.css` | item 11 |
| Long-press or ghost-drag on the swipe card | Motion's `drag` sets `user-select`, `-webkit-touch-callout`, `touch-action: none` and `draggable=false` | `framer-motion/.../use-props.mjs`; `Round2Screen.tsx:389-393` |
| 300 ms tap delay at normal zoom | Next's default viewport is `width=device-width, initial-scale=1` | `next/dist/lib/metadata/default-metadata.js` |
| Zoom disabled | No `maximum-scale` or `user-scalable=no` anywhere. Keep it that way | `layout.tsx:55` |
| Landscape text inflation | Preflight sets `-webkit-text-size-adjust: 100%` | `preflight.css:31` |
| Double tap deciding a card nobody saw | `MIN_ON_SCREEN_MS` plus `leavingRef` | `Round2Screen.tsx:34`, `:110` |
| Address bar colour on Android | `#0e0a09` matches the body | `layout.tsx:56`, `globals.css:44` |

## All the CSS and meta in one place

For whoever builds the design slice. This is items 1, 3, 5, 6, 8 and 9; items 2 and 7 are class or hook edits in the components named above.

```ts
// app/layout.tsx
export const viewport: Viewport = {
  themeColor: "#0e0a09",
  colorScheme: "dark",
  viewportFit: "cover",
};
```

```css
/* app/globals.css */
@layer base {
  html {
    touch-action: manipulation;
  }
  html,
  body {
    overscroll-behavior: none;
  }
  :where(button, a, label, select, [role="button"]) {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
}

@layer components {
  .pp-room {
    min-height: 100svh;
    padding-top: calc(1.5rem + env(safe-area-inset-top, 0px));
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
    padding-left: max(1.25rem, env(safe-area-inset-left, 0px));
    padding-right: max(1.25rem, env(safe-area-inset-right, 0px));
    overflow-x: clip;
  }
}
```

---

## 5-minute device checklist

Run it once on the iPhone (Safari) and once on the Android phone (Chrome), in a normal browser tab, not installed, portrait. Go in game order, so one play-through covers everything.

The easiest way to test is the Vercel preview of the fix branch. Over LAN with `npm run dev -- -H 0.0.0.0` also works, but Next 16 may block a phone's IP until it's in `allowedDevOrigins`. If something fails, attach Safari's Web Inspector (Mac Safari, Develop menu, your iPhone) or `chrome://inspect` for Android.

**Setup**
1. **(1)** At the top of setup, pull down hard and hold. *Pass:* no refresh spinner, no page bounce, no reload.
2. **(9)** Open "Screening in". *Pass:* the picker is dark and every country is readable.
3. **(fine)** Tap a service tile. *Pass:* it dips and lights up, with no gray or blue box flashing over it.

**Round 1**
4. **(8)** Pinch-zoom in a little, then double-tap a mood chip. *Pass:* the chip toggles twice and the page does not zoom further. Pinch back out (zoom must still work).
5. **(2)** Pick two moods, then double-tap "Lock my picks" fast. *Pass:* you land on "Pass the phone to Player 2" and stay there.
6. **(5)** On that gate, press and hold the big headline for 2 seconds. *Pass:* no blue selection, no loupe, no Copy menu.

**Round 2**
7. **(1)** Put your thumb in the gap between "Not it" and "Not sure" and drag down. *Pass:* the card moves and stamps NOT SURE. The page itself never moves.
8. **(1)** Drag down on the empty area above the card. *Pass:* nothing reloads.
9. **(6)** Swipe a card right fast, then immediately drag sideways beside the next card. *Pass:* the page never slides sideways.
10. **(2)** On the last card, finish, then double-tap "Done, pass the phone". *Pass:* you stay on the gate.

**Round 3**
11. **(1)** Scroll down the list, then flick back up past the top. *Pass:* no reload.
12. **(3)** Scroll so Safari's toolbar shrinks, then tap "Lock my picks" once. *Pass:* one tap works, and the ticket sits clear of the home indicator.
13. **(3)** On the next gate, with the toolbar still small, tap "I'm Player 2" once. *Pass:* one tap works and the button does not jump.

**Match**
14. **(5)** Long-press "Watch on ...". *Pass (iPhone):* no link preview pops up. Long-press a runner-up poster: no image menu.
15. **(7)** Press and hold "See N other matches" or "Play again" without letting go. *Pass:* it turns yellow while held. Slide off before releasing so nothing happens.
16. **(9)** Look at the browser bars on setup and on the match screen. *Pass:* Android's address bar is the room's black. Note what colour the iPhone toolbar takes on the match screen.

**Once, anywhere**
17. **(3)** Rotate to landscape on Round 2. *Pass:* nothing sits under the notch, and you can scroll to the three buttons.

Anything marked *fine* that fails on the phone goes back to Otto as a new finding.
