import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

const r = (p: string) => resolve(__dirname, p);

// Pure library build. The standalone playground app has its own
// `playground/vite.config.ts`; the two configs are fully decoupled.

// Library entry points → mirror the package.json "exports" map.
const entries = {
  index: r("src/index.ts"),
  // The optional AI layer (`metadata-form/ai`): @kanzo-tech/ai's `Assist` is
  // imported here and nowhere in the core.
  "ai/index": r("src/ai/index.ts"),
  // Direct rudof-engine access subpath (`metadata-form/rudof`) for custom wiring.
  // Emitted under dist/engine/ so the JS bundle and the dts (which mirrors the
  // src tree) share a path; package.json maps `./rudof` → dist/engine/index.*.
  "engine/index": r("src/engine/index.ts"),
  // The languages other than English, as data (`metadata-form/i18n`): the core carries
  // English only, and a consumer imports the rest.
  "i18n/index": r("src/i18n/index.ts"),
};

// Anything that must NOT be bundled into the library output: the peers, the
// design system (and what it is built on), and the wasm engine.
const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  // The rudof WASM module — a declared dependency, never bundled.
  "@kanzo-tech/rudof-wasm",
  // The /ai subpath's optional peers (`@kanzo-tech/*` is matched by `externalPackages`).
  "ai",
];
const externalPackages = /^(@kanzo-tech\/|@ark-ui\/|@ai-sdk\/|lucide-react(\/|$))/;

export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: "src",
      include: ["src"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    lib: {
      entry: entries,
      // ESM-only: this is a React component library consumed via bundlers.
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) =>
        external.includes(id) || externalPackages.test(id),
      output: {
        preserveModules: false,
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
