import { describe, it, expect } from "vitest";
import {
  gameReducer,
  initialState,
  type Action,
  type GameState,
} from "@/lib/gameMachine";
import { NO_AVAILABILITY } from "@/lib/filter";

// One of the three permanent pure-logic suites (reducer / filter / overlap).
// Covers phase sequencing, pass-the-phone turn tracking, the Round 3
// match/tiebreak branch, setup edits, and the COMPLETE_TURN advancement guard.

const run = (s: GameState, ...actions: Action[]) => actions.reduce(gameReducer, s);

// Complete the current player's round turn (set their data, then COMPLETE_TURN).
const completeRound1 = (s: GameState, player: 1 | 2, categories = ["action", "comedy"]) =>
  run(s, { type: "SET_CATEGORIES", player, categories }, { type: "COMPLETE_TURN", player });
const completeRound2 = (s: GameState, player: 1 | 2) =>
  run(s, { type: "SET_SWIPES", player, yes: [1], no: [2], neutral: [] }, { type: "COMPLETE_TURN", player });

const recList = (ids: number[]) =>
  ids.map((id) => ({
    id,
    title: `M${id}`,
    year: null,
    overview: "",
    posterUrl: null,
    genreIds: [],
    source: "swipe" as const,
    collectionId: null,
    availability: NO_AVAILABILITY,
  }));
const inferenceWith = (ids1: number[], ids2: number[]) => ({
  1: { moodRead: { summary: "", axes: [] }, recs: recList(ids1) },
  2: { moodRead: { summary: "", axes: [] }, recs: recList(ids2) },
});

describe("gameMachine reducer", () => {
  it("starts in setup with Player 1", () => {
    expect(initialState.phase).toBe("setup");
    expect(initialState.currentPlayer).toBe(1);
  });

  it("advances setup → round1, then passes the phone before completing the round", () => {
    let s = run(initialState, { type: "COMPLETE_TURN", player: 1 }); // setup -> round1
    expect([s.phase, s.currentPlayer]).toEqual(["round1", 1]);
    s = completeRound1(s, 1); // P1 done -> hand off to P2 (same phase)
    expect([s.phase, s.currentPlayer]).toEqual(["round1", 2]);
    s = completeRound1(s, 2); // P2 done -> round complete
    expect([s.phase, s.currentPlayer]).toEqual(["blending", 1]);
  });

  it("does not pass-the-phone on the AI phases (blending/inferring)", () => {
    let s = run(initialState, { type: "COMPLETE_TURN", player: 1 }); // -> round1
    s = completeRound1(s, 1);
    s = completeRound1(s, 2); // -> blending
    expect(s.phase).toBe("blending");
    s = run(s, { type: "COMPLETE_TURN", player: 1 }); // single advance: blending -> round2
    expect(s.phase).toBe("round2");
    s = completeRound2(s, 1);
    s = completeRound2(s, 2); // -> inferring
    expect(s.phase).toBe("inferring");
    s = run(s, { type: "COMPLETE_TURN", player: 1 }); // inferring -> round3
    expect([s.phase, s.currentPlayer]).toEqual(["round3", 1]);
  });

  it("Round 3 with no overlap routes to tiebreak; the bridge sets the match there", () => {
    let s: GameState = { ...initialState, phase: "round3", inference: inferenceWith([1, 2], [3, 4]) };
    s = run(s, { type: "SET_PICKS", player: 1, movieIds: [1, 2], shown: [1, 2] }, { type: "COMPLETE_TURN", player: 1 });
    s = run(s, { type: "SET_PICKS", player: 2, movieIds: [3, 4], shown: [3, 4] }, { type: "COMPLETE_TURN", player: 2 });
    expect(s.phase).toBe("tiebreak");
    expect(s.match).toBeNull();
    // The tiebreak (bridge) sets the match, then completes to the match phase.
    const bridge = {
      movie: {
        id: 7,
        title: "Bridge",
        year: null,
        posterUrl: null,
        genreIds: [],
        availability: NO_AVAILABILITY,
        matchTags: [],
        matchPercent: 80,
      },
      reason: "bridge" as const,
      alternatives: [],
    };
    s = run(s, { type: "SET_MATCH", match: bridge }, { type: "COMPLETE_TURN", player: 1 });
    expect(s.phase).toBe("match");
    expect(s.match).toBe(bridge); // bridge result kept, not overwritten
  });

  it("Round 3 with overlap routes to match with the best-fit shared movie", () => {
    let s: GameState = {
      ...initialState,
      phase: "round3",
      inference: inferenceWith([1, 2, 3], [3, 4, 5]),
    };
    s = run(s, { type: "SET_PICKS", player: 1, movieIds: [1, 2, 3], shown: [1, 2, 3] }, { type: "COMPLETE_TURN", player: 1 });
    s = run(s, { type: "SET_PICKS", player: 2, movieIds: [3, 4, 5], shown: [3, 4, 5] }, { type: "COMPLETE_TURN", player: 2 });
    expect(s.phase).toBe("match");
    expect(s.match?.movie.id).toBe(3); // only shared pick
    expect(s.match?.reason).toBe("overlap");
  });

  it("records the titles SHOWN to each player in Round 3 (for decline detection)", () => {
    let s: GameState = { ...initialState, phase: "round3" };
    s = gameReducer(s, { type: "SET_PICKS", player: 1, movieIds: [1], shown: [1, 2, 3] });
    expect(s.round.picks[1]).toEqual([1]);
    expect(s.round.shown[1]).toEqual([1, 2, 3]); // saw 3, picked 1 → 2 & 3 declinable
  });

  it("ignores a COMPLETE_TURN from the wrong player (a double-tap can't skip P2)", () => {
    let s: GameState = { ...initialState, phase: "round1" };
    s = completeRound1(s, 1); // -> P2's turn
    expect(s.currentPlayer).toBe(2);
    // a stale second tap still bound to Player 1 must be a no-op
    const after = gameReducer(s, { type: "COMPLETE_TURN", player: 1 });
    expect(after).toBe(s); // unchanged — Player 2 not skipped
  });

  it("ignores COMPLETE_TURN until the current player has data", () => {
    const empty: GameState = { ...initialState, phase: "round1" }; // no categories yet
    const blocked = gameReducer(empty, { type: "COMPLETE_TURN", player: 1 });
    expect(blocked).toBe(empty); // can't advance an unfinished turn
    const ready = completeRound1(empty, 1);
    expect(ready.currentPlayer).toBe(2); // with data, it advances
  });

  it("records each player's Round 1 category picks independently", () => {
    let s: GameState = { ...initialState, phase: "round1" };
    s = run(s, { type: "SET_CATEGORIES", player: 1, categories: ["action", "apocalyptic"] });
    s = run(s, { type: "SET_CATEGORIES", player: 2, categories: ["comedy", "cozy", "romance"] });
    expect(s.round.categories[1]).toEqual(["action", "apocalyptic"]);
    expect(s.round.categories[2]).toEqual(["comedy", "cozy", "romance"]);
  });

  it("records each player's Round 2 swipes all three ways", () => {
    let s: GameState = { ...initialState, phase: "round2" };
    s = run(s, { type: "SET_SWIPES", player: 1, yes: [10, 20], no: [30], neutral: [40] });
    expect(s.round.swipes[1]).toEqual({ yes: [10, 20], no: [30], neutral: [40] });
    expect(s.round.swipes[2]).toEqual({ yes: [], no: [], neutral: [] }); // P2 untouched
  });

  it("completes a Round 2 turn made entirely of 'Don't know' (invariant: no stall)", () => {
    let s: GameState = { ...initialState, phase: "round2" };
    // P1 processed every card as neutral — empty yes/no, but a populated neutral list.
    s = run(s, { type: "SET_SWIPES", player: 1, yes: [], no: [], neutral: [10, 20, 30] });
    const advanced = gameReducer(s, { type: "COMPLETE_TURN", player: 1 });
    expect(advanced.currentPlayer).toBe(2); // turn completed → handed to P2, not stalled
    // …while a genuinely untouched turn (no swipes at all) still cannot advance.
    const untouched: GameState = { ...initialState, phase: "round2" };
    expect(gameReducer(untouched, { type: "COMPLETE_TURN", player: 1 })).toBe(untouched);
  });

  it("stores the prefetched blend result", () => {
    const blend = { moodRead: { summary: "dark", axes: [] }, directions: [], pool: [] };
    const s = gameReducer(initialState, { type: "SET_BLEND", blend });
    expect(s.blend).toBe(blend);
  });

  it("clears subscribed services when the region changes", () => {
    let s = run(
      initialState,
      { type: "TOGGLE_SERVICE", serviceId: 8 },
      { type: "TOGGLE_SERVICE", serviceId: 337 }
    );
    expect(s.setup.services).toEqual([8, 337]);
    s = run(s, { type: "SET_REGION", region: "DE" });
    expect(s.setup.region).toBe("DE");
    expect(s.setup.services).toEqual([]); // region-specific ids reset
  });

  it("captures setup edits and RESET restores the initial state", () => {
    let s = run(
      initialState,
      { type: "SET_REGION", region: "GB" },
      { type: "TOGGLE_SERVICE", serviceId: 8 },
      { type: "TOGGLE_SERVICE", serviceId: 9 },
      { type: "TOGGLE_SERVICE", serviceId: 8 }, // toggles 8 back off
      { type: "SET_WILLING_TO_PAY", value: true }
    );
    expect(s.setup).toEqual({ region: "GB", services: [9], willingToPay: true });
    s = run(s, { type: "RESET" });
    expect(s).toEqual(initialState);
  });
});
