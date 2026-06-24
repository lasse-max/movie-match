"use client";

import { useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { selectWatchable, labelText, type AvailabilityLabel } from "@/lib/filter";
import { genreNames } from "@/lib/genres";
import type { Player } from "@/lib/gameMachine";
import type { PlayerRec } from "@/lib/inferTypes";
import { Check, Phone, Progress, eyebrow, goldCta, loaderCol, pill, screenCol, tag } from "./marquee";

const TARGET = 8;

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
  const { services, willingToPay, region } = state.setup;

  const [ready, setReady] = useState(player === 1);
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);

  // Resolve to a SINGLE watchable view — eligible titles, the rentals expand, or
  // the honest end-state. We never render ineligible titles as selectable picks.
  const view = selectWatchable(finalists, services, willingToPay, TARGET);

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
          Last step — pick every title you’d be happy to watch tonight.
        </p>
        <button className={goldCta} onClick={() => setReady(true)}>
          I’m ready
        </button>
      </div>
    );
  }

  // Nothing's included, but paying would unlock titles → offer the expand. When
  // they've selected NO services at all, also surface the path back to setup.
  if (view.kind === "offer-rentals") {
    return (
      <div className={loaderCol}>
        <h2 className="mb-2.5 font-display text-[32px]">Nothing’s included tonight</h2>
        <p className="mb-7 max-w-[270px] text-[14px] leading-[1.5] text-text/55">
          {services.length === 0
            ? "You haven’t added any subscriptions — but these are available to rent or buy."
            : "None of your picks are on your subscriptions — but they’re available to rent or buy."}
        </p>
        <button
          className={goldCta}
          onClick={() => dispatch({ type: "SET_WILLING_TO_PAY", value: true })}
        >
          Include rentals &amp; purchases
        </button>
        {services.length === 0 && (
          <button
            className="mt-3 text-[12px] text-text/45 underline underline-offset-4 transition hover:text-text"
            onClick={() => dispatch({ type: "RESET" })}
          >
            …or start over and add a service
          </button>
        )}
      </div>
    );
  }

  // Honest, recoverable end-state: nothing is streamable or rentable for these
  // picks in this region tonight. We never pad the screen with unwatchable titles
  // — offer an honest retune instead.
  if (view.kind === "none") {
    return (
      <div className={loaderCol}>
        <h2 className="mb-2.5 font-display text-[32px]">Nothing watchable tonight</h2>
        <p className="mb-7 max-w-[270px] text-[14px] leading-[1.5] text-text/55">
          We couldn’t find any of these to stream or rent in {region} right now. Retune your vibes
          and we’ll try again.
        </p>
        <button className={goldCta} onClick={() => dispatch({ type: "RESET" })}>
          Start over
        </button>
      </div>
    );
  }

  const rows = view.rows; // every row is eligible — nothing unwatchable is shown

  const toggle = (id: number) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const lockIn = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    // Record exactly the titles displayed (post rentals-expand) so the bridge can
    // treat shown-but-unpicked as declined — and never-shown titles as available.
    dispatch({ type: "SET_PICKS", player, movieIds: selected, shown: rows.map((r) => r.item.id) });
    dispatch({ type: "COMPLETE_TURN", player });
  };

  return (
    <div className={screenCol}>
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <span className={pill}>Round 3 · Shortlist</span>
          <Progress done={3} />
        </div>

        <h2 className="mb-1 font-display text-[32px] leading-[1.06]">
          Which would you <span className="italic text-gold">watch</span>?
        </h2>
        <p className="mb-5 text-[13.5px] text-text/50">
          Tap every title you’d be up for.{" "}
          {selected.length > 0 && <span className="text-gold">{selected.length} selected</span>}
        </p>

        <ul className="flex flex-col gap-[9px]">
          {rows.map(({ item, label }) => (
            <RecRow
              key={item.id}
              rec={item}
              label={label}
              selected={selected.includes(item.id)}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </ul>
      </div>

      <div className="mt-4">
        {/* Zero picks is a valid path — the reducer routes an empty shortlist to the
            bridge (→ a watchable end-state), so the CTA stays enabled at 0 selected. */}
        <button className={goldCta} disabled={submitted} onClick={lockIn}>
          {player === 1 ? "Done — pass the phone" : "Find your match"}
        </button>
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
  label: AvailabilityLabel; // always present — only eligible titles are rendered
  selected: boolean;
  onToggle: () => void;
}) {
  const tags = genreNames(rec.genreIds).slice(0, 2);
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 rounded-2xl border p-[9px] text-left transition active:scale-[0.99] ${
          selected ? "border-gold/65 bg-gold/[0.08]" : "border-text/9 bg-text/[0.02]"
        }`}
      >
        <div className="h-[66px] w-[46px] shrink-0 overflow-hidden rounded-lg border border-text/10 bg-text/10">
          {rec.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
            <img
              src={rec.posterUrl}
              alt={rec.title}
              width={46}
              height={66}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold">
            {rec.title}
            {rec.year ? <span className="font-normal text-text/45"> · {rec.year}</span> : null}
          </div>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className={tag}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 text-[11.5px] text-gold">{labelText(label)}</div>
        </div>
        <span
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition ${
            selected ? "bg-gold text-ink" : "border border-text/25"
          }`}
          aria-hidden
        >
          {selected && <Check size={13} />}
        </span>
      </button>
    </li>
  );
}
