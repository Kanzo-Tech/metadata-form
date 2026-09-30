import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { themeScript } from "@kanzo-tech/ui";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// This config owns the standalone playground app. The library has its own
// `../vite.config.ts` (pure lib build) — the two are fully decoupled.
const root = __dirname;
const lib = (p: string) => resolve(root, "..", p);

// The theme attributes land on <html> before first paint, so a reader's saved theme,
// density and radius are there when the page is, not a frame after it.
const themeInit: Plugin = {
  name: "theme-init",
  transformIndexHtml: () => [{ tag: "script", children: themeScript(), injectTo: "head-prepend" }],
};

export default defineConfig({
  root,
  plugins: [react(), tailwindcss(), themeInit],
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
      "metadata-form/i18n": lib("src/i18n/index.ts"),
      "metadata-form/ai": lib("src/ai/index.ts"),
      "metadata-form": lib("src/index.ts"),
      "@": lib("src"),
      "@examples": lib("examples"),
    },
  },
});
