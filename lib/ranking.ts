// Round-DEPENDENT popularity ranking (soft, isomorphic, eval-set-tunable).
//
// Round 2 (swipe/mood) favors RECOGNIZABLE films so they're easy to judge — that
// lives in selectSwipeSamples (voteCount within each direction). Round 3 (final
// picks) keeps popularity as a quality FLOOR (applied elsewhere) but re-ranks the
// qualifiers to DE-WEIGHT the ubiquitous canon (Star Wars/Marvel/household names)
// and lean slightly RECENT — surfacing discoveries over the obvious. Everything
// here is SOFT: a score nudge, never a ban, so a strong cross-player match still
// ranks high (the AI selection is unaffected). Weights are knobs to tune against
// the eval set in the matching pass.

export interface Rankable {
  voteAverage: number;
  voteCount: number;
  year: string | null;
}

// ---- tunable knobs ---------------------------------------------------------
const UBIQUITY_KNEE = 8000; // voteCount past which a title reads as "everyone's seen it"
const UBIQUITY_SPAN = 24000; // votes over the knee for the de-weight to bottom out
const UBIQUITY_FLOOR = 0.45; // the most a ubiquitous title is de-weighted to (soft, never 0)
const RECENCY_FULL_YEARS = 18; // within this many years → full recency lean
const RECENCY_DECAY_YEARS = 40; // older than this → recency lean fully gone
const W_QUALITY = 0.5; // component weights (sum to 1)
const W_RECENCY = 0.3;
const W_FRESHNESS = 0.2; // "not the ubiquitous canon"

/**
 * Soft Round 3 rank score (higher surfaces sooner): quality-weighted, leaning
 * recent, de-weighting the ubiquitous canon. Never a hard exclude.
 */
export function round3Rank(m: Rankable, now = new Date().getFullYear()): number {
  const quality = Math.min(Math.max(m.voteAverage, 0) / 10, 1); // 0..1

  const year = m.year ? Number.parseInt(m.year, 10) : NaN;
  const age = Number.isFinite(year) ? Math.max(0, now - year) : RECENCY_DECAY_YEARS;
  const recency =
    age <= RECENCY_FULL_YEARS
      ? 1
      : Math.max(0, 1 - (age - RECENCY_FULL_YEARS) / (RECENCY_DECAY_YEARS - RECENCY_FULL_YEARS));

  const freshness =
    m.voteCount <= UBIQUITY_KNEE
      ? 1
      : Math.max(UBIQUITY_FLOOR, 1 - (m.voteCount - UBIQUITY_KNEE) / UBIQUITY_SPAN);

  return W_QUALITY * quality + W_RECENCY * recency + W_FRESHNESS * freshness;
}
