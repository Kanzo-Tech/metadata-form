import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This config owns the standalone playground app. The library has its own
// `../vite.config.ts` (pure lib build) — the two are fully decoupled.
const root = __dirname;
const lib = (p: string) => resolve(root, "..", p);

export default defineConfig({
  root,
  plugins: [react()],
  // wasm-pack `--target web`: keep it out of Vite's dep pre-bundle so the .wasm
  // is served verbatim from node_modules. Pre-bundling rewrites the binding's
  // `new URL('rudof_wasm_bg.wasm', import.meta.url)` into `.vite/deps/` (no .wasm
  // there) → the dev server returns index.html → "expected magic word" on init.
  optimizeDeps: { exclude: ["@kanzo-tech/rudof-wasm"] },
  // The app lives in `playground/` but consumes the library straight from its
  // sibling `../src` (live sources, no build step), so widen Vite's fs sandbox
  // to the repo root (also covers the root node_modules).
  server: { fs: { allow: [resolve(root, "..")] } },
  resolve: {
    alias: {
      // More specific first — "metadata-form/ai" must win over "metadata-form".
      "metadata-form/ai": lib("src/ai/index.ts"),
      "metadata-form": lib("src/index.ts"),
      "@": lib("src"),
    },
  },
});
