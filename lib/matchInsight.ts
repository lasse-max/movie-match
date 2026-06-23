// Pure "why it matched" derivation for the match screen (MVP). The TAGS are the
// honest substance — the couple's mood axes + the title's genres. The PERCENT is
// a believable engagement number mapped from the deterministic fit signal; it is
// NOT a real probability. A full AI explanation is a 2.0 item. Isomorphic.
import { genreNames } from "./genres";

/** Up to `max` lowercase tags: the couple's mood axes first, then the title's
 * genres, de-duplicated (e.g. ["dark", "clever", "thriller"]). */
export function matchTags(moodAxes: string[], genreIds: number[], max = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  for (const a of moodAxes) push(a);
  for (const g of genreNames(genreIds)) push(g);
  return out.slice(0, max);
}

/** Map a normalized fit (0 worst … 1 best) to a believable 74–98% match score. */
export function matchPercent(fit01: number): number {
  const clamped = Math.max(0, Math.min(1, fit01));
  return Math.round(74 + clamped * 24);
}
