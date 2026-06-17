"use client";

import { useGame } from "./GameProvider";
import { SetupScreen } from "./SetupScreen";
import { Round1Screen } from "./Round1Screen";
import type { Phase } from "@/lib/gameMachine";

// Phase router for step 2. Every screen below is a placeholder that a later
// step replaces with the real round UI; this exists to make the state machine
// and pass-the-phone turn tracking clickable and reviewable end-to-end.

const btn =
  "rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]";
const devBtn = "rounded border border-foreground/20 px-2 py-1 hover:bg-foreground/5";

const ROUND_NUMBER: Partial<Record<Phase, 1 | 2 | 3>> = {
  round1: 1,
  round2: 2,
  round3: 3,
};

const ROUND_BLURB: Record<1 | 2 | 3, string> = {
  1: "Each player picks 2–3 categories/moods.",
  2: "Each player swipes a few sample titles.",
  3: "Each player marks every title they'd watch.",
};

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
  const { state, dispatch } = useGame();
  const advance = () => dispatch({ type: "ADVANCE" });

  switch (phase) {
    case "setup":
      return <SetupScreen />;

    case "round1":
      return <Round1Screen />;

    case "round2":
    case "round3":
      return <RoundPlaceholder n={ROUND_NUMBER[phase]!} />;

    case "blending":
      return (
        <Placeholder
          title="Blending your tastes…"
          body="AI call #1 turns both players' picks into shared themes + a TMDB candidate pool. (Step 5.)"
          actionLabel="Continue"
          onAction={advance}
        />
      );

    case "inferring":
      return (
        <Placeholder
          title="Reading the mood…"
          body="AI call #2 infers each player's latent vibe from their swipes to shape Round 3. (Step 6.)"
          actionLabel="Continue"
          onAction={advance}
        />
      );

    case "match":
      return (
        <Placeholder
          title="It's a match! 🎉"
          body={
            state.matchId
              ? `Agreed on movie id ${state.matchId}. The full match screen + JustWatch link land in step 9.`
              : "The full match screen + JustWatch link land in step 9."
          }
          actionLabel="Play again"
          onAction={() => dispatch({ type: "RESET" })}
        />
      );

    case "tiebreak":
      return (
        <Placeholder
          title="So close — tiebreak"
          body="No clean overlap. A short tiebreak surfaces the nearest match. (Overlap/tiebreak logic + tests — step 7.)"
          actionLabel="Resolve to match"
          onAction={advance}
        />
      );
  }
}

function RoundPlaceholder({ n }: { n: 1 | 2 | 3 }) {
  const { state, dispatch } = useGame();
  const player = state.currentPlayer;

  return (
    <div className="flex flex-col items-center gap-5">
      <span className="rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-wide">
        Round {n} of 3
      </span>
      <p className="text-sm text-foreground/70">{ROUND_BLURB[n]}</p>

      <div className="flex flex-col items-center gap-1">
        {player === 2 && <span className="text-2xl" aria-hidden>📲</span>}
        <span className="text-base font-semibold">
          {player === 2 ? "Player 2's turn" : "Player 1's turn"}
        </span>
        {player === 2 && (
          <span className="text-xs text-foreground/50">phone passed</span>
        )}
      </div>

      <button className={btn} onClick={() => dispatch({ type: "ADVANCE" })}>
        {player === 1 ? "Done — pass the phone" : "Finish round"}
      </button>
    </div>
  );
}

function Placeholder({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-foreground/70">{body}</p>
      <button className={btn} onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

// Temporary dev panel: surfaces FSM state and lets a reviewer reach both the
// match and tiebreak branches from Round 3. Removed when the real rounds land.
function DevControls() {
  const { state, dispatch } = useGame();

  const seedPicks = (a: number[], b: number[]) => {
    dispatch({ type: "SET_PICKS", player: 1, movieIds: a });
    dispatch({ type: "SET_PICKS", player: 2, movieIds: b });
  };

  return (
    <footer className="w-full max-w-sm rounded-lg border border-dashed border-foreground/20 p-3 text-xs text-foreground/60">
      <div className="mb-2 font-mono">
        phase=<b>{state.phase}</b> · player=<b>{state.currentPlayer}</b>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={devBtn} onClick={() => dispatch({ type: "RESET" })}>
          Reset
        </button>
        {state.phase === "round3" && (
          <>
            <button className={devBtn} onClick={() => seedPicks([1, 2, 3], [3, 4, 5])}>
              seed overlap → match
            </button>
            <button className={devBtn} onClick={() => seedPicks([1, 2], [3, 4])}>
              seed no-overlap → tiebreak
            </button>
          </>
        )}
      </div>
      <p className="mt-2 italic">Dev controls — removed when real rounds land.</p>
    </footer>
  );
}
