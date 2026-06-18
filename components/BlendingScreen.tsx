"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { categoryLabel } from "@/lib/categories";

const btn =
  "rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]";

// The "blending" phase: AI call #1 runs here, prefetching the candidate pool for
// Round 2. On success we store it and advance straight into Round 2.
export function BlendingScreen() {
  const { state, dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const fetchedAttempt = useRef(-1);

  useEffect(() => {
    if (fetchedAttempt.current === attempt) return; // once per attempt (also dev-strict-safe)
    fetchedAttempt.current = attempt;

    const p1 = state.round.categories[1].map(categoryLabel);
    const p2 = state.round.categories[2].map(categoryLabel);
    let cancelled = false;

    fetch("/api/blend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ p1, p2 }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else if (!Array.isArray(data.pool) || data.pool.length === 0) {
          setError("No candidates came back — try different vibes.");
        } else {
          dispatch({ type: "SET_BLEND", blend: data });
          dispatch({ type: "ADVANCE" }); // → Round 2
        }
      })
      .catch((e) => !cancelled && setError(String(e)));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only on retry
  }, [attempt]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>😕</span>
        <h2 className="text-xl font-semibold">Couldn’t blend your picks</h2>
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
      <span className="text-4xl motion-safe:animate-pulse" aria-hidden>🎬</span>
      <h2 className="text-xl font-semibold">Blending your tastes…</h2>
      <p className="text-sm text-foreground/60">
        Reading the room and lining up movies you might both be into tonight.
      </p>
    </div>
  );
}
