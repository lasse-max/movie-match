import { describe, it, expect } from "vitest";
import { normalizeCategoryPicks, categoryGenreId } from "@/lib/categories";

describe("normalizeCategoryPicks", () => {
  it("maps ids and labels to canonical labels", () => {
    expect(normalizeCategoryPicks(["horror", "Comedy"])).toEqual(["Horror", "Comedy"]);
  });

  it("is case-insensitive and trims", () => {
    expect(normalizeCategoryPicks(["  HORROR ", "cOmEdY"])).toEqual(["Horror", "Comedy"]);
  });

  it("de-duplicates (by id or label)", () => {
    expect(normalizeCategoryPicks(["horror", "Horror", "comedy"])).toEqual(["Horror", "Comedy"]);
  });

  it("drops unknown values and non-strings", () => {
    expect(normalizeCategoryPicks(["horror", "banana", 42, null, "comedy"])).toEqual([
      "Horror",
      "Comedy",
    ]);
  });

  it("bounds the count (default 3)", () => {
    expect(
      normalizeCategoryPicks(["action", "comedy", "horror", "drama", "crime"])
    ).toEqual(["Action", "Comedy", "Horror"]);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeCategoryPicks("horror")).toEqual([]);
    expect(normalizeCategoryPicks(undefined)).toEqual([]);
  });
});

describe("categoryGenreId", () => {
  it("returns the TMDB genre id for genre picks (by id or label)", () => {
    expect(categoryGenreId("horror")).toBe(27);
    expect(categoryGenreId("Sci-Fi")).toBe(878);
  });

  it("returns null for mood picks", () => {
    expect(categoryGenreId("apocalyptic")).toBeNull();
    expect(categoryGenreId("cozy")).toBeNull();
  });
});
