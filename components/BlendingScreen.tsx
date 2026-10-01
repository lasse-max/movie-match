"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { categoryLabel } from "@/lib/categories";
import { hasEnoughSamples, type BlendResult } from "@/lib/blendTypes";
import { REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { ERROR_LINES, ErrorState } from "./ErrorState";
import { PassPhone } from "./PassPhone";
import { ProjectorLoader } from "./Projector";

// The "blending" phase: AI call #1 (the candidate pool for Round 2). This is also the
// Round 1 to Round 2 BOUNDARY: the phone returns to Player 1, so the "pass it back"
// gate shows FIRST while the blend runs in the BACKGROUND, overlapping the physical
// handoff. If the pool is back by the time P1 takes the phone, we go straight on;
// otherwise the projector countdown hides the rest of the wait.
//
// Replay-safe: cleanup aborts the in-flight request and flags it cancelled, so under
// Strict Mode the first (aborted) run never resolves and the second completes.
export function BlendingScreen() {
  const { state, dispatch } = useGame();
  const [ready, setReady] = useState(false); // boundary handoff: phone back to P1
  const [result, setResult] = useState<BlendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const advanced = useRef(false);

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
          setError(ERROR_LINES.server);
        } else if (!Array.isArray(data.pool) || !hasEnoughSamples(data.pool)) {
          // Postcondition: BOTH players need enough distinct swipe samples. A
          // non-empty-but-tiny pool would dead-end Player 2, so fail recoverably.
          setError("We couldn’t line up enough films for both of you this time. Your picks are safe, so try again.");
        } else {
          setResult(data as BlendResult); // hold it; move on once P1 has the phone
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        clearTimeout(timer);
        if (!timedOut && e instanceof DOMException && e.name === "AbortError") return;
        setError(ERROR_LINES.connection);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, categories, region]);

  // On to Round 2, once: the pool, then P1's turn (no further gate).
  const advance = (blend: BlendResult) => {
    if (advanced.current) return;
    advanced.current = true;
    dispatch({ type: "SET_BLEND", blend });
    dispatch({ type: "COMPLETE_TURN", player: 1 });
  };

  // Gate FIRST: the handoff happens as P2 finishes, and the countdown (with its
  // "Up next · Round 2" line) only plays in P1's hands if the blend is still running.
  if (!ready) {
    return (
      <PassPhone
        to={1}
        back
        working
        kicker="Both picked · blending now"
        onReady={() => (result ? advance(result) : setReady(true))}
      >
        Hand it back. We’re already working while you pass it, so Round 2 is ready when you are.
      </PassPhone>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={
          <>
            We couldn’t
            <br />
            blend your picks
          </>
        }
        onRetry={() => {
          setError(null);
          setResult(null);
          advanced.current = false;
          setAttempt((a) => a + 1);
        }}
      >
        {error}
      </ErrorState>
    );
  }

  return (
    <ProjectorLoader
      title="Blending your tastes"
      done={!!result}
      onDone={() => {
        if (result) advance(result);
      }}
    >
      Up next · Round 2. Swipe on the vibe, not on whether you’ve seen it.
    </ProjectorLoader>
  );
}
