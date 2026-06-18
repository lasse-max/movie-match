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
  voteAverage: number;
  voteCount: number;
  directionIndex: number;
  directionTheme: string;
}

export interface BlendResult extends BlendStrategy {
  pool: PoolMovie[];
}

/**
 * Pick the Round 2 swipe samples. Spreads picks ACROSS directions (round-robin
 * by recognizability) so the swipes disambiguate which direction the couple
 * leans toward — the whole point of Round 2. Most-rated titles first so players
 * react to films they actually know.
 */
export function selectSwipeSamples(pool: PoolMovie[], target = 8): PoolMovie[] {
  const groups = new Map<number, PoolMovie[]>();
  for (const m of pool) {
    const g = groups.get(m.directionIndex);
    if (g) g.push(m);
    else groups.set(m.directionIndex, [m]);
  }
  for (const g of groups.values()) g.sort((a, b) => b.voteCount - a.voteCount);

  const perDir = Math.ceil(target / Math.max(1, groups.size));
  const picks: PoolMovie[] = [];
  for (let rank = 0; rank < perDir; rank++) {
    for (const g of groups.values()) {
      if (g[rank]) picks.push(g[rank]);
    }
  }
  return picks.slice(0, target);
}
