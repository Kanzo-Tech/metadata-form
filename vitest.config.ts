import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      "metadata-form/ai": r("src/ai/index.ts"),
      "metadata-form": r("src/index.ts"),
      "@": r("src"),
      "@examples": r("playground/examples"),
      // Resolve the built wasm package so the loader's dynamic import type-resolves
      // in tests. Built from the rudof fork (sibling checkout). The rudof
      // integration test injects its own engine and never actually calls the
      // loader, so this module is loaded but not executed.
      "rudof-wasm": r("../rudof-fork/rudof_wasm/pkg/rudof_wasm.js"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [r("test/setup.ts")],
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
});
