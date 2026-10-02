# Otto review · Design pass 2 (Picture Palace) · D1 to D5

*2 Oct 2026 · Reviewer: Otto · Commits fae596a..628deee · Brief: `docs/decisions/2026-10-01_design-pass-2-build.md`*

## Verdict

**Accepted.** The live game matches the boards closely and feels like one premium system. Next: Lasse plays it on his phone, then one polish round (D6) with his feedback and the points below, then Cato.

## What I checked

- Scope: nothing changed under `lib/` or `app/api/` since 21dff29. One new dependency (`motion`), as approved.
- `npm test` 164/164, `npx tsc --noEmit` and `npm run lint` clean on a fresh checkout.
- No em dashes in user-facing copy (the only ones left are inside the eval judge's prompt, which users never see).
- A full scripted game on the live site at 390 x 844: setup, Round 1, both hand-offs, the countdown loaders with quotes, Round 2, Round 3, a bridge, the curtain and the match. No page errors. Total about 70 s including bot pauses.
- The "Not sure" control is the same size and weight as the other two.

## Rulings on Arthur's questions

1. **Uncropped poster pushes the Watch button below the fold.** Lasse's call after he plays it. On a real phone the browser bars take another 100 to 180 px, so at the moment the reason line, the tags and the Watch button all sit below the fold. Otto recommends keeping the whole poster (it's the film's own art) but making the card smaller, so the title and the Watch button show without scrolling.
2. **Raw match tags** ("gritty-realist", "redemptive-dark"). Agreed, engine work. A blind text swap would break real words like "feel-good". Fix in the prompt instead (ask for plain one or two word tags). Logged for the engine follow-up after E4.
3. **Extra poster download for the colour strip.** Accepted.
4. **Off-board copy.** Reviewed, all fine.
5. **Off-board accessibility tweaks** (full cream curtain hint, 44 px genre buttons, signal red on large text only). Accepted.
6. **Nearest font names.** Accepted.
7. **AI timeout margin.** Real risk. The browser gives up on `/api/infer` at 15 s (`REQUEST_TIMEOUT_MS`), the call already takes 10 to 13 s, and embeddings add retrieval time before it. Otto recommends raising the limit to 25 s as part of E4 (engine change, Lasse to OK).
8. **`Movie Match/.claude/launch.json`** outside the repo. Harmless.
- **Design-hook ignore** in `.impeccable/config.local.json` (curtain fringe). Fine; it stays local.
- **Skip and Start over left off.** Correct call.

## For the polish round (D6), after Lasse plays it

- The match card and Watch button (point 1).
- Long service names truncate in the setup grid ("Amazon ...", "Paramo..."). Show short display names (Prime Video, Paramount+) in the component.
- Round 2 cards: the poster's own title art shows through behind our title and the controls (Shawshank, Ariel). A slightly stronger bottom scrim would calm it.
- Anything Lasse finds on his phone.

## Status note

No `embeddings.retrieval` lines in the live logs over the last 24 h, so the flag isn't on yet: the Vercel variables still need adding and a redeploy.
