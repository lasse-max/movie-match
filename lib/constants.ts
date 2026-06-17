// Isomorphic constants safe to import from both client and server code.
// (lib/tmdb.ts is server-only, so shared values live here instead.)

/** Default watch-provider region. Region picker in setup can override this. */
export const DEFAULT_REGION = "US";

/** Curated set of major markets offered in setup (MVP keeps this short). */
export const SUPPORTED_REGIONS: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
];
