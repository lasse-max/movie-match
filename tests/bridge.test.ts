import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { recMock, providersMock, collectionMock } = vi.hoisted(() => ({
  recMock: vi.fn(),
  providersMock: vi.fn(),
  collectionMock: vi.fn(),
}));
vi.mock("@/lib/tmdb", () => ({
  getRecommendations: recMock,
  getWatchProvidersForRegion: providersMock,
  getCollectionId: collectionMock,
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
  collectionId: null,
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
  collectionMock.mockResolvedValue(null); // no franchise by default
});

const freshRec = (id: number) => ({
  id,
  title: `F${id}`,
  release_date: "2020-01-01",
  overview: "",
  poster_path: "/f.jpg",
  genre_ids: [878, 28],
  vote_average: 8.2,
  vote_count: 900,
  popularity: 10,
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

  // A terminal "none" must be EXHAUSTIVE: an eligible title ranked PAST the
  // early-stop cap must still be found rather than producing a false "none".
  it("exhausts the full ranked pool before 'none' — finds an eligible title past the cap", async () => {
    // 16 higher-fit titles, all unavailable (so the bounded top-15 scan finds
    // nothing eligible and nothing rentable → would be a terminal none). The one
    // eligible title sits at position 17, beyond MAX_AVAIL_FETCHES (15).
    const unavailable = Array.from({ length: 16 }, (_, i) => pm(i + 1, [878, 28], 8.0)); // score 2
    const deepEligible = pm(17, [878], 7.0); // score 1 → ranks last (position 17)
    providersMock.mockImplementation((id: number) => Promise.resolve(id === 17 ? onNetflix : null));
    const out = await bridge([...unavailable, deepEligible], [], [], [878], [28], false, "US", SERVICES, false, []);
    expect(out.kind).toBe("match");
    if (out.kind === "match") expect(out.movie.id).toBe(17);
  });

  // Closing the class: needs-rentals is itself a claim of "no INCLUDED title" and
  // must be exhaustive. A rentable title in the top 15 must NOT short-circuit to
  // needs-rentals when an INCLUDED title exists deeper (not paying).
  it("prefers a deep INCLUDED title over an earlier rentable one (not paying)", async () => {
    const head = Array.from({ length: 16 }, (_, i) => pm(i + 1, [878, 28], 8.0)); // score 2
    const deepIncluded = pm(17, [878], 7.0); // score 1 → position 17
    // Title 3 (early) is rent-only; title 17 (past the cap) is included on Netflix.
    providersMock.mockImplementation((id: number) =>
      Promise.resolve(id === 17 ? onNetflix : id === 3 ? rentOnly : null)
    );
    const out = await bridge([...head, deepIncluded], [], [], [878], [28], false, "US", SERVICES, false, []);
    expect(out.kind).toBe("match"); // NOT needs-rentals
    if (out.kind === "match") expect(out.movie.id).toBe(17);
  });

  it("returns a winner + runner-up tail, each with tags + a fit percent", async () => {
    const cands = Array.from({ length: 5 }, (_, i) => pm(i + 1, [878, 28], 8 - i * 0.1)); // all eligible
    const out = await bridge(cands, [], [], [878], [28], false, "US", SERVICES, false, [], ["dark"]);
    expect(out.kind).toBe("match");
    if (out.kind === "match") {
      expect(out.alternatives).toHaveLength(4); // winner + the rest (within MAX_MATCHES)
      expect(out.movie.matchTags).toContain("dark");
      expect(out.movie.matchPercent).toBeGreaterThan(0);
    }
  });

  it("de-dupes franchise entries among winner + runner-ups", async () => {
    const a = pm(1, [878, 28], 8.5); // standalone
    const b = { ...pm(2, [878, 28], 8.4), collectionId: 100 }; // franchise X
    const c = { ...pm(3, [878, 28], 8.3), collectionId: 100 }; // franchise X again → dropped
    const d = pm(4, [878, 28], 8.2); // standalone
    const out = await bridge([a, b, c, d], [], [], [878], [28], false, "US", SERVICES, false, []);
    if (out.kind === "match") {
      const ids = [out.movie.id, ...out.alternatives.map((x) => x.id)];
      expect(ids).toContain(2); // first franchise entry kept
      expect(ids).not.toContain(3); // second franchise entry dropped
    }
  });

  // Major 4: a FRESH bridge rec enters with collectionId null; it must be enriched
  // so franchise dedup can drop it when it shares a collection with a pool title.
  it("de-dupes a FRESH bridge rec that shares a franchise with a pool title", async () => {
    const poolTitle = { ...pm(1, [878, 28], 8.5), collectionId: 100 }; // franchise X (pool)
    const other = pm(2, [878, 28], 8.0); // standalone pool title
    recMock.mockResolvedValue([freshRec(3)]); // fresh sequel from the recommendation graph
    collectionMock.mockImplementation((id: number) => Promise.resolve(id === 3 ? 100 : null)); // same franchise
    const out = await bridge([poolTitle, other], [1], [], [878], [28], false, "US", SERVICES, false, []);
    expect(out.kind).toBe("match");
    if (out.kind === "match") {
      const ids = [out.movie.id, ...out.alternatives.map((x) => x.id)];
      expect(ids).toContain(1); // pool franchise entry kept
      expect(ids).not.toContain(3); // fresh sequel (same collection) dropped after enrichment
    }
  });
});
