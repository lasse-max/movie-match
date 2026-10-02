// Isomorphic constants safe to import from both client and server code.
// (lib/tmdb.ts is server-only, so shared values live here instead.)

/** Default watch-provider region. Region picker in setup can override this. */
export const DEFAULT_REGION = "US";

/** Client-side cap on the AI prefetch fetches (blend/infer/bridge) so a hung
 * upstream surfaces a friendly retry instead of an endless loading screen. The
 * calls normally take 8 to 13 s, so 25 s leaves room for a slow one. Keep it
 * under the Vercel function limit (no maxDuration is set, so the project default
 * applies: 300 s with Fluid compute). */
export const REQUEST_TIMEOUT_MS = 25000;

/** Curated set of major markets offered in setup (MVP keeps this short). */
export const SUPPORTED_REGIONS: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
];
