import { describe, it, expect } from "vitest";
import { sanitizePool, boundedIds, idsIn, isSupportedRegion, MAX_POOL } from "@/lib/validate";

describe("sanitizePool", () => {
  it("keeps well-shaped movies, dedups by id, and coerces fields to safe defaults", () => {
    const pool = sanitizePool([
      { id: 1, title: "A", genreIds: [28, "x", 35], voteAverage: 7, voteCount: 100 },
      { id: 1, title: "dup" }, // duplicate id dropped
      { id: 2 }, // sparse but valid id → defaults filled
    ]);
    expect(pool.map((m) => m.id)).toEqual([1, 2]);
    expect(pool[0].genreIds).toEqual([28, 35]); // non-integer genre stripped
    expect(pool[1].title).toBe(""); // missing title → safe default (shape coercion, not provenance)
  });

  it("drops entries without a valid integer id", () => {
    expect(sanitizePool([{ title: "no id" }, { id: 1.5 }, { id: "3" }, null, 5])).toEqual([]);
  });

  it("caps the pool at MAX_POOL", () => {
    const huge = Array.from({ length: MAX_POOL + 50 }, (_, i) => ({ id: i + 1 }));
    expect(sanitizePool(huge)).toHaveLength(MAX_POOL);
  });

  it("returns [] for non-array input", () => {
    expect(sanitizePool("nope")).toEqual([]);
    expect(sanitizePool(undefined)).toEqual([]);
  });
});

describe("boundedIds / idsIn", () => {
  it("keeps integers, dedups, and bounds the count", () => {
    expect(boundedIds([1, 2, 2, 3, "x", 4.5])).toEqual([1, 2, 3]);
    expect(boundedIds([1, 2, 3, 4], 2)).toHaveLength(2);
  });

  it("idsIn keeps only ids present in the allowed (submitted-pool) set", () => {
    expect(idsIn([1, 2, 99], new Set([1, 2]))).toEqual([1, 2]);
  });
});

describe("isSupportedRegion", () => {
  it("accepts curated region codes and rejects everything else", () => {
    expect(isSupportedRegion("US")).toBe(true);
    expect(isSupportedRegion("DE")).toBe(true);
    expect(isSupportedRegion("XX")).toBe(false);
    expect(isSupportedRegion(42)).toBe(false);
  });
});
