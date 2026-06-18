"use client";

import { useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { CATEGORIES } from "@/lib/categories";
import type { Player } from "@/lib/gameMachine";

const MIN_PICKS = 2;
const MAX_PICKS = 3;

const primaryBtn =
  "w-full rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition enabled:hover:opacity-90 enabled:active:scale-[0.98] disabled:opacity-40";

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
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>
          📲
        </span>
        <h2 className="text-xl font-semibold">Pass the phone to Player 2</h2>
        <p className="text-sm text-foreground/60">
          Player 1’s picks are locked in — no peeking. Player 2, your turn.
        </p>
        <button className={primaryBtn} onClick={() => setReady(true)}>
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
    <div className="flex w-full flex-col gap-5">
      <div className="text-center">
        <span className="rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-wide">
          Round 1 of 3 · Player {player}
        </span>
        <h2 className="mt-3 text-lg font-semibold">What are you in the mood for?</h2>
        <p className="text-sm text-foreground/60">
          Pick 2–3 vibes ({selected.length}/{MAX_PICKS})
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/15 hover:border-foreground/40"
              } ${atMax ? "opacity-40" : ""}`}
            >
              <span aria-hidden>{c.emoji}</span>
              <span className="truncate">{c.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          className={primaryBtn}
          disabled={!canContinue || submitted}
          onClick={lockIn}
        >
          {player === 1 ? "Done — pass the phone" : "Lock in picks"}
        </button>
        {!canContinue && (
          <p className="text-xs text-foreground/50">Pick at least {MIN_PICKS} to continue.</p>
        )}
      </div>
    </div>
  );
}
