# Otto review · Embeddings v1 · E3 (and the anon check)

*1 Oct 2026 · Reviewer: Otto · Commits 693099c..3d17c79 · Brief: `docs/decisions/2026-10-01_embeddings-v1-E3-addendum.md`*

## Verdict

**Accepted.** E3 matches the addendum. Lasse can flip `EMBEDDINGS_ENABLED` on the live game once the two Supabase variables are in Vercel. Then E4, then Cato.

## What I checked

- Read `lib/retrieve.ts` in full and the `lib/infer.ts` and `app/api/eval/route.ts` diffs.
- `npm test` 164/164, `npx tsc --noEmit` clean, `npm run lint` clean (clean checkout).
- Regression proof, spot-checked: removed the 1.5 s abort and both timeout tests fail (5 s); restored, green.
- The golden snapshot (dced47c) was committed alone, before any `lib/` change.
- Anon check: the publishable key is denied on `match_movies` and on the `movies` table. Good.
- Security: `server-only`; the service key never leaves the server; a new `sb_secret_` key goes in `apikey` only; ids are integer-filtered before they go into the query string; the eval override returns 404 in production.
- Fail safe: database errors, empty results and timeouts all fall back to today's path with one warning line. A TMDB error during the availability checks lands in the same catch.
- Log line: counts, similarities and timings only. No titles, ids or personal data.

## Rulings on Arthur's questions

1. **E-9 changes flag-off output.** Correct reading. The addendum asked for both "off means today exactly" and "E-9 with or without the flag"; that conflict was mine, and E-9 wins (it is Lasse's rule). The golden shows nothing else moved. Both gaps Arthur found were real.
2. **An own "Not it" can still reach a player as the other player's pick.** Correct. The rule bars padding, not the partner's pick. In practice it is moot today: the two players never see the same Round 2 cards (0 shared across the 18 eval pools).
3. **The tiebreak bridge ignores Round 2 "Not it" swipes.** Real gap, out of scope here. Logged in the backlog. The fix needs `TiebreakScreen` to send the rejections plus a change to `app/api/bridge` and `lib/bridge.ts`, so it mixes engine and design (CLAUDE.md rule 10). Lasse decides when; earliest sensible slot is after design pass D5, so `TiebreakScreen` isn't edited twice at once.
4. **The midpoint only sources films.** Correct, and it's the invariant (no midpoint winner selector).
5. **Fresh can take up to 6 of the 8 Round 3 slots.** Accepted as the E-2 dial. E4 must report it (below).
6. **Thin-service couples may get fewer than 6 fresh.** Accepted. Watch `selected` in the live logs.
7. **Liking Knives Out keeps Glass Onion out of the fresh picks.** Accepted. It's one film per franchise in the list, and the liked film is already there.

## Notes (no action now)

- The TMDB availability checks are outside the 1.5 s database timeout and can run in up to four back-to-back rounds. E4's latency numbers will show whether that matters.
- Lasse's `.env.local` line `SUPABASE_PUBLISHABLE_KEY:` needs `=` instead of `:`. Harmless today.

## E4 additions (on top of section 5 of the embeddings brief)

Report per arm (flag off vs on), on the 17 valid couples:

- Liked films (own and cross-player) that made the final 8, average per player.
- Fresh films in the final 8, average per player.
- The existing bars: no confirmed regression (gap -24 or worse), "fits both" stays 17/17, variety gain after availability, Claude cost per game.

Latency comes from the live game, not a preview: Otto reads the `embeddings.retrieval` log lines (`ms`) and the `/api/infer` durations in Vercel for flag-on games against earlier flag-off games.

## Next

1. Lasse: add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Vercel (Production), set `EMBEDDINGS_ENABLED=true`, redeploy, play one game.
2. Otto: confirm the `embeddings.retrieval` line in the live logs.
3. Arthur: E4 gate run.
4. Cato: E1 to E4 as one milestone.
