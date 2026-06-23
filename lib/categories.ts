// Category/mood chips offered in Round 1. A deliberate mix of genres and moods:
// the AI blend (step 5) reads the underlying mood and turns each player's 2–3
// picks into 1–3 TMDB search directions — the value is in fuzzy cross-genre
// blends (e.g. apocalyptic + horror + action → zombie-action) that a plain tag
// intersection misses. Isomorphic (Round 1 UI + the blend prompt/fallback).

export interface Category {
  id: string;
  label: string;
  emoji: string;
  /** TMDB movie genre id, when this pick maps to one (moods don't). */
  tmdbGenreId?: number;
}

export const CATEGORIES: Category[] = [
  // Moods FIRST — a soft nudge toward mood-led Round 1. Moods are blendable
  // ("light"/"intense" → common ground), where genres polarize couples apart.
  { id: "feelgood", label: "Feel-good", emoji: "🌞" },
  { id: "mindbending", label: "Mind-bending", emoji: "🌀" },
  { id: "tearjerker", label: "Tearjerker", emoji: "😭" },
  { id: "dark", label: "Dark & gritty", emoji: "🌑" },
  { id: "cozy", label: "Cozy", emoji: "☕" },
  { id: "apocalyptic", label: "Apocalyptic", emoji: "☢️" },
  // Then genres (they still anchor the TMDB search).
  { id: "action", label: "Action", emoji: "💥", tmdbGenreId: 28 },
  { id: "comedy", label: "Comedy", emoji: "😂", tmdbGenreId: 35 },
  { id: "horror", label: "Horror", emoji: "👻", tmdbGenreId: 27 },
  { id: "scifi", label: "Sci-Fi", emoji: "🚀", tmdbGenreId: 878 },
  { id: "romance", label: "Romance", emoji: "💘", tmdbGenreId: 10749 },
  { id: "thriller", label: "Thriller", emoji: "🔪", tmdbGenreId: 53 },
  { id: "drama", label: "Drama", emoji: "🎭", tmdbGenreId: 18 },
  { id: "fantasy", label: "Fantasy", emoji: "🐉", tmdbGenreId: 14 },
  { id: "crime", label: "Crime", emoji: "🕵️", tmdbGenreId: 80 },
  { id: "animation", label: "Animated", emoji: "🎨", tmdbGenreId: 16 },
];

/** Map a stored category id back to its human label (for the AI prompt). */
export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** TMDB genre id for a pick given by id or label, or null for mood picks. */
export function categoryGenreId(idOrLabel: string): number | null {
  const key = idOrLabel.trim().toLowerCase();
  const match = CATEGORIES.find(
    (c) => c.id === key || c.label.toLowerCase() === key
  );
  return match?.tmdbGenreId ?? null;
}

/**
 * Sanitize a player's Round 1 picks before they reach the AI: keep only known
 * category values (matched by id or label), de-duplicate, return canonical
 * labels, and bound the count. Unknown/garbage input is dropped.
 */
export function normalizeCategoryPicks(raw: unknown, max = 3): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item.trim().toLowerCase();
    const match = CATEGORIES.find(
      (c) => c.id === key || c.label.toLowerCase() === key
    );
    if (!match || seen.has(match.id)) continue;
    seen.add(match.id);
    out.push(match.label);
    if (out.length >= max) break;
  }
  return out;
}
