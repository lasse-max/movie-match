import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// W1, on the real path: a Request into POST /api/blend → lib/blend (Claude and TMDB
// mocked at their modules, as in the other route tests) → the response. Then Next's
// part, done here by hand: once the response is sent, run what the route handed to
// after() → lib/retrieve's warm-up → fetch (Supabase, stubbed at that boundary).
vi.mock("server-only", () => ({}));

const { afterMock, afterTasks } = vi.hoisted(() => {
  const afterTasks: unknown[] = [];
  return { afterTasks, afterMock: vi.fn((task: unknown) => void afterTasks.push(task)) };
});
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: afterMock,
}));
/** What Next does once the response is sent: run every task handed to after(). */
const runAfter = () =>
  Promise.all(afterTasks.splice(0).map((t) => (typeof t === "function" ? t() : t)));

const { createMock, discoverMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  discoverMock: vi.fn(),
}));
vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "test-model",
  getAnthropic: () => ({ messages: { create: createMock } }),
}));
vi.mock("@/lib/tmdb", () => ({
  discoverMovies: discoverMock,
  searchKeyword: async () => 100,
  getCollectionId: async () => null,
  tmdbImageUrl: (p: string | null) => (p ? `https://img.test${p}` : null),
}));

import { POST } from "@/app/api/blend/route";
import { RETRIEVE_TIMEOUT_MS, WARMUP_TIMEOUT_MS } from "@/lib/retrieve";
import { DIM, fakeSupabase, film, hangingFetch, json, vec } from "./helpers/fakeSupabase";

const strategy = {
  moodRead: { summary: "dark and tense", axes: ["dark", "tense"] },
  directions: [
    { theme: "Horror", genreIds: [27], keywords: ["zombie"], tone: ["scary"], sourcePicks: ["P1: Horror"] },
  ],
};
const tmdbMovie = (id: number) => ({
  id,
  title: `Movie ${id}`,
  release_date: "2012-05-01",
  overview: "",
  poster_path: "/p.jpg",
  genre_ids: [27],
  vote_average: 7.2,
  vote_count: 800 + id,
  popularity: 40,
});
const catalogue = [film(901, vec(1, 0)), film(902, vec(0, 1))];

const post = () =>
  POST(
    new Request("http://localhost/api/blend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ p1: ["Horror", "Dark & gritty"], p2: ["Comedy", "Feel-good"] }),
    })
  );

/** The route's promise, or a failure if it takes longer than `ms` to respond. */
async function within<T>(ms: number, p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no response within ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([p, late]);
  } finally {
    clearTimeout(timer);
  }
}

const fetchMock = vi.fn();
let info: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

type WarmupLine = { event: string; outcome: string; ms: number };
/** The warm-up's log lines, parsed. */
const warmupLines = (): WarmupLine[] =>
  info.mock.calls
    .map(([line]: unknown[]) => {
      try {
        return JSON.parse(String(line)) as WarmupLine;
      } catch {
        return null;
      }
    })
    .filter((l: WarmupLine | null) => l?.event === "embeddings.warmup");

beforeEach(() => {
  vi.clearAllMocks();
  afterTasks.length = 0;
  createMock.mockResolvedValue({
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(strategy) }],
  });
  discoverMock.mockResolvedValue(Array.from({ length: 20 }, (_, i) => tmdbMovie(i + 1)));
  fetchMock.mockImplementation(fakeSupabase(catalogue));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("EMBEDDINGS_ENABLED", "true");
  vi.stubEnv("SUPABASE_URL", "https://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  info.mockRestore();
  warn.mockRestore();
  error.mockRestore();
});

describe("POST /api/blend warms the catalogue for Round 3 (W1)", () => {
  it("flag on: once the response is sent, one search on the game's path (match_movies, k 1), one line", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled(); // nothing runs before the response is sent

    await runAfter();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://db.test/rest/v1/rpc/match_movies");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ k: 1, exclude_ids: [] });
    const query = JSON.parse(body.query) as number[];
    expect(query).toHaveLength(DIM);
    expect(query.some((x) => x !== 0)).toBe(true); // cosine needs a non-zero vector
    expect(warmupLines()).toEqual([{ event: "embeddings.warmup", outcome: "ok", ms: expect.any(Number) }]);
  });

  it("a hanging warm-up doesn't delay the blend response, and stops at its own 5 s cap", async () => {
    fetchMock.mockImplementation(hangingFetch); // the database never answers
    const res = await within(1000, post());
    expect(res.status).toBe(200);
    expect((await res.json()).pool.length).toBeGreaterThan(0);

    vi.useFakeTimers();
    const warming = runAfter();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Past the game's 1.5 s per call it is still waiting: a cold search takes about 3 s.
    await vi.advanceTimersByTimeAsync(RETRIEVE_TIMEOUT_MS + 500);
    expect(warmupLines()).toEqual([]);
    await vi.advanceTimersByTimeAsync(WARMUP_TIMEOUT_MS - RETRIEVE_TIMEOUT_MS - 500);
    await warming;
    expect(warmupLines()).toEqual([{ event: "embeddings.warmup", outcome: "timeout", ms: WARMUP_TIMEOUT_MS }]);
  });

  it.each([
    ["the database is unreachable", () => Promise.reject(new TypeError("fetch failed"))],
    ["the database answers with an error", () => Promise.resolve(json({ message: "boom" }, 500))],
  ])("a failing warm-up (%s) doesn't change the blend result", async (_, failing) => {
    const healthy = await (await post()).json();
    await runAfter();

    fetchMock.mockImplementation(failing);
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(healthy);
    await runAfter(); // resolves: the warm-up keeps its error to itself
    expect(warmupLines().map((l) => l.outcome)).toEqual(["ok", "error"]);
  });

  it("flag off: no warm-up at all, so no database call", async () => {
    vi.stubEnv("EMBEDDINGS_ENABLED", "false");
    const res = await post();
    expect(res.status).toBe(200);
    await runAfter();
    expect(afterMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warmupLines()).toEqual([]);
  });

  it("flag on without database settings: no call, one config line", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    expect((await post()).status).toBe(200);
    await runAfter();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warmupLines()).toEqual([{ event: "embeddings.warmup", outcome: "config", ms: expect.any(Number) }]);
  });
});
