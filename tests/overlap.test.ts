import { describe, it, expect } from "vitest";
import { findOverlap, pickMatch } from "@/lib/overlap";
import { NO_AVAILABILITY } from "@/lib/filter";
import type { PlayerRec } from "@/lib/inferTypes";

// One of the three permanent pure-logic suites (reducer / filter / overlap).
const rec = (id: number): PlayerRec => ({
  id,
  title: `M${id}`,
  year: "2010",
  overview: "",
  posterUrl: null,
  genreIds: [],
  source: "swipe",
  availability: NO_AVAILABILITY,
});

describe("findOverlap", () => {
  it("returns titles both players would watch, best combined fit first", () => {
    const recs1 = [rec(10), rec(20), rec(30)]; // fit: 10→0, 20→1, 30→2
    const recs2 = [rec(10), rec(20), rec(30)]; // fit: 10→0, 20→1, 30→2
    const overlap = findOverlap(recs1, recs2, [10, 20, 30], [10, 20, 30]);
    expect(overlap.map((m) => m.id)).toEqual([10, 20, 30]); // 0 < 2 < 4
  });

  it("ranks by combined fit across the two players' orderings", () => {
    const recs1 = [rec(10), rec(20), rec(30)]; // 10→0, 20→1, 30→2
    const recs2 = [rec(10), rec(30), rec(20)]; // 10→0, 30→1, 20→2
    const overlap = findOverlap(recs1, recs2, [10, 20, 30], [10, 20, 30]);
    expect(overlap[0].id).toBe(10); // combined fit 0 — clearly best
    expect(overlap.map((m) => m.id).sort()).toEqual([10, 20, 30]);
  });

  it("excludes a title only one player picked", () => {
    const recs1 = [rec(1), rec(2)];
    const recs2 = [rec(1), rec(2)];
    const overlap = findOverlap(recs1, recs2, [1, 2], [1]); // P2 only picked 1
    expect(overlap.map((m) => m.id)).toEqual([1]);
  });

  it("returns empty when there is no overlap", () => {
    expect(findOverlap([rec(1)], [rec(2)], [1], [2])).toEqual([]);
  });
});

describe("pickMatch", () => {
  it("returns the best overlap as an 'overlap' match", () => {
    const m = pickMatch([rec(1), rec(2)], [rec(2), rec(1)], [1, 2], [1, 2]);
    expect(m?.reason).toBe("overlap");
    expect([1, 2]).toContain(m?.movie.id);
  });

  it("returns null when there is no overlap (caller bridges)", () => {
    expect(pickMatch([rec(1)], [rec(2)], [1], [2])).toBeNull();
  });
});
