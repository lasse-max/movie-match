# Movie Match · Design pass 2 · "Picture Palace" brief

*Owner: Lasse · Written by Otto · 30 Sep 2026 · Status: direction agreed in principle, prototype built, final design pending (Lasse via Claude Design or Figma)*

Take this brief to Claude Design or Figma. Bring back a final version that covers every screen listed in section 6. Otto then turns it into Arthur's build brief.

Prototype to react to: the "Movie Match Picture Palace" canvas (game flow you can tap through, share card, style sheet).

---

## 1. The product in one paragraph

Movie Match gets two people sharing one phone to a film they both want, in under three minutes. Setup (region, services, open to renting) → Round 1 (each picks moods/genres) → Round 2 (each swipes a few films: This vibe / Not sure / Not it) → Round 3 (each picks from a shortlist) → Match (or a bridge pick when there is no overlap), with where to watch it. Pass-the-phone gates sit between players. Two AI waits sit between rounds.

## 2. Why a second design pass

The current "Marquee" look (dark, champagne gold, Instrument Serif, tracked caps, gold gradient buttons) is competent but reads as the stock AI-premium template. Beta feedback: the first session decides whether people play again, so the first impression has to land. It should feel premium, with more flair.

## 3. The direction

**An old picture palace meets the mid-century two-colour poster.** Think velvet curtains, brass, marquee bulbs, table lamps in a dark auditorium, and bold flat Saul Bass-style posters in red, black and cream.

One system, three materials, each with one job:

| Material | Colour | Job |
|---|---|---|
| Light | Brass `#D6A24A`, Bulb `#FFE9B0` | Anything that glows or is pressed: CTAs, stamps, bulbs, the match |
| Fabric | House velvet `#B8141E`, Oxblood `#6E0B12`, Signal red `#E3312D` | Curtains, tickets, poster titles. Signal red is the contrast-safe red for text on black |
| Paper and the house | Poster cream `#F2E8D5`, Aisle `#17100E`, Projection black `#0E0A09` | Cards and posters are paper. The room is black. Raised surfaces step up in tone, no grey lines |

**Type** (all Google Fonts, free):
- Big Shoulders Display 900: headlines and film titles. Caps, tight.
- Big Shoulders Inline Display: marquee signage only (setup sign, valance, "It's a match").
- Libre Franklin: UI and body (a Franklin Gothic revival, the sans of old posters).
- Courier Prime 700: tickets, labels, credits. Caps, wide tracking, small.

**Texture:** light film grain over everything (about 8% opacity), cream "poster stock" on cards. No gradient washes except functional scrims on posters and the stage spotlight.

## 4. Signature moments (keep to these; one per moment)

1. **Setup sign.** A marquee board with chasing bulbs: "Tonight only / One film. Two of you." Under it, in plain words: "A quick 2-minute game. We use AI to match your moods to a movie you can both watch tonight." (Layout A2 on the canvas is the agreed setup.)
2. **ADMIT TWO ticket.** The start button is a ticket with a stub and notched edges. It suits a couples app.
3. **Physical swipe.** Real drag with a tilt; the card flies off with a rubber stamp (THIS VIBE / NOT SURE / NOT IT). Controls float over the poster, round, same size.
4. **Projector countdown.** An Academy-leader style 3-2-1 with sweep, crosshair, flicker and scratches. It loops while the AI works, so it hides the wait instead of adding one. Under it: a true fact from the couple's own pool (a TMDB tagline, year, director).
5. **The curtain.** On the match, a velvet curtain parts (about 1.9 s) under a valance that reads "Tonight's feature". Tap to open early.
6. **The poster card.** The match is shown as a collectible retro info card: the real poster, the title in big red caps, year, genre, runtime, where to watch, a colour strip taken from the poster, and a round brass "88% match" stamp. The same card is the share card (9:16 for stories).
7. **One delight:** a small popcorn burst as the curtain opens. Optional; cut it if it feels cartoonish.

**Dropped on purpose:** the burning dynamite fuse. It is a Western action image, not a cinema one, and the countdown already does the timer job. If a transition between rounds is wanted, use a "film burn" (the reel melting on screen), which fits the world.

## 5. Rules (non-negotiable for the build)

- **Real TMDB posters, framed.** Our graphics never replace a film's own art. Poster placeholders in the prototype are fictional films drawn in the house style.
- **Service picker (Lasse, 1 Oct):** a two-column grid with real TMDB logos, all services visible without scrolling. Tiles are tone-stepped, no borders; selected = brass ring and a check. Logos are muted until picked (greyscale with a slight warm tint, about 75% opacity), then full colour. Fast to scan beats clever.
- **Every fact on screen comes from TMDB.** No AI-written trivia (it invents things).
- **"Not sure" stays equal.** Same size and weight as the other two swipe choices. This is a data-integrity rule from fix #8, not a style choice.
- **Motion:** one entry curve `cubic-bezier(0.16, 1, 0.3, 1)` at 0.5 to 0.6 s; lists stagger 50 ms; press scales to 0.97; curtain `cubic-bezier(0.65, 0, 0.25, 1)` at about 1.9 s.
- **Short and skippable:** the big moments add under 5 s per game in total, and every one can be skipped on replay. The game stays under 3 minutes.
- **Reduced motion:** with the phone's reduce-motion setting on, every animation becomes an instant cut.
- **Accessibility:** touch targets at least 44 px; text contrast at least 4.5:1 (3:1 from 24 px); real buttons and labels.
- **Copy:** short and plain. No em dashes. No emoji.
- **IP:** inspired by picture palaces and mid-century posters only. No real poster artwork, no cinema names or logos (for example Electric Cinema), no lifted taglines.
- **Performance:** CSS and the Motion library (formerly Framer Motion), no video backgrounds. Must feel smooth on a mid-range phone.

## 6. What to bring back (so Arthur can build it)

Every screen and state, phone size (390 x 844), in this direction:

1. Setup (region, services, renting, ADMIT TWO)
2. Round 1: moods and genres picker (moods on top, per the backlog)
3. Pass-the-phone gate (to Player 2, and back to Player 1 at round boundaries)
4. Loader after Round 1 ("Blending your tastes"): projector countdown + pool fact
5. Round 2: swipe card, all three decisions, stamp states
6. Loader after Round 2 ("Reading the mood")
7. Round 3: the shortlist, multi-select, with availability labels ("Included with X", "Rent on X")
8. Tiebreak or bridge pick (no overlap), clearly labelled as a bridge
9. Match: curtain closed, curtain open, poster card, reasons, Watch CTA, runner-ups, play again
10. Share card, 9:16
11. Honest end-state ("nothing on your services tonight") with a light way back to setup
12. Error and retry state for an AI or network failure

Plus: the colour and type tokens as a table, and short notes on any motion that differs from section 5.

## 7. Open design questions for Lasse

- Keep the Round 1 "vibe" chips as plain text chips, or give them small poster-style icons?
- The share card: show the two players' names (typed at setup) or keep it anonymous?
- Popcorn burst: keep or cut after seeing it on a phone?
