import { describe, it, expect } from "vitest";
import { round3Rank } from "@/lib/ranking";

const m = (over: Partial<{ voteAverage: number; voteCount: number; year: string | null }> = {}) => ({
  voteAverage: 7.5,
  voteCount: 3000,
  year: "2020",
  ...over,
});
const NOW = 2025;

describe("round3Rank — soft Round 3 popularity de-weighting", () => {
  it("ranks a recent discovery above the old ubiquitous canon", () => {
    const discovery = m({ voteAverage: 7.6, voteCount: 3000, year: "2020" });
    const oldCanon = m({ voteAverage: 8.6, voteCount: 20000, year: "1977" }); // Star Wars-ish
    expect(round3Rank(discovery, NOW)).toBeGreaterThan(round3Rank(oldCanon, NOW));
  });

  it("de-weights canon softly — a recent canon still beats the old canon", () => {
    const recentCanon = m({ voteAverage: 8.2, voteCount: 25000, year: "2019" }); // Endgame-ish
    const oldCanon = m({ voteAverage: 8.6, voteCount: 20000, year: "1977" });
    expect(round3Rank(recentCanon, NOW)).toBeGreaterThan(round3Rank(oldCanon, NOW));
  });

  it("still surfaces a recent discovery over a recent canon (the de-weight is real)", () => {
    const discovery = m({ voteAverage: 7.6, voteCount: 3000, year: "2021" });
    const recentCanon = m({ voteAverage: 8.0, voteCount: 25000, year: "2021" });
    expect(round3Rank(discovery, NOW)).toBeGreaterThan(round3Rank(recentCanon, NOW));
  });

  it("never zeroes a title out — soft floor, so strong matches can still surface", () => {
    const megaCanon = m({ voteAverage: 8.8, voteCount: 100000, year: "1972" });
    expect(round3Rank(megaCanon, NOW)).toBeGreaterThan(0);
  });

  it("treats a missing year as old (no recency lean)", () => {
    expect(round3Rank(m({ year: "2022" }), NOW)).toBeGreaterThan(round3Rank(m({ year: null }), NOW));
  });
});
