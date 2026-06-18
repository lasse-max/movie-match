import { describe, it, expect } from "vitest";
import {
  gameReducer,
  initialState,
  type Action,
  type GameState,
} from "@/lib/gameMachine";

// One of the three permanent pure-logic suites (reducer / filter / overlap).
// Covers phase sequencing, pass-the-phone turn tracking, the Round 3
// match/tiebreak branch, and setup edits.

const run = (s: GameState, ...actions: Action[]) => actions.reduce(gameReducer, s);

describe("gameMachine reducer", () => {
  it("starts in setup with Player 1", () => {
    expect(initialState.phase).toBe("setup");
    expect(initialState.currentPlayer).toBe(1);
  });

  it("advances setup → round1, then passes the phone before completing the round", () => {
    let s = run(initialState, { type: "ADVANCE" }); // setup -> round1
    expect([s.phase, s.currentPlayer]).toEqual(["round1", 1]);
    s = run(s, { type: "ADVANCE" }); // P1 done -> hand off to P2 (same phase)
    expect([s.phase, s.currentPlayer]).toEqual(["round1", 2]);
    s = run(s, { type: "ADVANCE" }); // P2 done -> round complete
    expect([s.phase, s.currentPlayer]).toEqual(["blending", 1]);
  });

  it("does not pass-the-phone on the AI phases (blending/inferring)", () => {
    // Drive to blending: setup -> round1 (P1,P2) -> blending
    let s = run(initialState, { type: "ADVANCE" }, { type: "ADVANCE" }, { type: "ADVANCE" });
    expect(s.phase).toBe("blending");
    s = run(s, { type: "ADVANCE" }); // single advance leaves blending -> round2
    expect(s.phase).toBe("round2");
    // round2 P1,P2 -> inferring -> single advance -> round3
    s = run(s, { type: "ADVANCE" }, { type: "ADVANCE" });
    expect(s.phase).toBe("inferring");
    s = run(s, { type: "ADVANCE" });
    expect([s.phase, s.currentPlayer]).toEqual(["round3", 1]);
  });

  it("Round 3 with no overlap routes to tiebreak, then to match", () => {
    let s: GameState = { ...initialState, phase: "round3" };
    s = run(
      s,
      { type: "SET_PICKS", player: 1, movieIds: [1, 2] },
      { type: "SET_PICKS", player: 2, movieIds: [3, 4] },
      { type: "ADVANCE" }, // P1
      { type: "ADVANCE" } // P2 -> resolve
    );
    expect(s.phase).toBe("tiebreak");
    expect(s.matchId).toBeNull();
    s = run(s, { type: "ADVANCE" });
    expect(s.phase).toBe("match");
  });

  it("Round 3 with overlap routes to match and records the shared movie id", () => {
    let s: GameState = { ...initialState, phase: "round3" };
    s = run(
      s,
      { type: "SET_PICKS", player: 1, movieIds: [1, 2, 3] },
      { type: "SET_PICKS", player: 2, movieIds: [3, 4, 5] },
      { type: "ADVANCE" },
      { type: "ADVANCE" }
    );
    expect(s.phase).toBe("match");
    expect(s.matchId).toBe(3);
  });

  it("records each player's Round 1 category picks independently", () => {
    let s: GameState = { ...initialState, phase: "round1" };
    s = run(s, { type: "SET_CATEGORIES", player: 1, categories: ["action", "apocalyptic"] });
    s = run(s, { type: "SET_CATEGORIES", player: 2, categories: ["comedy", "cozy", "romance"] });
    expect(s.round.categories[1]).toEqual(["action", "apocalyptic"]);
    expect(s.round.categories[2]).toEqual(["comedy", "cozy", "romance"]);
  });

  it("records each player's Round 2 swipes both ways", () => {
    let s: GameState = { ...initialState, phase: "round2" };
    s = run(s, { type: "SET_SWIPES", player: 1, yes: [10, 20], no: [30] });
    expect(s.round.swipes[1]).toEqual({ yes: [10, 20], no: [30] });
    expect(s.round.swipes[2]).toEqual({ yes: [], no: [] }); // P2 untouched
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
