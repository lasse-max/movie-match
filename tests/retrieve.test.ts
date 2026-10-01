import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// lib/retrieve.ts: the vector math, the checks, the slot split, and retrieveFresh
// against a fake Supabase stubbed at the fetch boundary (it ranks a small catalogue
// by cosine, like the real match_movies). Availability goes through the real
// lib/availability with TMDB mocked.
vi.mock("server-only", () => ({}));

const { providersMock } = vi.hoisted(() => ({ providersMock: vi.fn() }));
vi.mock("@/lib/tmdb", () => ({ getWatchProvidersForRegion: providersMock }));

import {
  closestPair,
  cosine,
  meanVector,
  passesScreen,
  pickEligible,
  retrieveFresh,
  sharedSeed,
  FRESH_SLOTS,
  MAX_AVAIL_CHECKS,
  SHARED_SEED_MIN_SIM,
  SHARED_SLOTS,
  type CatalogueFilm,
  type EligibilityCheck,
  type RetrieveInput,
} from "@/lib/retrieve";
import type { PoolMovie } from "@/lib/blendTypes";
import { fakeSupabase, film, hangingFetch, json, vec, type Row } from "./helpers/fakeSupabase";

const onNetflix = {
  link: "https://jw.test",
  flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: null, display_priority: 1 }],
};

// Liked (pool) films: two whodunits, two space films, one romance.
const LIKED = [
  film(1, vec(1, 0, 0, 0)),
  film(2, vec(0.95, 0.05, 0, 0)),
  film(3, vec(0, 1, 0, 0)),
  film(4, vec(0, 0, 1, 0)),
  film(5, vec(0.01, 1, 0, 0)),
];
// Fresh clusters, each a little further from its axis as k grows.
const cluster = (base: number, axis: (k: number) => number[]) =>
  Array.from({ length: 10 }, (_, i) => film(base + i + 1, axis(i + 1)));
const WHODUNITS = cluster(100, (k) => vec(1, 0.02 * k, 0, 0));
const SPACE = cluster(200, (k) => vec(0.02 * k, 1, 0, 0));
const ROMANCE = cluster(300, (k) => vec(0, 0, 1, 0.02 * k));
const CATALOGUE = [...LIKED, ...WHODUNITS, ...SPACE, ...ROMANCE];

const fetchMock = vi.fn();
const stubSupabase = (catalogue: Row[], opts: { honourExclude?: boolean } = {}) =>
  fetchMock.mockImplementation(fakeSupabase(catalogue, opts));

const pm = (id: number, over: Partial<PoolMovie> = {}): PoolMovie => ({
  id, title: `Pool ${id}`, year: "2010", overview: "", posterUrl: null, genreIds: [],
  voteAverage: 7, voteCount: 500, directionIndex: 0, directionTheme: "Dir", collectionId: null, ...over,
});

const input = (likes: { 1: number[]; 2: number[] }, over: Partial<RetrieveInput> = {}): RetrieveInput => ({
  pool: LIKED.map((f) => pm(f.tmdb_id)),
  likes,
  swiped: new Set([...likes[1], ...likes[2]]),
  allowKidsFare: false,
  likedCollections: new Set(),
  region: "US",
  services: [8],
  willingToPay: false,
  ...over,
});
const ids = (films: { id: number }[] | null) => (films ?? []).map((f) => f.id);

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SUPABASE_URL", "https://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
  providersMock.mockResolvedValue(onNetflix); // everything watchable unless a test says otherwise
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  stubSupabase(CATALOGUE);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  warn.mockRestore();
});

// ---------------------------------------------------------------------------
describe("vector math", () => {
  it("averages component-wise, and has no fingerprint for no likes", () => {
    expect(meanVector([[1, 3], [3, 5]])).toEqual([2, 4]);
    expect(meanVector([])).toBeNull();
  });

  it("measures cosine similarity", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(cosine([0, 0], [1, 0])).toBe(0);
  });

  it("picks the most similar cross-player pair of likes", () => {
    const p1 = [[1, 0], [0, 1]];
    const p2 = [[0.2, 1], [-1, 0]];
    expect(closestPair(p1, p2)).toMatchObject({ i: 1, j: 0 }); // [0,1] and [0.2,1]
    expect(closestPair(p1, [])).toBeNull();
  });

  it("shares a seed only when the closest pair clears the threshold, at the pair's midpoint", () => {
    expect(SHARED_SEED_MIN_SIM).toBe(0.45);
    const above = sharedSeed([[1, 0]], [[0.46, Math.sqrt(1 - 0.46 ** 2)]]);
    expect(above.similarity).toBeCloseTo(0.46);
    expect(above.seed?.[0]).toBeCloseTo((1 + 0.46) / 2); // the midpoint of the pair
    const below = sharedSeed([[1, 0]], [[0.44, Math.sqrt(1 - 0.44 ** 2)]]);
    expect(below.similarity).toBeCloseTo(0.44);
    expect(below.seed).toBeNull(); // too far apart to share
  });
});

// ---------------------------------------------------------------------------
describe("the checks before a fresh film takes a slot", () => {
  const ok: CatalogueFilm = { ...film(500, []), similarity: 0.9 };
  const ctx = { excludeIds: new Set([7]), allowKidsFare: false, blockedCollections: new Set([777]) };

  it("passes a watchable-looking, quality, non-duplicate film", () => {
    expect(passesScreen(ok, ctx)).toBe(true);
  });
  it("drops a film in the pool or swiped this game", () => {
    expect(passesScreen({ ...ok, tmdb_id: 7 }, ctx)).toBe(false);
  });
  it("drops a film below the quality floor or with no poster", () => {
    expect(passesScreen({ ...ok, vote_count: 99 }, ctx)).toBe(false);
    expect(passesScreen({ ...ok, vote_average: 6.1 }, ctx)).toBe(false);
    expect(passesScreen({ ...ok, poster_path: null }, ctx)).toBe(false);
  });
  it("applies the kids-fare rule unless the couple opted in", () => {
    const kids = { ...ok, genre_ids: [16, 10751] };
    expect(passesScreen(kids, ctx)).toBe(false);
    expect(passesScreen(kids, { ...ctx, allowKidsFare: true })).toBe(true);
  });
  it("drops a film from a liked film's franchise", () => {
    expect(passesScreen({ ...ok, collection_id: 777 }, ctx)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("pickEligible: availability, franchise dedup, budget", () => {
  const row = (id: number, collection_id: number | null = null): CatalogueFilm => ({
    ...film(id, []), collection_id, similarity: 1 - id / 1000,
  });
  const fakeCheck = (eligible: Set<number>, already: Set<number> = new Set()) => {
    const checked = new Set(already);
    const started: number[] = [];
    const check: EligibilityCheck = {
      isChecked: (id) => checked.has(id),
      isEligible: async (id) => {
        if (!checked.has(id)) started.push(id);
        checked.add(id);
        return eligible.has(id);
      },
    };
    return { check, started };
  };

  it("keeps up to `need` eligible films, in similarity order, skipping unwatchable ones", async () => {
    const { check } = fakeCheck(new Set([1, 3, 4, 5]));
    const out = await pickEligible([1, 2, 3, 4, 5].map((i) => row(i)), 3, 12, check, { ids: new Set(), collections: new Set() });
    expect(out.picked.map((f) => f.tmdb_id)).toEqual([1, 3, 4]);
  });

  it("keeps one film per franchise", async () => {
    const { check } = fakeCheck(new Set([1, 2, 3]));
    const out = await pickEligible([row(1, 9), row(2, 9), row(3)], 3, 12, check, { ids: new Set(), collections: new Set() });
    expect(out.picked.map((f) => f.tmdb_id)).toEqual([1, 3]);
  });

  it("never spends more than its budget of new checks; films already checked are free", async () => {
    const { check, started } = fakeCheck(new Set(), new Set([1, 2])); // 1 and 2 were checked earlier
    await pickEligible(Array.from({ length: 20 }, (_, i) => row(i + 1)), 6, 4, check, { ids: new Set(), collections: new Set() });
    expect(started.length).toBe(4);
    expect(started).not.toContain(1);
  });
});

// ---------------------------------------------------------------------------
describe("retrieveFresh", () => {
  it("builds each fingerprint from the stored vectors of the player's likes, skipping films not in the catalogue", async () => {
    const out = await retrieveFresh(input({ 1: [1, 999], 2: [998] })); // 999, 998 not in the catalogue
    expect(out.stats.fingerprints).toEqual({ 1: true, 2: false });
    expect(ids(out.fresh[1]).every((id) => id > 100 && id <= 110)).toBe(true); // whodunits, near film 1
    expect(out.fresh[2]).toBeNull(); // no usable likes: today's path for that player
    expect(warn).not.toHaveBeenCalled(); // expected, not a failure
  });

  it("sends films near the shared seed to BOTH players, then fills each list with their own", async () => {
    const out = await retrieveFresh(input({ 1: [1], 2: [2] })); // two whodunit fans
    expect(out.stats.sharedSeed).toBe(true);
    expect(out.stats.sharedSimilarity).toBeGreaterThan(SHARED_SEED_MIN_SIM);
    const shared1 = out.fresh[1]!.filter((f) => f.shared).map((f) => f.id);
    const shared2 = out.fresh[2]!.filter((f) => f.shared).map((f) => f.id);
    expect(shared1).toHaveLength(SHARED_SLOTS);
    expect(shared2).toEqual(shared1); // the same films in both lists
    expect(out.fresh[1]).toHaveLength(FRESH_SLOTS); // 3 shared + 3 own
    expect(out.fresh[2]).toHaveLength(FRESH_SLOTS);
  });

  it("shares nothing when the closest pair is below the threshold: own fingerprints fill all six", async () => {
    const out = await retrieveFresh(input({ 1: [1], 2: [4] })); // whodunit vs romance
    expect(out.stats.sharedSeed).toBe(false);
    expect(out.fresh[1]!.some((f) => f.shared)).toBe(false);
    expect(out.fresh[1]).toHaveLength(FRESH_SLOTS);
    expect(ids(out.fresh[1]).every((id) => id > 100 && id <= 110)).toBe(true);
    expect(ids(out.fresh[2]).every((id) => id > 300 && id <= 310)).toBe(true);
  });

  it("fills a shared gap with the player's own films", async () => {
    // Shared seed = whodunits (films 1 and 2), but only one whodunit is watchable.
    // P1 leans space (likes 3 and 5 too), so their own list is space-first and can
    // make up the difference within the availability budget.
    providersMock.mockImplementation(async (id: number) => (id === 101 || (id > 200 && id <= 210) ? onNetflix : null));
    const out = await retrieveFresh(input({ 1: [1, 3, 5], 2: [2] }));
    expect(out.fresh[1]!.filter((f) => f.shared).map((f) => f.id)).toEqual([101]);
    expect(out.fresh[1]).toHaveLength(FRESH_SLOTS); // 1 shared + 5 own
    expect(out.fresh[1]!.filter((f) => !f.shared).every((f) => f.id > 200 && f.id <= 210)).toBe(true);
  });

  it("applies every check to retrieved films, even if the database ignores exclude_ids", async () => {
    // The nine films nearest film 1 are each disqualified by one check.
    const near = (k: number) => vec(1, 0.001 * k, 0, 0);
    const traps = [
      film(151, near(1)), // in the pool
      film(152, near(2)), // swiped this game
      film(153, near(3), { poster_path: null }),
      film(154, near(4), { vote_count: 50 }),
      film(155, near(5), { vote_average: 5.9 }),
      film(156, near(6), { genre_ids: [16, 10751] }), // kids' fare
      film(157, near(7), { collection_id: 777 }), // a liked film's franchise
      film(158, near(8)), // not watchable for this couple
      film(159, near(9)), // fine
    ];
    stubSupabase([...CATALOGUE, ...traps], { honourExclude: false });
    providersMock.mockImplementation(async (id: number) => (id === 158 ? null : onNetflix));
    const out = await retrieveFresh(
      input(
        { 1: [1], 2: [] },
        { pool: [1, 2, 3, 4, 151].map((id) => pm(id)), swiped: new Set([1, 152]), likedCollections: new Set([777]) }
      )
    );
    const got = ids(out.fresh[1]);
    expect(got).toContain(159);
    for (const id of [1, 151, 152, 153, 154, 155, 156, 157, 158]) expect(got).not.toContain(id);
  });

  it("caps availability checks at the per-player budget", async () => {
    providersMock.mockResolvedValue(null); // nothing watchable: it would check everything it could
    const out = await retrieveFresh(input({ 1: [1], 2: [] }));
    expect(providersMock.mock.calls.length).toBeLessThanOrEqual(MAX_AVAIL_CHECKS);
    expect(out.stats.availabilityChecks).toBeLessThanOrEqual(MAX_AVAIL_CHECKS);
    expect(out.fresh[1]).toBeNull(); // nothing eligible: today's path
    expect(out.stats.reason).toBe("empty");
  });

  it("sends a new secret key in apikey only, and a legacy JWT key as a Bearer token too", async () => {
    await retrieveFresh(input({ 1: [1], 2: [] }));
    const headersOf = () => fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headersOf().apikey).toBe("sb_secret_test");
    expect(headersOf().Authorization).toBeUndefined();

    fetchMock.mockClear();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJlegacy");
    await retrieveFresh(input({ 1: [1], 2: [] }));
    expect(headersOf().Authorization).toBe("Bearer eyJlegacy");
  });

  describe("falls back to today's path, with one structured warning, and never throws", () => {
    const expectFallback = (out: Awaited<ReturnType<typeof retrieveFresh>>, reason: string) => {
      expect(out.fresh).toEqual({ 1: null, 2: null });
      expect(out.stats.reason).toBe(reason);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({ event: "embeddings.fallback", reason });
    };

    it("on a database error", async () => {
      fetchMock.mockResolvedValue(json({ message: "boom" }, 500));
      expectFallback(await retrieveFresh(input({ 1: [1], 2: [2] })), "error");
    });

    it("on a network failure", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      expectFallback(await retrieveFresh(input({ 1: [1], 2: [2] })), "error");
    });

    it("on a malformed payload", async () => {
      fetchMock.mockResolvedValue(json({ not: "an array" }));
      expectFallback(await retrieveFresh(input({ 1: [1], 2: [2] })), "error");
    });

    it("on an empty result", async () => {
      stubSupabase(LIKED); // vectors load, but the catalogue has nothing else
      expectFallback(await retrieveFresh(input({ 1: [1], 2: [2] })), "empty");
    });

    it("when Supabase isn't configured, without calling it", async () => {
      vi.stubEnv("SUPABASE_URL", "");
      expectFallback(await retrieveFresh(input({ 1: [1], 2: [2] })), "config");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("on a timeout, within about 1.5 seconds", async () => {
      fetchMock.mockImplementation(hangingFetch);
      const started = Date.now();
      const out = await retrieveFresh(input({ 1: [1], 2: [2] }));
      expect(Date.now() - started).toBeLessThan(2500);
      expectFallback(out, "timeout");
    });
  });
});
