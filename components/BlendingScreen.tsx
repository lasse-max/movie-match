"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { categoryLabel } from "@/lib/categories";
import { hasEnoughSamples } from "@/lib/blendTypes";
import { REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { Clapperboard, Spinner, goldCta, loaderCol, surfaceCard } from "./marquee";

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
      <div className={loaderCol}>
        <h2 className="mb-2.5 font-display text-[30px]">Couldn’t blend your picks</h2>
        <p className="mb-6 max-w-[260px] text-[14px] leading-[1.5] text-text/55">{error}</p>
        <button
          className={goldCta}
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
    <div className={loaderCol}>
      <Spinner accent="text-gold">
        <Clapperboard size={30} />
      </Spinner>
      <h2 className="mb-2.5 font-display text-[32px]">Blending your tastes…</h2>
      <p className="mb-6 max-w-[250px] text-[14px] leading-[1.5] text-text/55">
        Reading the room and lining up titles you might both lean into.
      </p>
      {/* This wait precedes Round 2 — prime the vibe-framing while they wait. */}
      <div className={`w-full max-w-[280px] p-4 text-left ${surfaceCard}`}>
        <p className="mb-1 text-[10.5px] uppercase tracking-[1.5px] text-text/40">Up next · Round 2</p>
        <p className="text-[13.5px] text-text/75">
          Swipe on the <span className="font-display italic text-gold">vibe</span> — fine if you’ve seen it.
        </p>
      </div>
    </div>
  );
}
