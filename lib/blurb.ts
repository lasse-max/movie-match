// Trim a TMDB `overview` down to a short card blurb (~1–2 sentences). Prefers to
// end on a sentence boundary near the limit; otherwise cuts on a word boundary
// and adds an ellipsis. Pure + isomorphic — used by the Round 2 and Round 3
// cards so people can judge an unfamiliar title's vibe, not just its poster.
export function blurb(overview: string | undefined, maxChars = 180): string {
  const text = (overview ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;

  const window = text.slice(0, maxChars + 1);
  // End cleanly on a sentence boundary if one lands reasonably near the limit
  // (so a very short first sentence doesn't truncate the whole blurb away). Only
  // count . ! ? that follow a lowercase letter or digit, so internal periods in
  // abbreviations like "G.I." / "U.S." / "Dr." aren't mistaken for sentence ends.
  const matches = [...window.matchAll(/[a-z0-9][.!?](?:\s|$)/g)];
  const last = matches[matches.length - 1];
  const sentenceEnd = last ? last.index + 1 : -1; // position of the . ! or ?
  if (sentenceEnd >= maxChars * 0.6) return text.slice(0, sentenceEnd + 1).trim();

  const wordEnd = window.lastIndexOf(" ");
  return text.slice(0, wordEnd > 0 ? wordEnd : maxChars).trim() + "…";
}
