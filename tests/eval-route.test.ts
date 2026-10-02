import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// E4 harness, end to end on the real path: a Request into POST /api/eval (dev-only)
// → the scripted game on a frozen pool → lib/infer → lib/retrieve → fetch
// (Supabase, stubbed at that boundary) → the JSON response and its `e4` block.
// TMDB and Claude are mocked at their modules, as in the other route tests.
vi.mock("server-only", () => ({}));

// One stable client, like the real lazily built singleton: the route wraps its
// messages.create only while inferMoods runs.
const { createMock, client } = vi.hoisted(() => {
  const createMock = vi.fn();
  return { createMock, client: { messages: { create: createMock } } };
});
vi.mock("@/lib/anthropic", () => ({ CLAUDE_MODEL: "test-model", getAnthropic: () => client }));

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

import { POST } from "@/app/api/eval/route";
import { fakeSupabase, film, vec } from "./helpers/fakeSupabase";

const onNetflix = {
  link: "https://jw.test",
  flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: null, display_priority: 1 }],
};

const pm = (id: number, genreIds: number[], voteCount: number, directionIndex: number) => ({
  id,
  title: `Pool ${id}`,
  year: "2010",
  overview: "",
  posterUrl: null,
  genreIds,
  voteAverage: 7,
  voteCount,
  directionIndex,
  directionTheme: directionIndex === 0 ? "Sci-fi" : "Action",
  collectionId: null,
});

// Cards are dealt alternately by vote count within each direction, so with the
// scripted swipes (each player likes cards in their own anchor genre) Player 1
// likes 1, 3 and 9 and Player 2 likes 2, 5, 8 and 12.
const pool = [
  pm(1, [878], 900, 0),
  pm(2, [878, 28], 800, 0),
  pm(3, [878], 700, 0),
  pm(7, [878], 400, 0),
  pm(9, [878], 300, 0),
  pm(11, [878], 200, 0),
  pm(4, [28], 950, 1),
  pm(5, [28], 600, 1),
  pm(6, [28], 500, 1),
  pm(8, [28], 350, 1),
  pm(10, [28], 250, 1),
  pm(12, [28], 150, 1),
];
const poolIds = new Set(pool.map((m) => m.id));
const blend = { moodRead: { summary: "Sci-fi meets action", axes: [] }, directions: [], pool };
const likes = { 1: [1, 3, 9], 2: [2, 5, 8, 12] };

const sciFi = (x: number) => vec(1, x);
const action = (x: number) => vec(x, 1);
const catalogue = [
  ...[1, 3, 7, 9, 11].map((id, i) => film(id, sciFi(0.01 * i))),
  film(2, vec(0.7, 0.7)),
  ...[4, 5, 6, 8, 10, 12].map((id, i) => film(id, action(0.01 * i))),
  ...Array.from({ length: 10 }, (_, i) => film(401 + i, sciFi(0.02 * (i + 1)), { genre_ids: [878] })),
  ...Array.from({ length: 10 }, (_, i) => film(501 + i, action(0.02 * (i + 1)), { genre_ids: [28] })),
];

// Claude echoes each player's candidates in the order it was given them.
const candidates = (prompt: string, p: 1 | 2) =>
  [...((prompt.split(`Player ${p} candidates`)[1] ?? "").split("\n\n")[0]).matchAll(/- (\d+):/g)].map(
    (m) => Number(m[1])
  );
const claudeReply = async (req: { messages: { content: string }[] }) => {
  const prompt = req.messages[0].content;
  return {
    stop_reason: "end_turn",
    usage: { input_tokens: 1234, output_tokens: 321 },
    content: [
      {
        type: "text",
        text: JSON.stringify({
          players: [
            { player: 1, moodRead: { summary: "Sci-fi", axes: ["cerebral"] }, recIds: candidates(prompt, 1) },
            { player: 2, moodRead: { summary: "Action", axes: ["kinetic"] }, recIds: candidates(prompt, 2) },
          ],
        }),
      },
    ],
  };
};

// A TMDB recommendation row (today's fresh path).
const rec = (id: number) => ({
  id,
  title: `Rec ${id}`,
  release_date: "2015-01-01",
  overview: "",
  poster_path: "/r.jpg",
  genre_ids: [878, 28],
  vote_average: 7.5,
  vote_count: 900,
  popularity: 30,
});

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/eval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

type Film = { id: number; source: string; offPool: boolean; liked: "own" | "other" | null };
type E4 = {
  inferMs: number;
  claude: { calls: number; inputTokens: number; outputTokens: number; stopReasons: string[] };
  retrieval: Record<string, unknown> | null;
  fallback: Record<string, unknown> | null;
  winnerId: number | null;
  winnerOffPool: boolean | null;
  final8: Record<"1" | "2", Film[]>;
};

const fetchMock = vi.fn();
let warn: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockImplementation(claudeReply);
  recMock.mockResolvedValue([rec(701), rec(702)]);
  providersMock.mockResolvedValue(onNetflix);
  discoverMock.mockResolvedValue([]);
  collectionMock.mockResolvedValue(null);
  fetchMock.mockImplementation(fakeSupabase(catalogue));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("EMBEDDINGS_ENABLED", "false"); // the request's override decides
  vi.stubEnv("SUPABASE_URL", "https://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  warn.mockRestore();
  info.mockRestore();
});

const game = async (embeddings: boolean) => {
  const res = await post({ p1: ["Sci-Fi"], p2: ["Action"], blend, embeddings });
  expect(res.status).toBe(200);
  const body = await res.json();
  return { body, e4: body.e4 as E4 };
};

describe("POST /api/eval reports what E4 measures", () => {
  it("embeddings on: Claude usage, the retrieval log line, and each film's origin in the final 8", async () => {
    const { body, e4 } = await game(true);

    expect(body.embeddings).toBe(true);
    expect(e4.claude).toEqual({ calls: 1, inputTokens: 1234, outputTokens: 321, stopReasons: ["end_turn"] });
    expect(e4.retrieval).toMatchObject({ event: "embeddings.retrieval", outcome: "embeddings" });
    expect(e4.fallback).toBeNull();
    expect(e4.inferMs).toBeGreaterThanOrEqual(0);

    for (const p of [1, 2] as const) {
      const list = e4.final8[p];
      expect(list.length).toBe(8); // every title is on Netflix: the full 8
      for (const f of list) {
        expect(f.offPool).toBe(!poolIds.has(f.id));
        const other = p === 1 ? 2 : 1;
        expect(f.liked).toBe(likes[p].includes(f.id) ? "own" : likes[other].includes(f.id) ? "other" : null);
      }
      // Catalogue films reached the final 8 (today's TMDB path was not used).
      expect(list.some((f) => f.offPool && f.id > 400 && f.id < 700)).toBe(true);
      expect(list.some((f) => f.id >= 700)).toBe(false);
    }
    expect(e4.final8[1].filter((f) => f.liked === "own").map((f) => f.id).sort()).toEqual([1, 3, 9]);

    expect(e4.winnerId).not.toBeNull();
    expect(e4.winnerOffPool).toBe(!poolIds.has(e4.winnerId!));
  });

  it("embeddings off: today's fresh films, no retrieval line and no database call", async () => {
    const { body, e4 } = await game(false);

    expect(body.embeddings).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(e4.retrieval).toBeNull();
    expect(e4.claude.calls).toBe(1);
    const fresh = e4.final8[1].filter((f) => f.offPool);
    expect(fresh.length).toBeGreaterThan(0);
    for (const f of fresh) expect([701, 702]).toContain(f.id); // TMDB recommendations
  });

  it("makes a failed Claude call visible (the engine itself quietly falls back)", async () => {
    createMock.mockRejectedValue(new Error("overloaded"));
    const { e4 } = await game(true);
    expect(e4.claude.calls).toBe(0);
    expect(e4.claude.stopReasons).toEqual([]);
  });

  it("puts the Claude client and the console back after the call", async () => {
    await game(true);
    expect(client.messages.create).toBe(createMock);
    expect(console.info).toBe(info);
    expect(console.warn).toBe(warn);
  });
});
