/**
 * Vitest config for the SWAT4HCLS 2027 evidence harnesses.
 *
 * Deliberately separate from the root config: these are report generators, not
 * tests, and must not run as part of `npm test`. The root config's `include`
 * covers `test/**` and `src/**` only, so nothing here is picked up by accident.
 *
 *   npx vitest run --config evaluation/experiments/vitest.config.ts
 */
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const r = (p: string) => resolve(__dirname, "../..", p);

export default defineConfig({
  resolve: {
    alias: {
      "metadata-form/ai": r("src/ai/index.ts"),
      "metadata-form": r("src/index.ts"),
      "@": r("src"),
      "@examples": r("examples"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [r("test/setup.ts")],
    include: [resolve(__dirname, "**/*.harness.ts")],
    // These are report generators, not tests: one "test" walks a whole corpus and
    // benchmarks each profile tens of times. E4 alone parses SPHN's 952 kB 36
    // times. Minutes are expected; a test-shaped timeout would only truncate the
    // evidence.
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
  },
});
