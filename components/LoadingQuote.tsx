"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { randomQuote, type MovieQuote } from "@/lib/quotes";
import { ENTRY_EASE, display, label } from "./palace";

/** If one wait passes about this long, fade to a second quote. */
const SECOND_QUOTE_MS = 8000;

/** A different quote from the one showing (the curated list is short). */
function anotherQuote(current: MovieQuote): MovieQuote {
  for (let i = 0; i < 8; i++) {
    const q = randomQuote();
    if (q.quote !== current.quote) return q;
  }
  return current;
}

/**
 * The hero of every AI wait, Total War style (Load1 / Load2 boards): one iconic
 * line from the curated, hand-checked list in lib/quotes.ts, big, under a brass
 * opening quotation mark, with the film in Courier caps. Past about 8 s it fades
 * to a second quote.
 */
export function LoadingQuote() {
  const [q, setQ] = useState(randomQuote);
  const reduced = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(() => setQ((cur) => anotherQuote(cur)), SECOND_QUOTE_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.figure
        key={q.quote}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.5, ease: ENTRY_EASE }}
        className="flex flex-col gap-3.5 px-1 pb-2.5"
      >
        <span aria-hidden className={`${display} h-11 text-[96px] leading-[0.6] text-brass`}>
          “
        </span>
        <blockquote className="font-display text-[40px] font-extrabold leading-[0.98] tracking-[-0.005em] text-cream">
          {q.quote}
        </blockquote>
        <figcaption className={`${label} tracking-[0.22em] text-cream/65`}>{q.film}</figcaption>
      </motion.figure>
    </AnimatePresence>
  );
}
