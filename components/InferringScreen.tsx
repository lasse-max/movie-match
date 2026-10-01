"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { REQUEST_TIMEOUT_MS } from "@/lib/constants";
import type { InferResult } from "@/lib/inferTypes";
import { ERROR_LINES, ErrorState } from "./ErrorState";
import { PassPhone } from "./PassPhone";
import { ProjectorLoader } from "./Projector";

// The "inferring" phase: AI call #2 (each player's ~8 Round 3 recs). This is also the
// Round 2 to Round 3 BOUNDARY: the phone returns to Player 1, so the "pass it back"
// gate shows FIRST while the infer runs in the BACKGROUND, overlapping the physical
// handoff. If the recs are back by the time P1 takes the phone, we go straight on;
// otherwise the projector countdown hides the rest of the wait.
// Replay-safe (AbortController + cancelled flag).
export function InferringScreen() {
  const { state, dispatch } = useGame();
  const [ready, setReady] = useState(false); // boundary handoff: phone back to P1
  const [result, setResult] = useState<InferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const advanced = useRef(false);

  const blend = state.blend;
  const swipes = state.round.swipes;
  const categories = state.round.categories;
  const { region, services, willingToPay } = state.setup;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const pool = blend?.pool ?? [];

    fetch("/api/infer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pool, swipes, categories, region, services, willingToPay }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        clearTimeout(timer);
        if (data.error || !data[1] || !data[2]) {
          setError(ERROR_LINES.server);
        } else {
          setResult(data as InferResult); // hold it; move on once P1 has the phone
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
  }, [attempt, blend, swipes, categories, region, services, willingToPay]);

  // On to Round 3, once: the recs, then P1's turn (no further gate).
  const advance = (inference: InferResult) => {
    if (advanced.current) return;
    advanced.current = true;
    dispatch({ type: "SET_INFERENCE", inference });
    dispatch({ type: "COMPLETE_TURN", player: 1 });
  };

  // Gate FIRST: the handoff happens as P2 finishes, and the countdown (with its
  // "Up next · Round 3" line) only plays in P1's hands if the call is still running.
  if (!ready) {
    return (
      <PassPhone
        to={1}
        back
        working
        kicker="Both swiped · reading the mood now"
        onReady={() => (result ? advance(result) : setReady(true))}
      >
        Hand it back. We’re already working while you pass it, so Round 3 is ready when you are.
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
            read the mood
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
      title="Reading the mood"
      done={!!result}
      onDone={() => {
        if (result) advance(result);
      }}
    >
      Up next · Round 3. Pick every film you’d happily watch. More picks, better odds.
    </ProjectorLoader>
  );
}
