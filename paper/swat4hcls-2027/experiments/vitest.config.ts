/**
 * Vitest config for the SWAT4HCLS 2027 evidence harnesses.
 *
 * Deliberately separate from the root config: these are report generators, not
 * tests, and must not run as part of `npm test`. The root config's `include`
 * covers `test/**` and `src/**` only, so nothing here is picked up by accident.
 *
 *   npx vitest run --config paper/swat4hcls-2027/experiments/vitest.config.ts
 */
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const r = (p: string) => resolve(__dirname, "../../..", p);

export default defineConfig({
  resolve: {
    alias: {
      "metadata-form/ai": r("src/ai/index.ts"),
      "metadata-form": r("src/index.ts"),
      "@": r("src"),
      "@examples": r("playground/examples"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [r("test/setup.ts")],
    include: [resolve(__dirname, "**/*.harness.ts")],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
