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
}

/** The deterministic end state of Round 3 — always a decision. */
export interface MatchResult {
  movie: MatchMovie;
  reason: "overlap" | "bridge";
}
