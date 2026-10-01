"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
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

/** Right is This vibe, left is Not it, down is Not sure. */
type Dir = "right" | "left" | "down";

/** Release past this share of the card width (or flick) to decide. */
const THRESHOLD = 0.35;
/** A flick: release speed in px/s. */
const FLICK = 600;
/** Tilt at a full card width of drag; it keeps growing as the card flies off. */
const TILT = 12;

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

// Round 2, built to docs/design/picture-palace/SwipeStamp.dc.html: a physical card
// you drag (or a button you tap), a rubber stamp, three equal decisions.
function PlayerSwipe({ player, samples }: { player: Player; samples: PoolMovie[] }) {
  const { dispatch } = useGame();
  const [ready, setReady] = useState(player === 1);
  const [index, setIndex] = useState(0);
  const [yes, setYes] = useState<number[]>([]);
  const [no, setNo] = useState<number[]>([]);
  const [neutral, setNeutral] = useState<number[]>([]);
  const [last, setLast] = useState<Dir | null>(null);
  const [flying, setFlying] = useState(false); // a card is still flying off
  const [exit, setExit] = useState<ExitTarget>({ dir: "right", w: 0, h: 0 });
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false); // blocks a synchronous double-tap
  const indexRef = useRef(0);
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
  // lib/gameMachine.ts turn completion and lib/infer.ts degrade).
  const decide = (dir: Dir) => {
    const movie = samples[indexRef.current];
    if (!movie || !size) return;
    indexRef.current += 1; // a second decision in the same tick lands on the next card
    setExit({ dir, w: size.w, h: size.h });
    setFlying(true);
    setLast(dir);
    if (dir === "right") setYes((v) => [...v, movie.id]);
    else if (dir === "left") setNo((v) => [...v, movie.id]);
    else setNeutral((v) => [...v, movie.id]);
    setIndex((i) => i + 1);
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
            {/* The two cards waiting behind, stepped back and dimmed. */}
            {visible.slice(1).map((m, i) => (
              <div
                key={m.id}
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-[22px] transition-[transform,filter] duration-[560ms] ease-entry"
                style={{
                  zIndex: 2 - i,
                  transform: i === 0 ? "translateY(14px) scale(0.95)" : "translateY(26px) scale(0.9)",
                  filter: i === 0 ? "brightness(0.6)" : "brightness(0.4)",
                }}
              >
                <Poster movie={m} />
              </div>
            ))}

            <AnimatePresence custom={exit} onExitComplete={() => setFlying(false)}>
              {!done && (
                <TopCard key={visible[0].id} movie={visible[0]} width={size.w} onDecide={decide} />
              )}
            </AnimatePresence>

            {/* Three equal choices over the poster: same size, same weight. */}
            {!done && (
              <div className="absolute inset-x-0 bottom-[18px] z-10 flex justify-center gap-7">
                <Control label="Not it" onClick={() => decide("left")}>
                  <Cross size={24} />
                </Control>
                <Control label="Not sure" onClick={() => decide("down")}>
                  <Question size={24} />
                </Control>
                <Control label="This vibe" brass onClick={() => decide("right")}>
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

/** Where a decided card flies: right/left with the tilt, or down and away. */
interface ExitTarget {
  dir: Dir;
  w: number;
  h: number;
}

/** The card on top: follows the finger, tilts, stamps, and flies off on a decision. */
function TopCard({
  movie,
  width,
  onDecide,
}: {
  movie: PoolMovie;
  width: number;
  onDecide: (dir: Dir) => void;
}) {
  const reduced = !!useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const decided = useRef(false);
  const [gone, setGone] = useState(false);
  const t = width * THRESHOLD;

  const rotate = useTransform(x, [-width, 0, width], [-TILT, 0, TILT], { clamp: false });
  // Each stamp fades in as the card heads its way, fully on at the threshold.
  const right = useTransform(() => (x.get() > 0 && x.get() >= y.get() ? Math.min(x.get() / t, 1) : 0));
  const left = useTransform(() => (x.get() < 0 && -x.get() >= y.get() ? Math.min(-x.get() / t, 1) : 0));
  const down = useTransform(() =>
    y.get() > 0 && y.get() > Math.abs(x.get()) ? Math.min(y.get() / t, 1) : 0
  );

  const fly = reduced ? { duration: 0 } : { duration: 0.56, ease: ENTRY_EASE };

  return (
    <motion.article
      className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-[22px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.9)] active:cursor-grabbing"
      style={{ x, y, rotate, zIndex: 3, pointerEvents: gone ? "none" : undefined }}
      drag
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (decided.current) return;
        const px = x.get();
        const py = y.get();
        const v = info.velocity;
        let dir: Dir | null = null;
        if (Math.abs(px) >= Math.max(py, 0)) {
          if (px > t || (v.x > FLICK && Math.abs(v.x) > Math.abs(v.y))) dir = "right";
          else if (px < -t || (v.x < -FLICK && Math.abs(v.x) > Math.abs(v.y))) dir = "left";
        }
        if (!dir && (py > t || (v.y > FLICK && v.y > Math.abs(v.x)))) dir = "down";
        if (dir) {
          decided.current = true;
          setGone(true);
          onDecide(dir);
        } else {
          // Not far enough: spring back.
          const back = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 500, damping: 34 };
          animate(x, 0, back);
          animate(y, 0, back);
        }
      }}
      initial={reduced ? false : { y: 14, scale: 0.95, filter: "brightness(0.6)" }}
      animate={{ y: 0, scale: 1, filter: "brightness(1)" }}
      transition={fly}
      variants={{
        exit: ({ dir, w, h }: ExitTarget) =>
          dir === "down"
            ? { y: h * 0.38, scale: 0.86, opacity: 0, zIndex: 4, transition: fly }
            : { x: (dir === "right" ? 1 : -1) * w * 1.3, zIndex: 4, transition: fly },
      }}
      exit="exit"
    >
      <Poster movie={movie} />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(14,10,9,0.96)_0%,rgba(14,10,9,0.74)_34%,rgba(14,10,9,0)_60%)]" />
      {movie.genreIds.length > 0 && (
        <span className="absolute left-4 top-4 rounded-full bg-[rgba(14,10,9,0.55)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-cream backdrop-blur-[8px]">
          {genreNames(movie.genreIds).slice(0, 2).join(" · ")}
        </span>
      )}
      <div className="absolute inset-x-[22px] bottom-[122px] flex flex-col gap-1.5">
        <h2 className={`${display} line-clamp-3 text-[48px] leading-[0.86]`}>{movie.title}</h2>
        {movie.year && <span className="text-[13px] text-cream/75">{movie.year}</span>}
      </div>

      <Stamp value={right} className="text-brass-light">
        This vibe
      </Stamp>
      <Stamp value={left} className="text-cream">
        Not it
      </Stamp>
      <Stamp value={down} className="border-dashed text-cream">
        Not sure
      </Stamp>
    </motion.article>
  );
}

/** A rubber stamp across the poster; its opacity tracks the drag toward it. */
function Stamp({
  value,
  className,
  children,
}: {
  value: MotionValue<number>;
  className: string;
  children: string;
}) {
  const scale = useTransform(value, [0, 1], [1.5, 1]);
  return (
    <motion.span
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-[24%] z-[5] whitespace-nowrap rounded-[8px] border-4 border-current bg-[rgba(14,10,9,0.35)] px-[18px] pb-1.5 pt-2 font-display text-[40px] font-black uppercase leading-none tracking-[0.04em] ${className}`}
      style={{ opacity: value, scale, x: "-50%", rotate: -12 }}
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
      className="group flex min-w-16 flex-col items-center gap-[7px] text-[12px] font-semibold text-cream"
    >
      <span
        className={`flex h-[62px] w-[62px] items-center justify-center rounded-full transition-transform duration-[180ms] ease-entry group-active:scale-[0.92] ${
          brass
            ? "bg-brass text-projection shadow-[0_12px_30px_-10px_rgba(214,162,74,0.8)]"
            : "bg-[rgba(14,10,9,0.5)] shadow-[inset_0_0_0_1px_rgba(242,232,213,0.24)] backdrop-blur-[12px] backdrop-saturate-[1.2]"
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
