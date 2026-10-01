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

export function GameScreen() {
  const { state } = useGame();

  return (
    <>
      {/* The room: projection black, fixed to the viewport. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-projection" />

      {/* Content flows normally (no page-level clipping), so content-heavy phases
          (all Round 3 rows, the CTA, the expanded match tail) scroll into reach. */}
      <main className="flex min-h-dvh flex-col px-5 py-6">
        <section className="mx-auto flex w-full max-w-sm flex-1 flex-col">
          <PhaseView phase={state.phase} />
        </section>
      </main>

      {/* Film grain over everything (about 8%). Not drawn with reduce-motion on. */}
      <div aria-hidden className="pp-grain" />
    </>
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
