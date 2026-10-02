import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      "@kanzo-tech/metadata-form/i18n": r("src/i18n/index.ts"),
      "@kanzo-tech/metadata-form/ai": r("src/ai/index.ts"),
      "@kanzo-tech/metadata-form": r("src/index.ts"),
      "@": r("src"),
      "@examples": r("examples"),
      "@playground": r("playground/src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [r("test/setup.ts")],
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
});
