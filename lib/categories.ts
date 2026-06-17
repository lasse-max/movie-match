// Category/mood chips offered in Round 1. A deliberate mix of genres and moods:
// the AI blend (step 5) turns each player's 2–3 picks into shared themes and a
// candidate pool — the value is in fuzzy cross-genre blends (e.g. apocalyptic +
// horror + action → Train to Busan) that a plain tag intersection misses.
// Isomorphic (used by the Round 1 UI now and the blend prompt later).

export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { id: "action", label: "Action", emoji: "💥" },
  { id: "comedy", label: "Comedy", emoji: "😂" },
  { id: "horror", label: "Horror", emoji: "👻" },
  { id: "scifi", label: "Sci-Fi", emoji: "🚀" },
  { id: "romance", label: "Romance", emoji: "💘" },
  { id: "thriller", label: "Thriller", emoji: "🔪" },
  { id: "drama", label: "Drama", emoji: "🎭" },
  { id: "fantasy", label: "Fantasy", emoji: "🐉" },
  { id: "crime", label: "Crime", emoji: "🕵️" },
  { id: "animation", label: "Animated", emoji: "🎨" },
  { id: "feelgood", label: "Feel-good", emoji: "🌞" },
  { id: "mindbending", label: "Mind-bending", emoji: "🌀" },
  { id: "tearjerker", label: "Tearjerker", emoji: "😭" },
  { id: "dark", label: "Dark & gritty", emoji: "🌑" },
  { id: "cozy", label: "Cozy", emoji: "☕" },
  { id: "apocalyptic", label: "Apocalyptic", emoji: "☢️" },
];

/** Map a stored category id back to its human label (for the AI prompt later). */
export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
