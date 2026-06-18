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

// ---- fixtures --------------------------------------------------------------

let nextId = 1;
const movie = (over: Record<string, unknown> = {}) => ({
  id: nextId++,
  title: `Movie ${nextId}`,
  release_date: "2012-05-01",
  overview: "",
  poster_path: "/poster.jpg",
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

// ---- blendTastes: Family guard (#7) ----------------------------------------

describe("blendTastes Family guard", () => {
  it("excludes the Family genre for a non-animation direction", async () => {
    await blendTastes(["Horror"], ["Comedy"]);
    const usedWithoutFamily = discoverMock.mock.calls.some(
      ([p]) => p.without_genres === "10751"
    );
    expect(usedWithoutFamily).toBe(true);
  });

  it("keeps Family eligible for an animation-led direction", async () => {
    createMock.mockResolvedValue(
      aiResponse({
        moodRead: { summary: "playful", axes: [] },
        directions: [
          {
            theme: "Animated",
            genreIds: [16],
            keywords: [],
            tone: ["fun"],
            sourcePicks: ["P1: Animated"],
          },
        ],
      })
    );
    await blendTastes(["Animated"], ["Comedy"]);
    const everUsedWithoutFamily = discoverMock.mock.calls.some(
      ([p]) => p.without_genres === "10751"
    );
    expect(everUsedWithoutFamily).toBe(false);
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

  it("does not throw if every TMDB query is empty (returns an empty pool)", async () => {
    discoverMock.mockImplementation(() => []);
    const result = await blendTastes(["Horror"], ["Comedy"]);
    expect(result.pool).toEqual([]);
  });
});
