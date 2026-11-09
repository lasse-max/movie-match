// Round 2's release rule (D6 §1.4), apart from the screen so it can be tested on
// its own. One rule, the same numbers, for all three directions.

/** Right is This vibe, left is Not it, down is Not sure. */
export type Dir = "right" | "left" | "down";

/** A release decides once the throw's projected rest point is past this share of
 * the card width. Down is measured in the same px as the sides. */
export const THRESHOLD = 0.35;
/** Where a throw would come to rest: position + release velocity × this (Apple's
 * momentum projection, a deceleration rate of about 0.9934). */
export const PROJECTION_S = 0.15;
/** A release only decides after this much real travel its way, so a twitch can't. */
export const MIN_TRAVEL = 12;

/**
 * Which way a release decides, or null to spring back. The projected rest point
 * picks the leading axis and must be past the threshold, with at least MIN_TRAVEL
 * px of real travel that way. Up decides nothing.
 */
export function releaseDirection(
  px: number,
  py: number,
  vx: number,
  vy: number,
  threshold: number
): Dir | null {
  const ex = px + vx * PROJECTION_S;
  const ey = py + vy * PROJECTION_S;
  if (Math.abs(ex) >= Math.max(ey, 0)) {
    if (ex > threshold && px >= MIN_TRAVEL) return "right";
    if (ex < -threshold && px <= -MIN_TRAVEL) return "left";
    return null;
  }
  return ey > threshold && py >= MIN_TRAVEL ? "down" : null;
}
