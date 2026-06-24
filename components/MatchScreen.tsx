"use client";

import { useState } from "react";
import { useGame } from "./GameProvider";
import { evaluateAvailability } from "@/lib/filter";
import type { MatchMovie } from "@/lib/inferTypes";
import {
  ExternalArrow,
  GOLD_SURFACE,
  Heart,
  eyebrowNeutral,
  ghostBtn,
  goldCta,
  tag,
} from "./marquee";

const INLINE_ALTERNATIVES = 3; // runner-ups shown inline; the rest behind "See other matches"

export function MatchScreen() {
  const { state, dispatch } = useGame();
  const [showAll, setShowAll] = useState(false);
  const match = state.match;
  const { services, willingToPay } = state.setup;
  const labelFor = (m: MatchMovie) =>
    evaluateAvailability(m.availability, services, willingToPay).label;

  if (!match) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-5 text-center">
        <p className="text-sm text-text/60">No pick yet — start over?</p>
        <button className={goldCta} onClick={() => dispatch({ type: "RESET" })}>
          Play again
        </button>
      </div>
    );
  }

  const { movie, reason, alternatives } = match;
  const overlap = reason === "overlap";
  const heroLabel = labelFor(movie);
  const justWatch = heroLabel?.justWatchLink ?? movie.availability.justWatchLink;
  const verb = heroLabel?.type === "rent" ? "Rent on" : heroLabel?.type === "buy" ? "Buy on" : "Watch on";
  const shown = showAll ? alternatives : alternatives.slice(0, INLINE_ALTERNATIVES);
  const hiddenCount = alternatives.length - INLINE_ALTERNATIVES;

  return (
    <div className="relative flex min-h-full flex-1 flex-col text-center">
      {/* peak glow — rose for the overlap match, gold for the bridge pick */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[80px] h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-[10px] motion-safe:animate-[mmGlow_5s_ease-in-out_infinite]"
        style={{
          background: overlap
            ? "radial-gradient(circle, rgba(240,104,90,0.28), rgba(240,104,90,0) 65%)"
            : "radial-gradient(circle, rgba(232,192,125,0.22), rgba(232,192,125,0) 65%)",
        }}
      />

      <div className="relative">
        {/* badge — rose "It's a match" (peak) or gold "Your bridge pick" */}
        {overlap ? (
          <div className="mb-4 mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-rose/40 bg-rose/10 px-3.5 py-1.5">
            <Heart size={14} className="text-rose" />
            <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-rose">
              It’s a match
            </span>
          </div>
        ) : (
          <div className="mb-4 mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-gold">
              Your bridge pick
            </span>
          </div>
        )}

        {/* hero poster */}
        <div className="relative mx-auto mb-[18px] aspect-[2/3] w-[188px] overflow-hidden rounded-[18px] border border-gold/30 bg-text/[0.04] shadow-[0_30px_70px_-22px_rgba(0,0,0,0.95)] motion-safe:animate-[mmFloat_5s_ease-in-out_infinite]">
          {movie.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
            <img src={movie.posterUrl} alt={movie.title} className="h-full w-full object-cover" />
          ) : null}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.8) 100%)" }}
          />
          <div className="absolute right-3 top-3 rounded-full border border-gold/40 bg-ink/60 px-[11px] py-1.5 text-[13px] font-bold text-gold backdrop-blur-md">
            {movie.matchPercent}%
          </div>
        </div>

        {/* title + meta */}
        <h2 className="mb-[3px] font-display text-[34px] leading-[1.05]">{movie.title}</h2>
        <p className="mb-3 text-[13px] text-text/50">
          {movie.year ? `${movie.year} · ` : ""}
          {movie.matchPercent}% match
        </p>

        {movie.matchTags.length > 0 && (
          <div className="mb-3.5 flex flex-wrap justify-center gap-1.5">
            {movie.matchTags.map((t) => (
              <span key={t} className={tag}>
                {t}
              </span>
            ))}
          </div>
        )}

        <p className="mx-auto mb-[18px] max-w-[290px] text-[13.5px] leading-[1.5] text-text/60">
          {overlap
            ? "You both picked it — settle in."
            : "Your lists didn’t overlap, so we bridged your tastes into this."}
        </p>

        {/* watch CTA */}
        {justWatch && (
          <a
            href={justWatch}
            target="_blank"
            rel="noopener noreferrer"
            className={`mb-[22px] inline-flex items-center gap-2 rounded-[14px] px-[22px] py-[13px] text-[14px] font-bold ${GOLD_SURFACE}`}
          >
            {heroLabel ? `${verb} ${heroLabel.provider}` : "Where to watch"}
            <ExternalArrow size={14} />
          </a>
        )}

        {/* alternatives — the full backfilled tail; 3 inline + "See other matches" */}
        {alternatives.length > 0 && (
          <div className="mb-[18px] text-left">
            <p className={`mb-2.5 ${eyebrowNeutral}`}>Or also…</p>
            <div className="flex flex-col gap-2">
              {shown.map((alt) => (
                <AltRow key={alt.id} movie={alt} provider={labelFor(alt)?.provider ?? null} />
              ))}
            </div>
            {!showAll && hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-2.5 text-[12px] font-medium text-gold/80 underline underline-offset-4 transition hover:text-gold"
              >
                See {hiddenCount} other match{hiddenCount === 1 ? "" : "es"}
              </button>
            )}
          </div>
        )}

        <button className={ghostBtn} onClick={() => dispatch({ type: "RESET" })}>
          Play again
        </button>
      </div>
    </div>
  );
}

function AltRow({ movie, provider }: { movie: MatchMovie; provider: string | null }) {
  const justWatch = movie.availability.justWatchLink;
  const meta = `${movie.matchPercent}% match${provider ? ` · ${provider}` : ""}`;
  return (
    <a
      href={justWatch ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-[14px] border border-text/8 bg-text/[0.02] p-[9px] transition active:scale-[0.99]"
    >
      <div className="h-[54px] w-[38px] shrink-0 overflow-hidden rounded-[7px] border border-text/10 bg-text/10">
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
          <img src={movie.posterUrl} alt={movie.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold">{movie.title}</p>
        <p className="truncate text-[11.5px] text-text/50">{meta}</p>
      </div>
      <ExternalArrow size={15} className="shrink-0 text-text/50" />
    </a>
  );
}
