import type { ReactNode } from "react";
import { Retry, brassCta, display, label } from "./palace";

/** The one line, by what went wrong. Plain, no blame, and your place is kept. */
export const ERROR_LINES = {
  connection: "The connection dropped for a moment. Your picks are safe, so you won’t lose your place.",
  server: "We hit a snag on our side. Your picks are safe, so you won’t lose your place.",
} as const;

/**
 * The one error state for an AI or network failure (Error board): a jammed film
 * strip, "Film jam", a headline, one line and one retry button. Used by Blending,
 * Inferring and Tiebreak.
 */
export function ErrorState({
  title,
  onRetry,
  children,
}: {
  title: ReactNode;
  onRetry: () => void;
  /** One line. */
  children: ReactNode;
}) {
  return (
    <div className="pp-enter flex min-h-full flex-1 flex-col gap-[26px]">
      <div className="flex flex-1 flex-col justify-center gap-[26px]">
        <FilmStrip />
        <div role="alert" className="flex flex-col gap-2.5">
          <span className={`${label} text-brass`}>Film jam</span>
          <h1 className={`${display} text-[46px] leading-[0.88]`}>{title}</h1>
          <p className="text-[15px] leading-[1.5] text-cream/75">{children}</p>
        </div>
      </div>
      <button type="button" className={brassCta} onClick={onRetry}>
        <Retry size={18} />
        Try again
      </button>
    </div>
  );
}

/** Three frames of film with sprocket holes; the middle one has burnt through. */
function FilmStrip() {
  const sprockets =
    "absolute inset-x-2 h-1.5 bg-[repeating-linear-gradient(90deg,#0e0a09_0_8px,transparent_8px_16px)]";
  return (
    <div aria-hidden className="relative flex gap-2.5 rounded-[6px] bg-[#1a1411] px-3 py-3.5">
      <span className={`${sprockets} top-1`} />
      <span className={`${sprockets} bottom-1`} />
      <span className="h-24 flex-1 rounded-[3px] bg-[#2a1f18]" />
      <span className="h-24 flex-1 rounded-[3px] bg-[radial-gradient(circle_at_46%_52%,#fff4dc_0_10%,#f2b04a_16%,#b8141e_28%,#3a120c_40%,#2a1f18_52%)]" />
      <span className="h-24 flex-1 rounded-[3px] bg-[#2a1f18]" />
    </div>
  );
}
