/**
 * E4 — how much JS does adding `metadata-form` cost an app?
 *
 * Builds the SAME minimal React app twice with Vite, in production mode:
 *
 *   baseline — React 19 + ReactDOM, rendering a <div>
 *   withLib  — the same, plus `useMetadataForm` + `<MetadataForm>` over a real
 *              SHACL profile (the Evidenze data-space shapes)
 *
 * and diffs the emitted JS. The delta is therefore everything the library drags
 * in that the app did not already have — the form engine, the widgets, the
 * design system, the wasm-bindgen glue — and NOT React, which both builds pay
 * for. The `.wasm` binary is emitted as a separate asset (fetched on demand, not
 * part of the JS bundle) and is reported on its own.
 *
 * The apps consume the library from `../src`, exactly as the playground does, so
 * no `npm run build` of the library is required and the measured code is the
 * code in the tree.
 *
 * Writes results/bundle.json, read by perf.harness.ts.
 *
 *   node bundle-delta.mjs
 */
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { gzipSync, brotliCompressSync, constants as zlib } from "node:zlib";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../..");
const WORK = join(HERE, ".bundle");
const OUT = join(HERE, "results");
const require = createRequire(import.meta.url);

const gz = (b) => gzipSync(b, { level: 9 }).byteLength;
const br = (b) => brotliCompressSync(b, { params: { [zlib.BROTLI_PARAM_QUALITY]: 11 } }).byteLength;

const INDEX_HTML = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>e4</title></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>`;

const BASELINE = `import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")!).render(<div>baseline</div>);
`;

// Deliberately the whole public surface an adopter actually uses: the hook, the
// component and the default widget set (which `<MetadataForm>` pulls in anyway).
const WITH_LIB = `import { createRoot } from "react-dom/client";
import { useMetadataForm, MetadataForm } from "metadata-form";
import "@kanzo-tech/ui/styles.css";
import shapes from "./shapes.ttl?raw";

function App() {
  const form = useMetadataForm({ shapes });
  return <MetadataForm form={form} />;
}
createRoot(document.getElementById("root")!).render(<App />);
`;

// A third build that stops at the engine: the wasm-bindgen glue plus the
// `metadata-form/rudof` wrapper and the shape IR, with none of the React UI.
// Splits the delta into "the engine seam" and "the form UI on top of it", which
// is the first question a reader asks of a 142 kB figure.
const ENGINE_ONLY = `import { createRoot } from "react-dom/client";
import { createRudofEngine } from "metadata-form/rudof";
import shapes from "./shapes.ttl?raw";

const engine = createRudofEngine();
engine.loadShapes(shapes).then((m) => {
  createRoot(document.getElementById("root")!).render(<div>{m.nodeShapes.size}</div>);
});
`;

/** Vite needs a declaration for the \`?raw\` import in a .tsx entry. */
const RAW_DTS = `declare module "*?raw" { const s: string; export default s; }\n`;

function scaffold(name, entry) {
  const dir = join(WORK, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), INDEX_HTML);
  writeFileSync(join(dir, "main.tsx"), entry);
  writeFileSync(join(dir, "raw.d.ts"), RAW_DTS);
  writeFileSync(
    join(dir, "shapes.ttl"),
    readFileSync(join(REPO, "examples/evidenze-dataspace/shapes.ttl"), "utf8"),
  );
  return dir;
}

async function buildApp(name, entry) {
  const root = scaffold(name, entry);
  const outDir = join(WORK, `out-${name}`);
  rmSync(outDir, { recursive: true, force: true });
  await build({
    root,
    logLevel: "warn",
    plugins: [react()],
    optimizeDeps: { exclude: ["@kanzo-tech/rudof-wasm"] },
    resolve: {
      alias: {
        "metadata-form/ai": resolve(REPO, "src/ai/index.ts"),
        "metadata-form/rudof": resolve(REPO, "src/engine/index.ts"),
        "metadata-form": resolve(REPO, "src/index.ts"),
        "@": resolve(REPO, "src"),
      },
    },
    build: { outDir, emptyOutDir: true, sourcemap: false, reportCompressedSize: false },
  });

  const totals = { js: 0, jsGzip: 0, jsBrotli: 0, css: 0, cssGzip: 0, wasm: 0, files: [] };
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      const buf = readFileSync(p);
      const rel = p.slice(outDir.length + 1);
      if (p.endsWith(".js")) {
        totals.js += buf.byteLength;
        totals.jsGzip += gz(buf);
        totals.jsBrotli += br(buf);
        totals.files.push({ file: rel, bytes: buf.byteLength, gzip: gz(buf) });
      } else if (p.endsWith(".css")) {
        totals.css += buf.byteLength;
        totals.cssGzip += gz(buf);
        totals.files.push({ file: rel, bytes: buf.byteLength, gzip: gz(buf) });
      } else if (p.endsWith(".wasm")) {
        totals.wasm += buf.byteLength;
      }
    }
  };
  walk(outDir);
  return totals;
}

const baseline = await buildApp("baseline", BASELINE);
const engineOnly = await buildApp("engine", ENGINE_ONLY);
const withLib = await buildApp("withlib", WITH_LIB);

mkdirSync(OUT, { recursive: true });
const result = {
  generated: new Date().toISOString().slice(0, 19) + "Z",
  vite: require("vite/package.json").version,
  react: require("react/package.json").version,
  note:
    "Two production Vite builds of the same minimal React app, differing only in " +
    "whether it imports and renders <MetadataForm> over a real SHACL profile. " +
    "The JS delta excludes React (both builds pay for it) and excludes the .wasm " +
    "binary, which is emitted as a separate on-demand asset.",
  baseline,
  engineOnly,
  withLib,
  deltaEngine: {
    js: engineOnly.js - baseline.js,
    jsGzip: engineOnly.jsGzip - baseline.jsGzip,
    jsBrotli: engineOnly.jsBrotli - baseline.jsBrotli,
  },
  delta: {
    js: withLib.js - baseline.js,
    jsGzip: withLib.jsGzip - baseline.jsGzip,
    jsBrotli: withLib.jsBrotli - baseline.jsBrotli,
    css: withLib.css - baseline.css,
    cssGzip: withLib.cssGzip - baseline.cssGzip,
    wasm: withLib.wasm - baseline.wasm,
  },
};
writeFileSync(join(OUT, "bundle.json"), JSON.stringify(result, null, 2));
rmSync(WORK, { recursive: true, force: true });

const kb = (b) => `${(b / 1024).toFixed(1)} kB`;
console.log(`[E4] baseline JS ${kb(baseline.js)} (gz ${kb(baseline.jsGzip)})`);
console.log(`[E4] +engine   JS ${kb(engineOnly.js)} (gz ${kb(engineOnly.jsGzip)})`);
console.log(`[E4] +library JS ${kb(withLib.js)} (gz ${kb(withLib.jsGzip)})`);
console.log(`[E4] delta       ${kb(result.delta.js)} (gz ${kb(result.delta.jsGzip)}, br ${kb(result.delta.jsBrotli)})`);
console.log(`[E4] wasm asset  ${kb(withLib.wasm)}`);
console.log(`[E4] wrote ${join(OUT, "bundle.json")}`);
