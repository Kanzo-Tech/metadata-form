import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The form as a page to show in an iframe (`npm run build` puts it in
// dist/frame/, which an app copies to its public folder). `npm run dev:frame`
// serves it with demo.html, a host page that frames it.
const root = __dirname;
const lib = (p: string) => resolve(root, "..", p);

// The page's Content Security Policy, on the built page only (the dev server
// injects inline scripts). 'wasm-unsafe-eval' lets the rudof engine compile;
// shapes are fetched from the page's own origin or sent as text.
const csp: Plugin = {
  name: "frame-csp",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content:
          "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
      },
      injectTo: "head-prepend",
    },
  ],
};

export default defineConfig({
  root,
  base: "./",
  plugins: [react(), tailwindcss(), csp],
  // See playground/vite.config.ts: the wasm is served as it is, not pre-bundled.
  optimizeDeps: { exclude: ["@kanzo-tech/rudof-wasm"] },
  server: { fs: { allow: [lib(".")] } },
  resolve: {
    alias: {
      "@kanzo-tech/metadata-form/i18n": lib("src/i18n/index.ts"),
      "@kanzo-tech/metadata-form/embed": lib("src/embed/index.ts"),
      "@kanzo-tech/metadata-form": lib("src/index.ts"),
      "@": lib("src"),
      "@examples": lib("examples"),
    },
  },
  build: {
    outDir: lib("dist/frame"),
    emptyOutDir: true,
    // No inline polyfill script: the page's CSP only allows 'self'.
    modulePreload: { polyfill: false },
    // One page, loaded once: the form, Kanzo UI and React in one script (~780 kB,
    // ~240 kB gzipped) is expected, not a chunk to split.
    chunkSizeWarningLimit: 1000,
    rollupOptions: { input: resolve(root, "index.html") },
  },
});
