"use client";

import { useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { selectSwipeSamples, type PoolMovie } from "@/lib/blendTypes";
import { genreNames } from "@/lib/genres";
import { blurb } from "@/lib/blurb";
import type { Player } from "@/lib/gameMachine";
import {
  Check,
  GOLD_SURFACE,
  Heart,
  Phone,
  Question,
  XMark,
  eyebrow,
  goldCta,
  pill,
  screenCol,
} from "./marquee";

export function Round2Screen() {
  const { state } = useGame();
  const pool = state.blend?.pool ?? [];
  // Each player gets their own distinct set (both span the directions), so the
  // other player's positives become genuinely-new Round 3 candidates.
  const samples = selectSwipeSamples(pool)[state.currentPlayer];

  if (samples.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text/55">
        No samples to swipe — something went wrong upstream.
      </p>
    );
  }

  // Remount per player so each turn starts clean (and re-arms the handoff gate).
  return <PlayerSwipe key={state.currentPlayer} player={state.currentPlayer} samples={samples} />;
}

function PlayerSwipe({ player, samples }: { player: Player; samples: PoolMovie[] }) {
  const { dispatch } = useGame();
  const [ready, setReady] = useState(player === 1);
  const [index, setIndex] = useState(0);
  const [yes, setYes] = useState<number[]>([]);
  const [no, setNo] = useState<number[]>([]);
  const [neutral, setNeutral] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false); // blocks a synchronous double-tap

  const finishTurn = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    // Send all three buckets so the reducer sees a fully-processed turn even when
    // every card was "Don't know" (empty yes+no but a populated neutral list).
    dispatch({ type: "SET_SWIPES", player, yes, no, neutral });
    dispatch({ type: "COMPLETE_TURN", player }); // P1 → pass phone; P2 → infer mood
  };

  // Pass-the-phone handoff before Player 2.
  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center px-2 text-center">
        <div className="relative mb-7 flex h-[120px] w-[120px] items-center justify-center">
          <span className="absolute inset-0 rounded-full border-[1.5px] border-gold/50 motion-safe:animate-[mmPulseRing_2.4s_ease-out_infinite]" />
          <span className="absolute inset-0 rounded-full border-[1.5px] border-gold/50 motion-safe:animate-[mmPulseRing_2.4s_ease-out_infinite_1.2s]" />
          <div className="flex h-[78px] w-[78px] items-center justify-center rounded-3xl border border-gold/40 bg-[linear-gradient(150deg,rgba(232,192,125,0.18),rgba(232,192,125,0.04))] text-gold motion-safe:animate-[mmFloat_3.5s_ease-in-out_infinite]">
            <Phone size={34} />
          </div>
        </div>
        <p className={`mb-2 ${eyebrow} tracking-[2px]`}>Picks locked · no peeking</p>
        <h2 className="mb-3 font-display text-[36px] leading-[1.05]">
          Pass the phone
          <br />
          to <span className="italic text-gold">Player 2</span>
        </h2>
        <p className="mb-8 max-w-[260px] text-[14.5px] leading-[1.5] text-text/55">
          A new set of titles — swipe on the vibe, not whether you’ve seen them.
        </p>
        <button className={goldCta} onClick={() => setReady(true)}>
          I’m ready
        </button>
      </div>
    );
  }

  const swipe = (keep: boolean) => {
    const movie = samples[index];
    if (keep) setYes((v) => [...v, movie.id]);
    else setNo((v) => [...v, movie.id]);
    setIndex((i) => i + 1);
  };

  // "Don't know" — neutral. Recorded explicitly (so the turn still completes when
  // every card is skipped), but handed to inference as no-data, never a false
  // "away". See lib/gameMachine.ts (turn completion) and lib/infer.ts (degrade).
  const skip = () => {
    setNeutral((v) => [...v, samples[index].id]);
    setIndex((i) => i + 1);
  };

  // Done — lock in this player's leanings (both ways) and pass on.
  if (index >= samples.length) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-[74px] w-[74px] items-center justify-center rounded-full border border-gold/40 bg-[linear-gradient(150deg,rgba(232,192,125,0.18),rgba(232,192,125,0.04))] text-gold">
          <Check size={32} />
        </div>
        <h2 className="mb-2.5 font-display text-[34px]">That’s the read.</h2>
        <p className="mb-8 text-[14.5px] text-text/55">
          {yes.length} {yes.length === 1 ? "title" : "titles"} you’re into · {no.length} passed
          {neutral.length > 0 ? ` · ${neutral.length} skipped` : ""}
        </p>
        <button className={goldCta} disabled={submitted} onClick={finishTurn}>
          {player === 1 ? "Done — pass the phone" : "See where you land"}
        </button>
      </div>
    );
  }

  const movie = samples[index];
  const kicker = genreNames(movie.genreIds).slice(0, 2).join(" · ");
  const description = blurb(movie.overview, 120);

  return (
    <div className={`${screenCol} pb-1`}>
      <div className="mb-3.5 flex items-center justify-between">
        <span className={pill}>Round 2 · Swipe</span>
        <span className="text-[12px] text-text/50">
          {index + 1} / {samples.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-4">
        <div className="relative aspect-[2/3] max-h-[420px] w-full overflow-hidden rounded-[22px] border border-text/10 bg-text/[0.04] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.9)]">
          {movie.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="h-full w-full object-cover"
            />
          ) : null}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,.85) 100%)" }}
          />
          {kicker && (
            <div className="absolute left-3.5 top-3.5 rounded-full border border-text/25 px-2.5 py-1 text-[10px] uppercase tracking-[1.5px] text-text/70 backdrop-blur-sm">
              {kicker}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h3 className="font-display text-[30px] leading-none">{movie.title}</h3>
            {movie.year && <p className="mt-1 text-[12.5px] text-text/60">{movie.year}</p>}
            {description && (
              <p className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-text/60">{description}</p>
            )}
          </div>
        </div>
        <p className="text-center text-[13px] text-text/50">
          In the mood for something <span className="font-display italic text-gold">like</span> this?
        </p>
      </div>

      {/* Three real, equal choices. "Not it" (outline) and "This vibe" (gold) stay the
          visual heroes; "Not sure" is a clearly visible, equally-tappable third option —
          NOT a faint ghost. (The old tiny low-contrast "Skip" caused users to mis-swipe
          like/pass, polluting the deliberately 0-weight neutral signal that feeds the mood
          inference, the eval, and the data flywheel.) Semantics unchanged: skip() = neutral. */}
      <div className="mt-4 flex items-stretch gap-2">
        <button
          onClick={() => swipe(false)}
          className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border border-text/18 bg-text/[0.03] py-[15px] text-[14px] font-semibold text-text transition active:scale-[0.98]"
        >
          <XMark size={16} />
          Not it
        </button>
        <button
          onClick={skip}
          className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border border-text/10 bg-text/[0.08] py-[15px] text-[13.5px] font-medium text-text/80 transition active:scale-[0.98]"
        >
          <Question size={16} />
          Not sure
        </button>
        <button
          onClick={() => swipe(true)}
          className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl py-[15px] text-[14px] font-bold transition active:scale-[0.98] ${GOLD_SURFACE}`}
        >
          <Heart size={16} />
          This vibe
        </button>
      </div>
    </div>
  );
}
