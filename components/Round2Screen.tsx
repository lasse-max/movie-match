"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  usePresence,
  usePresenceData,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useGame } from "./GameProvider";
import { PassPhone } from "./PassPhone";
import { selectSwipeSamples, type PoolMovie } from "@/lib/blendTypes";
import { genreNames } from "@/lib/genres";
import type { Player } from "@/lib/gameMachine";
import { Cross, ENTRY_EASE, Heart, Question, brassCta, display, label } from "./palace";
import { PROJECTION_S, THRESHOLD, releaseDirection, type Dir } from "./swipe";

// Round 2 motion (D6 §1). Every number is the same for all three choices.

/** Tilt at a full card width of drag; it keeps growing as the card flies off. */
const TILT = 12;
/** A drag that decides flies off on one spring per axis, from the release velocity. */
const EXIT_SPRING = { type: "spring", stiffness: 250, damping: 32, mass: 1 } as const;
/** A release that doesn't decide springs home, keeping the finger's speed. */
const BACK_SPRING = { type: "spring", stiffness: 500, damping: 34, mass: 1 } as const;
/** The stamp lands from this scale, on a tap and under the finger alike. */
const STAMP_FROM = 1.4;
// A tap: the stamp shows at once and lands on a still card, the card thuds at the
// impact, then flies. About 0.52 s from the tap to the next card taking input.
const STAMP_IN_S = 0.05; // opacity, linear
const STAMP_LAND_S = 0.12; // scale; it speeds into the card and stops dead
const STAMP_LAND_EASE = [0.32, 0, 0.67, 0] as const;
const THUD_S = 0.2;
const FLY_AT_S = 0.24;
const FLY_S = 0.28;
const FLY_EASE = [0.4, 0, 1, 1] as const; // accelerates out, no tail off-screen
/** A drag decided short of the threshold eases its stamp to full. */
const FLICK_STAMP_S = 0.08;
/** The next card steps up as the old one leaves; the waiting cards shift as long. */
const STEP_UP_S = 0.4;
/** Reduce-motion: nothing moves. The stamp holds at full, then the card fades out
 * over the next one (a drag fades at once). */
const REDUCED_HOLD_MS = 300;
const REDUCED_FADE_S = 0.15;
/** A decision only counts on a card the player has seen: the last decided card must
 * have finished leaving, and its successor must have been in view this long. It
 * comes into view as the old card flies (on a tap, 240 ms in) or, with reduce-motion,
 * once the old card has faded, so the floor counts from then, not from the tap. */
const MIN_ON_SCREEN_MS = 300;

export function Round2Screen() {
  const { state } = useGame();
  const pool = state.blend?.pool ?? [];
  // Each player gets their own distinct set (both span the directions), so the
  // other player's positives become genuinely-new Round 3 candidates.
  const samples = selectSwipeSamples(pool)[state.currentPlayer];

  if (samples.length === 0) {
    return (
      <p className="py-6 text-center text-[14px] text-cream/75">
        No films to swipe. Something went wrong on our side.
      </p>
    );
  }

  // Remount per player so each turn starts clean (and re-arms the handoff gate).
  return <PlayerSwipe key={state.currentPlayer} player={state.currentPlayer} samples={samples} />;
}

/** How the card on top leaves (AnimatePresence's `custom`): which way, and whether a
 * tap decided it (the stamp sequence) or a drag (already flying on its springs). */
interface ExitPlan {
  dir: Dir;
  by: "tap" | "drag";
}

// Round 2, built to docs/design/picture-palace/SwipeStamp.dc.html and D6Swipe: a
// physical card you drag (or a button you tap), a rubber stamp, three equal decisions.
function PlayerSwipe({ player, samples }: { player: Player; samples: PoolMovie[] }) {
  const { dispatch } = useGame();
  const reduced = !!useReducedMotion();
  const [ready, setReady] = useState(player === 1);
  const [index, setIndex] = useState(0);
  const [yes, setYes] = useState<number[]>([]);
  const [no, setNo] = useState<number[]>([]);
  const [neutral, setNeutral] = useState<number[]>([]);
  const [last, setLast] = useState<Dir | null>(null);
  const [flying, setFlying] = useState(false); // a decided card is still leaving
  const [exit, setExit] = useState<ExitPlan | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false); // blocks a synchronous double-tap
  const indexRef = useRef(0);
  // One guard for buttons and drags alike, set synchronously, so a second tap or
  // a drag on the same card can never decide the card underneath.
  const leavingRef = useRef(false); // a decided card hasn't finished leaving
  const openAtRef = useRef(Number.NEGATIVE_INFINITY); // the card on top counts from then
  // A callback ref, so measuring starts whenever the deck mounts (Player 2's turn
  // opens on the gate, with no deck yet).
  const [deck, setDeck] = useState<HTMLDivElement | null>(null);
  const size = useCardSize(deck);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const finishTurn = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    // Send all three buckets so the reducer sees a fully-processed turn even when
    // every card was "Not sure" (empty yes+no but a populated neutral list).
    dispatch({ type: "SET_SWIPES", player, yes, no, neutral });
    dispatch({ type: "COMPLETE_TURN", player }); // P1 → pass phone; P2 → infer mood
  };

  // Pass-the-phone handoff before Player 2.
  if (!ready) {
    return (
      <PassPhone to={2} kicker="Swipes locked · no peeking" onReady={() => setReady(true)}>
        Hand it over. Player 2 swipes their own films. Go by the vibe, seen it or not.
      </PassPhone>
    );
  }

  // One decision for the card on top, recorded exactly as before: This vibe → yes,
  // Not it → no, Not sure → neutral (no data, never a false "away"; see
  // lib/gameMachine.ts turn completion and lib/infer.ts degrade). Recorded at the
  // tap or release; the stamp and the flight play afterwards, as the card's exit.
  // Returns whether it counted: only once the next card is on top and has been in
  // view long enough (see MIN_ON_SCREEN_MS).
  const decide = (dir: Dir, by: ExitPlan["by"], cardId?: number): boolean => {
    const movie = samples[indexRef.current];
    if (!movie || !size) return false;
    if (cardId !== undefined && cardId !== movie.id) return false; // that card already left
    if (leavingRef.current || performance.now() < openAtRef.current) return false;
    leavingRef.current = true;
    // With reduce-motion the next card shows once this one has faded (onExitComplete).
    openAtRef.current = reduced
      ? Number.POSITIVE_INFINITY
      : performance.now() + (by === "tap" ? FLY_AT_S * 1000 : 0) + MIN_ON_SCREEN_MS;
    indexRef.current += 1;
    setExit({ dir, by });
    setFlying(true);
    setLast(dir);
    if (dir === "right") setYes((v) => [...v, movie.id]);
    else if (dir === "left") setNo((v) => [...v, movie.id]);
    else setNeutral((v) => [...v, movie.id]);
    setIndex((i) => i + 1);
    return true;
  };

  const done = index >= samples.length;

  // Every card decided (and the last one has landed): lock in this player's read.
  if (done && !flying) {
    return (
      <div className="pp-enter flex min-h-full flex-1 flex-col">
        <Header player={player} at={samples.length} of={samples.length} />
        <div className="flex flex-1 flex-col justify-center gap-3">
          <h1 className={`${display} text-[56px] leading-[0.86]`}>
            That’s
            <br />
            <span className="text-signal">the read.</span>
          </h1>
          <p className="text-[15px] leading-[1.5] text-cream/75">
            {yes.length} {yes.length === 1 ? "film" : "films"} you’re into · {no.length} passed
            {neutral.length > 0 ? ` · ${neutral.length} not sure` : ""}
          </p>
        </div>
        <button type="button" className={brassCta} disabled={submitted} onClick={finishTurn}>
          {player === 1 ? "Done, pass the phone" : "See where you land"}
        </button>
      </div>
    );
  }

  const visible = samples.slice(index, index + 3);

  return (
    <div className="pp-enter flex min-h-full flex-1 flex-col gap-3.5">
      <Header player={player} at={Math.min(index + 1, samples.length)} of={samples.length} />

      <div ref={setDeck} className="relative flex min-h-[420px] flex-1 items-center justify-center">
        {size && (
          <div className="relative" style={{ width: size.w, height: size.h }}>
            {/* The two cards waiting behind, stepped back and dimmed with a black
                overlay (never a filter: cheaper frames on a phone). */}
            {visible.slice(1).map((m, i) => (
              <div
                key={m.id}
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-[22px] transition-transform duration-[400ms] ease-entry"
                style={{
                  zIndex: 2 - i,
                  transform: i === 0 ? "translateY(14px) scale(0.95)" : "translateY(26px) scale(0.9)",
                }}
              >
                <Poster movie={m} />
                <div
                  className="absolute inset-0 bg-black transition-opacity duration-[400ms] ease-entry"
                  style={{ opacity: i === 0 ? 0.4 : 0.6 }}
                />
              </div>
            ))}

            <AnimatePresence
              custom={exit}
              onExitComplete={() => {
                leavingRef.current = false; // the next card is on top
                if (reduced) openAtRef.current = performance.now() + MIN_ON_SCREEN_MS;
                setFlying(false);
              }}
            >
              {!done && (
                <TopCard
                  key={visible[0].id}
                  movie={visible[0]}
                  size={size}
                  stepUpDelay={exit?.by === "tap" ? FLY_AT_S : 0}
                  onDecide={(dir) => decide(dir, "drag", visible[0].id)}
                />
              )}
            </AnimatePresence>

            {/* Three equal choices over the poster: same size, same weight. The row
                lets presses through, so a drag can start anywhere but the discs. */}
            {!done && (
              <div className="pointer-events-none absolute inset-x-0 bottom-[18px] z-10 flex justify-center gap-7">
                <Control label="Not it" onClick={() => decide("left", "tap")}>
                  <Cross size={24} />
                </Control>
                <Control label="Not sure" onClick={() => decide("down", "tap")}>
                  <Question size={24} />
                </Control>
                <Control label="This vibe" brass onClick={() => decide("right", "tap")}>
                  <Heart size={24} filled />
                </Control>
              </div>
            )}
          </div>
        )}
      </div>

      <p aria-live="polite" className="flex-none text-center text-[14px] text-cream/70">
        {last === "down"
          ? "Skipped. Not sure counts for nothing either way."
          : "Swipe on the vibe, not on whether you’ve seen it."}
      </p>
    </div>
  );
}

function Header({ player, at, of }: { player: Player; at: number; of: number }) {
  return (
    <header className="flex flex-none items-center justify-between">
      <span className={`${label} text-brass`}>Round 2 · The vibe</span>
      <span className={`${label} text-cream/65`}>
        Player {player} · {at}/{of}
      </span>
    </header>
  );
}

/** Each stamp's own values once its card is decided, so a tap lands the stamp on a
 * still card instead of leaving it to the flight. */
function useStampLanding() {
  return { opacity: useMotionValue(0), scale: useMotionValue(STAMP_FROM) };
}
type StampLanding = ReturnType<typeof useStampLanding>;

/** Far enough sideways to clear any screen at any tilt. */
const offScreenX = (w: number, h: number) => window.innerWidth / 2 + Math.hypot(w, h) / 2 + 24;

/** An animation's end, or `ms` at the latest: a stopped animation never resolves,
 * and a card that never finished leaving would hold up the deck. */
function endOf(animation: { finished: Promise<unknown> }, ms: number): Promise<unknown> {
  return Promise.race([animation.finished, new Promise((resolve) => setTimeout(resolve, ms))]);
}

/** The card on top: follows the finger, tilts, stamps, and leaves on a decision. */
function TopCard({
  movie,
  size: { w, h },
  stepUpDelay,
  onDecide,
}: {
  movie: PoolMovie;
  size: { w: number; h: number };
  /** Seconds before it steps up from its waiting place: with the old card's flight. */
  stepUpDelay: number;
  /** Returns whether the decision counted. */
  onDecide: (dir: Dir) => boolean;
}) {
  const reduced = !!useReducedMotion();
  const [isPresent, safeToRemove] = usePresence(); // false once this card is leaving
  const plan = usePresenceData() as ExitPlan | null | undefined;
  // The finger: the drag moves x and y only, so the stamps follow the finger alone.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // The card's own pose, apart from the drag: the step-up, the thud, the fade.
  const lift = useMotionValue(reduced ? 0 : 14);
  const scale = useMotionValue(reduced ? 1 : 0.95);
  const dim = useMotionValue(reduced ? 0 : 0.4);
  const fade = useMotionValue(1);
  const decided = useRef(false);
  const flight = useRef<Promise<unknown> | null>(null); // a drag's exit, under way
  const [passThrough, setPassThrough] = useState(false); // flying: the next card can be grabbed
  const t = w * THRESHOLD;

  const rotate = useTransform(x, [-w, 0, w], [-TILT, 0, TILT], { clamp: false });
  // How far the finger has taken the card toward each choice, full at the threshold.
  const toward = {
    right: useTransform(() => (x.get() > 0 && x.get() >= y.get() ? Math.min(x.get() / t, 1) : 0)),
    left: useTransform(() => (x.get() < 0 && -x.get() >= y.get() ? Math.min(-x.get() / t, 1) : 0)),
    down: useTransform(() =>
      y.get() > 0 && y.get() > Math.abs(x.get()) ? Math.min(y.get() / t, 1) : 0
    ),
  };
  const landing = { right: useStampLanding(), left: useStampLanding(), down: useStampLanding() };

  // Arriving: step up from the waiting place as the old card flies (D6 §1.5).
  const stepUp = useEffectEvent(() => {
    if (reduced) return;
    const step = { duration: STEP_UP_S, ease: ENTRY_EASE, delay: stepUpDelay };
    animate(lift, 0, step);
    animate(scale, 1, step);
    animate(dim, 0, step);
  });
  useEffect(() => stepUp(), []);

  // A drag decided it: fly off from the release, on one spring per axis.
  const throwOff = (dir: Dir, v: { x: number; y: number }): Promise<unknown> => {
    const stamp = landing[dir];
    const p = toward[dir].get();
    if (p < 1) {
      // Decided short of the threshold (a flick): the stamp catches up to full.
      stamp.opacity.jump(p);
      stamp.scale.jump(STAMP_FROM - (STAMP_FROM - 1) * p);
      const snap = reduced ? { duration: 0 } : { duration: FLICK_STAMP_S, ease: "easeOut" as const };
      animate(stamp.opacity, 1, snap);
      animate(stamp.scale, 1, snap);
    }
    if (reduced) return endOf(animate(fade, 0, { duration: REDUCED_FADE_S, ease: "linear" }), 400);
    const lead = { ...EXIT_SPRING, restDelta: 20, restSpeed: 400 };
    const trail = { ...EXIT_SPRING, restDelta: 2, restSpeed: 50 };
    if (dir === "down") {
      animate(x, x.get() + v.x * PROJECTION_S, { ...trail, velocity: v.x });
      return endOf(animate(y, 1.5 * h, { ...lead, velocity: v.y }), 1000);
    }
    animate(y, y.get() + v.y * PROJECTION_S, { ...trail, velocity: v.y });
    const toX = (dir === "right" ? 1 : -1) * offScreenX(w, h);
    return endOf(animate(x, toX, { ...lead, velocity: v.x }), 1000);
  };

  // Leaving (D6 §1.1, §1.8). The decision was recorded at the tap; this is only the
  // card's exit, and the next decision waits for it (onExitComplete).
  const leave = useEffectEvent((later: (ms: number, fn: () => void) => void): Promise<unknown> => {
    if (flight.current) return flight.current; // a drag: already flying
    if (!plan) return Promise.resolve();
    const stamp = landing[plan.dir];
    if (reduced) {
      // The stamp at full, a hold, then a fade over the next card. Nothing moves.
      stamp.opacity.jump(1);
      stamp.scale.jump(1);
      return new Promise((resolve) =>
        later(REDUCED_HOLD_MS, () => {
          setPassThrough(true);
          resolve(endOf(animate(fade, 0, { duration: REDUCED_FADE_S, ease: "linear" }), 400));
        })
      );
    }
    animate(stamp.opacity, 1, { duration: STAMP_IN_S, ease: "linear" });
    animate(stamp.scale, 1, { duration: STAMP_LAND_S, ease: STAMP_LAND_EASE });
    animate(scale, [1, 0.965, 1], {
      duration: THUD_S,
      times: [0, 0.3, 1],
      ease: ["easeOut", ENTRY_EASE],
      delay: STAMP_LAND_S,
    });
    later(FLY_AT_S * 1000, () => setPassThrough(true));
    const fly = { duration: FLY_S, ease: FLY_EASE, delay: FLY_AT_S };
    const flown =
      plan.dir === "down"
        ? animate(y, 1.5 * h, fly)
        : animate(x, (plan.dir === "right" ? 1 : -1) * offScreenX(w, h), fly);
    return endOf(flown, (FLY_AT_S + FLY_S) * 1000 + 200);
  });
  const gone = useEffectEvent(() => safeToRemove?.());
  useEffect(() => {
    if (isPresent) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let live = true;
    leave((ms, fn) => void timers.push(setTimeout(fn, ms))).then(() => live && gone());
    return () => {
      live = false;
      timers.forEach(clearTimeout);
    };
  }, [isPresent]);

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        y: lift,
        scale,
        opacity: fade,
        zIndex: isPresent ? 3 : 4,
        pointerEvents: passThrough ? "none" : undefined,
      }}
    >
      <motion.article
        className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-[22px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.9)] active:cursor-grabbing"
        style={{ x, y, rotate }}
        drag={isPresent}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          // Already decided, or leaving after a button decided it: never decide again,
          // and never pull a leaving card back.
          if (decided.current || !isPresent) return;
          const v = info.velocity; // passed on: the springs keep the finger's speed
          const dir = releaseDirection(x.get(), y.get(), v.x, v.y, t);
          if (dir && onDecide(dir)) {
            decided.current = true;
            setPassThrough(true);
            flight.current = throwOff(dir, v);
          } else {
            // Not far enough, or too soon after the last card: spring back.
            animate(x, 0, reduced ? { duration: 0 } : { ...BACK_SPRING, velocity: v.x });
            animate(y, 0, reduced ? { duration: 0 } : { ...BACK_SPRING, velocity: v.y });
          }
        }}
      >
        <Poster movie={movie} />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(14,10,9,0.96)_0%,rgba(14,10,9,0.82)_36%,rgba(14,10,9,0)_64%)]" />
        {movie.genreIds.length > 0 && (
          <span className="absolute left-4 top-4 rounded-full bg-[rgba(14,10,9,0.72)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-cream">
            {genreNames(movie.genreIds).slice(0, 2).join(" · ")}
          </span>
        )}
        <div className="absolute inset-x-[22px] bottom-[122px] flex flex-col gap-1.5">
          {/* The padding keeps accents (É, Å) inside the clamp's clip. */}
          <h2 className={`${display} -mt-[0.16em] line-clamp-3 pt-[0.16em] text-[48px] leading-[0.86]`}>
            {movie.title}
          </h2>
          {movie.year && <span className="text-[13px] text-cream/75">{movie.year}</span>}
        </div>

        {/* Dimmed while it steps up from behind: an overlay, never a filter. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[4] bg-black"
          style={{ opacity: dim }}
        />

        <Stamp toward={toward.right} landing={landing.right} className="text-brass-light">
          This vibe
        </Stamp>
        <Stamp toward={toward.left} landing={landing.left} className="text-cream">
          Not it
        </Stamp>
        <Stamp toward={toward.down} landing={landing.down} className="border-dashed text-cream">
          Not sure
        </Stamp>
      </motion.article>
    </motion.div>
  );
}

/** A rubber stamp across the poster. It follows the finger (full at the threshold)
 * and, once the card is decided, lands on its own. */
function Stamp({
  toward,
  landing,
  className,
  children,
}: {
  toward: MotionValue<number>;
  landing: StampLanding;
  className: string;
  children: string;
}) {
  const opacity = useTransform(() => Math.max(toward.get(), landing.opacity.get()));
  const scale = useTransform(() =>
    Math.min(STAMP_FROM - (STAMP_FROM - 1) * toward.get(), landing.scale.get())
  );
  return (
    <motion.span
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-[24%] z-[5] whitespace-nowrap rounded-[8px] border-4 border-current bg-[rgba(14,10,9,0.35)] px-[18px] pb-1.5 pt-2 font-display text-[40px] font-black uppercase leading-none tracking-[0.04em] ${className}`}
      style={{ opacity, scale, x: "-50%", rotate: -12 }}
    >
      {children}
    </motion.span>
  );
}

/** One round control: a 62 px disc and its label. All three the same size and weight. */
function Control({
  label: text,
  brass = false,
  onClick,
  children,
}: {
  label: string;
  brass?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group pointer-events-auto flex min-w-16 flex-col items-center gap-[7px] text-[12px] font-semibold text-cream"
    >
      <span
        className={`flex h-[62px] w-[62px] items-center justify-center rounded-full transition-transform duration-[180ms] ease-entry group-active:scale-[0.92] ${
          brass
            ? "bg-brass text-projection shadow-[0_12px_30px_-10px_rgba(214,162,74,0.8)]"
            : "bg-[rgba(14,10,9,0.72)] shadow-[inset_0_0_0_1px_rgba(242,232,213,0.24)]"
        }`}
      >
        {children}
      </span>
      {text}
    </button>
  );
}

/** The real TMDB poster, filling the card. */
function Poster({ movie }: { movie: PoolMovie }) {
  if (!movie.posterUrl) return <div className="absolute inset-0 bg-aisle" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
    <img
      src={movie.posterUrl}
      alt=""
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
    />
  );
}

/** The card's size: the poster's 2:3 where the deck allows, never past its edges. */
function useCardSize(el: HTMLDivElement | null) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.floor(Math.min(width, height / 1.5));
      setSize((s) => (s && s.w === w ? s : { w, h: Math.floor(w * 1.5) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return size;
}
