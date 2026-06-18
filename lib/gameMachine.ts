// Pure, framework-free state machine for the pass-the-phone game flow.
//   setup → round1 → blending(AI#1) → round2 → inferring(AI#2) → round3 → match | tiebreak
//
// Kept free of React so it stays deterministic and easy to reason about. The
// round data slots (categories/swipes/picks) are filled in by later steps; this
// step establishes the phases, transitions, and pass-the-phone turn tracking.
import { DEFAULT_REGION } from "./constants";
import type { BlendResult } from "./blendTypes";

export type Phase =
  | "setup"
  | "round1"
  | "blending" // AI call #1 in flight (blend tastes → candidate pool)
  | "round2"
  | "inferring" // AI call #2 in flight (infer mood → Round 3 recs)
  | "round3"
  | "match"
  | "tiebreak";

/** Two players share one device; turns alternate within each round. */
export type Player = 1 | 2;

/** The three pass-the-phone rounds (each has a Player 1 turn then a Player 2 turn). */
export const ROUND_PHASES = ["round1", "round2", "round3"] as const;

export function isRoundPhase(phase: Phase): boolean {
  return (ROUND_PHASES as readonly string[]).includes(phase);
}

export interface SetupConfig {
  region: string;
  /** TMDB provider_ids the couple subscribes to (filled in Round 0 / setup, step 3). */
  services: number[];
  /** Whether to include the paid rent/buy tier in candidates. */
  willingToPay: boolean;
}

/** Round 2 leanings — captured both ways so AI #2 can read tone from each side. */
export interface PlayerSwipes {
  yes: number[]; // leaned toward
  no: number[]; // leaned away
}

/** Per-player data captured across the rounds (movie ids unless noted). */
export interface RoundData {
  categories: Record<Player, string[]>; // R1: category/mood selections
  swipes: Record<Player, PlayerSwipes>; // R2: leaned toward / away
  picks: Record<Player, number[]>; // R3: titles each player would watch
}

export interface GameState {
  phase: Phase;
  /** Whose turn it is within the current pass-the-phone round. */
  currentPlayer: Player;
  setup: SetupConfig;
  round: RoundData;
  /** Prefetched AI #1 result (mood read, directions, candidate pool). */
  blend: BlendResult | null;
  /** The agreed movie id, set when we reach the match phase. */
  matchId: number | null;
}

export const initialState: GameState = {
  phase: "setup",
  currentPlayer: 1,
  setup: { region: DEFAULT_REGION, services: [], willingToPay: false },
  round: {
    categories: { 1: [], 2: [] },
    swipes: { 1: { yes: [], no: [] }, 2: { yes: [], no: [] } },
    picks: { 1: [], 2: [] },
  },
  blend: null,
  matchId: null,
};

export type Action =
  | { type: "RESET" }
  | { type: "SET_REGION"; region: string }
  | { type: "TOGGLE_SERVICE"; serviceId: number }
  | { type: "SET_WILLING_TO_PAY"; value: boolean }
  | { type: "SET_CATEGORIES"; player: Player; categories: string[] }
  | { type: "SET_SWIPES"; player: Player; yes: number[]; no: number[] }
  | { type: "SET_PICKS"; player: Player; movieIds: number[] }
  | { type: "SET_BLEND"; blend: BlendResult }
  | { type: "ADVANCE" }; // finish the current turn/phase; handles pass-the-phone

// NOTE: Round 3 → match | tiebreak branching is a placeholder here. The real,
// unit-tested overlap/tiebreak computation lands in step 7 (lib/overlap.ts) and
// replaces both helpers below.
function hasOverlap(state: GameState): boolean {
  const [a, b] = [state.round.picks[1], state.round.picks[2]];
  return a.some((id) => b.includes(id));
}

function resolveRound3(state: GameState): Phase {
  return hasOverlap(state) ? "match" : "tiebreak";
}

function pickMatchId(state: GameState): number | null {
  const [a, b] = [state.round.picks[1], state.round.picks[2]];
  return a.find((id) => b.includes(id)) ?? null;
}

/** The phase reached when the current phase completes (both players done). */
function nextPhase(state: GameState): Phase {
  switch (state.phase) {
    case "setup":
      return "round1";
    case "round1":
      return "blending";
    case "blending":
      return "round2";
    case "round2":
      return "inferring";
    case "inferring":
      return "round3";
    case "round3":
      return resolveRound3(state);
    case "tiebreak":
      return "match";
    case "match":
      return "match"; // terminal
  }
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "RESET":
      return initialState;

    case "SET_REGION":
      // Provider ids are region-specific, so a region change resets the picks.
      return {
        ...state,
        setup: { ...state.setup, region: action.region, services: [] },
      };

    case "TOGGLE_SERVICE": {
      const has = state.setup.services.includes(action.serviceId);
      const services = has
        ? state.setup.services.filter((s) => s !== action.serviceId)
        : [...state.setup.services, action.serviceId];
      return { ...state, setup: { ...state.setup, services } };
    }

    case "SET_WILLING_TO_PAY":
      return { ...state, setup: { ...state.setup, willingToPay: action.value } };

    case "SET_CATEGORIES":
      return {
        ...state,
        round: {
          ...state.round,
          categories: { ...state.round.categories, [action.player]: action.categories },
        },
      };

    case "SET_SWIPES":
      return {
        ...state,
        round: {
          ...state.round,
          swipes: {
            ...state.round.swipes,
            [action.player]: { yes: action.yes, no: action.no },
          },
        },
      };

    case "SET_BLEND":
      return { ...state, blend: action.blend };

    case "SET_PICKS":
      return {
        ...state,
        round: {
          ...state.round,
          picks: { ...state.round.picks, [action.player]: action.movieIds },
        },
      };

    case "ADVANCE": {
      // Pass-the-phone: inside a round, Player 1 finishing hands off to Player 2
      // before the round itself completes.
      if (isRoundPhase(state.phase) && state.currentPlayer === 1) {
        return { ...state, currentPlayer: 2 };
      }
      const phase = nextPhase(state);
      return {
        ...state,
        phase,
        currentPlayer: 1, // reset whose-turn for the next round
        matchId: phase === "match" ? pickMatchId(state) : state.matchId,
      };
    }

    default:
      return state;
  }
}
