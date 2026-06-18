// Server-only Claude client. Importing this from a Client Component fails the
// build, so ANTHROPIC_API_KEY never reaches the browser.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Model for the two taste calls per session. The BRD pins Sonnet 4.6
// (cost-conscious, ~2 calls/session). Swap to "claude-opus-4-8" for
// higher-quality blends if the fuzzy intersections ever feel generic.
export const CLAUDE_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

/** Lazily constructed Anthropic client (reads ANTHROPIC_API_KEY from env). */
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }
  client ??= new Anthropic();
  return client;
}
