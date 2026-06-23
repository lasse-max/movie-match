import { describe, it, expect } from "vitest";
import { MOVIE_QUOTES, randomQuote } from "@/lib/quotes";

describe("movie quotes (loading flavor)", () => {
  it("every quote is attributed and non-empty", () => {
    expect(MOVIE_QUOTES.length).toBeGreaterThan(0);
    for (const q of MOVIE_QUOTES) {
      expect(q.quote.trim()).not.toBe("");
      expect(q.film.trim()).not.toBe("");
    }
  });

  it("randomQuote always returns a member of the list", () => {
    for (let i = 0; i < 25; i++) expect(MOVIE_QUOTES).toContain(randomQuote());
  });
});
