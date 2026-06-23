import { describe, it, expect } from "vitest";
import { matchTags, matchPercent } from "@/lib/matchInsight";

describe("matchTags", () => {
  it("blends mood axes (first) with genre names, lowercased + deduped", () => {
    // 878 = Science Fiction, 53 = Thriller
    expect(matchTags(["dark", "clever"], [878, 53])).toEqual(["dark", "clever", "science fiction"]);
  });

  it("drops a genre that duplicates a mood axis and respects the cap", () => {
    expect(matchTags(["thriller"], [53], 3)).toEqual(["thriller"]); // 53 = Thriller, dup of the axis
  });

  it("falls back to genres alone when there are no mood axes", () => {
    expect(matchTags([], [878])).toEqual(["science fiction"]);
  });
});

describe("matchPercent", () => {
  it("maps a normalized fit (0..1) to a believable 74–98%", () => {
    expect(matchPercent(1)).toBe(98);
    expect(matchPercent(0)).toBe(74);
    expect(matchPercent(0.5)).toBe(86);
  });

  it("clamps fits outside 0..1", () => {
    expect(matchPercent(2)).toBe(98);
    expect(matchPercent(-1)).toBe(74);
  });
});
