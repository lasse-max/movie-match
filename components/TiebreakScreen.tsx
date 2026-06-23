"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { isKidsFare } from "@/lib/genres";
import { declinedFrom } from "@/lib/overlap";
import { REQUEST_TIMEOUT_MS } from "@/lib/constants";

const btn =
  "rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]";

// The "tiebreak" phase: no clean Round 3 overlap, so bridge from both players'
// R2 positives (server side) to a WATCHABLE film fitting both — excluding what
// either player declined in Round 3. The bridge only ever returns an eligible
// match; when nothing's watchable it hands back a recoverable state (offer
// rentals, or the honest end-state) rather than an unavailable pick.
export function TiebreakScreen() {
  const { state, dispatch } = useGame();
  const [outcome, setOutcome] = useState<"loading" | "needs-rentals" | "none">("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const swipes = state.round.swipes;
  const categories = state.round.categories;
  const picks = state.round.picks;
  const shown = state.round.shown;
  const blend = state.blend;
  const inference = state.inference;
  const setup = state.setup;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const pool = blend?.pool ?? [];
    const allowKidsFare = pool.some((m) => isKidsFare(m.genreIds));

    // Decline = shown-but-unpicked only; never-shown titles stay bridge-eligible.
    const declinedIds = declinedFrom(shown, picks);
    // Combined mood words for the "why it matched" tags on the match screen.
    const moodAxes = inference
      ? [...new Set([...inference[1].moodRead.axes, ...inference[2].moodRead.axes])]
      : [];

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
        declinedIds,
        moodAxes,
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        clearTimeout(timer);
        if (data.error) {
          setError(data.error);
        } else if (data.kind === "match" && data.movie) {
          dispatch({
            type: "SET_MATCH",
            match: { movie: data.movie, reason: "bridge" as const, alternatives: data.alternatives ?? [] },
          });
          dispatch({ type: "COMPLETE_TURN", player: 1 }); // → match
        } else if (data.kind === "needs-rentals") {
          setOutcome("needs-rentals");
        } else {
          setOutcome("none");
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
  }, [attempt, swipes, categories, picks, shown, blend, inference, setup, dispatch]);

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

  // Nothing's included on their services, but paying would unlock a fitting pick.
  if (outcome === "needs-rentals") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>💸</span>
        <h2 className="text-xl font-semibold">Nothing’s included tonight</h2>
        <p className="text-sm text-foreground/60">
          {setup.services.length === 0
            ? "You haven’t added any subscriptions — but a great fit is available to rent or buy."
            : "Your bridge pick isn’t on your subscriptions — but it’s available to rent or buy."}
        </p>
        <button
          className={btn}
          onClick={() => {
            setOutcome("loading"); // show the spinner while the bridge re-runs with rentals on
            dispatch({ type: "SET_WILLING_TO_PAY", value: true });
          }}
        >
          Include rentals &amp; purchases
        </button>
        {setup.services.length === 0 && (
          <button
            className="text-xs text-foreground/50 underline underline-offset-4 hover:text-foreground"
            onClick={() => dispatch({ type: "RESET" })}
          >
            …or start over and add a service
          </button>
        )}
      </div>
    );
  }

  // Honest, recoverable end-state: nothing watchable even with rentals.
  if (outcome === "none") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-4xl" aria-hidden>🌧️</span>
        <h2 className="text-xl font-semibold">Nothing watchable tonight</h2>
        <p className="text-sm text-foreground/60">
          We couldn’t find a bridge you can stream or rent in {setup.region} right now. Retune
          your vibes and we’ll try again.
        </p>
        <button className={btn} onClick={() => dispatch({ type: "RESET" })}>
          Start over
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
