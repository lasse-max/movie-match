// Pure, framework-free state machine for the pass-the-phone game flow.
//   setup → round1 → blending(AI#1) → round2 → inferring(AI#2) → round3 → match | tiebreak
//
// Kept free of React so it stays deterministic and easy to reason about. The
// round data slots (categories/swipes/picks) are filled in by later steps; this
// step establishes the phases, transitions, and pass-the-phone turn tracking.
import { DEFAULT_REGION } from "./constants";
import { pickMatch } from "./overlap";
import type { BlendResult } from "./blendTypes";
import type { InferResult, MatchResult, PlayerRec } from "./inferTypes";

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

/** Round 2 leanings — captured all three ways so AI #2 can read tone from each
 * side, and so a fully-processed turn is distinguishable from an untouched one. */
export interface PlayerSwipes {
  yes: number[]; // leaned toward
  no: number[]; // leaned away
  neutral: number[]; // "Don't know" — processed but carries no signal
}

/** Per-player data captured across the rounds (movie ids unless noted). */
export interface RoundData {
  categories: Record<Player, string[]>; // R1: category/mood selections
  swipes: Record<Player, PlayerSwipes>; // R2: leaned toward / away
  picks: Record<Player, number[]>; // R3: titles each player would watch
  /** R3: the titles each player was actually SHOWN — so a "decline" is a
   * displayed-but-unselected title, never an unseen backfill/ineligible one. */
  shown: Record<Player, number[]>;
}

export interface GameState {
  phase: Phase;
  /** Whose turn it is within the current pass-the-phone round. */
  currentPlayer: Player;
  setup: SetupConfig;
  round: RoundData;
  /** Prefetched AI #1 result (mood read, directions, candidate pool). */
  blend: BlendResult | null;
  /** AI #2 result: per-player mood read + ranked Round 3 recs. */
  inference: InferResult | null;
  /** The agreed movie, set at the match phase (overlap or bridge). */
  match: MatchResult | null;
}

export const initialState: GameState = {
  phase: "setup",
  currentPlayer: 1,
  setup: { region: DEFAULT_REGION, services: [], willingToPay: false },
  round: {
    categories: { 1: [], 2: [] },
    swipes: {
      1: { yes: [], no: [], neutral: [] },
      2: { yes: [], no: [], neutral: [] },
    },
    picks: { 1: [], 2: [] },
    shown: { 1: [], 2: [] },
  },
  blend: null,
  inference: null,
  match: null,
};

export type Action =
  | { type: "RESET" }
  | { type: "SET_REGION"; region: string }
  | { type: "TOGGLE_SERVICE"; serviceId: number }
  | { type: "SET_WILLING_TO_PAY"; value: boolean }
  | { type: "SET_CATEGORIES"; player: Player; categories: string[] }
  | { type: "SET_SWIPES"; player: Player; yes: number[]; no: number[]; neutral: number[] }
  | { type: "SET_PICKS"; player: Player; movieIds: number[]; shown: number[] }
  | { type: "SET_BLEND"; blend: BlendResult }
  | { type: "SET_INFERENCE"; inference: InferResult }
  | { type: "SET_MATCH"; match: MatchResult }
  // The current player finishes their turn. Carries the player so a stray/
  // double dispatch from the wrong turn is ignored (can't skip a player).
  | { type: "COMPLETE_TURN"; player: Player };

function recsOf(state: GameState, player: Player): PlayerRec[] {
  return state.inference ? state.inference[player].recs : [];
}

/** Overlap match from Round 3 picks (ranked by combined fit), or null → tiebreak. */
function round3Match(state: GameState): MatchResult | null {
  return pickMatch(
    recsOf(state, 1),
    recsOf(state, 2),
    state.round.picks[1],
    state.round.picks[2]
  );
}

function resolveRound3(state: GameState): Phase {
  return round3Match(state) ? "match" : "tiebreak";
}

/** Whether the current player has submitted the data their turn requires. */
function currentPlayerHasData(state: GameState): boolean {
  const cp = state.currentPlayer;
  switch (state.phase) {
    case "round1":
      return state.round.categories[cp].length > 0;
    case "round2": {
      // A fully-processed turn counts even with zero yes/no signal — an
      // all-"Don't know" turn is valid completion (it just hands no signal
      // downstream, which inference degrades to the player's Round 1 mood).
      const s = state.round.swipes[cp];
      return s.yes.length + s.no.length + s.neutral.length > 0;
    }
    case "round3":
      return true; // picking nothing is a valid choice
    default:
      return true; // setup / AI phases / terminal advance programmatically
  }
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
            [action.player]: { yes: action.yes, no: action.no, neutral: action.neutral },
          },
        },
      };

    case "SET_BLEND":
      return { ...state, blend: action.blend };

    case "SET_INFERENCE":
      return { ...state, inference: action.inference };

    case "SET_MATCH":
      return { ...state, match: action.match };

    case "SET_PICKS":
      return {
        ...state,
        round: {
          ...state.round,
          picks: { ...state.round.picks, [action.player]: action.movieIds },
          shown: { ...state.round.shown, [action.player]: action.shown },
        },
      };

    case "COMPLETE_TURN": {
      // Guard: only the current player can complete the current turn, and only
      // once their data exists. A double-tap or stale dispatch is a no-op, so it
      // can never skip a player or advance an unfinished turn.
      if (action.player !== state.currentPlayer) return state;
      if (!currentPlayerHasData(state)) return state;

      // Pass-the-phone: inside a round, Player 1 finishing hands off to Player 2
      // before the round itself completes.
      if (isRoundPhase(state.phase) && state.currentPlayer === 1) {
        return { ...state, currentPlayer: 2 };
      }
      const phase = nextPhase(state);
      // Overlap match is computed when leaving Round 3; a bridge match (set via
      // SET_MATCH during the tiebreak phase) is kept as-is.
      const match =
        phase === "match" && state.phase === "round3" ? round3Match(state) : state.match;
      return {
        ...state,
        phase,
        currentPlayer: 1, // reset whose-turn for the next round
        match,
      };
    }

    default:
      return state;
  }
}
