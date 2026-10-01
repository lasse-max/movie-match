import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Embeddings v1 · E3. inferMoods with the EMBEDDINGS_ENABLED flag off (today's
// path, pinned by a golden snapshot) and on (catalogue retrieval via Supabase,
// stubbed at the fetch boundary), plus the E-9 rejection rules in both modes.
vi.mock("server-only", () => ({}));

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "test-model",
  getAnthropic: () => ({ messages: { create: createMock } }),
}));

const { recMock, providersMock, discoverMock, collectionMock } = vi.hoisted(() => ({
  recMock: vi.fn(),
  providersMock: vi.fn(),
  discoverMock: vi.fn(),
  collectionMock: vi.fn(),
}));
vi.mock("@/lib/tmdb", () => ({
  getRecommendations: recMock,
  getWatchProvidersForRegion: providersMock,
  discoverMovies: discoverMock,
  getCollectionId: collectionMock,
  tmdbImageUrl: (p: string | null) => (p ? `https://img.test${p}` : null),
}));

import { inferMoods } from "@/lib/infer";
import { FRESH_SLOTS } from "@/lib/retrieve";
import type { PoolMovie } from "@/lib/blendTypes";
import type { InferResult } from "@/lib/inferTypes";
import { fakeSupabase, film, hangingFetch, vec, type Row } from "./helpers/fakeSupabase";

const onNetflix = {
  link: "https://jw.test",
  flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: null, display_priority: 1 }],
};

const pm = (id: number, over: Partial<PoolMovie> = {}): PoolMovie => ({
  id,
  title: `Pool ${id}`,
  year: "2010",
  overview: "",
  posterUrl: null,
  genreIds: [],
  voteAverage: 7,
  voteCount: 500,
  directionIndex: 0,
  directionTheme: "Dir A",
  collectionId: null,
  ...over,
});

// A TMDB recommendation / discover row.
const rec = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  title: `Rec ${id}`,
  release_date: "2015-01-01",
  overview: "",
  poster_path: "/r.jpg",
  genre_ids: [878],
  vote_average: 7.5,
  vote_count: 900,
  popularity: 30,
  ...over,
});

const refusal = { stop_reason: "refusal", content: [] };
const aiInfer = (players: unknown[]) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify({ players }) }],
});

// Compact, order-preserving view of a result: id:source:included-on-a-service.
const view = (r: InferResult) => ({
  1: { mood: r[1].moodRead.summary, recs: r[1].recs.map((x) => `${x.id}:${x.source}:${x.availability.flatrate.length ? "inc" : "-"}`) },
  2: { mood: r[2].moodRead.summary, recs: r[2].recs.map((x) => `${x.id}:${x.source}:${x.availability.flatrate.length ? "inc" : "-"}`) },
});

const fetchSpy = vi.fn();
let warn: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  // Any network call fails loudly unless a test installs a fake database.
  fetchSpy.mockImplementation(async () => {
    throw new Error("unexpected network call in test");
  });
  vi.stubGlobal("fetch", fetchSpy);
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  createMock.mockResolvedValue(refusal);
  recMock.mockResolvedValue([]);
  providersMock.mockResolvedValue(null);
  discoverMock.mockResolvedValue([]);
  collectionMock.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  warn.mockRestore();
  info.mockRestore();
});

// Candidate ids a player's list sent to Claude (parsed from the prompt).
const promptCandidates = (player: 1 | 2): number[] => {
  const text: string = createMock.mock.calls[0][0].messages[0].content;
  const block = text.split(`Player ${player} candidates`)[1]?.split("\n\n")[0] ?? "";
  return [...block.matchAll(/^\s+- (\d+):/gm)].map((m) => Number(m[1]));
};
const recIds = (r: InferResult, p: 1 | 2) => r[p].recs.map((x) => x.id);

// ---------------------------------------------------------------------------
// Golden fixture: cross-player + own likes + fresh + padding + availability +
// provider backfill, with "Not it" swipes that E-9 leaves untouched (each player
// rejected only a film outside their own mood, and no film was rejected by both).
// ---------------------------------------------------------------------------
const goldenPool: PoolMovie[] = [
  pm(1, { genreIds: [878], voteCount: 900 }),
  pm(2, { genreIds: [878, 28], voteCount: 800 }),
  pm(3, { genreIds: [878], voteCount: 700 }),
  pm(4, { genreIds: [28], voteCount: 950 }),
  pm(5, { genreIds: [28], voteCount: 600 }),
  pm(6, { genreIds: [28, 53], voteCount: 500 }),
  pm(7, { genreIds: [878], voteCount: 400 }),
  pm(8, { genreIds: [28], voteCount: 300 }),
  pm(9, { genreIds: [18], voteCount: 1000 }),
  pm(10, { genreIds: [878], voteCount: 350 }),
  pm(11, { genreIds: [28], voteCount: 450 }),
  pm(12, { genreIds: [878, 12], voteCount: 550 }),
];
const goldenSwipes = {
  1: { yes: [1, 3], no: [4] }, // rejects an action title (off P1's sci-fi mood)
  2: { yes: [2, 5], no: [7] }, // rejects a sci-fi title (off P2's action mood)
};
const goldenCategories = { 1: ["Sci-Fi"], 2: ["Action"] };

function arrangeGolden() {
  recMock.mockResolvedValue([
    rec(101, { vote_average: 7.9 }),
    rec(102, { vote_average: 7.5 }),
    rec(103, { vote_average: 6.0 }), // below the floor
  ]);
  providersMock.mockImplementation(async (id: number) => (id % 2 === 0 ? onNetflix : null));
  discoverMock.mockResolvedValue([rec(202, { genre_ids: [878] }), rec(204, { genre_ids: [28] })]);
  createMock.mockResolvedValue(
    aiInfer([
      { player: 1, moodRead: { summary: "Cerebral sci-fi", axes: ["cerebral"] }, recIds: [101, 2, 3, 1, 102, 999] },
      { player: 2, moodRead: { summary: "Big action", axes: ["kinetic"] }, recIds: [5, 102, 2, 101, 888] },
    ])
  );
}

describe("flag off: today's path, unchanged (golden)", () => {
  it("produces exactly today's candidate lists and Round 3 output, with no database call", async () => {
    vi.stubEnv("EMBEDDINGS_ENABLED", "false");
    arrangeGolden();

    const result = await inferMoods(goldenPool, goldenSwipes, goldenCategories, "US", [8], false);

    expect(fetchSpy).not.toHaveBeenCalled(); // no Supabase, no retrieval
    expect(createMock).toHaveBeenCalledTimes(1);
    const prompt = createMock.mock.calls[0][0].messages[0].content;
    expect(prompt).toMatchInlineSnapshot(`
      "Player 1 swiped TOWARD: Pool 1 (2010); Pool 3 (2010)
      Player 1 swiped AWAY: Pool 4 (2010)
      Player 1 candidates (rank ~8, best first):
        - 2: Pool 2 (2010) [Science Fiction, Action] — Dir A
        - 1: Pool 1 (2010) [Science Fiction] — Dir A
        - 3: Pool 3 (2010) [Science Fiction] — Dir A
        - 101: Rec 101 (2015) [Science Fiction] — Fresh pick
        - 102: Rec 102 (2015) [Science Fiction] — Fresh pick
        - 7: Pool 7 (2010) [Science Fiction] — Dir A
        - 10: Pool 10 (2010) [Science Fiction] — Dir A
        - 12: Pool 12 (2010) [Science Fiction, Adventure] — Dir A

      Player 2 swiped TOWARD: Pool 2 (2010); Pool 5 (2010)
      Player 2 swiped AWAY: Pool 7 (2010)
      Player 2 candidates (rank ~8, best first):
        - 2: Pool 2 (2010) [Science Fiction, Action] — Dir A
        - 5: Pool 5 (2010) [Action] — Dir A
        - 101: Rec 101 (2015) [Science Fiction] — Fresh pick
        - 102: Rec 102 (2015) [Science Fiction] — Fresh pick
        - 4: Pool 4 (2010) [Action] — Dir A
        - 6: Pool 6 (2010) [Action, Thriller] — Dir A
        - 8: Pool 8 (2010) [Action] — Dir A
        - 11: Pool 11 (2010) [Action] — Dir A"
    `);
    expect(view(result)).toMatchInlineSnapshot(`
      {
        "1": {
          "mood": "Cerebral sci-fi",
          "recs": [
            "101:fresh:-",
            "2:cross-player:inc",
            "3:swipe:-",
            "1:swipe:-",
            "102:fresh:inc",
            "7:swipe:-",
            "10:swipe:inc",
            "12:swipe:inc",
            "202:fresh:inc",
          ],
        },
        "2": {
          "mood": "Big action",
          "recs": [
            "5:swipe:-",
            "102:fresh:inc",
            "2:swipe:inc",
            "101:fresh:-",
            "4:swipe:inc",
            "6:swipe:inc",
            "8:swipe:inc",
            "11:swipe:-",
          ],
        },
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// E-9 · rejections go first. Applies with or without embeddings (flag on below).
// Each case is built so the rejected film WOULD reach Round 3 without the rule.
// ---------------------------------------------------------------------------
describe("E-9: rejections go first (flag off)", () => {
  beforeEach(() => {
    vi.stubEnv("EMBEDDINGS_ENABLED", "false");
    providersMock.mockResolvedValue(onNetflix); // everything watchable: availability can't hide a leak
  });

  it("a film BOTH players rejected never reaches Round 3: not padding, backfill, provider backfill or cross-player", async () => {
    // 50 fits both moods; both rejected it. P2 ALSO lists it as a like (a malformed
    // client), which would make it a cross-player pick for P1.
    const pool = [
      pm(50, { genreIds: [878, 28], voteCount: 3000 }),
      pm(51, { genreIds: [878] }),
      pm(52, { genreIds: [28] }),
      pm(53, { genreIds: [878] }),
      pm(54, { genreIds: [28] }),
    ];
    discoverMock.mockResolvedValue([rec(50, { genre_ids: [878, 28] })]); // the service catalog returns it too
    const result = await inferMoods(
      pool,
      { 1: { yes: [51], no: [50] }, 2: { yes: [52, 50], no: [50] } },
      { 1: ["Sci-Fi"], 2: ["Action"] },
      "US",
      [8],
      false
    );
    expect(promptCandidates(1)).not.toContain(50);
    expect(promptCandidates(2)).not.toContain(50);
    expect(recIds(result, 1)).not.toContain(50);
    expect(recIds(result, 2)).not.toContain(50);
  });

  it("a player's OWN rejection never pads their own list, but can still pad the other player's", async () => {
    const pool = [
      pm(60, { genreIds: [878, 28], voteCount: 3000 }), // fits both moods; only P1 rejected it
      pm(61, { genreIds: [878] }),
      pm(62, { genreIds: [28] }),
      pm(63, { genreIds: [878] }),
      pm(64, { genreIds: [28] }),
    ];
    discoverMock.mockResolvedValue([rec(60, { genre_ids: [878, 28] })]);
    const result = await inferMoods(
      pool,
      { 1: { yes: [61], no: [60] }, 2: { yes: [62], no: [] } },
      { 1: ["Sci-Fi"], 2: ["Action"] },
      "US",
      [8],
      false
    );
    expect(promptCandidates(1)).not.toContain(60);
    expect(recIds(result, 1)).not.toContain(60); // not padding, backfill or provider backfill
    expect(recIds(result, 2)).toContain(60); // P2 never rejected it
  });

  it("an own rejection may still reach the player as the OTHER player's pick (cross-player)", async () => {
    // Only padding is barred. If the other player liked it, it is a real match signal.
    const pool = [pm(60, { genreIds: [878, 28] }), pm(61, { genreIds: [878] }), pm(62, { genreIds: [28] })];
    const result = await inferMoods(
      pool,
      { 1: { yes: [61], no: [60] }, 2: { yes: [62, 60], no: [] } },
      { 1: ["Sci-Fi"], 2: ["Action"] },
      "US",
      [8],
      false
    );
    expect(result[1].recs.find((r) => r.id === 60)?.source).toBe("cross-player");
  });

  it("a fresh film from a liked film's franchise never pushes the liked film out", async () => {
    // P1 liked 70 (franchise 777). TMDB recommends 170, a sequel in the same
    // franchise, and the AI ranks the sequel first. Without the guard the
    // franchise dedup keeps the higher-ranked fresh sequel and drops the like.
    const pool = [
      pm(70, { genreIds: [878], collectionId: 777 }),
      pm(71, { genreIds: [878] }),
      pm(72, { genreIds: [28] }),
    ];
    recMock.mockResolvedValue([rec(170)]);
    collectionMock.mockImplementation(async (id: number) => (id === 170 ? 777 : null));
    createMock.mockResolvedValue(
      aiInfer([
        { player: 1, moodRead: { summary: "Sci-fi", axes: [] }, recIds: [170, 70, 71] },
        { player: 2, moodRead: { summary: "Action", axes: [] }, recIds: [72] },
      ])
    );
    const result = await inferMoods(
      pool,
      { 1: { yes: [70], no: [] }, 2: { yes: [72], no: [] } },
      { 1: ["Sci-Fi"], 2: ["Action"] },
      "US",
      [8],
      false
    );
    expect(recIds(result, 1)).toContain(70); // the liked film stays
    expect(recIds(result, 1)).not.toContain(170); // the same-franchise fresh pick is dropped
  });
});

// ---------------------------------------------------------------------------
// Flag on: a fake Supabase at the fetch boundary serves the fresh films.
// Vectors for the golden pool's liked films (P1: 1, 3 · P2: 2, 5), plus a sci-fi
// cluster near P1 and an action cluster near P2. Film 2 sits close to P1's likes,
// so the closest cross-player pair clears the threshold and seeds shared films.
// ---------------------------------------------------------------------------
const goldenCatalogue: Row[] = [
  film(1, vec(1, 0)),
  film(3, vec(0.9, 0.1)),
  film(2, vec(0.95, 0.05)),
  film(5, vec(0, 1)),
  ...Array.from({ length: 10 }, (_, i) => film(401 + i, vec(1, 0.02 * (i + 1)), { genre_ids: [878] })),
  ...Array.from({ length: 10 }, (_, i) => film(501 + i, vec(0.02 * (i + 1), 1), { genre_ids: [28] })),
];

function flagOn(catalogue: Row[] = goldenCatalogue, opts: { honourExclude?: boolean } = {}) {
  vi.stubEnv("EMBEDDINGS_ENABLED", "true");
  vi.stubEnv("SUPABASE_URL", "https://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
  fetchSpy.mockImplementation(fakeSupabase(catalogue, opts));
}
const freshIn = (ids: number[]) => ids.filter((id) => id > 400);

describe("flag on: catalogue retrieval serves the fresh films", () => {
  beforeEach(() => {
    providersMock.mockResolvedValue(onNetflix);
  });

  it("replaces today's fresh expansion with up to six catalogue films per player, after every liked film", async () => {
    flagOn();
    await inferMoods(goldenPool, goldenSwipes, goldenCategories, "US", [8], false);

    expect(fetchSpy).toHaveBeenCalled(); // the catalogue
    expect(recMock).not.toHaveBeenCalled(); // not today's TMDB recommendations
    const c1 = promptCandidates(1);
    expect(c1.slice(0, 3)).toEqual([2, 1, 3]); // cross-player, then own likes, first
    expect(freshIn(c1)).toHaveLength(FRESH_SLOTS);
    expect(freshIn(promptCandidates(2))).toHaveLength(FRESH_SLOTS);
  });

  it("puts the shared films in BOTH players' lists", async () => {
    flagOn();
    await inferMoods(goldenPool, goldenSwipes, goldenCategories, "US", [8], false);
    const shared = freshIn(promptCandidates(1)).filter((id) => promptCandidates(2).includes(id));
    expect(shared.length).toBeGreaterThanOrEqual(3);
  });

  it("lets more than two fresh films reach Round 3 when Claude ranks them first (today's cap is two)", async () => {
    flagOn();
    createMock.mockImplementation(async (req: { messages: { content: string }[] }) => {
      const content = req.messages[0].content;
      const fresh = (p: 1 | 2) =>
        [...((content.split(`Player ${p} candidates`)[1] ?? "").split("\n\n")[0]).matchAll(/- (\d+):/g)]
          .map((m) => Number(m[1]))
          .filter((id) => id > 400);
      return aiInfer([
        { player: 1, moodRead: { summary: "Sci-fi", axes: [] }, recIds: [...fresh(1), 2, 1, 3] },
        { player: 2, moodRead: { summary: "Action", axes: [] }, recIds: [...fresh(2), 2, 5] },
      ]);
    });
    const result = await inferMoods(goldenPool, goldenSwipes, goldenCategories, "US", [8], false);
    expect(result[1].recs.slice(0, 8).filter((r) => r.source === "fresh")).toHaveLength(FRESH_SLOTS);
  });

  it("never pushes a liked film out of the 16 candidates, however many fresh films there are", async () => {
    // 14 liked sci-fi films between them: only 2 of P1's 16 slots are left for fresh.
    const likedIds = Array.from({ length: 14 }, (_, i) => 21 + i);
    const pool = likedIds.map((id) => pm(id, { genreIds: [878] }));
    const catalogue = [
      ...likedIds.map((id) => film(id, vec(1, 0.001 * id))),
      ...Array.from({ length: 10 }, (_, i) => film(401 + i, vec(1, 0.02 * (i + 1)), { genre_ids: [878] })),
    ];
    flagOn(catalogue);
    await inferMoods(
      pool,
      { 1: { yes: likedIds.slice(0, 8), no: [] }, 2: { yes: likedIds.slice(8), no: [] } },
      { 1: ["Sci-Fi"], 2: ["Sci-Fi"] },
      "US",
      [8],
      false
    );
    const c1 = promptCandidates(1);
    expect(c1).toHaveLength(16);
    for (const id of likedIds) expect(c1).toContain(id); // all 14 likes kept
    expect(freshIn(c1)).toHaveLength(2); // fresh only took what padding would have
  });

  it("keeps E-9 even when the database ignores exclude_ids and returns a rejected film first", async () => {
    const pool = [
      pm(50, { genreIds: [878, 28] }),
      pm(51, { genreIds: [878] }),
      pm(52, { genreIds: [28] }),
    ];
    const catalogue = [
      film(51, vec(1, 0)),
      film(52, vec(0, 1)),
      film(50, vec(0.99, 0.01), { genre_ids: [878, 28] }), // right at P1's fingerprint
      ...Array.from({ length: 10 }, (_, i) => film(401 + i, vec(1, 0.02 * (i + 1)), { genre_ids: [878] })),
      ...Array.from({ length: 10 }, (_, i) => film(501 + i, vec(0.02 * (i + 1), 1), { genre_ids: [28] })),
    ];
    flagOn(catalogue, { honourExclude: false });
    discoverMock.mockResolvedValue([rec(50, { genre_ids: [878, 28] })]);
    const result = await inferMoods(
      pool,
      { 1: { yes: [51], no: [50] }, 2: { yes: [52], no: [50] } },
      { 1: ["Sci-Fi"], 2: ["Action"] },
      "US",
      [8],
      false
    );
    expect(promptCandidates(1)).not.toContain(50);
    expect(promptCandidates(2)).not.toContain(50);
    expect(recIds(result, 1)).not.toContain(50);
    expect(recIds(result, 2)).not.toContain(50);
  });

  it("lets the eval route force retrieval off or on per request, whatever the env says", async () => {
    flagOn(); // env says on
    await inferMoods(goldenPool, goldenSwipes, goldenCategories, "US", [8], false, { embeddings: false });
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.stubEnv("EMBEDDINGS_ENABLED", "false"); // env says off
    await inferMoods(goldenPool, goldenSwipes, goldenCategories, "US", [8], false, { embeddings: true });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("logs one structured line per game: counts and similarity, no titles", async () => {
    flagOn();
    await inferMoods(goldenPool, goldenSwipes, goldenCategories, "US", [8], false);
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0][0]);
    expect(JSON.parse(line)).toMatchObject({
      event: "embeddings.retrieval",
      outcome: "embeddings",
      fingerprints: { 1: true, 2: true },
      sharedSeed: true,
      selected: { 1: FRESH_SLOTS, 2: FRESH_SLOTS },
      servedBy: { 1: "embeddings", 2: "embeddings" },
    });
    expect(JSON.parse(line).used[1]).toBeGreaterThan(0);
    expect(line).not.toMatch(/Pool |Cat |Rec /); // no titles
    expect(warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Fail safe. Regression tests for the fallback: with the flag ON and the database
// failing, the game returns exactly today's output (the golden path) instead of an
// error. Each fails without its fix (verified by reverting it; see the report).
// ---------------------------------------------------------------------------
describe("fail safe: a broken database falls back to today's path, exactly", () => {
  async function todaysOutput() {
    vi.stubEnv("EMBEDDINGS_ENABLED", "false");
    arrangeGolden();
    const result = await inferMoods(goldenPool, goldenSwipes, goldenCategories, "US", [8], false);
    const prompt = createMock.mock.calls[0][0].messages[0].content;
    createMock.mockClear();
    return { result, prompt };
  }
  async function withBrokenDatabase(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
    flagOn();
    fetchSpy.mockImplementation(fetchImpl);
    const result = await inferMoods(goldenPool, goldenSwipes, goldenCategories, "US", [8], false);
    return { result, prompt: createMock.mock.calls[0][0].messages[0].content };
  }

  it("when the database is down", async () => {
    const today = await todaysOutput();
    const broken = await withBrokenDatabase(async () => {
      throw new TypeError("fetch failed");
    });
    expect(fetchSpy).toHaveBeenCalled();
    expect(broken.prompt).toBe(today.prompt);
    expect(view(broken.result)).toEqual(view(today.result));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("when the database hangs (1.5 s timeout)", async () => {
    const today = await todaysOutput();
    const started = Date.now();
    const broken = await withBrokenDatabase(hangingFetch);
    expect(Date.now() - started).toBeLessThan(2500);
    expect(broken.prompt).toBe(today.prompt);
    expect(view(broken.result)).toEqual(view(today.result));
  });
});
