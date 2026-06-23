// Short, attributed famous movie quotes for the "straightforward" loading waits
// (infer / match). Rome: Total War-style flavor text to use the wait. Kept short
// and attributed — low IP risk at this scale. Isomorphic.
export interface MovieQuote {
  quote: string;
  film: string;
}

export const MOVIE_QUOTES: MovieQuote[] = [
  { quote: "Here's looking at you, kid.", film: "Casablanca" },
  { quote: "May the Force be with you.", film: "Star Wars" },
  { quote: "I'll be back.", film: "The Terminator" },
  { quote: "There's no place like home.", film: "The Wizard of Oz" },
  { quote: "Why so serious?", film: "The Dark Knight" },
  { quote: "To infinity and beyond!", film: "Toy Story" },
  { quote: "Life is like a box of chocolates.", film: "Forrest Gump" },
  { quote: "Roads? Where we're going, we don't need roads.", film: "Back to the Future" },
  { quote: "Just keep swimming.", film: "Finding Nemo" },
  { quote: "There is no spoon.", film: "The Matrix" },
  { quote: "E.T. phone home.", film: "E.T. the Extra-Terrestrial" },
  { quote: "Nobody puts Baby in a corner.", film: "Dirty Dancing" },
  { quote: "I see dead people.", film: "The Sixth Sense" },
  { quote: "Carpe diem. Seize the day.", film: "Dead Poets Society" },
  { quote: "Houston, we have a problem.", film: "Apollo 13" },
  { quote: "Wax on, wax off.", film: "The Karate Kid" },
  { quote: "My precious.", film: "The Lord of the Rings" },
  { quote: "Adventure is out there!", film: "Up" },
];

/** A random quote — pick once per loading screen for a different flavor each wait. */
export function randomQuote(): MovieQuote {
  return MOVIE_QUOTES[Math.floor(Math.random() * MOVIE_QUOTES.length)];
}
