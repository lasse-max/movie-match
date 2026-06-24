import { describe, it, expect, vi, beforeEach } from "vitest";

// infer.ts is server-only and calls Claude + TMDB recommendations; mock all
// three to unit-test the candidate assembly, AI validation, and fallback.
vi.mock("server-only", () => ({}));

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "test-model",
  getAnthropic: () => ({ messages: { create: createMock } }),
}));

const { recMock, providersMock, discoverMock, collectionMock } = vi.hoisted(() => ({
  recMock: vi.fn(),
  providersMock: vi.fn(),
  discoverMock: vi.fn(),
  collectionMock: vi.fn(),
}));
vi.mock("@/lib/tmdb", () => ({
  getRecommendations: recMock,
  getWatchProvidersForRegion: providersMock,
  discoverMovies: discoverMock, // provider-targeted Round 3 backfill
  getCollectionId: collectionMock,
  tmdbImageUrl: (p: string | null) => (p ? `https://img.test${p}` : null),
}));

const onNetflix = { link: "https://jw.test", flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: null, display_priority: 1 }] };
const rentOnly = { link: "https://jw.test", rent: [{ provider_id: 2, provider_name: "Apple TV", logo_path: null, display_priority: 1 }] };

import { inferMoods } from "@/lib/infer";
import type { PoolMovie } from "@/lib/blendTypes";

const pm = (id: number, over: Partial<PoolMovie> = {}): PoolMovie => ({
  id,
  title: `Pool ${id}`,
  year: "2010",
  overview: "",
  posterUrl: null,
  genreIds: [],
  voteAverage: 7,
  voteCount: 500,
  directionIndex: 0,
  directionTheme: "Dir A",
  collectionId: null,
  ...over,
});

const refusal = { stop_reason: "refusal", content: [] };
const aiInfer = (players: unknown[]) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify({ players }) }],
});

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockResolvedValue(refusal); // default: AI declines → deterministic fallback
  recMock.mockResolvedValue([]); // default: no fresh expansion
  providersMock.mockResolvedValue(null); // default: no availability data
  discoverMock.mockResolvedValue([]); // default: provider backfill finds nothing
  collectionMock.mockResolvedValue(null); // default: no franchise dedup
});

// A discover result (provider-targeted catalog hit), genre-anchored on Sci-Fi (878).
const dm = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  title: `Disc ${id}`,
  release_date: "2018-01-01",
  overview: "",
  poster_path: "/d.jpg",
  genre_ids: [878],
  vote_average: 7.5,
  vote_count: 800,
  popularity: 20,
  ...over,
});

describe("inferMoods", () => {
  const noCategories = { 1: [], 2: [] };

  it("seeds each player with the OTHER player's positives (cross-player), with fallback mood", async () => {
    const pool = [pm(1), pm(2)];
    const result = await inferMoods(
      pool,
      { 1: { yes: [1], no: [] }, 2: { yes: [2], no: [] } },
      noCategories,
      "US",
      [],
      false
    );

    const p1 = result[1].recs;
    expect(p1.find((r) => r.id === 2)?.source).toBe("cross-player"); // P2's positive
    expect(p1.find((r) => r.id === 1)?.source).toBe("swipe"); // own positive
    expect(result[1].moodRead.summary).toBe("mixed"); // fallback when AI declines
  });

  it("gates cross-player positives by the player's anchor genres (mood fit)", async () => {
    // P1 anchored on Sci-Fi (878). P2 liked a pure-action title (1) and a sci-fi one (2).
    const pool = [
      pm(1, { genreIds: [28] }), // action — P2's pick, clashes with P1's sci-fi mood
      pm(2, { genreIds: [878] }), // sci-fi — P2's pick, fits P1
      pm(3, { genreIds: [878] }), // P1's own pick
    ];
    const result = await inferMoods(
      pool,
      { 1: { yes: [3], no: [] }, 2: { yes: [1, 2], no: [] } },
      { 1: ["Sci-Fi"], 2: ["Action"] },
      "US",
      [],
      false
    );
    const p1ids = result[1].recs.map((r) => r.id);
    expect(p1ids).toContain(2); // sci-fi cross-player kept
    expect(p1ids).not.toContain(1); // clashing action cross-player dropped
  });

  it("includes fresh expansion from TMDB recommendations, flagged 'fresh'", async () => {
    recMock.mockResolvedValue([
      {
        id: 99,
        title: "Fresh Pick",
        release_date: "2015-01-01",
        overview: "",
        poster_path: "/f.jpg",
        genre_ids: [28],
        vote_average: 7.4,
        vote_count: 900,
        popularity: 30,
      },
    ]);
    const result = await inferMoods(
      [pm(1)],
      { 1: { yes: [1], no: [] }, 2: { yes: [], no: [] } },
      noCategories,
      "US",
      [],
      false
    );
    expect(result[1].recs.find((r) => r.source === "fresh")?.id).toBe(99);
  });

  it("applies a quality floor to fresh expansion (drops low-rated recs)", async () => {
    recMock.mockResolvedValue([
      { id: 50, title: "Weak", release_date: "2015-01-01", overview: "", poster_path: "/w.jpg", genre_ids: [28], vote_average: 5.4, vote_count: 900, popularity: 10 },
      { id: 51, title: "Strong", release_date: "2016-01-01", overview: "", poster_path: "/s.jpg", genre_ids: [28], vote_average: 7.6, vote_count: 900, popularity: 10 },
    ]);
    const result = await inferMoods(
      [pm(1)],
      { 1: { yes: [1], no: [] }, 2: { yes: [], no: [] } },
      noCategories,
      "US",
      [],
      false
    );
    const freshIds = result[1].recs.filter((r) => r.source === "fresh").map((r) => r.id);
    expect(freshIds).toContain(51); // well-rated kept
    expect(freshIds).not.toContain(50); // below the floor, dropped
  });

  it("uses the AI mood + ranking but drops invented ids", async () => {
    createMock.mockResolvedValue(
      aiInfer([
        { player: 1, moodRead: { summary: "dark and tense", axes: ["dark"] }, recIds: [999, 1, 2] },
        { player: 2, moodRead: { summary: "warm", axes: [] }, recIds: [1] },
      ])
    );
    const result = await inferMoods(
      [pm(1), pm(2), pm(3)],
      { 1: { yes: [1], no: [] }, 2: { yes: [2], no: [] } },
      noCategories,
      "US",
      [],
      false
    );
    const p1ids = result[1].recs.map((r) => r.id);
    expect(p1ids).not.toContain(999); // invented id dropped
    expect(p1ids).toContain(1);
    expect(result[1].moodRead.summary).toBe("dark and tense"); // AI mood used
  });

  // Blocker #1 (downstream): an all-"Don't know" Round 2 turn hands no signal, so
  // inference must degrade to that player's Round 1 mood — never guess from nothing.
  it("degrades a no-signal player to their Round 1 mood", async () => {
    createMock.mockResolvedValue(
      aiInfer([
        { player: 1, moodRead: { summary: "ai guess from nothing", axes: [] }, recIds: [] },
        { player: 2, moodRead: { summary: "warm", axes: [] }, recIds: [2] },
      ])
    );
    const pool = [pm(1, { genreIds: [27] }), pm(2, { genreIds: [27] })];
    const result = await inferMoods(
      pool,
      { 1: { yes: [], no: [] }, 2: { yes: [2], no: [] } }, // P1 handed no signal
      { 1: ["Horror"], 2: ["Comedy"] },
      "US",
      [],
      false
    );
    expect(result[1].moodRead.summary.toLowerCase()).toContain("horror"); // from Round 1
    expect(result[1].moodRead.axes).toEqual(["Horror"]);
    expect(result[1].recs.length).toBeGreaterThan(0); // still gets mood-fit finalists
    expect(result[2].moodRead.summary).toBe("warm"); // P2 had signal → AI read kept
  });

  // Major 2: price/access-type must NOT influence ranking. Finalists are ordered
  // by fit only; eligibility filters at display time, it never reorders.
  it("ranks finalists by fit only — eligibility never reorders (price-independent)", async () => {
    // Title 1: higher voteCount (better fit) but NOT on the service. Title 2: lower
    // voteCount but on Netflix. Fit order must win — 1 before 2 — despite eligibility.
    providersMock.mockImplementation((id: number) => Promise.resolve(id === 2 ? onNetflix : null));
    const pool = [pm(1, { voteCount: 900 }), pm(2, { voteCount: 100 })];
    const result = await inferMoods(
      pool,
      { 1: { yes: [], no: [] }, 2: { yes: [], no: [] } },
      noCategories,
      "US",
      [8],
      false
    );
    const ids = result[1].recs.map((r) => r.id);
    expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(2)); // fit order, not eligible-first
  });

  // Major (3rd pass): Round 3's terminal "nothing watchable" must be exhaustive.
  // The one watchable title sits past the early-stop cap (and everything ahead is
  // fully unavailable), so it must still appear in the finalists — no false none.
  it("finds a watchable title beyond the early-stop cap (no false Round-3 none)", async () => {
    // 17 mood-fit titles by descending voteCount; only the LAST (id 17, lowest
    // votes → ranked ~17th) is on Netflix, the rest have no availability at all.
    const pool = Array.from({ length: 17 }, (_, i) => pm(i + 1, { voteCount: 1000 - i }));
    providersMock.mockImplementation((id: number) => Promise.resolve(id === 17 ? onNetflix : null));
    const result = await inferMoods(
      pool,
      { 1: { yes: [], no: [] }, 2: { yes: [], no: [] } },
      noCategories,
      "US",
      [8],
      false
    );
    const watchable = result[1].recs.find((r) => r.availability.flatrate.some((p) => p.id === 8));
    expect(watchable?.id).toBe(17); // the deep eligible title is present, not missed
  });

  // Closing the class: the early-stop respects the CURRENT constraint. A rentable
  // title up top must NOT short-circuit Round 3 to offer-rentals when an INCLUDED
  // title exists deeper — a not-paying couple is shown the free option, not nudged.
  it("shows a deep INCLUDED title rather than nudging a not-paying user to rent", async () => {
    const pool = Array.from({ length: 17 }, (_, i) => pm(i + 1, { voteCount: 1000 - i }));
    // Title 3 (early) is rent-only; title 17 (past the cap) is included on Netflix.
    providersMock.mockImplementation((id: number) =>
      Promise.resolve(id === 17 ? onNetflix : id === 3 ? rentOnly : null)
    );
    const result = await inferMoods(
      pool,
      { 1: { yes: [], no: [] }, 2: { yes: [], no: [] } },
      noCategories,
      "US",
      [8],
      false // NOT willing to pay → current constraint is "included only"
    );
    const included = result[1].recs.find((r) => r.id === 17);
    expect(included?.availability.flatrate.some((p) => p.id === 8)).toBe(true); // shown as watchable
  });
});

// Availability-aware backfill: when few services leave a player short on eligible
// titles, mine the service catalog directly (provider-targeted discover). P1 is
// genre-anchored on Sci-Fi (878); P2 is mood-only so it never queries (keeps the
// assertions on P1's single discover call). The short pool has no availability, so
// the backfill must run.
describe("provider backfill (availability-aware Round 3)", () => {
  const anchored = { 1: ["Sci-Fi"], 2: [] };
  const noSwipes = { 1: { yes: [], no: [] }, 2: { yes: [], no: [] } };
  const shortPool = [pm(1, { genreIds: [878] })];

  it("queries the service catalog with provider, region, and anchor-genre params", async () => {
    discoverMock.mockResolvedValue([dm(100)]);
    providersMock.mockImplementation((id: number) => Promise.resolve(id === 100 ? onNetflix : null));
    await inferMoods(shortPool, noSwipes, anchored, "US", [8], false);
    expect(discoverMock).toHaveBeenCalled();
    const params = discoverMock.mock.calls[0][0];
    expect(params.with_watch_providers).toBe("8"); // the couple's selected service ids
    expect(params.watch_region).toBe("US");
    expect(params.with_genres).toBe("878"); // the player's anchor genres
  });

  it("flips monetization with willing-to-pay (flatrate vs flatrate|rent|buy)", async () => {
    await inferMoods(shortPool, noSwipes, anchored, "US", [8], false);
    expect(discoverMock.mock.calls[0][0].with_watch_monetization_types).toBe("flatrate");
    discoverMock.mockClear();
    await inferMoods(shortPool, noSwipes, anchored, "US", [8], true);
    expect(discoverMock.mock.calls[0][0].with_watch_monetization_types).toBe("flatrate|rent|buy");
  });

  // The most important guard: a discovered title that fails the per-title
  // eligibility re-check under the real constraint must NOT be added.
  it("rejects a discovered title that fails the eligibility re-check (watchability guard)", async () => {
    // 100 is genuinely included on Netflix; 101 comes back rent-only — under a
    // not-paying [Netflix] constraint it is NOT eligible.
    discoverMock.mockResolvedValue([dm(100), dm(101)]);
    providersMock.mockImplementation((id: number) =>
      Promise.resolve(id === 100 ? onNetflix : id === 101 ? rentOnly : null)
    );
    const result = await inferMoods(shortPool, noSwipes, anchored, "US", [8], false);
    const ids = result[1].recs.map((r) => r.id);
    expect(ids).toContain(100); // watchable → kept
    expect(ids).not.toContain(101); // unwatchable under the real constraint → rejected
  });

  it("franchise-dedupes backfilled titles (one per collection)", async () => {
    discoverMock.mockResolvedValue([dm(100), dm(101)]);
    providersMock.mockImplementation((id: number) => Promise.resolve(id >= 100 ? onNetflix : null));
    collectionMock.mockResolvedValue(500); // both discovered titles are the same franchise
    const result = await inferMoods(shortPool, noSwipes, anchored, "US", [8], false);
    const kept = result[1].recs.filter((r) => r.id === 100 || r.id === 101);
    expect(kept).toHaveLength(1); // only one franchise sibling survives
  });

  it("bounds the provider lookup fan-out regardless of result count", async () => {
    discoverMock.mockResolvedValue(Array.from({ length: 30 }, (_, i) => dm(100 + i)));
    providersMock.mockImplementation((id: number) => Promise.resolve(id >= 100 ? onNetflix : null));
    await inferMoods(shortPool, noSwipes, anchored, "US", [8], false);
    // need (TARGET 8 − 0 eligible) + buffer → at most 14 enrichments, never all 30.
    expect(collectionMock.mock.calls.length).toBeGreaterThan(0);
    expect(collectionMock.mock.calls.length).toBeLessThanOrEqual(14);
  });

  it("does not query the service catalog when enough titles are already eligible", async () => {
    // 6 pool titles all included on Netflix → already ≥ floor → no provider backfill.
    const ample = Array.from({ length: 6 }, (_, i) => pm(i + 1, { genreIds: [878], voteCount: 900 - i }));
    providersMock.mockResolvedValue(onNetflix);
    discoverMock.mockResolvedValue([dm(100)]);
    await inferMoods(ample, noSwipes, { 1: ["Sci-Fi"], 2: ["Sci-Fi"] }, "US", [8], false);
    expect(discoverMock).not.toHaveBeenCalled();
  });
});
