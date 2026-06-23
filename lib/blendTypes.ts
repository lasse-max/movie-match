// Isomorphic blend types + pure helpers, shared by the server-only blend module
// (lib/blend.ts) and the client game state / Round 2 UI. No server-only imports
// here so the client can carry the candidate pool without pulling in the SDK.

export interface MoodRead {
  summary: string;
  axes: string[];
}

export interface Direction {
  theme: string;
  genreIds: number[];
  keywords: string[];
  tone: string[];
  sourcePicks: string[];
}

export interface BlendStrategy {
  moodRead: MoodRead;
  directions: Direction[];
}

export interface PoolMovie {
  id: number;
  title: string;
  year: string | null;
  overview: string;
  posterUrl: string | null;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
  directionIndex: number;
  directionTheme: string;
  /** TMDB franchise/collection id (null = standalone) — for sequel dedup. */
  collectionId: number | null;
}

export interface BlendResult extends BlendStrategy {
  pool: PoolMovie[];
}

/**
 * Pick the Round 2 swipe samples — a DISTINCT set per player (the two never see
 * the same cards). Within each direction the titles are ranked by recognizability
 * and dealt alternately to P1/P2, so each player's set is disjoint, spans the 1–3
 * directions, and leads with films they'll actually recognize. Distinct sets give
 * more surface area to read each player's mood and make Round 3 cross-player
 * positives genuinely new candidates the other player never saw.
 */
export function selectSwipeSamples(
  pool: PoolMovie[],
  perPlayer = 8
): { 1: PoolMovie[]; 2: PoolMovie[] } {
  const groups = new Map<number, PoolMovie[]>();
  for (const m of pool) {
    const g = groups.get(m.directionIndex);
    if (g) g.push(m);
    else groups.set(m.directionIndex, [m]);
  }
  for (const g of groups.values()) g.sort((a, b) => b.voteCount - a.voteCount);

  // Deal alternately within each direction: even ranks → P1, odd ranks → P2.
  const byPlayer: { 1: PoolMovie[][]; 2: PoolMovie[][] } = { 1: [], 2: [] };
  for (const g of groups.values()) {
    const p1: PoolMovie[] = [];
    const p2: PoolMovie[] = [];
    g.forEach((m, i) => (i % 2 === 0 ? p1 : p2).push(m));
    byPlayer[1].push(p1);
    byPlayer[2].push(p2);
  }

  // Round-robin across directions so each player's set spans them.
  const gather = (lists: PoolMovie[][]): PoolMovie[] => {
    const out: PoolMovie[] = [];
    const depth = Math.max(0, ...lists.map((l) => l.length));
    for (let rank = 0; rank < depth && out.length < perPlayer; rank++) {
      for (const list of lists) {
        if (list[rank] && out.length < perPlayer) out.push(list[rank]);
      }
    }
    return out;
  };

  return { 1: gather(byPlayer[1]), 2: gather(byPlayer[2]) };
}

/**
 * One title per TMDB franchise: keep the highest-voteCount entry per collection
 * (standalones — null collectionId — always kept), preserving order. Stops
 * Zombieland 1 & 2 / Ted 1 & 2 / three Iron Mans from crowding the swipe set and
 * Round 3. Pure.
 */
export function dedupeByCollection(pool: PoolMovie[]): PoolMovie[] {
  const bestIndexByCollection = new Map<number, number>();
  const out: PoolMovie[] = [];
  for (const m of pool) {
    if (m.collectionId == null) {
      out.push(m);
      continue;
    }
    const existingIndex = bestIndexByCollection.get(m.collectionId);
    if (existingIndex === undefined) {
      bestIndexByCollection.set(m.collectionId, out.length);
      out.push(m);
    } else if (m.voteCount > out[existingIndex].voteCount) {
      out[existingIndex] = m; // keep the better-known franchise entry, in place
    }
  }
  return out;
}

/** Minimum distinct Round 2 cards each player needs for a playable swipe round.
 * The disjoint split means a thin pool can starve Player 2 — this is the floor. */
export const MIN_SAMPLES_PER_PLAYER = 4;

/**
 * Viable-pool postcondition: the pool yields enough DISTINCT swipe samples for
 * BOTH players. A non-empty-but-tiny pool (e.g. 1 title) fails here, so the
 * Blending screen surfaces a recoverable error instead of dead-ending Player 2.
 */
export function hasEnoughSamples(pool: PoolMovie[]): boolean {
  const samples = selectSwipeSamples(pool);
  return (
    samples[1].length >= MIN_SAMPLES_PER_PLAYER &&
    samples[2].length >= MIN_SAMPLES_PER_PLAYER
  );
}
