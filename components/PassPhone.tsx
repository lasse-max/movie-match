import type { ReactNode } from "react";
import type { Player } from "@/lib/gameMachine";
import { Bulbs, brassCta, display, label, mono } from "./palace";

/**
 * The one pass-the-phone gate, for every hand-off: within a round (to Player 2)
 * and at the round boundaries (back to Player 1, with the AI already working
 * behind it). Pure UI: the caller owns when it shows and what "I'm Player N" does.
 * Built to docs/design/picture-palace/Pass2.dc.html and Pass1.dc.html.
 */
export function PassPhone({
  to,
  back = false,
  kicker,
  working = false,
  onReady,
  children,
}: {
  /** Who should hold the phone next. */
  to: Player;
  /** A round boundary: the phone goes back to Player 1. */
  back?: boolean;
  /** The brass line above the headline. */
  kicker: string;
  /** The AI call is already running behind the gate. */
  working?: boolean;
  onReady: () => void;
  /** One line of copy. */
  children: ReactNode;
}) {
  // Each part rises in on the entry curve, 50 ms apart.
  const delay = (i: number) => ({ animationDelay: `${i * 50}ms` });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Bulbs count={20} />

      <div className="flex flex-1 flex-col justify-center gap-[22px] py-6">
        <span className={`pp-enter ${label} text-brass`} style={delay(0)}>
          {kicker}
        </span>
        <h1 className={`pp-enter ${display} text-[76px] leading-[0.84]`} style={delay(1)}>
          Pass
          <br />
          the phone
          <br />
          <span className="text-signal">
            {back ? "back to" : "to"} Player {to}
          </span>
        </h1>
        <div className="pp-enter" style={delay(2)}>
          <SeatTicket player={to} />
        </div>
        <p className="pp-enter max-w-[300px] text-[15px] leading-[1.5] text-cream/75" style={delay(3)}>
          {children}
        </p>
        {working && (
          // The leader's rings are box-shadows (no layout space), so leave them room.
          <div className="pp-enter ml-3.5 flex items-center gap-[26px]" style={delay(4)}>
            <WarmingLeader />
            <span className={`${mono} text-[11px] tracking-[0.2em] text-cream/65`}>Projector warming up</span>
          </div>
        )}
      </div>

      <button type="button" className={brassCta} onClick={onReady}>
        I’m Player {to}
      </button>
    </div>
  );
}

/** The cream seat ticket, tilted: ADMIT ONE · SEAT · PLAYER N. */
function SeatTicket({ player }: { player: Player }) {
  return (
    <div
      aria-hidden
      className="flex h-[74px] w-[250px] -rotate-[4deg] items-stretch rounded-[6px] bg-cream text-projection shadow-[0_20px_40px_-18px_rgba(0,0,0,0.9)]"
    >
      <span
        className={`${mono} flex w-[70px] flex-none items-center justify-center border-r-2 border-dashed border-projection/35 text-center text-[10px] leading-[1.4] tracking-[0.2em]`}
      >
        Admit
        <br />
        one
      </span>
      <span className="flex flex-col justify-center gap-0.5 px-4">
        <span className={`${mono} text-[9px] tracking-[0.22em] text-[#6b5a50]`}>Seat</span>
        <span className={`${display} text-[34px] leading-none text-velvet`}>Player {player}</span>
      </span>
    </div>
  );
}

/** A small still leader: the projector is warming up while the AI works. */
function WarmingLeader() {
  return (
    <div
      aria-hidden
      className="relative h-11 w-11 flex-none rounded-full bg-[#1a1411] shadow-[inset_0_0_0_2px_rgba(242,232,213,0.5),0_0_0_12px_#0e0a09,0_0_0_14px_rgba(242,232,213,0.22)]"
    >
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(rgba(242,232,213,0.14)_0_130deg,rgba(242,232,213,0)_130deg)]" />
      <span className="absolute inset-x-0 top-1/2 -mt-px h-0.5 bg-cream/40" />
      <span className="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-cream/40" />
      <span className="absolute inset-[16%] rounded-full shadow-[inset_0_0_0_2px_rgba(242,232,213,0.5)]" />
    </div>
  );
}
