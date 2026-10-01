"use client";

// Picture Palace kit (design pass 2): shared class recipes, icons and small parts.
// Brass is light, red is fabric, cream is paper; no colour does another's job.
// Presentation only, no game logic. Values come from docs/design/picture-palace.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useReducedMotion, type Transition } from "motion/react";

// ---- type ---------------------------------------------------------------------

/** Big Shoulders 900, caps, set tight: headlines and film titles. Each use sets
 * its own size and line-height (so no two line-heights ever compete). */
export const display = "font-display font-black uppercase tracking-[-0.01em]";
/** Big Shoulders Inline: marquee signage only (setup sign, valance, "It's a match"). */
export const signage = "font-signage font-extrabold uppercase";
/** Courier Prime 700: labels, tickets, credits. Caps, wide tracking, small. */
export const label = "font-mono text-[11px] font-bold uppercase tracking-[0.28em]";

// ---- layout and surfaces ------------------------------------------------------

/** A screen: fills the column, enters on the one entry curve. */
export const screen = "pp-enter flex min-h-full flex-1 flex-col";
/** A raised surface: one step up in tone from the room, no lines. */
export const aisle = "rounded-2xl bg-aisle";

// ---- buttons --------------------------------------------------------------------

const press = "transition-transform duration-[180ms] ease-entry active:scale-[0.97]";

/** The brass CTA: anything you press to go on. */
export const brassCta =
  `flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] bg-brass text-[16px] font-bold text-projection shadow-[0_14px_34px_-12px_rgba(214,162,74,0.7)] ${press} ` +
  "disabled:cursor-not-allowed disabled:bg-aisle disabled:text-cream/40 disabled:shadow-none disabled:active:scale-100";
/** The secondary, outlined in cream. */
export const outlineCta = `flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] text-[15px] font-semibold text-cream shadow-[inset_0_0_0_1.5px_rgba(242,232,213,0.4)] ${press} hover:text-bulb`;
/** A quiet text button (play again, skip), still a 44 px target. */
export const textButton = "min-h-11 px-4 text-[15px] text-cream/65 transition-colors hover:text-bulb";

// ---- motion ---------------------------------------------------------------------

/** The one entry curve, cubic-bezier(0.16, 1, 0.3, 1). */
export const ENTRY_EASE = [0.16, 1, 0.3, 1] as const;
/** List items stagger by 50 ms. */
export const STAGGER = 0.05;

/** The entry transition, or an instant cut when the phone asks for reduced motion
 * (Motion alone would still fade opacity). */
export function useEntry(delay = 0): Transition {
  const reduced = useReducedMotion();
  return reduced ? { duration: 0 } : { duration: 0.6, ease: ENTRY_EASE, delay };
}

// ---- parts ------------------------------------------------------------------------

/** A row of chasing marquee bulbs (static with reduce-motion on). */
export function Bulbs({ count = 16 }: { count?: number }) {
  return (
    <div aria-hidden className="pp-bulbs">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="pp-bulb" />
      ))}
    </div>
  );
}

/** A velvet ticket button with a stub and notched edges: ADMIT TWO on setup,
 * LOCK IT IN on Round 1. */
export function Ticket({
  children,
  stub = (
    <>
      Admit
      <br />
      two
    </>
  ),
  ...rest
}: { children: ReactNode; stub?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="pp-ticket" {...rest}>
      <span
        className={`${label} flex w-[86px] flex-none items-center justify-center border-r-2 border-dashed border-cream/50 text-center text-[12px] leading-[1.35] tracking-[0.22em]`}
      >
        {stub}
      </span>
      <span className={`${display} flex flex-1 items-center justify-between pl-[18px] pr-6 text-[28px] leading-none`}>
        {children}
        <ArrowRight size={22} />
      </span>
    </button>
  );
}

// ---- icons (24 grid, 2 px stroke, round caps; traced from the boards) -------------

type IconProps = { size?: number; className?: string };

const icon = (size: number, className: string | undefined, paths: ReactNode, filled = false) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden
    className={className}
    fill={filled ? "currentColor" : "none"}
    stroke={filled ? "none" : "currentColor"}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {paths}
  </svg>
);

export const Check = ({ size = 18, className }: IconProps) =>
  icon(size, className, <path d="M5 12.5l4.5 4.5L19 7.5" />);
export const ArrowRight = ({ size = 20, className }: IconProps) =>
  icon(size, className, <path d="M5 12h14M13 6l6 6-6 6" />);
export const ChevronDown = ({ size = 18, className }: IconProps) =>
  icon(size, className, <path d="M6 9l6 6 6-6" />);
export const Cross = ({ size = 22, className }: IconProps) =>
  icon(size, className, <path d="M6 6l12 12M18 6L6 18" />);
export const Question = ({ size = 22, className }: IconProps) =>
  icon(
    size,
    className,
    <>
      <path d="M9.2 9a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2.9-1.2 1.8v.6" />
      <path d="M12 17.6v.1" />
    </>
  );
export const Heart = ({ size = 22, className, filled = false }: IconProps & { filled?: boolean }) =>
  icon(
    size,
    className,
    <path d="M12 20.5s-7.5-4.6-7.5-10.4A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.8c0 5.8-7.5 10.4-7.5 10.4z" />,
    filled
  );
export const ExternalArrow = ({ size = 16, className }: IconProps) =>
  icon(size, className, <path d="M7 17L17 7M9 7h8v8" />);
export const Retry = ({ size = 20, className }: IconProps) =>
  icon(
    size,
    className,
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7" />
  );
