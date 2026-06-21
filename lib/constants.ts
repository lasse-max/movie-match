// Isomorphic constants safe to import from both client and server code.
// (lib/tmdb.ts is server-only, so shared values live here instead.)

/** Default watch-provider region. Region picker in setup can override this. */
export const DEFAULT_REGION = "US";

/** Client-side cap on the AI prefetch fetches (blend/infer/bridge) so a hung
 * upstream surfaces a friendly retry instead of an endless loading screen. */
export const REQUEST_TIMEOUT_MS = 15000;

/** Curated set of major markets offered in setup (MVP keeps this short). */
export const SUPPORTED_REGIONS: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
];
