# Otto review · W1, warm the catalogue at game start

*9 Nov 2026 · Reviewer: Otto · Commit `f8c376f` (live) · Arthur's report: `docs/HANDOFF.md`*

## Verdict

**Accepted, and the live check passed.** D6 can start. Cato reviews W1 together with D6.

## What I checked

- Code: the blend route hands `warmCatalogue()` to Next's `after()`, so it runs after the response; flag off schedules nothing; the warm-up has its own 5 s cap, never throws and logs one line. One `match_movies` search, k = 1, fixed vector.
- `npm test` 180/180 and `npx tsc --noEmit` clean on a fresh checkout.
- **Live, cold:** no games for at least 55 minutes (9 Nov, 04:46 to 05:42 UTC). One scripted game at 05:42: the warm-up logged `ok` in 2.4 s right after the blend; 37 s later Round 3's catalogue step succeeded in 1.5 s, with no timeout. Before W1, the same situation fell back (7 Nov). One player had nothing eligible on their services (reason `empty`, by design).

## Open points

1. **One test, not a rate.** Arthur saw a search take 1.9 s from the Mac five minutes after the previous one, so the database may cool within minutes. A couple who take several minutes over Round 2 could still hit a cold search. Real couples usually take one to three minutes.
2. **The database is at the edge of its size.** Read-only check on 9 Nov: the database has 256 MB of shared memory (the 1 GB "Micro" size); the films table with its vectors is 249 MB, of which the search index is 118 MB. That's why it goes cold. Options if fallbacks show up: the next size up (a few dollars a month; Lasse decides, the exact price shows in Supabase before confirming), or preloading the index with `pg_prewarm` (available here, needs a migration, and doesn't stop the index being pushed out again on a 1 GB machine).
3. **We can't see the fallback rate yet.** Vercel's free plan keeps logs for only one hour. The event log in launch readiness (Track C) should record whether each game was served by the catalogue.

## Recommendation

Keep the database size as it is for now; the warm-up did its job in the cold test. Decide on upsizing once the event log shows how often real games fall back. Add "served by catalogue or not" to the event log's fields.
