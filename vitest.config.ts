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
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [r("test/setup.ts")],
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
});
