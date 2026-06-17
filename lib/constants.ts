// Isomorphic constants safe to import from both client and server code.
// (lib/tmdb.ts is server-only, so shared values live here instead.)

/** Default watch-provider region. Region picker in setup can override this. */
export const DEFAULT_REGION = "US";
