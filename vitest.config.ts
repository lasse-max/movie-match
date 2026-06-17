import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirrors the "@/*" -> "./*" path alias from tsconfig.json so tests can import
// project modules the same way app code does (e.g. `@/lib/filter`).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Pure-function unit tests only (filter + Round 3 overlap/tiebreak).
    // UI components and API routes are covered by manual smoke-testing for the MVP.
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
