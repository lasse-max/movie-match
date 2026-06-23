import { describe, it, expect } from "vitest";
import { findOverlap, pickMatch, declinedFrom } from "@/lib/overlap";
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
  collectionId: null,
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

  it("returns up to 3 runner-ups, each with tags + a fit percent, winner ranked highest", () => {
    const recs = [rec(1), rec(2), rec(3), rec(4), rec(5)];
    const m = pickMatch(recs, recs, [1, 2, 3, 4, 5], [1, 2, 3, 4, 5], ["dark", "tense"]);
    expect(m?.movie.id).toBe(1);
    expect(m?.alternatives.map((a) => a.id)).toEqual([2, 3, 4]); // capped at 3 runner-ups
    expect(m?.movie.matchTags).toContain("dark"); // mood tag surfaced
    expect(m!.movie.matchPercent).toBeGreaterThanOrEqual(m!.alternatives[0].matchPercent);
  });
});

describe("declinedFrom", () => {
  it("declines shown-but-unpicked titles across both players", () => {
    // P1 saw 1,2,3 and picked 1 → declined 2,3. P2 saw 3,4 and picked 4 → declined 3.
    const declined = declinedFrom({ 1: [1, 2, 3], 2: [3, 4] }, { 1: [1], 2: [4] });
    expect([...declined].sort((a, b) => a - b)).toEqual([2, 3]);
  });

  it("never declines a never-shown finalist (backfill beyond the visible set)", () => {
    // 99 was never shown to either player → it must stay bridge-eligible.
    const declined = declinedFrom({ 1: [1, 2], 2: [1] }, { 1: [1], 2: [1] });
    expect(declined).toContain(2); // shown to P1, not picked → declined
    expect(declined).not.toContain(99); // never shown → not declined
  });
});
