import { describe, it, expect } from "vitest";
import { THRESHOLD, releaseDirection } from "@/components/swipe";

// D6 §1.4: a release decides by where the throw is heading (its projected rest
// point, position + velocity × 0.15 s) with at least 12 px of real travel, the
// same rule for all three directions. The table is the swipe physics review's
// item 5, on a 390 px phone (a 350 px card, so the threshold is about 122 px).
const t = 350 * THRESHOLD;

describe("Round 2 release rule", () => {
  it.each([
    ["a short flick: 12 px at 750 px/s", 12, 750, true],
    ["a twitch: 5 px at 900 px/s", 5, 900, false],
    ["a slow, confident push: 80 px at 300 px/s", 80, 300, true],
    ["110 px at 550 px/s", 110, 550, true],
    ["110 px, held still", 110, 0, false],
    ["135 px, pulling back at 250 px/s", 135, -250, false],
  ])("%s: the same answer for This vibe, Not it and Not sure", (_, travel, speed, decides) => {
    expect(releaseDirection(travel, 0, speed, 0, t)).toBe(decides ? "right" : null);
    expect(releaseDirection(-travel, 0, -speed, 0, t)).toBe(decides ? "left" : null);
    expect(releaseDirection(0, travel, 0, speed, t)).toBe(decides ? "down" : null);
  });

  it("the throw's heading picks the direction, not where the card is", () => {
    // Further down than across, but thrown hard to the right: This vibe.
    expect(releaseDirection(40, 60, 900, 0, t)).toBe("right");
    // Across, but thrown down: Not sure.
    expect(releaseDirection(30, 20, 0, 900, t)).toBe("down");
  });

  it("up decides nothing, however hard", () => {
    expect(releaseDirection(0, -200, 0, -2000, t)).toBeNull();
    expect(releaseDirection(10, -200, 50, -2000, t)).toBeNull();
  });
});
