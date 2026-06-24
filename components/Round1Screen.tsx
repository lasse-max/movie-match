"use client";

import { useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { CATEGORIES } from "@/lib/categories";
import type { Player } from "@/lib/gameMachine";
import {
  Phone,
  Progress,
  chipBase,
  chipOff,
  chipOn,
  eyebrow,
  goldCta,
  pill,
  screenCol,
} from "./marquee";

const MIN_PICKS = 2;
const MAX_PICKS = 3;

export function Round1Screen() {
  const { state } = useGame();
  // Remount per player so each turn starts clean (clears in-progress picks and
  // re-arms the pass-the-phone gate for Player 2).
  return <PlayerTurn key={state.currentPlayer} player={state.currentPlayer} />;
}

function PlayerTurn({ player }: { player: Player }) {
  const { dispatch } = useGame();
  const [ready, setReady] = useState(player === 1); // P1 starts immediately
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false); // blocks a synchronous double-tap

  // Pass-the-phone handoff before Player 2 picks.
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
          Their turn to set the vibe. We’ll blend the two of you together.
        </p>
        <button className={goldCta} onClick={() => setReady(true)}>
          I’m ready
        </button>
      </div>
    );
  }

  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id)
        ? cur.filter((c) => c !== id)
        : cur.length >= MAX_PICKS
          ? cur // cap at MAX_PICKS; ignore extra taps
          : [...cur, id]
    );

  const canContinue = selected.length >= MIN_PICKS;

  const lockIn = () => {
    if (submittedRef.current || !canContinue) return;
    submittedRef.current = true;
    setSubmitted(true);
    dispatch({ type: "SET_CATEGORIES", player, categories: selected });
    dispatch({ type: "COMPLETE_TURN", player }); // P1 → pass phone; P2 → round complete
  };

  return (
    <div className={screenCol}>
      <div className="flex-1">
        <div className="mb-6 flex items-center justify-between">
          <span className={pill}>Round 1 · Player {player}</span>
          <Progress done={1} />
        </div>

        <h2 className="mb-1.5 font-display text-[34px] leading-[1.06]">
          What’s the <span className="italic text-gold">mood</span> tonight?
        </h2>
        <p className="mb-6 text-[14px] text-text/55">
          Pick two or three. <span className="text-gold">{selected.length} / {MAX_PICKS}</span>
        </p>

        <div className="flex flex-wrap gap-[9px]">
          {CATEGORIES.map((c) => {
            const on = selected.includes(c.id);
            const atMax = !on && selected.length >= MAX_PICKS;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                disabled={atMax}
                aria-pressed={on}
                className={`${chipBase} ${on ? chipOn : chipOff} ${atMax ? "opacity-35" : ""}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <button className={goldCta} disabled={!canContinue || submitted} onClick={lockIn}>
          {player === 1 ? "Done — pass the phone" : "Lock in picks"}
        </button>
        {!canContinue && (
          <p className="mt-2.5 text-center text-[12px] text-text/45">
            Pick at least {MIN_PICKS} to continue.
          </p>
        )}
      </div>
    </div>
  );
}
