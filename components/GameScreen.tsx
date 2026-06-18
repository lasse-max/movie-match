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

const devBtn = "rounded border border-foreground/20 px-2 py-1 hover:bg-foreground/5";

export function GameScreen() {
  const { state } = useGame();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <header className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span aria-hidden>🎬</span> Movie Match
      </header>

      <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-foreground/10 p-6">
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
    <footer className="w-full max-w-sm rounded-lg border border-dashed border-foreground/20 p-3 text-xs text-foreground/60">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono">
          phase=<b>{state.phase}</b> · player=<b>{state.currentPlayer}</b>
        </span>
        <button className={devBtn} onClick={() => dispatch({ type: "RESET" })}>
          Reset
        </button>
      </div>
    </footer>
  );
}
