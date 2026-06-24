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
    <>
      {/* Cinematic backdrop — fixed to the viewport and self-clipped, so it stays
          put while the content scrolls over it and never clips tall phases. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, #16131f 0%, #0a090f 45%, #060509 100%)",
        }}
      >
        <div
          className="absolute left-1/2 top-[12%] h-[560px] w-[560px] -translate-x-1/2 rounded-full blur-[20px] motion-safe:animate-[mmGlow_7s_ease-in-out_infinite]"
          style={{
            background: "radial-gradient(circle, rgba(232,192,125,0.14), rgba(232,192,125,0) 62%)",
          }}
        />
        <div
          className="absolute -inset-[10%] opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />
      </div>

      {/* Content flows normally (no page-level clipping), so content-heavy phases —
          all Round 3 rows, the CTA, the expanded Match tail — scroll into reach. */}
      <main className="flex min-h-dvh flex-col px-5 py-6">
        <section className="mx-auto flex w-full max-w-sm flex-1 flex-col">
          <PhaseView phase={state.phase} />
        </section>
      </main>
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
