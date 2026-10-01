"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useGame } from "./GameProvider";
import { isKidsFare } from "@/lib/genres";
import { declinedFrom } from "@/lib/overlap";
import { REQUEST_TIMEOUT_MS } from "@/lib/constants";
import type { MatchMovie } from "@/lib/inferTypes";
import { ERROR_LINES, ErrorState } from "./ErrorState";
import { ProjectorLoader } from "./Projector";
import { brassCta, display, label, textButton } from "./palace";

/** What the bridge said: a watchable match, or a recoverable state. */
type BridgeAnswer =
  | { kind: "match"; movie: MatchMovie; alternatives: MatchMovie[] }
  | { kind: "needs-rentals" }
  | { kind: "none" };

// The "tiebreak" phase: no clean Round 3 overlap, so bridge from both players'
// R2 positives (server side) to a WATCHABLE film fitting both, excluding what
// either player declined in Round 3. The bridge only ever returns an eligible
// match; when nothing's watchable it hands back a recoverable state (offer
// rentals, or the honest end-state) rather than an unavailable pick. The wait
// uses the projector countdown; the answer lands when the current number ends.
export function TiebreakScreen() {
  const { state, dispatch } = useGame();
  const [answer, setAnswer] = useState<BridgeAnswer | null>(null);
  const [view, setView] = useState<"loading" | "needs-rentals" | "none">("loading");
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
          setError(ERROR_LINES.server);
        } else if (data.kind === "match" && data.movie) {
          setAnswer({ kind: "match", movie: data.movie, alternatives: data.alternatives ?? [] });
        } else if (data.kind === "needs-rentals") {
          setAnswer({ kind: "needs-rentals" });
        } else {
          setAnswer({ kind: "none" });
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
  }, [attempt, swipes, categories, picks, shown, blend, inference, setup, dispatch]);

  // Once the countdown finishes its number: the match goes to the curtain; the
  // other answers become the notice below.
  const land = () => {
    if (!answer) return;
    if (answer.kind === "match") {
      dispatch({
        type: "SET_MATCH",
        match: { movie: answer.movie, reason: "bridge" as const, alternatives: answer.alternatives },
      });
      dispatch({ type: "COMPLETE_TURN", player: 1 }); // to the match
    } else {
      setView(answer.kind);
    }
  };

  if (error) {
    return (
      <ErrorState
        title={
          <>
            We couldn’t
            <br />
            find your match
          </>
        }
        onRetry={() => {
          setError(null);
          setAnswer(null);
          setView("loading");
          setAttempt((a) => a + 1);
        }}
      >
        {error}
      </ErrorState>
    );
  }

  // Nothing's included on their services, but paying would unlock a fitting pick.
  if (view === "needs-rentals") {
    return (
      <Notice
        kicker="No exact overlap"
        title="Nothing’s included tonight"
        body={
          setup.services.length === 0
            ? "You haven’t added any subscriptions, but a great fit is available to rent or buy."
            : "Your bridge pick isn’t on your subscriptions, but it’s available to rent or buy."
        }
      >
        <button
          type="button"
          className={brassCta}
          onClick={() => {
            // Back to the countdown while the bridge re-runs with rentals on.
            setAnswer(null);
            setView("loading");
            dispatch({ type: "SET_WILLING_TO_PAY", value: true });
          }}
        >
          Include rentals and purchases
        </button>
        {setup.services.length === 0 && (
          <button type="button" className={`${textButton} self-center`} onClick={() => dispatch({ type: "RESET" })}>
            Start over and add a service
          </button>
        )}
      </Notice>
    );
  }

  // Honest, recoverable end-state: nothing watchable even with rentals.
  if (view === "none") {
    return (
      <Notice
        kicker="No exact overlap"
        title="Nothing watchable tonight"
        body={`We couldn’t find a bridge you can stream or rent in ${setup.region} right now. Retune your vibes and we’ll try again.`}
      >
        <button type="button" className={brassCta} onClick={() => dispatch({ type: "RESET" })}>
          Start over
        </button>
      </Notice>
    );
  }

  return (
    <ProjectorLoader title="Finding common ground" done={!!answer} onDone={land}>
      No exact overlap, so we’re bridging both your tastes into one pick.
    </ProjectorLoader>
  );
}

/** A plain notice in the house style: kicker, headline, one line, actions. */
function Notice({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="pp-enter flex min-h-full flex-1 flex-col gap-[26px]">
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        <span className={`${label} text-brass`}>{kicker}</span>
        <h1 className={`${display} text-[46px] leading-[0.88]`}>{title}</h1>
        <p className="text-[15px] leading-[1.5] text-cream/75">{body}</p>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}
