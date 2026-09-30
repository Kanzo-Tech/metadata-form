/**
 * E4 — ONE cold WASM start, in a fresh V8 isolate.
 *
 * Printed as a single JSON line on stdout. `perf.harness.ts` spawns this N times
 * (one child process per sample) because that is the only way to get a genuinely
 * cold measurement: wasm-bindgen's `__wbg_init` short-circuits after the first
 * call, and V8 keeps compiled modules alive inside a process, so re-initialising
 * in-process measures a warm cache, not a cold start.
 *
 * HONESTY NOTE. This is Node, not a browser. `bytes` is a local disk read, which
 * stands in for `fetch()` over the network — the browser's real cold path is
 * `WebAssembly.instantiateStreaming(fetch(...))`, which overlaps download with
 * compilation and is dominated by transfer time. The number to carry into the
 * paper from here is `instantiate` (compile + instantiate of a 2.7 MB module),
 * NOT a total that pretends to include a network fetch.
 *
 *   node cold-start.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("@kanzo-tech/rudof-wasm");
const wasmPath = join(dirname(pkgPath), "rudof_wasm_bg.wasm");

const t0 = performance.now();
const bytes = readFileSync(wasmPath);
const t1 = performance.now();
const mod = await import("@kanzo-tech/rudof-wasm");
const t2 = performance.now();
await mod.default({ module_or_path: bytes });
const t3 = performance.now();
const session = new mod.Session();
const t4 = performance.now();
// Touch the session so a lazy-init implementation cannot hide behind the clock.
session.loadShapes(
  "@prefix sh: <http://www.w3.org/ns/shacl#> . <urn:s> a sh:NodeShape .",
  "text/turtle",
);
const t5 = performance.now();

process.stdout.write(
  JSON.stringify({
    readBytes: t1 - t0,
    importGlue: t2 - t1,
    instantiate: t3 - t2,
    newSession: t4 - t3,
    firstParse: t5 - t4,
    toFirstSession: t4 - t0,
    wasmBytes: bytes.byteLength,
  }) + "\n",
);
