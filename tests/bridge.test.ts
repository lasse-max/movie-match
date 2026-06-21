import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { recMock, providersMock } = vi.hoisted(() => ({ recMock: vi.fn(), providersMock: vi.fn() }));
vi.mock("@/lib/tmdb", () => ({
  getRecommendations: recMock,
  getWatchProvidersForRegion: providersMock,
  tmdbImageUrl: (p: string | null) => (p ? `https://img.test${p}` : null),
}));

import { bridge } from "@/lib/bridge";
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

const onNetflix = {
  link: "https://jw.test",
  flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: null, display_priority: 1 }],
};
const rentOnly = {
  link: "https://jw.test",
  rent: [{ provider_id: 2, provider_name: "Apple TV", logo_path: null, display_priority: 1 }],
};
const SERVICES = [8]; // the couple subscribes to Netflix

beforeEach(() => {
  vi.clearAllMocks();
  recMock.mockResolvedValue([]); // no fresh recommendations by default
  providersMock.mockResolvedValue(onNetflix); // default: everything's on Netflix
});

describe("bridge", () => {
  it("returns an ELIGIBLE best-fit match (intersection beats a one-lane pick)", async () => {
    const matrix = pm(1, [878, 28], 8.2); // sci-fi + action — fits both anchors
    const equalizer = pm(2, [28], 8.9); // action only, higher rated
    const out = await bridge([matrix, equalizer], [], [], [878], [28], false, "US", SERVICES, false, []);
    expect(out.kind).toBe("match");
    if (out.kind === "match") {
      expect(out.movie.id).toBe(1);
      // Invariant: a match is always actually watchable — never an unavailable pick.
      expect(out.movie.availability.flatrate.some((p) => p.id === 8)).toBe(true);
    }
  });

  it("breaks ties between equal-fit eligible titles by vote average", async () => {
    const out = await bridge(
      [pm(1, [878, 28], 7.0), pm(2, [878, 28], 8.5)],
      [],
      [],
      [878],
      [28],
      false,
      "US",
      SERVICES,
      false,
      []
    );
    expect(out.kind === "match" && out.movie.id).toBe(2);
  });

  it("excludes titles either player declined in Round 3", async () => {
    // Best fit is 1, but it was declined → must fall to the next eligible fit (2).
    const out = await bridge(
      [pm(1, [878, 28], 9.0), pm(2, [878, 28], 7.0)],
      [],
      [],
      [878],
      [28],
      false,
      "US",
      SERVICES,
      false,
      [1]
    );
    expect(out.kind === "match" && out.movie.id).toBe(2);
  });

  it("offers rentals instead of an unavailable match (rentable only, not paying)", async () => {
    providersMock.mockResolvedValue(rentOnly);
    const out = await bridge([pm(1, [878, 28])], [], [], [878], [28], false, "US", SERVICES, false, []);
    expect(out.kind).toBe("needs-rentals");
  });

  it("becomes an eligible match once willing-to-pay unlocks a rentable title", async () => {
    providersMock.mockResolvedValue(rentOnly);
    const out = await bridge([pm(1, [878, 28])], [], [], [878], [28], false, "US", SERVICES, true, []);
    expect(out.kind).toBe("match");
    if (out.kind === "match") expect(out.movie.availability.rent.some((p) => p.id === 2)).toBe(true);
  });

  it("is the honest 'none' end-state when nothing's watchable even paying", async () => {
    providersMock.mockResolvedValue(null); // no availability anywhere
    const out = await bridge([pm(1, [878, 28])], [], [], [878], [28], false, "US", SERVICES, true, []);
    expect(out.kind).toBe("none");
  });

  it("is 'none' when no candidate fits either mood", async () => {
    const western = pm(1, [37]); // fits neither sci-fi (878) nor action (28)
    const out = await bridge([western], [], [], [878], [28], false, "US", SERVICES, true, []);
    expect(out.kind).toBe("none");
  });

  // Major 3: an eligible candidate deeper than a fixed top-N must still be found
  // (the batched scan), not produce a false "none".
  it("finds an eligible candidate deeper than a fixed top-N (no false 'none')", async () => {
    const ten = Array.from({ length: 10 }, (_, i) => pm(i + 1, [878, 28], 8.0)); // score 2, rank first
    const eleventh = pm(11, [878], 7.0); // score 1 → ranks 11th
    providersMock.mockImplementation((id: number) => Promise.resolve(id === 11 ? onNetflix : null));
    const out = await bridge([...ten, eleventh], [], [], [878], [28], false, "US", SERVICES, false, []);
    expect(out.kind).toBe("match");
    if (out.kind === "match") expect(out.movie.id).toBe(11);
  });
});
