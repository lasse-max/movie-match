// Test helper: a fake Supabase for lib/retrieve.ts, stubbed at the fetch boundary.
// It serves stored vectors from /rest/v1/movies and answers /rest/v1/rpc/match_movies
// by ranking the catalogue by cosine against the query, like the real function.
import type { CatalogueFilm } from "@/lib/retrieve";

export const DIM = 1536; // text-embedding-3-small; lib/retrieve rejects other sizes

/** A vector in a tiny semantic space, padded to the real dimension with zeros. */
export const vec = (...xs: number[]) => [...xs, ...new Array<number>(DIM - xs.length).fill(0)];

export const cos = (a: number[], b: number[]) => {
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
};

/** A catalogue row plus its stored vector. */
export interface Row extends Omit<CatalogueFilm, "similarity"> {
  v: number[];
}

export const film = (id: number, v: number[], over: Partial<Row> = {}): Row => ({
  tmdb_id: id,
  title: `Cat ${id}`,
  year: 2015,
  overview: "o",
  genre_ids: [9648],
  collection_id: null,
  vote_count: 900,
  vote_average: 7.4,
  poster_path: "/p.jpg",
  v,
  ...over,
});

export const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });

/** A fetch implementation backed by `catalogue`. `honourExclude: false` simulates a
 * database that ignores exclude_ids, to prove the checks don't rely on it. */
export function fakeSupabase(catalogue: Row[], opts: { honourExclude?: boolean } = {}) {
  return async (url: string, init: RequestInit = {}): Promise<Response> => {
    const u = new URL(url);
    if (u.pathname.endsWith("/rest/v1/movies")) {
      const ids = (u.searchParams.get("tmdb_id") ?? "")
        .replace(/^in\.\(|\)$/g, "")
        .split(",")
        .map(Number);
      return json(
        catalogue
          .filter((r) => ids.includes(r.tmdb_id))
          .map((r) => ({ tmdb_id: r.tmdb_id, embedding: `[${r.v.join(",")}]` }))
      );
    }
    if (u.pathname.endsWith("/rest/v1/rpc/match_movies")) {
      const body = JSON.parse(String(init.body));
      const q = JSON.parse(body.query) as number[];
      const exclude = new Set<number>(body.exclude_ids);
      return json(
        catalogue
          .filter((r) => opts.honourExclude === false || !exclude.has(r.tmdb_id))
          .map(({ v, ...rest }) => ({ ...rest, similarity: cos(q, v) }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, body.k)
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

/** A fetch that never answers until its signal aborts (a hung database). */
export const hangingFetch = (_url: string, init: RequestInit = {}) =>
  new Promise<Response>((_, reject) =>
    init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
  );
