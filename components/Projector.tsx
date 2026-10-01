"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { LoadingQuote } from "./LoadingQuote";
import { label } from "./palace";

/**
 * The projector countdown that hides an AI wait (Load1 / Load2 boards). A 3-2-1
 * Academy leader loops while the call runs; once the result is in it finishes the
 * current number and moves on, so it never holds players more than about 1 s.
 * The quote is the hero. With reduce-motion on it is a still leader, and it moves
 * on as soon as the result is in.
 */
export function ProjectorLoader({
  title,
  done,
  onDone,
  children,
}: {
  /** The brass label, e.g. "Blending your tastes". */
  title: string;
  /** The result is in. */
  done: boolean;
  /** Called once, after the current number finishes. */
  onDone: () => void;
  /** The "Up next" line. */
  children: ReactNode;
}) {
  const reduced = !!useReducedMotion();
  const { n, tick } = useCountdown(done, onDone, reduced);

  return (
    <>
      {/* The stage spotlight and two film scratches, fixed behind the content (kept
          outside the entering container, whose transform would pin them to it). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[5] bg-[radial-gradient(ellipse_90%_60%_at_50%_32%,#22140f_0%,#0e0a09_70%)]"
      />
      <span aria-hidden className="pp-scratch -z-[4]" style={{ left: "23%" }} />
      <span aria-hidden className="pp-scratch pp-scratch-b -z-[4]" style={{ left: "78%" }} />

      <div className="pp-enter flex min-h-full flex-1 flex-col">
        <div className="flex flex-col items-center gap-[22px] pt-[34px]">
          <Leader n={reduced ? null : n} tick={tick} />
          <div role="status" className="flex flex-col items-center gap-2 text-center">
            <span className={`${label} text-brass`}>{title}</span>
            <span className="max-w-[300px] text-[14px] leading-[1.5] text-cream/75">{children}</span>
          </div>
        </div>

        <div className="mt-auto pt-8">
          <LoadingQuote />
        </div>
      </div>
    </>
  );
}

/** The leader: sweep, flickering frame, crosshair, inner ring and the number. A
 * null number is the still leader (reduce-motion), with a fixed wedge. */
function Leader({ n, tick }: { n: number | null; tick: number }) {
  return (
    <div
      aria-hidden
      className="relative h-[150px] w-[150px] flex-none overflow-hidden rounded-full bg-[#1a1411] shadow-[inset_0_0_0_2px_rgba(242,232,213,0.5),0_0_0_12px_#0e0a09,0_0_0_14px_rgba(242,232,213,0.22)]"
    >
      {n == null ? (
        <span className="absolute inset-0 rounded-full bg-[conic-gradient(rgba(242,232,213,0.14)_0_130deg,rgba(242,232,213,0)_130deg)]" />
      ) : (
        <span className="pp-sweep" />
      )}
      <span className="pp-flicker" />
      <span className="absolute inset-x-0 top-1/2 -mt-px h-0.5 bg-cream/40" />
      <span className="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-cream/40" />
      <span className="absolute inset-[16%] rounded-full shadow-[inset_0_0_0_2px_rgba(242,232,213,0.5)]" />
      {n != null && (
        // Keyed by tick so each number pops in fresh.
        <span
          key={tick}
          className="pp-num absolute inset-0 flex items-center justify-center font-display text-[87px] font-black leading-none text-cream"
        >
          {n}
        </span>
      )}
    </div>
  );
}

/**
 * 3, 2, 1, 3, ... one number a second. Each second, if the result is in, it stops
 * and calls onDone instead of starting the next number: the current one always
 * finishes, and nobody waits more than about a second. With reduce-motion there is
 * no number to finish, so it calls onDone as soon as the result is in.
 */
function useCountdown(done: boolean, onDone: () => void, reduced: boolean) {
  const [tick, setTick] = useState(0);
  const doneRef = useRef(done);
  const onDoneRef = useRef(onDone);
  const fired = useRef(false);

  useEffect(() => {
    doneRef.current = done;
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (reduced && done && !fired.current) {
      fired.current = true;
      onDoneRef.current();
    }
  }, [reduced, done]);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      if (doneRef.current) {
        clearInterval(id);
        if (!fired.current) {
          fired.current = true;
          onDoneRef.current();
        }
        return;
      }
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [reduced]);

  return { n: 3 - (tick % 3), tick };
}
