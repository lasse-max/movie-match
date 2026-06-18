"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { isKidsFare } from "@/lib/genres";
import { recToMovie } from "@/lib/overlap";

const btn =
  "rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]";

// The "tiebreak" phase: no clean Round 3 overlap, so bridge from both players'
// R2 positives (server side) and land on a film that fits both — never a dead end.
export function TiebreakScreen() {
  const { state, dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const swipes = state.round.swipes;
  const categories = state.round.categories;
  const blend = state.blend;
  const inference = state.inference;
  const setup = state.setup;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const pool = blend?.pool ?? [];
    const allowKidsFare = pool.some((m) => isKidsFare(m.genreIds));
    const fallbackRec = inference?.[1].recs[0] ?? inference?.[2].recs[0] ?? null;
    const fallback = fallbackRec ? recToMovie(fallbackRec) : null;

    fetch("/api/bridge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pool,
        positives1: swipes[1].yes,
        positives2: swipes[2].yes,
        categories,
        allowKidsFare,
        region: setup.region,
        services: setup.services,
        willingToPay: setup.willingToPay,
        fallback,
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error || !data.movie) {
          setError(data.error ?? "Couldn't find a bridge pick.");
        } else {
          dispatch({ type: "SET_MATCH", match: data });
          dispatch({ type: "COMPLETE_TURN", player: 1 }); // → match
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
  }, [attempt, swipes, categories, blend, inference, setup, dispatch]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>😕</span>
        <h2 className="text-xl font-semibold">Couldn’t settle the tiebreak</h2>
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
      <span className="text-4xl motion-safe:animate-pulse" aria-hidden>🤝</span>
      <h2 className="text-xl font-semibold">So close — finding common ground…</h2>
      <p className="text-sm text-foreground/60">
        No exact overlap, so we’re bridging both your tastes into one pick.
      </p>
    </div>
  );
}
