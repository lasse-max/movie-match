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
    // Node by default (lib/ and route tests). A screen test opts into a DOM with a
    // `// @vitest-environment happy-dom` line at its top (tests/*.test.tsx).
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
  },
});
