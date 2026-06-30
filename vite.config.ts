import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

const r = (p: string) => resolve(__dirname, p);

// Library entry points → mirror the package.json "exports" map.
const entries = {
  index: r("src/index.ts"),
  // Optional adapter subpath — Vercel AI SDK lives here, never in the core.
  "ai/index": r("src/ai/index.ts"),
  // Direct rudof-engine access subpath (`metadata-form/rudof`) for custom wiring.
  // Emitted under dist/engine/ so the JS bundle and the dts (which mirrors the
  // src tree) share a path; package.json maps `./rudof` → dist/engine/index.*.
  "engine/index": r("src/engine/index.ts"),
};

// Anything that must NOT be bundled into the library output.
const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  // The rudof WASM module — provided by `npm run build:wasm`, never bundled.
  "@kanzo/rudof-wasm",
  "@radix-ui/themes",
  // The /ai adapter's deps — kept external (optional peer deps).
  "ai",
  "zod",
];

export default defineConfig(({ command }) => {
  // `vite build` → library mode. `vite` (dev) / `vite preview` → playground app.
  const isLibBuild = command === "build";

  return {
    plugins: [
      react(),
      isLibBuild &&
        dts({
          entryRoot: "src",
          include: ["src"],
          exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          tsconfigPath: "./tsconfig.json",
        }),
    ].filter(Boolean),
    // In dev/preview the playground is the app root.
    root: isLibBuild ? undefined : r("playground"),
    // The dev root is `playground/`, but the alias below resolves the wasm to the
    // sibling rudof-fork checkout and the lib sources live one level up in `src/`.
    // Both are outside the dev root, so allow them through Vite's fs sandbox.
    server: isLibBuild
      ? undefined
      : { fs: { allow: [r("."), r("../rudof-fork")] } },
    build: isLibBuild
      ? {
          lib: {
            entry: entries,
            // ESM-only: this is a React component library consumed via bundlers.
            formats: ["es"],
          },
          rollupOptions: {
            external: (id) =>
              external.includes(id) ||
              /^@rdfjs\//.test(id) ||
              /^@radix-ui\//.test(id) ||
              /^@ai-sdk\//.test(id) ||
              // CodeMirror must stay external: @codemirror/state demands a single
              // instance — bundling it would risk a duplicate-copy break in apps
              // that also use CodeMirror. Resolved via our declared `dependencies`.
              /^@codemirror\//.test(id),
            output: {
              preserveModules: false,
              assetFileNames: (info) =>
                info.name === "style.css" ? "styles.css" : "[name][extname]",
              entryFileNames: "[name].js",
              chunkFileNames: "chunks/[name]-[hash].js",
            },
          },
          sourcemap: true,
          emptyOutDir: true,
        }
      : undefined,
    resolve: {
      alias: {
        // More specific first — "metadata-form/ai" must win over "metadata-form".
        "metadata-form/ai": r("src/ai/index.ts"),
        "metadata-form": r("src/index.ts"),
        "@": r("src"),
        // In dev/preview the playground must actually load the wasm: resolve it to
        // the built pkg (rudof fork sibling checkout). In lib build it stays
        // external (see `external` above) so consumers provide it themselves.
        ...(isLibBuild
          ? {}
          : { "@kanzo/rudof-wasm": r("../rudof-fork/rudof_wasm/pkg/rudof_wasm.js") }),
      },
    },
  };
});
