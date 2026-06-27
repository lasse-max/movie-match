"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { LoadingQuote } from "./LoadingQuote";
import { REQUEST_TIMEOUT_MS } from "@/lib/constants";
import type { InferResult } from "@/lib/inferTypes";
import { Sparkle, Spinner, goldCta, loaderCol } from "./marquee";
import { PassPhone } from "./PassPhone";

// The "inferring" phase: AI call #2 (each player's ~8 Round 3 recs). This is also the
// Round 2 → Round 3 BOUNDARY — the phone returns to Player 1 — so a "pass it back"
// gate shows FIRST; the infer fires on mount in the BACKGROUND so it overlaps the
// physical handoff, and we advance only once P1 is ready AND the recs are back.
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
          setError(data.error ?? "Couldn't read the room — try again.");
        } else {
          setResult(data as InferResult); // hold it; advance once P1 has the phone
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
  }, [attempt, blend, swipes, categories, region, services, willingToPay]);

  // Advance to Round 3 only once BOTH the handoff is done (P1 ready) and the recs are back.
  useEffect(() => {
    if (ready && result && !advanced.current) {
      advanced.current = true;
      dispatch({ type: "SET_INFERENCE", inference: result });
      dispatch({ type: "COMPLETE_TURN", player: 1 }); // → Round 3 (P1's turn — no further gate)
    }
  }, [ready, result, dispatch]);

  // Gate FIRST — the handoff happens as P2 finishes; the "Reading the mood…" loader
  // (and its quote) then lands in the hands of whoever plays next (P1).
  if (!ready) {
    return (
      <PassPhone
        kicker="Round 2 done · no peeking"
        lead="back to"
        player="Player 1"
        subcopy="Round 3 starts with Player 1 — hand the phone back, then tap below."
        onReady={() => setReady(true)}
      />
    );
  }

  if (error) {
    return (
      <div className={loaderCol}>
        <h2 className="mb-2.5 font-display text-[30px]">Couldn’t read the mood</h2>
        <p className="mb-6 max-w-[260px] text-[14px] leading-[1.5] text-text/55">{error}</p>
        <button
          className={goldCta}
          onClick={() => {
            setError(null);
            setResult(null);
            advanced.current = false;
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
      <Spinner accent="text-rose">
        <Sparkle size={30} />
      </Spinner>
      <h2 className="mb-2.5 font-display text-[32px]">Reading the mood…</h2>
      <p className="mb-6 max-w-[250px] text-[14px] leading-[1.5] text-text/55">
        Turning your swipes into a shortlist you’ll both be into.
      </p>
      <LoadingQuote />
    </div>
  );
}
