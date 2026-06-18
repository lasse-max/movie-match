import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { recMock } = vi.hoisted(() => ({ recMock: vi.fn() }));
vi.mock("@/lib/tmdb", () => ({
  getRecommendations: recMock,
  getWatchProvidersForRegion: () => Promise.resolve(null), // no availability → degraded best-fit
  tmdbImageUrl: (p: string | null) => (p ? `https://img.test${p}` : null),
}));

import { bridge } from "@/lib/bridge";
import { NO_AVAILABILITY } from "@/lib/filter";
import type { PoolMovie } from "@/lib/blendTypes";

const pm = (id: number, genreIds: number[], voteAverage = 7.5): PoolMovie => ({
  id,
  title: `M${id}`,
  year: "2010",
  overview: "",
  posterUrl: "/p.jpg",
  genreIds,
  voteAverage,
  voteCount: 800,
  directionIndex: 0,
  directionTheme: "D",
});

beforeEach(() => {
  vi.clearAllMocks();
  recMock.mockResolvedValue([]); // no fresh recommendations by default
});

describe("bridge", () => {
  it("prefers a title fitting BOTH anchors over a higher-rated one-lane pick", async () => {
    const matrix = pm(1, [878, 28], 8.2); // sci-fi + action (intersection)
    const equalizer = pm(2, [28], 8.9); // action only, higher rated
    const result = await bridge([matrix, equalizer], [], [], [878], [28], false, "US", [], false, null);
    expect(result?.id).toBe(1); // intersection beats the one-lane pick on fit
  });

  it("breaks ties between equal-fit titles by vote average", async () => {
    const result = await bridge(
      [pm(1, [878, 28], 7.0), pm(2, [878, 28], 8.5)],
      [],
      [],
      [878],
      [28],
      false,
      "US",
      [],
      false,
      null
    );
    expect(result?.id).toBe(2);
  });

  it("falls back when nothing clears the quality floor", async () => {
    const fallback = {
      id: 99,
      title: "FB",
      year: null,
      posterUrl: null,
      genreIds: [],
      availability: NO_AVAILABILITY,
    };
    const result = await bridge([pm(1, [878, 28], 5.0)], [], [], [878], [28], false, "US", [], false, fallback);
    expect(result).toBe(fallback);
  });
});
