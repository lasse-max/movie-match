"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { useGame } from "./GameProvider";
import { evaluateAvailability, type AvailabilityLabel } from "@/lib/filter";
import type { MatchMovie } from "@/lib/inferTypes";
import { Notice } from "./Notice";
import { PosterCard } from "./PosterCard";
import { Bulbs, ExternalArrow, brassCta, label, mono, signage } from "./palace";

/** The popcorn burst as the curtain opens. One switch, to cut it after Lasse plays it. */
const POPCORN = true;
/** The closed curtain holds this long, then parts on its own (tap to open sooner). */
const CURTAIN_HOLD_MS = 900;
const INLINE_ALTERNATIVES = 3; // runner-ups shown inline; the rest behind "See other matches"

// The match, built to docs/design/picture-palace/MatchClosed.dc.html and
// MatchOpen.dc.html. There is always a match, so a bridge pick gets the same
// curtain and the same "It's a match"; only the one line on why changes.
export function MatchScreen() {
  const { state, dispatch } = useGame();
  const reduced = useReducedMotion();
  // With reduce-motion on, the curtain is simply open.
  const [open, setOpen] = useState(!!reduced);
  const [showAll, setShowAll] = useState(false);
  const { services, willingToPay } = state.setup;
  const labelFor = (m: MatchMovie) => evaluateAvailability(m.availability, services, willingToPay).label;

  useEffect(() => {
    // The reveal starts at the top, however far the last screen was scrolled.
    window.scrollTo(0, 0);
    const t = setTimeout(() => setOpen(true), CURTAIN_HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  const match = state.match;
  if (!match) {
    return (
      <Notice kicker="Tonight’s feature" title="No pick yet" body="Start over and we’ll find you a film.">
        <button type="button" className={brassCta} onClick={() => dispatch({ type: "RESET" })}>
          Play again
        </button>
      </Notice>
    );
  }

  const { movie, reason, alternatives } = match;
  const where = labelFor(movie);
  const watchLink = where?.justWatchLink ?? movie.availability.justWatchLink;
  const verb = where?.type === "rent" ? "Rent on" : where?.type === "buy" ? "Buy on" : "Watch on";
  const shown = showAll ? alternatives : alternatives.slice(0, INLINE_ALTERNATIVES);
  const hiddenCount = alternatives.length - INLINE_ALTERNATIVES;

  return (
    <div data-curtain={open ? "open" : "closed"} className="flex min-h-full flex-1 flex-col">
      {/* The stage: a warm spotlight in the dark room. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[5] bg-[radial-gradient(ellipse_80%_55%_at_50%_40%,#2a1612_0%,#0e0a09_72%)]"
      />

      {/* The reveal. Side room for the open curtain's folds; top room for the valance. */}
      <div className="flex flex-col gap-[18px] px-4 pb-1.5 pt-[88px]">
        <Reveal delay={1.05}>
          <h1
            className={`${signage} text-center text-[46px] leading-none tracking-[0.02em] text-brass-light [text-shadow:0_0_22px_rgba(255,200,110,0.55)]`}
          >
            It’s a match
          </h1>
        </Reveal>

        <Reveal delay={1.15} className="flex justify-center pt-2">
          <PosterCard movie={movie} where={where} />
        </Reveal>

        <Reveal delay={1.3} className="flex flex-col gap-[18px]">
          <p className="text-center text-[14px] leading-[1.5] text-cream/75 [text-wrap:pretty]">
            {reason === "overlap"
              ? "You both picked it. Settle in."
              : "Your lists didn’t overlap, so we found the film that sits between your two tastes."}
          </p>
          {movie.matchTags.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2">
              {movie.matchTags.map((t) => (
                <li key={t} className="rounded-full bg-[#1e1512] px-3 py-[7px] text-[13px] text-cream">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </Reveal>

        {watchLink && (
          <Reveal delay={1.4}>
            <a href={watchLink} target="_blank" rel="noopener noreferrer" className={brassCta}>
              {where ? `${verb} ${where.provider}` : "Where to watch"}
              <ExternalArrow size={18} />
            </a>
          </Reveal>
        )}

        {/* The runner-ups: the full ranked eligible tail, 3 inline, the rest on request. */}
        {alternatives.length > 0 && (
          <Reveal delay={1.5} className="flex flex-col gap-2.5">
            <h2 className={`${label} text-cream/60`}>Or also</h2>
            {shown.map((alt) => (
              <AltRow key={alt.id} movie={alt} where={labelFor(alt)} />
            ))}
            {!showAll && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={`${mono} min-h-11 self-start text-[11px] tracking-[0.2em] text-brass-light transition-colors hover:text-bulb`}
              >
                See {hiddenCount} other match{hiddenCount === 1 ? "" : "es"}
              </button>
            )}
          </Reveal>
        )}

        <Reveal delay={1.5} className="flex justify-center">
          <button
            type="button"
            onClick={() => dispatch({ type: "RESET" })}
            className={`${mono} min-h-11 px-4 text-[11px] tracking-[0.24em] text-cream/65 transition-colors hover:text-bulb`}
          >
            Play again
          </button>
        </Reveal>
      </div>

      {POPCORN && (
        <div aria-hidden className="pointer-events-none fixed inset-y-0 left-1/2 z-[12] w-full max-w-[480px] -translate-x-1/2">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="pp-kernel" />
          ))}
        </div>
      )}

      {/* The proscenium, fixed to the screen: two velvet curtains under the valance. */}
      <div aria-hidden className="pointer-events-none fixed inset-y-0 left-1/2 z-[15] w-full max-w-[480px] -translate-x-1/2">
        <div className="pp-curtain pp-curtain-l" />
        <div className="pp-curtain pp-curtain-r" />
        <div className="absolute inset-x-0 top-0">
          <div className="flex h-[74px] flex-col justify-center gap-[9px] bg-[linear-gradient(#9a1019,#6e0b12)]">
            <Bulbs count={18} />
            <span
              className={`${signage} self-center text-[27px] leading-none tracking-[0.05em] text-bulb [text-shadow:0_0_16px_rgba(255,200,110,0.6)]`}
            >
              Tonight’s feature
            </span>
          </div>
          <div className="pp-scallop" />
        </div>
      </div>

      {/* Closed: tap anywhere to raise the curtain sooner. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed inset-0 z-30 flex flex-col items-center justify-end gap-2 pb-[34px]"
        >
          <span className={`${label} text-bulb [text-shadow:0_0_12px_rgba(0,0,0,0.9)]`}>We have a match</span>
          {/* Full cream with a dark halo: the board's 80% cream drops to about 3.5:1 on the brightest fold. */}
          <span
            className={`${mono} flex min-h-11 items-center text-[11px] tracking-[0.22em] text-cream [text-shadow:0_0_12px_rgba(0,0,0,0.9)]`}
          >
            Tap to raise the curtain
          </span>
        </button>
      )}
    </div>
  );
}

/** One part of the reveal: rises in once the curtain is open, after `delay` seconds. */
function Reveal({ delay, className = "", children }: { delay: number; className?: string; children: ReactNode }) {
  return (
    <div className={`pp-reveal ${className}`} style={{ transitionDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

function AltRow({ movie, where }: { movie: MatchMovie; where: AvailabilityLabel | null }) {
  const link = where?.justWatchLink ?? movie.availability.justWatchLink;
  const meta = [where?.provider, `${movie.matchPercent}% match`].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className="h-[62px] w-11 flex-none overflow-hidden rounded bg-[#2a1d19]">
        {movie.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-display text-[21px] font-extrabold uppercase leading-none">{movie.title}</span>
        <span className="truncate text-[12px] text-cream/65">{meta}</span>
      </span>
      {link && <ExternalArrow size={18} className="flex-none text-cream/50" />}
    </>
  );
  const row = "flex items-center gap-3.5 rounded-xl bg-aisle p-2.5";
  return link ? (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`${row} transition-transform duration-[180ms] ease-entry active:scale-[0.98]`}
    >
      {body}
    </a>
  ) : (
    <div className={row}>{body}</div>
  );
}
