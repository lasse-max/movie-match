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
import type { PoolMovie } from "@/lib/blendTypes";
import type { InferResult } from "@/lib/inferTypes";

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

const fetchSpy = vi.fn(async () => {
  throw new Error("unexpected network call in test");
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchSpy);
  createMock.mockResolvedValue(refusal);
  recMock.mockResolvedValue([]);
  providersMock.mockResolvedValue(null);
  discoverMock.mockResolvedValue([]);
  collectionMock.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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
