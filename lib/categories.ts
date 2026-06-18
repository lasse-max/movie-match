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
  { id: "feelgood", label: "Feel-good", emoji: "🌞" },
  { id: "mindbending", label: "Mind-bending", emoji: "🌀" },
  { id: "tearjerker", label: "Tearjerker", emoji: "😭" },
  { id: "dark", label: "Dark & gritty", emoji: "🌑" },
  { id: "cozy", label: "Cozy", emoji: "☕" },
  { id: "apocalyptic", label: "Apocalyptic", emoji: "☢️" },
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
