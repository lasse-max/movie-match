import { describe, it, expect, vi, beforeEach } from "vitest";

// infer.ts is server-only and calls Claude + TMDB recommendations; mock all
// three to unit-test the candidate assembly, AI validation, and fallback.
vi.mock("server-only", () => ({}));

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "test-model",
  getAnthropic: () => ({ messages: { create: createMock } }),
}));

const { recMock } = vi.hoisted(() => ({ recMock: vi.fn() }));
vi.mock("@/lib/tmdb", () => ({
  getRecommendations: recMock,
  tmdbImageUrl: (p: string | null) => (p ? `https://img.test${p}` : null),
}));

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
});

describe("inferMoods", () => {
  const noCategories = { 1: [], 2: [] };

  it("seeds each player with the OTHER player's positives (cross-player), with fallback mood", async () => {
    const pool = [pm(1), pm(2)];
    const result = await inferMoods(
      pool,
      { 1: { yes: [1], no: [] }, 2: { yes: [2], no: [] } },
      noCategories
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
      { 1: ["Sci-Fi"], 2: ["Action"] }
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
      noCategories
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
      noCategories
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
      noCategories
    );
    const p1ids = result[1].recs.map((r) => r.id);
    expect(p1ids).not.toContain(999); // invented id dropped
    expect(p1ids).toContain(1);
    expect(result[1].moodRead.summary).toBe("dark and tense"); // AI mood used
  });
});
