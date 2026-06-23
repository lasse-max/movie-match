// Isomorphic types for AI call #2 (mood inference → Round 3 recs) and the final
// match result. Shared by the server logic and the client game state / UI.
import type { MoodRead } from "./blendTypes";
import type { MovieAvailability } from "./filter";

/** Where a Round 3 rec came from (drives the UI flag + fresh-expansion cap). */
export type RecSource = "cross-player" | "swipe" | "fresh";

export interface PlayerRec {
  id: number;
  title: string;
  year: string | null;
  overview: string;
  posterUrl: string | null;
  genreIds: number[];
  source: RecSource;
  /** TMDB franchise/collection id (null = standalone) — for sequel dedup. */
  collectionId: number | null;
  /** Region-scoped availability (attached after the taste step). */
  availability: MovieAvailability;
}

export interface PlayerInference {
  moodRead: MoodRead;
  recs: PlayerRec[]; // ranked, ~5
}

export interface InferResult {
  1: PlayerInference;
  2: PlayerInference;
}

export interface MatchMovie {
  id: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
  genreIds: number[];
  availability: MovieAvailability;
  /** Why it matched — lowercase mood/genre tags (the honest substance). */
  matchTags: string[];
  /** A believable fit percentage (the engagement number; MVP heuristic). */
  matchPercent: number;
}

/** The deterministic end state of Round 3 — always a decision. The winner is the
 * hero; `alternatives` are 2-3 close runner-ups shown beneath it. */
export interface MatchResult {
  movie: MatchMovie;
  reason: "overlap" | "bridge";
  alternatives: MatchMovie[];
}
