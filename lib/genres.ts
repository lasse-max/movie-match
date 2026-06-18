// TMDB movie genre id → name (isomorphic). Used to give the AI readable genre
// labels for candidate movies in the mood-inference prompt.
export const TMDB_GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export function genreNames(ids: number[] | undefined): string[] {
  return (ids ?? []).map((id) => TMDB_GENRE_NAMES[id]).filter(Boolean);
}

export const ANIMATION_GENRE_ID = 16;
export const FAMILY_GENRE_ID = 10751;

/**
 * Kids' fare = tagged BOTH Animation AND Family (Mario, Zootopia, Toy Story).
 * That pairing is the kids'-movie signature: it keeps adult comedy (Grown Ups,
 * Elf — Family but not Animation) and adult animation (Spider-Verse — Animation
 * but not Family), and drops only the children's tentpoles.
 */
export function isKidsFare(genreIds: number[] | undefined): boolean {
  if (!genreIds) return false;
  return genreIds.includes(ANIMATION_GENRE_ID) && genreIds.includes(FAMILY_GENRE_ID);
}
