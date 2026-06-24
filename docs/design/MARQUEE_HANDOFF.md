# Handoff: Movie Match — "Marquee" Premium Redesign

## Overview
This is a full visual redesign of the **Movie Match** app (the existing Next.js codebase in this repo). It replaces the default black-on-white Tailwind/Geist scaffold with a cinematic, premium aesthetic called **Marquee**: a dark "watching at night" canvas, champagne-gold accents, an editorial serif for emotional moments, and poster-forward cards.

**Scope of work: restyle only.** The 3-round game logic — `GameProvider`/`useGame`, the `gameMachine` reducer, every `dispatch(...)` call, the AI/TMDB API routes, and the screen flow — **does not change**. You are rewriting `className` strings, a few wrapper elements, fonts, and the global theme tokens. Nothing in `lib/` and nothing in the `app/api/` routes should be touched.

## About the Design Files
The bundled `Movie Match — Redesign.dc.html` is a **design reference prototype built in HTML**, not production code to copy directly. It uses inline styles and a small runtime (`support.js`) purely so it renders standalone in a browser. **Do not import it or its inline styles into the app.** Your task is to **recreate its look inside the existing React + Tailwind v4 environment**, using this repo's established patterns (Tailwind utility classes, the `useGame()` hook, the existing component structure).

To view the reference: open the `.dc.html` file in a browser. There is a navigator pill at the bottom — click the dots to jump between screens (Setup → Vibes → Hand-off → Blend → Swipe → Read → Shortlist → Match). Note: the prototype runs as a single player for an easy click-through; in the real app the Player 1 → Player 2 hand-off (the "Pass the phone" screen) stays exactly as currently implemented.

## Fidelity
**High-fidelity direction, refine per screen.** Colors, typography, and the component language are final — match them. Exact pixel spacing on each screen can be adjusted to fit the real content and the existing responsive container; treat the prototype's layout as the intended result, not a literal measurement spec.

## Posters
**Keep real TMDB posters.** The prototype shows gradient placeholder tiles only because it has no TMDB access. In the real build, keep rendering the existing `<img src={posterUrl}>` (Round 2 card, Round 3 rows, Match hero, alternatives). Your job is to restyle the **frame** around each poster — border-radius, a hairline border, shadow, and the bottom gradient scrim + text overlay on the large cards. Where a poster is missing (`posterUrl == null`), fall back to a flat `bg-white/5` tile (as today), not a gradient.

---

## Design Tokens

Exact values — use these verbatim.

### Color
| Token | Value | Use |
|---|---|---|
| `--ink` | `#0a0810` | App background (deepest) |
| `--ink-2` | `#0e0c14` | Screen surface (top of gradient) |
| `--surface` | `rgba(245,241,232,0.03)` | Card / input fill |
| `--surface-2` | `rgba(245,241,232,0.07)` | Tag / chip fill |
| `--line` | `rgba(245,241,232,0.10)` | Hairline borders |
| `--gold` | `#E8C07D` | Primary accent, CTAs, selected states |
| `--gold-deep` | `#C99B53` | CTA gradient end |
| `--rose` | `#F0685A` | **Reserved for the "It's a match" peak only** |
| `--text` | `#F5F1E8` | Primary text (warm off-white) |
| `--muted` | `rgba(245,241,232,0.55)` | Secondary text |
| `--faint` | `rgba(245,241,232,0.40)` | Labels, captions |

Gold is the everyday accent. **Rose appears on exactly one screen — the Match reveal.** Don't spread it elsewhere; its scarcity is what makes the match moment land.

### Typography
- **Display** — `Instrument Serif`, weight 400, with an *italic* variant used for the emphasized word in each headline (e.g. *both*, *mood*, *like*, *watch*). Sizes: hero 42px / screen titles 32–34px / card titles 30px. Line-height ~1.05. This is the emotional voice — use it for H1/H2 and movie titles only.
- **UI** — `Hanken Grotesk`, weights 300–700. Body 14–15px, labels 11–12px uppercase with ~1.5px letter-spacing, buttons 15px/700.
- No emoji anywhere (the current app uses emoji — remove them; replace with the inline SVG icons described per screen, or simple line icons from your icon set).

### Shape & depth
- Radii: buttons/inputs `16px` (`rounded-2xl`), cards `14px`, large poster cards `18–22px`, chips/pills/tags `999px`.
- CTA shadow (gold buttons): `0 14px 34px -12px rgba(232,192,125,0.6)`.
- Poster card shadow: `0 30px 60px -24px rgba(0,0,0,0.9)`.
- Selected fill: gold at 8–14% alpha; selected border: `rgba(232,192,125,0.65–0.75)`.

---

## Setup — global theme (do this first)

### `app/layout.tsx` — fonts
Replace the Geist font setup with:
```tsx
import { Instrument_Serif, Hanken_Grotesk } from "next/font/google";

const display = Instrument_Serif({
  weight: ["400"], style: ["normal", "italic"],
  subsets: ["latin"], variable: "--font-display", display: "swap",
});
const sans = Hanken_Grotesk({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"], variable: "--font-sans", display: "swap",
});

// on <body>:  className={`${sans.variable} ${display.variable} antialiased`}
```

### `app/globals.css` — tokens
Replace the current `:root` / `@theme inline` / `body` block with:
```css
@import "tailwindcss";

:root {
  --ink: #0a0810;
  --ink-2: #0e0c14;
  --surface: rgba(245,241,232,0.03);
  --surface-2: rgba(245,241,232,0.07);
  --line: rgba(245,241,232,0.10);
  --gold: #E8C07D;
  --gold-deep: #C99B53;
  --rose: #F0685A;
  --text: #F5F1E8;
  --muted: rgba(245,241,232,0.55);
}

@theme inline {
  --color-ink: var(--ink);
  --color-gold: var(--gold);
  --color-rose: var(--rose);
  --color-text: var(--text);
  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
}

body {
  background: var(--ink);
  color: var(--text);
  font-family: var(--font-sans), system-ui, sans-serif;
}
```
Remove the `@media (prefers-color-scheme)` block — the app is always dark now. After this, `text-foreground`/`bg-background` usages should be migrated to `text-text` / `bg-ink` (or just use the CSS vars). Search the components for `foreground` and replace per the recipes below.

### `app/page.tsx` background
The app should sit on the cinematic backdrop. Wrap the game (in `GameScreen.tsx`'s `<main>`, or `page.tsx`) so the page background is:
```
radial-gradient(120% 90% at 50% -10%, #16131f 0%, #0a090f 45%, #060509 100%)
```
Optional polish (matches the prototype): a soft gold radial glow blurred behind the content, and a faint SVG `feTurbulence` grain overlay at ~5% opacity, `mix-blend-mode: overlay`. Both are decorative `pointer-events-none` layers.

---

## Reusable class recipes
Define these once (as string consts like the existing `primaryBtn`, or `@utility` in globals.css) and reuse:

- **Gold CTA** (`primaryBtn` replacement):
  `w-full rounded-2xl px-6 py-4 text-[15px] font-bold text-ink transition active:scale-[0.98]` + inline style `background: linear-gradient(150deg,#E8C07D,#C99B53); box-shadow: 0 14px 34px -12px rgba(232,192,125,.6)`. Disabled state: `bg-white/[0.08] text-white/30 shadow-none`.
- **Eyebrow label**: `text-[11px] uppercase tracking-[1.5px] text-gold` (or `text-white/45` for neutral labels).
- **Pill badge** (round headers): `text-[11px] uppercase tracking-[1.5px] text-gold border border-gold/35 rounded-full px-3 py-[5px]`.
- **Selectable chip** (Round 1): base `rounded-full px-[15px] py-2.5 text-[13.5px] font-medium border transition`; unselected `border-white/12 bg-white/[0.03] text-text`; selected `border-gold/75 bg-gold/[0.14] text-gold`.
- **Tag**: `text-[10–11px] rounded-full px-2.5 py-1 bg-white/[0.07] text-white/60`.

---

## Screens / Views

### 1. SetupScreen.tsx
- **Layout**: vertical, flex column, `min-h-full`, body scrolls, CTA pinned at bottom.
- **Header**: 30px rounded-9px gold gradient logo chip (clapperboard SVG in ink) + "Movie Match" 15px/600.
- **Hero**: gold eyebrow "TONIGHT, TOGETHER" → `Instrument Serif` headline "One film you ***both*** actually want." (italic gold on *both*) → muted subcopy.
- **Region**: keep the `<select>` and its logic; restyle as a `rounded-2xl border-white/12 bg-white/[0.03]` field, 13px padding, gold chevron. (A custom dropdown is optional.)
- **Services grid**: keep the providers fetch + `TOGGLE_SERVICE` dispatch. 2-col grid, 9px gap. Each tile: `rounded-2xl` row, left a 24px rounded-7px brand swatch (use the TMDB `logoUrl` image clipped into the swatch, or a brand-color block), name 13px/500, and a gold check SVG when `selected`. Selected tile: `border-gold/70 bg-gold/10`; unselected `border-white/10 bg-white/[0.03]`. Drop the current `✓` emoji badge and `ring-2` look.
- **Willing-to-pay**: keep the checkbox logic but present as a custom toggle row — title "Open to renting tonight?", subcopy, and a 46×27 pill toggle (gold track + ink knob when on). Selected row tints `border-gold/50 bg-gold/[0.07]`.
- **CTA**: gold button "Start the night". Disabled (`!canContinue`) → faint style. Keep the `COMPLETE_TURN` dispatch.

### 2. Round1Screen.tsx (Vibes)
- Keep `CATEGORIES`, `MIN_PICKS`/`MAX_PICKS`, `toggle`, `lockIn`, the pass-the-phone gate, all dispatches.
- **Header row**: pill badge "Round 1 · Player {n}" + a 3-segment progress indicator (current segment gold, rest `white/16`).
- **Title**: serif "What's the ***mood*** tonight?" + "Pick two or three. `{selected.length} / 3`" (gold count).
- **Chips**: replace the 2-col grid + emoji buttons with **wrapping pill chips** (flex-wrap, 9px gap) using the Selectable-chip recipe. Remove emoji. At-max unselected chips → `opacity-35`.
- **CTA**: gold, label "Done — pass the phone" (P1) / "Lock in picks" (P2); disabled until 2 picked.
- **Pass-the-phone gate**: centered. Pulsing concentric gold rings around a floating rounded phone-SVG icon, eyebrow "PICKS LOCKED · NO PEEKING", serif "Pass the phone to ***Player 2***", subcopy, gold "I'm ready" button. (Animations: ring `scale .7→1.5 / opacity .7→0` over 2.4s infinite, two staggered; icon gentle 3.5s float.)

### 3. BlendingScreen.tsx
- Keep the `/api/blend` effect and error handling untouched.
- **Loading**: centered. 96px ring spinner — a static `white/8` ring under a `transparent` ring whose top+right borders are gold, spinning 1.1s linear; clapperboard SVG centered inside. Serif "Blending your tastes…", muted subcopy, and the existing "Up next — Round 2" hint as a `rounded-2xl border-white/8 bg-white/[0.03]` card (left-aligned, gold eyebrow + serif-italic *vibe* in the line).
- **Error state**: same layout language, gold "Try again" button. Drop the 😕 emoji — use a small neutral icon or omit.

### 4. Round2Screen.tsx (Swipe)
- Keep `selectSwipeSamples`, swipe/skip/finish logic, the per-player gate, all dispatches.
- **Header**: pill badge "Round 2 · Swipe" + "`{i+1} / {n}`" muted.
- **Poster card**: large, `aspect-[2/3]`, `rounded-[22px]`, `border-white/10`, big shadow. **Keep the TMDB `<img>` filling it** (object-cover). Over it: a bottom-up black gradient scrim, a top-left genre kicker pill (backdrop-blur, `border-white/25`), and bottom overlay with serif title (30px), year (12px muted), and tag pills. Below the card: centered "In the mood for something ***like*** this?" (serif-italic *like*).
- **Action row**: three buttons — `Not it` (outline `border-white/18 bg-white/[0.03]`, X icon), `Skip` (ghost, tiny, `text-white/40`, maps to the existing neutral/skip), `This vibe` (gold gradient, heart icon). Keep the existing yes/no/neutral semantics.
- **Done panel**: gold check in a soft gold circle, serif "That's the read.", summary line ("{n} titles you're into · {m} passed"), gold "See where you land".

### 5. InferringScreen.tsx
- Keep the `/api/infer` effect + error handling.
- Same loader language as Blending **but the spinner ring + center icon use `--rose`** (this is the "reading the mood / love" beat — the one place besides Match where rose appears) with a sparkle/star SVG. Keep the `<LoadingQuote>` — restyle the blockquote as `Instrument Serif` italic 19px, figcaption `text-white/40`.

### 6. Round3Screen.tsx (Shortlist)
- Keep `selectWatchable`, the offer-rentals / none end-states, `toggle`, `lockIn`, all dispatches.
- **Header**: pill "Round 3 · Shortlist" + 3 filled gold progress segments. Serif "Which would you ***watch***?" + "Tap every title you'd be up for. `{n} selected`".
- **Rows** (`RecRow`): `rounded-2xl` selectable row. **Keep the TMDB poster** thumbnail (46×66, `rounded-lg`, `border-white/10`). Title 14.5px/600 with muted ` · year`, tag pills, and the availability `labelText(label)` in **gold** 11.5px. Right side: a 22px round check — gold-filled with ink check when selected, else `border-white/25`. Selected row: `border-gold/65 bg-gold/[0.08]`.
- **CTA**: gold "Find your match", disabled until ≥1 selected.
- **Rental / none / offer states**: keep logic; restyle with the same centered language + gold buttons. Replace emoji headers with small icons or omit.

### 7. TiebreakScreen.tsx
- Same treatment as Inferring/Round3 states: rose-tinted loader for "finding common ground", gold buttons on the recoverable states. Logic untouched.

### 8. MatchScreen.tsx (the peak — rose allowed here)
- Keep `evaluateAvailability`, `labelFor`, alternatives, JustWatch links, `RESET`.
- **Backdrop**: a soft **rose** radial glow blurred behind the hero (decorative), gentle pulse.
- **Badge**: rose pill "♥ IT'S A MATCH" (`border-rose/40 bg-rose/10 text-rose`, heart SVG). For the bridge case (`reason !== "overlap"`) use a gold "YOUR BRIDGE PICK" pill instead and keep gold-only styling.
- **Hero poster**: ~188px wide `aspect-[2/3]`, `rounded-[18px]`, `border-gold/30`, big shadow, gentle float. **Keep TMDB `<img>`.** Top-right: `{matchPercent}%` chip (ink/blur, `border-gold/40`, gold text).
- **Title block**: serif title 34px, "`{year} · {matchPercent}% match`" muted, centered match tags, then the `reason` line ("You both picked it — settle in." / bridge copy) as muted body.
- **Watch CTA**: gold gradient button "Watch on {provider}" with an external-link arrow, linking to `justWatchLink`. Keep the existing where-to-watch label logic to derive the provider name.
- **Alternatives** ("Or also…"): gold eyebrow + rows — TMDB thumb (38×54), title 13.5px/600, "`{percent}% match · {tags}`" muted, external-link arrow → `justWatchLink`.
- **Play again**: outline button (`border-white/15`, transparent), `RESET`.

---

## Interactions & Behavior
- **Selected states** transition `all .18s ease`; buttons `active:scale-[0.98]`.
- **Loaders**: ring spinner 1.1s linear infinite; hand-off rings 2.4s ease-out infinite (staggered 1.2s); float 3.5–5s ease-in-out infinite. All decorative; respect `prefers-reduced-motion` (the current code already uses `motion-safe:` — keep that pattern).
- **Screen entrance**: the prototype intentionally has **no** opacity/transform entrance animation on screen wrappers (it caused flicker under re-render). If you want entrance motion in React, drive it with a mount transition (e.g. Framer Motion / CSS that doesn't restart on every render) — do not put a one-shot `@keyframes` with `opacity:0` start directly on a frequently re-rendered wrapper.
- Navigation, validation rules (min picks, canContinue), error/empty/end states: **all already implemented — preserve exactly.**

## State Management
No changes. State lives in `GameProvider` via the `gameMachine` reducer; screens read with `useGame()` and advance with `dispatch(...)`. Restyling must not alter any `dispatch` type, payload, or the `Phase` flow.

## Assets / Icons
- Replace all emoji with inline SVGs (clapperboard, phone, check, heart, X, chevron, external-link arrow, sparkle) — see the prototype's SVG markup for ready-to-lift paths, or use your preferred icon library (e.g. lucide-react) with these colors.
- Fonts: Google Fonts `Instrument Serif` + `Hanken Grotesk` via `next/font/google` (above).
- Posters / provider logos: existing TMDB image URLs — unchanged.

## Files
- `Movie Match — Redesign.dc.html` — the visual reference (open in a browser; use the bottom navigator to switch screens). `support.js` is just its runtime — **not** for the app.
- Target files to restyle in this repo: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, and `components/{SetupScreen,Round1Screen,BlendingScreen,Round2Screen,InferringScreen,Round3Screen,TiebreakScreen,MatchScreen,GameScreen,LoadingQuote}.tsx`. **Do not touch** anything in `lib/` or `app/api/`.
