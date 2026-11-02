import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// End to end on the real path: a Request into POST /api/infer → request
// validation → lib/infer → lib/retrieve → fetch (Supabase, stubbed at that
// boundary only) → the JSON response. TMDB and Claude are mocked at their modules,
// as in the other infer tests.
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

import { POST } from "@/app/api/infer/route";
import { fakeSupabase, film, vec } from "./helpers/fakeSupabase";

const onNetflix = {
  link: "https://jw.test",
  flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: null, display_priority: 1 }],
};

const poolMovie = (id: number, genreIds: number[], voteCount = 500) => ({
  id,
  title: `Pool ${id}`,
  year: "2010",
  overview: "",
  posterUrl: null,
  genreIds,
  voteAverage: 7,
  voteCount,
  directionIndex: 0,
  directionTheme: "Dir",
  collectionId: null,
});

// P1 leans sci-fi (likes 1, 3), P2 action (likes 2, 5); film 2 sits near P1's
// likes, so the couple shares a seed. 4 and 7 are rejected.
const requestBody = {
  pool: [
    poolMovie(1, [878], 900),
    poolMovie(2, [878, 28], 800),
    poolMovie(3, [878], 700),
    poolMovie(4, [28]),
    poolMovie(5, [28], 600),
    poolMovie(6, [28]),
    poolMovie(7, [878]),
  ],
  swipes: { 1: { yes: [1, 3], no: [4] }, 2: { yes: [2, 5], no: [7] } },
  categories: { 1: ["Sci-Fi"], 2: ["Action"] },
  region: "US",
  services: [8],
  willingToPay: false,
};
const catalogue = [
  film(1, vec(1, 0)),
  film(3, vec(0.9, 0.1)),
  film(2, vec(0.95, 0.05)),
  film(5, vec(0, 1)),
  ...Array.from({ length: 10 }, (_, i) => film(401 + i, vec(1, 0.02 * (i + 1)), { genre_ids: [878] })),
  ...Array.from({ length: 10 }, (_, i) => film(501 + i, vec(0.02 * (i + 1), 1), { genre_ids: [28] })),
];

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/infer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

type Rec = { id: number; source: string; availability: { flatrate: unknown[] } };
type Body = Record<"1" | "2", { recs: Rec[] }>;

const fetchMock = vi.fn();
let warn: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockResolvedValue({ stop_reason: "refusal", content: [] }); // deterministic fill
  recMock.mockResolvedValue([]);
  providersMock.mockResolvedValue(onNetflix);
  discoverMock.mockResolvedValue([]);
  collectionMock.mockResolvedValue(null);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("EMBEDDINGS_ENABLED", "true");
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

describe("POST /api/infer with embeddings on (real path, database stubbed at fetch)", () => {
  it("returns catalogue fresh films for both players, the shared ones in both lists", async () => {
    fetchMock.mockImplementation(fakeSupabase(catalogue));
    const res = await post(requestBody);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;

    const fresh = (p: "1" | "2") => body[p].recs.filter((r) => r.source === "fresh").map((r) => r.id);
    expect(fresh("1").length).toBeGreaterThan(2); // past today's cap of two
    expect(fresh("1").every((id) => id > 400)).toBe(true); // from the catalogue
    expect(fresh("1").filter((id) => fresh("2").includes(id)).length).toBeGreaterThan(0); // shared
    expect(body["1"].recs.map((r) => r.id)).not.toContain(4); // P1's own rejection never pads
    expect(body["2"].recs.map((r) => r.id)).not.toContain(7); // nor P2's
    expect(body["1"].recs.find((r) => r.id === fresh("1")[0])!.availability.flatrate.length).toBeGreaterThan(0);
    expect(recMock).not.toHaveBeenCalled(); // today's TMDB fresh path not used
    expect(info).toHaveBeenCalledTimes(1); // the per-game log line
  });

  it("still answers 200 on today's path when the database is down: never an error screen", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    recMock.mockResolvedValue([
      { id: 99, title: "Rec 99", release_date: "2015-01-01", overview: "", poster_path: "/r.jpg", genre_ids: [878], vote_average: 7.6, vote_count: 900, popularity: 10 },
    ]);
    const res = await post(requestBody);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body["1"].recs.find((r) => r.id === 99)?.source).toBe("fresh"); // today's TMDB fresh pick
    expect(body["1"].recs.length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledTimes(1); // one structured warning
  });

  // F3 (Cato 2.0 finding 3): the 1.5 s limit covered the database only, so a hung
  // availability lookup held the whole game. Now one 3 s deadline covers the step.
  it("gives the whole catalogue step 3 s: a hung availability lookup falls back to today's path", async () => {
    fetchMock.mockImplementation(fakeSupabase(catalogue)); // the database works
    // Availability for catalogue films never answers until cancelled; the pool's
    // own films and today's fresh pick answer as usual.
    const cancelled: number[] = [];
    providersMock.mockImplementation((id: number, _region: string, signal?: AbortSignal) =>
      id > 400
        ? new Promise((_, reject) =>
            signal?.addEventListener("abort", () => {
              cancelled.push(id);
              reject(new DOMException("aborted", "AbortError"));
            })
          )
        : Promise.resolve(onNetflix)
    );
    recMock.mockResolvedValue([
      { id: 99, title: "Rec 99", release_date: "2015-01-01", overview: "", poster_path: "/r.jpg", genre_ids: [878], vote_average: 7.6, vote_count: 900, popularity: 10 },
    ]);

    const started = Date.now();
    const res = await post(requestBody);
    const elapsed = Date.now() - started;

    expect(res.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(2900); // it waited out the deadline…
    expect(elapsed).toBeLessThan(4500); // …and no longer
    const body = (await res.json()) as Body;
    for (const p of ["1", "2"] as const) {
      expect(body[p].recs.some((r) => r.id > 400)).toBe(false); // no catalogue film: today's path
    }
    expect(body["1"].recs.find((r) => r.id === 99)?.source).toBe("fresh"); // today's TMDB fresh pick
    const fallbacks = warn.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .filter((line: string) => line.includes("embeddings.fallback"));
    expect(fallbacks).toHaveLength(1);
    expect(JSON.parse(fallbacks[0])).toMatchObject({ reason: "deadline", players: [1, 2] });
    expect(cancelled.length).toBeGreaterThan(0); // the hung lookups were cancelled
  }, 15000);

  it("ignores any client attempt to switch embeddings (the override is eval-only)", async () => {
    fetchMock.mockImplementation(fakeSupabase(catalogue));
    vi.stubEnv("EMBEDDINGS_ENABLED", "false");
    const res = await post({ ...requestBody, embeddings: true });
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled(); // the live route never forwards it
  });
});
