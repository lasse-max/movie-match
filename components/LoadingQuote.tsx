"use client";

import { useState } from "react";
import { randomQuote } from "@/lib/quotes";

// A single random movie quote, picked once on mount — flavor for the straightforward
// loading waits (infer / match) so the wait isn't dead time.
export function LoadingQuote() {
  const [q] = useState(randomQuote);
  return (
    <figure className="max-w-[280px]">
      <blockquote className="mb-1.5 font-display text-[19px] italic leading-[1.35] text-text/80">
        “{q.quote}”
      </blockquote>
      <figcaption className="text-[12px] text-text/40">— {q.film}</figcaption>
    </figure>
  );
}
