"use client";

import { useGame } from "./GameProvider";
import { evaluateAvailability, labelText } from "@/lib/filter";

const primaryBtn =
  "rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]";

// Final result. The overlap match and the bridge match render the same way; the
// full match screen (where to stream + JustWatch deep link) lands in step 9/10.
export function MatchScreen() {
  const { state, dispatch } = useGame();
  const match = state.match;

  if (!match) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-foreground/60">No pick yet — start over?</p>
        <button className={primaryBtn} onClick={() => dispatch({ type: "RESET" })}>
          Play again
        </button>
      </div>
    );
  }

  const { movie, reason } = match;
  const overlap = reason === "overlap";
  const { label } = evaluateAvailability(
    movie.availability,
    state.setup.services,
    state.setup.willingToPay
  );
  const justWatch = movie.availability.justWatchLink;

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="text-4xl" aria-hidden>{overlap ? "🍿" : "🤝"}</span>
      <h2 className="text-2xl font-bold tracking-tight">
        {overlap ? "It’s a match!" : "Your bridge pick"}
      </h2>

      <div className="aspect-[2/3] w-40 overflow-hidden rounded-xl bg-foreground/10">
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
          <img
            src={movie.posterUrl}
            alt={movie.title}
            width={160}
            height={240}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div>
        <div className="text-lg font-semibold">
          {movie.title}
          {movie.year ? <span className="font-normal text-foreground/50"> ({movie.year})</span> : null}
        </div>
        <p className="mt-1 text-sm text-foreground/60">
          {overlap
            ? "You both picked it — settle in."
            : "Your lists didn’t overlap, so we bridged your tastes into this."}
        </p>
        {label && <p className="mt-2 text-sm font-medium">{labelText(label)}</p>}
      </div>

      {justWatch && (
        <a
          href={justWatch}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-foreground/70 underline underline-offset-4 hover:text-foreground"
        >
          Where to watch ↗
        </a>
      )}

      <button className={primaryBtn} onClick={() => dispatch({ type: "RESET" })}>
        Play again
      </button>
    </div>
  );
}
