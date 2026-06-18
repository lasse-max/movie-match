"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";

const btn =
  "rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]";

// The "inferring" phase: AI call #2 reads both players' Round 2 swipes → each
// player's ~5 Round 3 recs. Replay-safe (AbortController + cancelled flag).
export function InferringScreen() {
  const { state, dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const blend = state.blend;
  const swipes = state.round.swipes;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const pool = blend?.pool ?? [];

    fetch("/api/infer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pool, swipes }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error || !data[1] || !data[2]) {
          setError(data.error ?? "Couldn't read the room — try again.");
        } else {
          dispatch({ type: "SET_INFERENCE", inference: data });
          dispatch({ type: "COMPLETE_TURN", player: 1 }); // → Round 3
        }
      })
      .catch((e: unknown) => {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Network error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attempt, blend, swipes, dispatch]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>😕</span>
        <h2 className="text-xl font-semibold">Couldn’t read the mood</h2>
        <p className="text-sm text-foreground/60">{error}</p>
        <button
          className={btn}
          onClick={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <span className="text-4xl motion-safe:animate-pulse" aria-hidden>🔮</span>
      <h2 className="text-xl font-semibold">Reading the mood…</h2>
      <p className="text-sm text-foreground/60">
        Turning your swipes into a shortlist you’ll both be into.
      </p>
    </div>
  );
}
