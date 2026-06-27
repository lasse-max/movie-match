"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { categoryLabel } from "@/lib/categories";
import { hasEnoughSamples, type BlendResult } from "@/lib/blendTypes";
import { REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { Clapperboard, Spinner, goldCta, loaderCol, surfaceCard } from "./marquee";
import { PassPhone } from "./PassPhone";

// The "blending" phase: AI call #1 (the candidate pool for Round 2). This is also the
// Round 1 → Round 2 BOUNDARY — the phone returns to Player 1 — so a "pass it back"
// gate shows FIRST; the blend fires on mount in the BACKGROUND so it overlaps the
// physical handoff, and we advance only once P1 is ready AND the pool is back.
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
          setError(data.error);
        } else if (!Array.isArray(data.pool) || !hasEnoughSamples(data.pool)) {
          // Postcondition: BOTH players need enough distinct swipe samples. A
          // non-empty-but-tiny pool would dead-end Player 2 — fail recoverably.
          setError("Couldn't line up enough titles for both of you — try different vibes.");
        } else {
          setResult(data as BlendResult); // hold it; advance once P1 has the phone
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
  }, [attempt, categories, region]);

  // Advance to Round 2 only once BOTH the handoff is done (P1 ready) and the pool is back.
  useEffect(() => {
    if (ready && result && !advanced.current) {
      advanced.current = true;
      dispatch({ type: "SET_BLEND", blend: result });
      dispatch({ type: "COMPLETE_TURN", player: 1 }); // → Round 2 (P1's turn — no further gate)
    }
  }, [ready, result, dispatch]);

  // Gate FIRST — the handoff happens as P2 finishes; the loader (and its "Up next ·
  // Round 2" framing) then builds anticipation in the hands of whoever plays next (P1).
  if (!ready) {
    return (
      <PassPhone
        kicker="Round 1 done · no peeking"
        lead="back to"
        player="Player 1"
        subcopy="Round 2 starts with Player 1 — hand the phone back, then tap below."
        onReady={() => setReady(true)}
      />
    );
  }

  if (error) {
    return (
      <div className={loaderCol}>
        <h2 className="mb-2.5 font-display text-[30px]">Couldn’t blend your picks</h2>
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
