"use client";

import { useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { selectSwipeSamples, type PoolMovie } from "@/lib/blendTypes";
import type { Player } from "@/lib/gameMachine";

const primaryBtn =
  "w-full rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]";

export function Round2Screen() {
  const { state } = useGame();
  const pool = state.blend?.pool ?? [];
  // Each player gets their own distinct set (both span the directions), so the
  // other player's positives become genuinely-new Round 3 candidates.
  const samples = selectSwipeSamples(pool)[state.currentPlayer];

  if (samples.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-foreground/60">
        No samples to swipe — something went wrong upstream.
      </p>
    );
  }

  // Remount per player so each turn starts clean (and re-arms the handoff gate).
  return <PlayerSwipe key={state.currentPlayer} player={state.currentPlayer} samples={samples} />;
}

function PlayerSwipe({ player, samples }: { player: Player; samples: PoolMovie[] }) {
  const { dispatch } = useGame();
  const [ready, setReady] = useState(player === 1);
  const [index, setIndex] = useState(0);
  const [yes, setYes] = useState<number[]>([]);
  const [no, setNo] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false); // blocks a synchronous double-tap

  const finishTurn = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    dispatch({ type: "SET_SWIPES", player, yes, no });
    dispatch({ type: "COMPLETE_TURN", player }); // P1 → pass phone; P2 → infer mood
  };

  // Pass-the-phone handoff before Player 2.
  if (!ready) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>📲</span>
        <h2 className="text-xl font-semibold">Pass the phone to Player 2</h2>
        <p className="text-sm text-foreground/60">
          Same titles, your turn — swipe on the vibe, not whether you’ve seen them.
        </p>
        <button className={primaryBtn} onClick={() => setReady(true)}>
          I’m ready
        </button>
      </div>
    );
  }

  const swipe = (keep: boolean) => {
    const movie = samples[index];
    if (keep) setYes((v) => [...v, movie.id]);
    else setNo((v) => [...v, movie.id]);
    setIndex((i) => i + 1);
  };

  // Done — lock in this player's leanings (both ways) and pass on.
  if (index >= samples.length) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>✅</span>
        <h2 className="text-xl font-semibold">All done, Player {player}!</h2>
        <p className="text-sm text-foreground/60">
          {yes.length} in the mood · {no.length} not tonight
        </p>
        <button className={primaryBtn} disabled={submitted} onClick={finishTurn}>
          {player === 1 ? "Done — pass the phone" : "See where you land"}
        </button>
      </div>
    );
  }

  const movie = samples[index];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="text-center">
        <span className="rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-wide">
          Round 2 of 3 · Player {player}
        </span>
        <p className="mt-3 text-sm font-medium">
          In the mood for something <span className="italic">like</span> this? ({index + 1}/
          {samples.length})
        </p>
        <p className="text-xs text-foreground/50">
          Swipe on the vibe — it’s fine if you’ve already seen it.
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <div className="aspect-[2/3] w-40 overflow-hidden rounded-xl bg-foreground/10">
          {movie.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
            <img
              src={movie.posterUrl}
              alt={movie.title}
              width={160}
              height={240}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="text-center">
          <div className="font-semibold">{movie.title}</div>
          {movie.year && <div className="text-xs text-foreground/50">{movie.year}</div>}
        </div>
      </div>

      <div className="flex w-full gap-3">
        <button
          onClick={() => swipe(false)}
          className="flex-1 rounded-full border border-foreground/20 px-4 py-3 text-sm font-semibold transition hover:bg-foreground/5 active:scale-[0.98]"
        >
          👎 Not the vibe
        </button>
        <button
          onClick={() => swipe(true)}
          className="flex-1 rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]"
        >
          👍 This vibe
        </button>
      </div>
    </div>
  );
}
