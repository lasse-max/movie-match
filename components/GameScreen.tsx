"use client";

import { useGame } from "./GameProvider";
import { SetupScreen } from "./SetupScreen";
import { Round1Screen } from "./Round1Screen";
import { BlendingScreen } from "./BlendingScreen";
import { Round2Screen } from "./Round2Screen";
import { InferringScreen } from "./InferringScreen";
import { Round3Screen } from "./Round3Screen";
import { TiebreakScreen } from "./TiebreakScreen";
import { MatchScreen } from "./MatchScreen";
import type { Phase } from "@/lib/gameMachine";

// Faint fractal-noise grain (decorative, ~5% over the canvas).
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function GameScreen() {
  const { state } = useGame();

  return (
    <main
      className="relative flex min-h-dvh flex-col overflow-hidden px-5 py-6"
      style={{
        background:
          "radial-gradient(120% 90% at 50% -10%, #16131f 0%, #0a090f 45%, #060509 100%)",
      }}
    >
      {/* ambient gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[12%] h-[560px] w-[560px] -translate-x-1/2 rounded-full blur-[20px] motion-safe:animate-[mmGlow_7s_ease-in-out_infinite]"
        style={{
          background:
            "radial-gradient(circle, rgba(232,192,125,0.14), rgba(232,192,125,0) 62%)",
        }}
      />
      {/* film grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[10%] opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      <section className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col">
        <PhaseView phase={state.phase} />
      </section>

      <DevControls />
    </main>
  );
}

function PhaseView({ phase }: { phase: Phase }) {
  switch (phase) {
    case "setup":
      return <SetupScreen />;
    case "round1":
      return <Round1Screen />;
    case "blending":
      return <BlendingScreen />;
    case "round2":
      return <Round2Screen />;
    case "inferring":
      return <InferringScreen />;
    case "round3":
      return <Round3Screen />;
    case "tiebreak":
      return <TiebreakScreen />;
    case "match":
      return <MatchScreen />;
  }
}

// Minimal dev strip for review navigation (phase/player readout + reset).
function DevControls() {
  const { state, dispatch } = useGame();
  return (
    <footer className="relative z-10 mx-auto mt-5 flex w-full max-w-sm items-center justify-between rounded-full border border-text/10 bg-text/[0.03] px-4 py-2 text-[11px] text-text/40">
      <span>
        phase=<b className="text-text/70">{state.phase}</b> · player=
        <b className="text-text/70">{state.currentPlayer}</b>
      </span>
      <button
        className="font-semibold uppercase tracking-[1px] text-gold transition active:scale-95"
        onClick={() => dispatch({ type: "RESET" })}
      >
        Reset
      </button>
    </footer>
  );
}
