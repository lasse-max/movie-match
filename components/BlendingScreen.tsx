"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { categoryLabel } from "@/lib/categories";
import { hasEnoughSamples } from "@/lib/blendTypes";
import { REQUEST_TIMEOUT_MS } from "@/lib/constants";

const btn =
  "rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]";

// The "blending" phase: AI call #1 runs here, prefetching the candidate pool for
// Round 2. On success we store it and advance straight into Round 2.
//
// The effect is replay-safe: cleanup aborts the in-flight request and flags it
// cancelled, so under React Strict Mode the first (aborted) run never dispatches
// and the second run completes normally — it cannot get stuck on "Blending…".
export function BlendingScreen() {
  const { state, dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const categories = state.round.categories;
  const region = state.setup.region;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const p1 = categories[1].map(categoryLabel);
    const p2 = categories[2].map(categoryLabel);

    fetch("/api/blend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ p1, p2, region }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        clearTimeout(timer);
        if (data.error) {
          setError(data.error);
        } else if (!Array.isArray(data.pool) || !hasEnoughSamples(data.pool)) {
          // Postcondition: BOTH players need enough distinct swipe samples. A
          // non-empty-but-tiny pool would dead-end Player 2 — fail recoverably.
          setError("Couldn't line up enough titles for both of you — try different vibes.");
        } else {
          dispatch({ type: "SET_BLEND", blend: data });
          dispatch({ type: "COMPLETE_TURN", player: 1 }); // → Round 2 (no player turn here)
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        clearTimeout(timer);
        if (timedOut) {
          setError("This is taking longer than usual — check your connection and try again.");
          return;
        }
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Network error");
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, categories, region, dispatch]);

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
