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
};

// Anything that must NOT be bundled into the library output.
const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "n3",
  "grapoi",
  "jsonld",
  "rdf-validate-shacl",
  "@rdfjs/namespace",
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
      },
    },
  };
});
