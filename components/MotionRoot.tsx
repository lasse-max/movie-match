"use client";

import { MotionConfig } from "motion/react";

/** Root of every Motion animation. With the phone's reduce-motion setting on,
 * Motion skips transform and layout animations; components that fade also check
 * useReducedMotion() so everything becomes an instant cut. */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
