import { describe, it, expect, vi, beforeEach } from "vitest";

// blend.ts is server-only and talks to Claude + TMDB; mock all three so we can
// unit-test the pure hardened logic (validation, fallback, pool relaxation,
// Family exclusion, keyword resolution) deterministically.
vi.mock("server-only", () => ({}));

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "test-model",
  getAnthropic: () => ({ messages: { create: createMock } }),
}));

const { discoverMock, keywordMock } = vi.hoisted(() => ({
  discoverMock: vi.fn(),
  keywordMock: vi.fn(),
}));
vi.mock("@/lib/tmdb", () => ({
  discoverMovies: discoverMock,
  searchKeyword: keywordMock,
  tmdbImageUrl: (p: string | null) => (p ? `https://img.test${p}` : null),
}));

import { validateStrategy, fallbackStrategy, blendTastes } from "@/lib/blend";
import { isKidsFare } from "@/lib/genres";
import { hasEnoughSamples, MIN_SAMPLES_PER_PLAYER, type PoolMovie } from "@/lib/blendTypes";

const poolMovie = (id: number, directionIndex = 0): PoolMovie => ({
  id,
  title: `M${id}`,
  year: null,
  overview: "",
  posterUrl: null,
  genreIds: [],
  voteAverage: 7,
  voteCount: 100 + id,
  directionIndex,
  directionTheme: "D",
});

// ---- fixtures --------------------------------------------------------------

let nextId = 1;
const movie = (over: Record<string, unknown> = {}) => ({
  id: nextId++,
  title: `Movie ${nextId}`,
  release_date: "2012-05-01",
  overview: "",
  poster_path: "/poster.jpg",
  genre_ids: [] as number[],
  vote_average: 7.2,
  vote_count: 800,
  popularity: 40,
  ...over,
});
const movies = (n: number) => Array.from({ length: n }, () => movie());

const aiResponse = (obj: unknown) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify(obj) }],
});

const VALID_STRATEGY = {
  moodRead: { summary: "dark and tense", axes: ["dark", "tense"] },
  directions: [
    {
      theme: "Horror",
      genreIds: [27],
      keywords: ["zombie"],
      tone: ["scary"],
      sourcePicks: ["P1: Horror"],
    },
  ],
};

beforeEach(() => {
  nextId = 1;
  vi.clearAllMocks();
  createMock.mockResolvedValue(aiResponse(VALID_STRATEGY));
  keywordMock.mockResolvedValue(100);
  discoverMock.mockImplementation(() => movies(20));
});

// ---- validateStrategy (#3) -------------------------------------------------

describe("validateStrategy", () => {
  it("accepts a well-formed strategy", () => {
    const s = validateStrategy(VALID_STRATEGY);
    expect(s).not.toBeNull();
    expect(s!.directions[0].genreIds).toEqual([27]);
  });

  it.each([
    ["not an object", 42],
    ["missing moodRead", { directions: VALID_STRATEGY.directions }],
    ["empty summary", { ...VALID_STRATEGY, moodRead: { summary: "  ", axes: [] } }],
    ["non-string axes", { ...VALID_STRATEGY, moodRead: { summary: "x", axes: [1] } }],
    ["empty directions", { ...VALID_STRATEGY, directions: [] }],
    [
      "too many directions",
      { ...VALID_STRATEGY, directions: Array(4).fill(VALID_STRATEGY.directions[0]) },
    ],
    [
      "disallowed genre id (Family)",
      { ...VALID_STRATEGY, directions: [{ ...VALID_STRATEGY.directions[0], genreIds: [10751] }] },
    ],
    [
      "non-integer genre id",
      { ...VALID_STRATEGY, directions: [{ ...VALID_STRATEGY.directions[0], genreIds: [27.5] }] },
    ],
    [
      "empty genreIds",
      { ...VALID_STRATEGY, directions: [{ ...VALID_STRATEGY.directions[0], genreIds: [] }] },
    ],
    [
      "empty theme",
      { ...VALID_STRATEGY, directions: [{ ...VALID_STRATEGY.directions[0], theme: "" }] },
    ],
    [
      "non-string keyword",
      { ...VALID_STRATEGY, directions: [{ ...VALID_STRATEGY.directions[0], keywords: [5] }] },
    ],
  ])("rejects %s", (_label, input) => {
    expect(validateStrategy(input)).toBeNull();
  });
});

// ---- fallbackStrategy ------------------------------------------------------

describe("fallbackStrategy", () => {
  it("ranks shared genres first and maps to TMDB genre ids", () => {
    const s = fallbackStrategy(["Horror", "Comedy"], ["Horror"]);
    expect(s.moodRead.summary).toBe("mixed");
    expect(s.directions[0].theme).toBe("Horror"); // shared by both players
    expect(s.directions[0].genreIds).toEqual([27]);
  });

  it("falls back to a generic popular direction when only moods were picked", () => {
    const s = fallbackStrategy(["Cozy"], ["Feel-good"]);
    expect(s.directions).toHaveLength(1);
    expect(s.directions[0].genreIds).toEqual([]); // no genre filter → top popular
  });
});

// ---- Kids'-fare guard (Option A) -------------------------------------------

describe("isKidsFare", () => {
  it("flags Animation AND Family", () => {
    expect(isKidsFare([16, 10751, 35])).toBe(true);
  });
  it("does not flag adult animation (Animation, no Family)", () => {
    expect(isKidsFare([16, 28, 878])).toBe(false); // Spider-Verse
  });
  it("does not flag adult family comedy (Family, no Animation)", () => {
    expect(isKidsFare([35, 10751])).toBe(false); // Elf / Home Alone
  });
  it("handles missing genre_ids", () => {
    expect(isKidsFare(undefined)).toBe(false);
  });
});

describe("blendTastes kids'-fare guard", () => {
  it("drops kids' fare by default but keeps adult animation and adult family", async () => {
    const kids = movie({ genre_ids: [16, 10751] }); // Mario / Zootopia signature
    const adultAnimation = movie({ genre_ids: [16, 28] }); // Spider-Verse
    const adultFamily = movie({ genre_ids: [35, 10751] }); // Elf
    discoverMock.mockImplementation(() => [kids, adultAnimation, adultFamily, ...movies(15)]);

    const { pool } = await blendTastes(["Horror"], ["Comedy"]);
    const ids = pool.map((m) => m.id);
    expect(ids).not.toContain(kids.id);
    expect(ids).toContain(adultAnimation.id);
    expect(ids).toContain(adultFamily.id);
  });

  it("keeps kids' fare when a player explicitly picked Animated", async () => {
    const kids = movie({ genre_ids: [16, 10751] });
    discoverMock.mockImplementation(() => [kids, ...movies(15)]);

    const { pool } = await blendTastes(["Animated"], ["Comedy"]);
    expect(pool.map((m) => m.id)).toContain(kids.id);
  });
});

// ---- blendTastes: keyword resolution (#8) ----------------------------------

describe("blendTastes keyword resolution", () => {
  it("resolves keywords to ids and drops ambiguous ones", async () => {
    keywordMock.mockImplementation(async (t: string) => (t === "zombie" ? 7 : null));
    createMock.mockResolvedValue(
      aiResponse({
        moodRead: { summary: "dark", axes: [] },
        directions: [
          {
            theme: "Horror",
            genreIds: [27],
            keywords: ["zombie", "made up term"],
            tone: ["scary"],
            sourcePicks: ["P1: Horror"],
          },
        ],
      })
    );
    await blendTastes(["Horror"], ["Comedy"]);
    const terms = keywordMock.mock.calls.map((c) => c[0]);
    expect(terms).toContain("zombie");
    expect(terms).toContain("made up term");
    const withKw = discoverMock.mock.calls.find(([p]) => p.with_keywords);
    expect(withKw?.[0].with_keywords).toBe("7"); // only the resolved one
  });
});

// ---- blendTastes: relaxation + fallback (#2) -------------------------------

describe("blendTastes pool relaxation", () => {
  it("relaxes keyword constraints when the keyword-filtered pool is too thin", async () => {
    // Keyword-constrained queries come back empty; genre-only queries are healthy.
    discoverMock.mockImplementation((p: Record<string, string>) =>
      p.with_keywords ? [] : movies(20)
    );
    const result = await blendTastes(["Horror"], ["Comedy"]);
    expect(result.pool.length).toBeGreaterThanOrEqual(15);
    // it must have retried without the keyword filter
    expect(discoverMock.mock.calls.some(([p]) => !p.with_keywords)).toBe(true);
  });

  it("falls back to the genre strategy when the model output is invalid", async () => {
    createMock.mockResolvedValue(aiResponse({ garbage: true }));
    const result = await blendTastes(["Horror"], ["Comedy"]);
    expect(result.moodRead.summary).toBe("mixed"); // fallback strategy
    expect(result.pool.length).toBeGreaterThan(0);
  });

  it("guarantees a viable pool via the broad popular fallback when every directioned query is thin", async () => {
    // Every genre/keyword-directed query comes back empty; only the final broad,
    // region-available popular query (watch_region set) returns titles.
    discoverMock.mockImplementation((p: Record<string, string>) =>
      p.watch_region ? movies(20) : []
    );
    const result = await blendTastes(["Horror"], ["Comedy"]);
    expect(result.pool.length).toBeGreaterThanOrEqual(15); // viable, never starved/empty
    // and it must have run the eligible-aware broad query
    expect(
      discoverMock.mock.calls.some(([p]) => p.watch_region && p.with_watch_monetization_types)
    ).toBe(true);
  });

  it("a thin broad fallback yields a pool the viable-sample postcondition rejects", async () => {
    // Directioned/genre queries empty; even the broad query is thin → unviable pool.
    discoverMock.mockImplementation((p: Record<string, string>) => (p.watch_region ? movies(2) : []));
    const result = await blendTastes(["Horror"], ["Comedy"]);
    expect(result.pool.length).toBeLessThan(2 * MIN_SAMPLES_PER_PLAYER); // thin
    expect(hasEnoughSamples(result.pool)).toBe(false); // screen surfaces the recoverable error
  });
});

// ---- viable-pool postcondition (Major 4) -----------------------------------

describe("hasEnoughSamples", () => {
  it("is false for a tiny pool that would starve Player 2", () => {
    expect(hasEnoughSamples([poolMovie(1)])).toBe(false); // 1 title → P2 gets 0 cards
  });

  it("is true once both players clear the minimum distinct samples", () => {
    const pool = Array.from({ length: 2 * MIN_SAMPLES_PER_PLAYER }, (_, i) => poolMovie(i + 1));
    expect(hasEnoughSamples(pool)).toBe(true);
  });
});
