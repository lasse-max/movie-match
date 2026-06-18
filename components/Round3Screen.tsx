"use client";

import { useRef, useState } from "react";
import { useGame } from "./GameProvider";
import type { Player } from "@/lib/gameMachine";
import type { PlayerRec, RecSource } from "@/lib/inferTypes";

const primaryBtn =
  "w-full rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition enabled:hover:opacity-90 enabled:active:scale-[0.98] disabled:opacity-40";

const SOURCE_BADGE: Partial<Record<RecSource, string>> = {
  "cross-player": "💜 They’re into this",
  fresh: "✨ Fresh pick",
};

export function Round3Screen() {
  const { state } = useGame();
  return <PlayerPicks key={state.currentPlayer} player={state.currentPlayer} />;
}

function PlayerPicks({ player }: { player: Player }) {
  const { state, dispatch } = useGame();
  const inference = state.inference?.[player];
  const recs = inference?.recs ?? [];

  const [ready, setReady] = useState(player === 1);
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);

  if (!ready) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>📲</span>
        <h2 className="text-xl font-semibold">Pass the phone to Player 2</h2>
        <p className="text-sm text-foreground/60">
          Last step — pick every title you’d be happy to watch tonight.
        </p>
        <button className={primaryBtn} onClick={() => setReady(true)}>
          I’m ready
        </button>
      </div>
    );
  }

  const toggle = (id: number) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const lockIn = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    dispatch({ type: "SET_PICKS", player, movieIds: selected });
    dispatch({ type: "COMPLETE_TURN", player }); // P1 → pass phone; P2 → resolve
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="text-center">
        <span className="rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-wide">
          Round 3 of 3 · Player {player}
        </span>
        <h2 className="mt-3 text-lg font-semibold">Which would you watch?</h2>
        {inference?.moodRead.summary && (
          <p className="text-xs text-foreground/50">Your vibe: {inference.moodRead.summary}</p>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {recs.map((rec) => (
          <RecRow
            key={rec.id}
            rec={rec}
            selected={selected.includes(rec.id)}
            onToggle={() => toggle(rec.id)}
          />
        ))}
      </ul>

      <div className="flex flex-col items-center gap-2">
        <button className={primaryBtn} disabled={submitted} onClick={lockIn}>
          {player === 1 ? "Done — pass the phone" : "Find your match"}
        </button>
        <p className="text-xs text-foreground/50">
          {selected.length === 0
            ? "Tap every title you'd be up for."
            : `${selected.length} selected`}
        </p>
      </div>
    </div>
  );
}

function RecRow({
  rec,
  selected,
  onToggle,
}: {
  rec: PlayerRec;
  selected: boolean;
  onToggle: () => void;
}) {
  const badge = SOURCE_BADGE[rec.source];
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition ${
          selected
            ? "border-foreground ring-1 ring-foreground"
            : "border-foreground/15 hover:border-foreground/40"
        }`}
      >
        <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-foreground/10">
          {rec.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
            <img
              src={rec.posterUrl}
              alt={rec.title}
              width={44}
              height={64}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {rec.title}
            {rec.year ? <span className="font-normal text-foreground/50"> · {rec.year}</span> : null}
          </div>
          {badge && <div className="text-[11px] text-foreground/60">{badge}</div>}
        </div>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
            selected ? "border-foreground bg-foreground text-background" : "border-foreground/30"
          }`}
          aria-hidden
        >
          {selected ? "✓" : ""}
        </span>
      </button>
    </li>
  );
}
