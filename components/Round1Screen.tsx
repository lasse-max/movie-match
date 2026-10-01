"use client";

import { useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { CATEGORIES, type Category } from "@/lib/categories";
import type { Player } from "@/lib/gameMachine";
import { PassPhone } from "./PassPhone";
import { Ticket, display, label } from "./palace";

const MIN_PICKS = 2;
const MAX_PICKS = 3;

// Moods on top (they blend), genres below (they anchor the search).
const MOODS = CATEGORIES.filter((c) => c.tmdbGenreId == null);
const GENRES = CATEGORIES.filter((c) => c.tmdbGenreId != null);

export function Round1Screen() {
  const { state } = useGame();
  // Remount per player so each turn starts clean (clears in-progress picks and
  // re-arms the pass-the-phone gate for Player 2).
  return <PlayerTurn key={state.currentPlayer} player={state.currentPlayer} />;
}

// Round 1, built to docs/design/picture-palace/R1Mood.dc.html.
function PlayerTurn({ player }: { player: Player }) {
  const { dispatch } = useGame();
  const [ready, setReady] = useState(player === 1); // P1 starts immediately
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false); // blocks a synchronous double-tap

  // Pass-the-phone handoff before Player 2 picks.
  if (!ready) {
    return (
      <PassPhone to={2} kicker="Picks locked · no peeking" onReady={() => setReady(true)}>
        Hand it over. Player 2 picks their own moods, then we blend the two of you.
      </PassPhone>
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

  const chip = (c: Category, i: number, kind: "mood" | "genre") => {
    const on = selected.includes(c.id);
    const atMax = !on && selected.length >= MAX_PICKS;
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => toggle(c.id)}
        disabled={atMax}
        aria-pressed={on}
        style={{ animationDelay: `${120 + i * 50}ms` }}
        className={`pp-enter flex items-center justify-between gap-2 text-left font-semibold transition-[background-color,box-shadow,transform,opacity] duration-300 ease-entry active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${
          kind === "mood"
            ? "min-h-[46px] rounded-xl px-3.5 text-[15px]"
            : "min-h-11 rounded-full px-[13px] text-[14px]" // 44 px target (the board's 40 is below the brief's minimum)
        } ${
          on
            ? "bg-[#241911] text-cream shadow-[inset_0_0_0_1.5px_rgba(214,162,74,0.75),0_10px_26px_-14px_rgba(214,162,74,0.55)]"
            : "bg-aisle text-cream/85"
        }`}
      >
        {c.label}
        {kind === "mood" && on && (
          <span
            aria-hidden
            className="h-[7px] w-[7px] flex-none rounded-full bg-bulb shadow-[0_0_8px_2px_rgba(255,200,110,0.7)]"
          />
        )}
      </button>
    );
  };

  return (
    <div className="pp-enter flex min-h-full flex-1 flex-col gap-[18px]">
      <header className="flex flex-none items-center justify-between">
        <span className={`${label} text-brass`}>Round 1 · The mood</span>
        <span className={`${label} text-cream/65`}>Player {player}</span>
      </header>

      <div className="flex flex-none flex-col gap-2.5">
        <h1 className={`${display} text-[50px] leading-[0.86]`}>
          What are you
          <br />
          <span className="text-signal">in the mood for?</span>
        </h1>
        <p className="text-[15px] leading-[1.5] text-cream/75">
          Pick 2 or 3. Your partner won’t see them.
        </p>
      </div>

      <div className="flex flex-none flex-col gap-2">
        <span className={`${label} text-cream/65`}>Moods</span>
        <div className="grid grid-cols-2 gap-2">{MOODS.map((c, i) => chip(c, i, "mood"))}</div>
      </div>

      <div className="flex flex-none flex-col gap-2">
        <span className={`${label} text-cream/65`}>Or a genre</span>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((c, i) => chip(c, MOODS.length + i, "genre"))}
        </div>
      </div>

      <div className="mt-auto flex flex-none flex-col gap-2.5">
        <span aria-live="polite" className={`${label} self-center text-brass`}>
          {selected.length} of {MAX_PICKS} picked
        </span>
        <Ticket
          stub={
            <>
              Lock
              <br />
              it in
            </>
          }
          disabled={!canContinue || submitted}
          onClick={lockIn}
        >
          Lock my picks
        </Ticket>
      </div>
    </div>
  );
}
