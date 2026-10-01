"use client";

import { useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { PassPhone } from "./PassPhone";
import { Notice } from "./Notice";
import { selectWatchable, labelText, type AvailabilityLabel } from "@/lib/filter";
import { genreNames } from "@/lib/genres";
import type { Player } from "@/lib/gameMachine";
import type { PlayerRec } from "@/lib/inferTypes";
import { Check, Ticket, brassCta, display, label, mono, textButton } from "./palace";

const TARGET = 8;

// No source attribution is shown here. Cross-player positives are a SILENT
// seeding mechanism (lib/infer.ts): surfacing "they're into this" would nudge
// compromise picks and spoil the "you both picked it" reveal on the match
// screen. Each row stays a clean, genuine "would I watch this?".

export function Round3Screen() {
  const { state } = useGame();
  return <PlayerPicks key={state.currentPlayer} player={state.currentPlayer} />;
}

// Round 3, built to docs/design/picture-palace/R3Shortlist.dc.html.
function PlayerPicks({ player }: { player: Player }) {
  const { state, dispatch } = useGame();
  const inference = state.inference?.[player];
  const finalists = inference?.recs ?? [];
  const { services, willingToPay, region } = state.setup;

  const [ready, setReady] = useState(player === 1);
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);

  // Resolve to a SINGLE watchable view: eligible titles, the rentals expand, or
  // the honest end-state. We never render ineligible titles as selectable picks.
  const view = selectWatchable(finalists, services, willingToPay, TARGET);

  if (!ready) {
    return (
      <PassPhone to={2} kicker="Picks locked · no peeking" onReady={() => setReady(true)}>
        Hand it over. Player 2 picks from their own shortlist, then we find your match.
      </PassPhone>
    );
  }

  // Nothing's included, but paying would unlock titles: offer the expand. When
  // they've selected NO services at all, also surface the path back to setup.
  if (view.kind === "offer-rentals") {
    return (
      <Notice
        kicker="Round 3 · Shortlist"
        title="Nothing’s included tonight"
        body={
          services.length === 0
            ? "You haven’t added any subscriptions, but these are available to rent or buy."
            : "None of your picks are on your subscriptions, but they’re available to rent or buy."
        }
      >
        <button
          type="button"
          className={brassCta}
          onClick={() => dispatch({ type: "SET_WILLING_TO_PAY", value: true })}
        >
          Include rentals and purchases
        </button>
        {services.length === 0 && (
          <button type="button" className={`${textButton} self-center`} onClick={() => dispatch({ type: "RESET" })}>
            Start over and add a service
          </button>
        )}
      </Notice>
    );
  }

  // Honest, recoverable end-state: nothing is streamable or rentable for these
  // picks in this region tonight. We never pad the screen with unwatchable titles;
  // we offer an honest retune instead.
  if (view.kind === "none") {
    return (
      <Notice
        kicker="Round 3 · Shortlist"
        title="Nothing watchable tonight"
        body={`We couldn’t find any of these to stream or rent in ${region} right now. Retune your vibes and we’ll try again.`}
      >
        <button type="button" className={brassCta} onClick={() => dispatch({ type: "RESET" })}>
          Start over
        </button>
      </Notice>
    );
  }

  const rows = view.rows; // every row is eligible: nothing unwatchable is shown

  const toggle = (id: number) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const lockIn = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    // Record exactly the titles displayed (post rentals-expand) so the bridge can
    // treat shown-but-unpicked as declined, and never-shown titles as available.
    dispatch({ type: "SET_PICKS", player, movieIds: selected, shown: rows.map((r) => r.item.id) });
    dispatch({ type: "COMPLETE_TURN", player });
  };

  return (
    <div className="pp-enter flex min-h-full flex-1 flex-col gap-3.5">
      <header className="flex flex-none items-center justify-between">
        <span className={`${label} text-brass`}>Round 3 · Shortlist</span>
        <span className={`${label} text-cream/65`}>Player {player}</span>
      </header>

      <div className="flex flex-none flex-col gap-2">
        <h1 className={`${display} text-[44px] leading-[0.86]`}>
          What would
          <br />
          <span className="text-signal">you watch?</span>
        </h1>
        <p className="text-[14px] leading-[1.45] text-cream/75">
          Pick every film you’d happily watch tonight. More picks, better odds.
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {rows.map(({ item, label: availability }, i) => (
          <RecRow
            key={item.id}
            index={i}
            rec={item}
            availability={availability}
            selected={selected.includes(item.id)}
            onToggle={() => toggle(item.id)}
          />
        ))}
      </ul>

      {/* Zero picks is a valid path: the reducer routes an empty shortlist to the
          bridge (a watchable end-state), so the ticket stays live at 0 picked. */}
      <div className="mt-auto pt-1">
        <Ticket
          stub={
            <span aria-live="polite">
              {selected.length}
              <br />
              picked
            </span>
          }
          disabled={submitted}
          onClick={lockIn}
        >
          Lock my picks
        </Ticket>
      </div>
    </div>
  );
}

function RecRow({
  index,
  rec,
  availability,
  selected,
  onToggle,
}: {
  index: number;
  rec: PlayerRec;
  availability: AvailabilityLabel; // always present: only eligible titles are rendered
  selected: boolean;
  onToggle: () => void;
}) {
  const meta = [rec.year, ...genreNames(rec.genreIds).slice(0, 2)].filter(Boolean).join(" · ");
  return (
    <li className="pp-enter" style={{ animationDelay: `${120 + index * 50}ms` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl py-1.5 pl-1.5 pr-2.5 text-left transition-[background-color,box-shadow,transform] duration-300 ease-entry active:scale-[0.98] ${
          selected ? "bg-[#241911] shadow-[inset_0_0_0_1.5px_rgba(214,162,74,0.75)]" : "bg-aisle"
        }`}
      >
        <span className="relative h-[52px] w-9 flex-none overflow-hidden rounded bg-[#2a1d19]">
          {rec.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
            <img src={rec.posterUrl} alt="" className="h-full w-full object-cover" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate font-display text-[19px] font-extrabold uppercase leading-none">
            {rec.title}
          </span>
          {meta && <span className="truncate text-[12px] leading-[15px] text-cream/65">{meta}</span>}
          <span className={`${mono} text-[9.5px] leading-[10px] tracking-[0.16em] text-brass`}>
            {labelText(availability)}
          </span>
        </span>
        <span
          aria-hidden
          className={`flex h-7 w-7 flex-none items-center justify-center rounded-full transition-[background-color,box-shadow] duration-300 ${
            selected ? "bg-brass text-projection" : "shadow-[inset_0_0_0_1.5px_rgba(242,232,213,0.35)]"
          }`}
        >
          {selected && <Check size={16} />}
        </span>
      </button>
    </li>
  );
}
