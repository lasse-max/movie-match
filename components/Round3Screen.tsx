"use client";

import { useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { evaluateAvailability, labelText, type AvailabilityLabel } from "@/lib/filter";
import type { Player } from "@/lib/gameMachine";
import type { PlayerRec } from "@/lib/inferTypes";

const TARGET = 5;

const primaryBtn =
  "w-full rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition enabled:hover:opacity-90 enabled:active:scale-[0.98] disabled:opacity-40";

// No source attribution is shown here. Cross-player positives are a SILENT
// seeding mechanism (lib/infer.ts) — surfacing "they're into this" would nudge
// compromise picks and spoil the "you both picked it!" reveal on the match
// screen. Each card stays a clean, genuine "would I watch this?".

export function Round3Screen() {
  const { state } = useGame();
  return <PlayerPicks key={state.currentPlayer} player={state.currentPlayer} />;
}

function PlayerPicks({ player }: { player: Player }) {
  const { state, dispatch } = useGame();
  const inference = state.inference?.[player];
  const finalists = inference?.recs ?? [];
  const { services, willingToPay } = state.setup;

  const [ready, setReady] = useState(player === 1);
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);

  // Apply the (pure) eligibility filter — only what they can actually watch.
  const evaluated = finalists.map((rec) => ({
    rec,
    ...evaluateAvailability(rec.availability, services, willingToPay),
  }));
  const eligible = evaluated.filter((e) => e.eligible).slice(0, TARGET);
  const couldRent = evaluated.some((e) => e.rentBuyAvailable);

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

  // Never dead-end: nothing included, but rentals would unlock titles → offer it.
  if (eligible.length === 0 && !willingToPay && couldRent) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>💸</span>
        <h2 className="text-xl font-semibold">Nothing’s included tonight</h2>
        <p className="text-sm text-foreground/60">
          None of your picks are on your subscriptions — but they’re available to rent or buy.
        </p>
        <button
          className={primaryBtn}
          onClick={() => dispatch({ type: "SET_WILLING_TO_PAY", value: true })}
        >
          Include rentals &amp; purchases
        </button>
      </div>
    );
  }

  // Absolute fallback (rare — nothing watchable in the region at all): show the
  // finalists anyway so the round never ends empty.
  const degraded = eligible.length === 0;
  const rows = degraded ? evaluated.slice(0, TARGET) : eligible;

  const toggle = (id: number) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const lockIn = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    dispatch({ type: "SET_PICKS", player, movieIds: selected });
    dispatch({ type: "COMPLETE_TURN", player });
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

      {degraded && (
        <p className="rounded-lg bg-foreground/5 px-3 py-2 text-center text-xs text-foreground/60">
          Couldn’t confirm these on your services — pick anyway, or hit Reset to retune.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map(({ rec, label }) => (
          <RecRow
            key={rec.id}
            rec={rec}
            label={label}
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
          {selected.length === 0 ? "Tap every title you'd be up for." : `${selected.length} selected`}
        </p>
      </div>
    </div>
  );
}

function RecRow({
  rec,
  label,
  selected,
  onToggle,
}: {
  rec: PlayerRec;
  label: AvailabilityLabel | null;
  selected: boolean;
  onToggle: () => void;
}) {
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
          <div className="text-[11px] text-foreground/60">
            {label ? labelText(label) : "Not on your services"}
          </div>
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
