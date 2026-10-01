-- Embeddings v1 · Track A · slice E1 (schema)
--
-- Enables pgvector, creates the `movies` catalogue, a cosine index, the
-- match_movies() retrieval function, and locks the table down with RLS.
--
-- Arthur writes this file; LASSE APPLIES IT (Supabase SQL editor). It is never
-- auto-applied. Re-runnable: every statement is idempotent (if-not-exists /
-- or-replace), so pasting it twice is safe.
--
-- Decisions it implements (docs/decisions/2026-10-01_embeddings-v1.md):
--   E-4  model text-embedding-3-small  -> vector(1536)
--   E-5  Supabase pgvector, server-side only
--   inv.4  RLS on, no public access; only the service role (which bypasses RLS)
--          can read or write.

-- ---------------------------------------------------------------------------
-- 1. Extension
-- ---------------------------------------------------------------------------
-- Supabase hosts pgvector; this makes the `vector` type available.
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- 2. Catalogue table
-- ---------------------------------------------------------------------------
-- One row per TMDB film above the quality floor (100+ votes, 6.2+ average, a
-- poster and an overview). Facts come from TMDB; the embedding is built once
-- from `cheapText` (title, year, overview, keywords) by scripts/build-catalog.mjs.
create table if not exists public.movies (
  tmdb_id       integer     primary key,          -- TMDB movie id
  title         text        not null,
  year          integer,                          -- release year, may be null
  overview      text,
  keywords      text[]      not null default '{}',-- TMDB keyword names
  genre_ids     integer[]   not null default '{}',-- TMDB genre ids
  collection_id integer,                          -- TMDB franchise id, for dedup
  vote_count    integer     not null default 0,
  vote_average  real        not null default 0,
  popularity    real        not null default 0,
  poster_path   text,                             -- TMDB poster path (no host)
  language      text,                             -- original_language (ISO 639-1)
  embedding     vector(1536),                     -- text-embedding-3-small
  model         text        not null default 'text-embedding-3-small',
  text_hash     text        not null,             -- hash of model + cheapText;
                                                  -- resumable builds skip unchanged rows
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Cosine index
-- ---------------------------------------------------------------------------
-- HNSW (not IVFFlat) on purpose: this migration is applied to an EMPTY table
-- before the catalogue is built, and HNSW builds incrementally with good recall
-- from empty. IVFFlat would need its lists trained on existing rows, i.e. a
-- rebuild after the first load. Cosine distance matches the de-risk's metric.
create index if not exists movies_embedding_cosine_idx
  on public.movies using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- 4. Retrieval function
-- ---------------------------------------------------------------------------
-- The k catalogue films nearest a query vector (cosine), skipping exclude_ids.
-- SECURITY INVOKER (the default): it runs as the caller, so RLS still applies.
-- The server calls it with the service role, which bypasses RLS; the anon key
-- would see nothing. `similarity` is cosine similarity in [-1, 1] (higher =
-- closer), derived from the `<=>` cosine-distance operator.
create or replace function public.match_movies(
  query       vector(1536),
  k           integer   default 20,
  exclude_ids integer[] default '{}'
)
returns table (
  tmdb_id       integer,
  title         text,
  year          integer,
  overview      text,
  keywords      text[],
  genre_ids     integer[],
  collection_id integer,
  vote_count    integer,
  vote_average  real,
  popularity    real,
  poster_path   text,
  language      text,
  similarity    real
)
language sql
stable
security invoker
-- HNSW returns at most hnsw.ef_search rows per scan (default 40), whatever `k`
-- asks for. The runtime wants more than 40 so availability filtering still leaves
-- enough, so raise it. ef_search must be >= the largest `k` we allow (200).
set hnsw.ef_search = 200
as $$
  select
    m.tmdb_id, m.title, m.year, m.overview, m.keywords, m.genre_ids,
    m.collection_id, m.vote_count, m.vote_average, m.popularity,
    m.poster_path, m.language,
    (1 - (m.embedding <=> query))::real as similarity
  from public.movies m
  where m.embedding is not null
    -- null-safe: a null exclude_ids must not wipe the result set.
    and not (m.tmdb_id = any(coalesce(exclude_ids, '{}')))
  order by m.embedding <=> query
  -- clamp k to 1..200 (<= ef_search); a null or out-of-range k never runs wild.
  limit least(greatest(coalesce(k, 20), 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- 5. Lock down (RLS + grants)
-- ---------------------------------------------------------------------------
-- RLS on with NO policies => the anon and authenticated roles can read/write
-- nothing. The service role bypasses RLS, so only server-side code holding the
-- service key touches this data. Belt and braces: revoke the default PostgREST
-- grants and the function's execute from the browser-facing roles too.
alter table public.movies enable row level security;

revoke all on public.movies from anon, authenticated;
revoke all on function public.match_movies(vector, integer, integer[]) from anon, authenticated, public;

-- Make the server's access explicit. Supabase grants the service role via default
-- privileges (not through PUBLIC), so the revokes above don't touch it — but grant
-- exactly what the build and runtime need so it never depends on that default.
-- Least privilege: the catalogue build upserts (select/insert/update); no delete.
grant select, insert, update on public.movies to service_role;
grant execute on function public.match_movies(vector, integer, integer[]) to service_role;
