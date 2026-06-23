"use client";

import { useState } from "react";
import { randomQuote } from "@/lib/quotes";

// A single random movie quote, picked once on mount — flavor for the straightforward
// loading waits (infer / match) so the wait isn't dead time.
export function LoadingQuote() {
  const [q] = useState(randomQuote);
  return (
    <figure className="mt-2 max-w-xs">
      <blockquote className="text-sm italic text-foreground/60">“{q.quote}”</blockquote>
      <figcaption className="mt-1 text-xs text-foreground/40">— {q.film}</figcaption>
    </figure>
  );
}
