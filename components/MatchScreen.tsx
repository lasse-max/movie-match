"use client";

import { useGame } from "./GameProvider";
import { evaluateAvailability, labelText } from "@/lib/filter";
import type { MatchMovie } from "@/lib/inferTypes";

const primaryBtn =
  "rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.98]";

const tagLine = (tags: string[]) => tags.join(" · ");

export function MatchScreen() {
  const { state, dispatch } = useGame();
  const match = state.match;
  const { services, willingToPay } = state.setup;
  const labelFor = (m: MatchMovie) => {
    const { label } = evaluateAvailability(m.availability, services, willingToPay);
    return label ? labelText(label) : null;
  };

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

  const { movie, reason, alternatives } = match;
  const overlap = reason === "overlap";
  const heroLabel = labelFor(movie);
  const justWatch = movie.availability.justWatchLink;

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
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
        <div className="mt-1 text-sm font-semibold text-foreground/80">{movie.matchPercent}% match</div>
        {movie.matchTags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
            {movie.matchTags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-foreground/70"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-sm text-foreground/60">
          {overlap
            ? "You both picked it — settle in."
            : "Your lists didn’t overlap, so we bridged your tastes into this."}
        </p>
        {heroLabel && <p className="mt-2 text-sm font-medium">{heroLabel}</p>}
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

      {alternatives.length > 0 && (
        <div className="w-full">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/50">
            Or also…
          </h3>
          <ul className="flex flex-col gap-2">
            {alternatives.map((alt) => (
              <AltRow key={alt.id} movie={alt} label={labelFor(alt)} />
            ))}
          </ul>
        </div>
      )}

      <button className={primaryBtn} onClick={() => dispatch({ type: "RESET" })}>
        Play again
      </button>
    </div>
  );
}

function AltRow({ movie, label }: { movie: MatchMovie; label: string | null }) {
  const justWatch = movie.availability.justWatchLink;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-foreground/15 p-2 text-left">
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-foreground/10">
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
          <img
            src={movie.posterUrl}
            alt={movie.title}
            width={40}
            height={56}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {movie.title}
          {movie.year ? <span className="font-normal text-foreground/50"> ({movie.year})</span> : null}
        </div>
        <div className="truncate text-[11px] text-foreground/55">
          {movie.matchPercent}% match{movie.matchTags.length > 0 ? ` · ${tagLine(movie.matchTags)}` : ""}
        </div>
        {label && <div className="text-[11px] font-medium text-foreground/70">{label}</div>}
      </div>
      {justWatch && (
        <a
          href={justWatch}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-1 text-sm text-foreground/60 hover:text-foreground"
          aria-label={`Where to watch ${movie.title}`}
        >
          ↗
        </a>
      )}
    </li>
  );
}
