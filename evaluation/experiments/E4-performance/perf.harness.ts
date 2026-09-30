/**
 * E4 — is per-edit conditional re-evaluation in the browser affordable?
 *
 * Measures the rudof-over-WASM engine end to end, across the same published
 * SHACL profiles E1 vendored, so size scaling is visible rather than a single
 * data point.
 *
 * WHAT THIS IS AND IS NOT
 * -----------------------
 * Everything here runs in **Node + jsdom**, not in a browser. The wasm module is
 * the same artefact a browser would load and V8 is the same engine Chrome runs,
 * so the engine timings transfer with a caveat, not a proof. jsdom has no layout
 * and no paint, so the "keystroke → visibility" figure is *commit → committed
 * DOM mutation*, excluding the browser's style/layout/paint. Both limits are
 * stated in the generated report; do not launder them away.
 *
 * Emits results/perf.json (machine) and results/perf.md (paper, → Tab. 4).
 *
 * Run (with the cold-start and bundle steps):
 *   bash evaluation/experiments/E4-performance/run.sh
 *
 * Or this file alone (cold + bundle numbers then come from a previous run):
 *   npx vitest run --config evaluation/experiments/vitest.config.ts \
 *     E4-performance
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync, brotliCompressSync, constants as zlibConstants } from "node:zlib";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cpus, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { it } from "vitest";
import { render, renderHook, act, waitFor, cleanup } from "@testing-library/react";
import React from "react";
import { createRudofEngine } from "@/engine/index.js";
import { namedNode, literal } from "@/form/factory.js";
import { allFields } from "@/form/FormModel.js";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import type { Term } from "@rdfjs/types";
import { PROFILES as CORPUS, type ProfileSpec } from "../E1-coverage/profiles.js";

const HERE = __dirname;
const REPO = resolve(HERE, "../../..");
const OUT = join(HERE, "results");
const require = createRequire(import.meta.url);

/** Samples per measured operation. Parse is the slowest op, hence fewer reps. */
const N = 50;
const N_PARSE = 30;
const N_EDIT = 30;
const WARMUP = 5;
/** Cold-start child processes. Each one is a fresh V8 isolate. */
const N_COLD = 25;

// ────────────────────────────────────────────────────────────── statistics ──

interface Stats {
  n: number;
  min: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
  /** The very first call of this operation in this process — JIT-cold glue. */
  firstCall?: number;
}

/** Nearest-rank percentile: p(q) = sorted[ceil(q·n) − 1]. No interpolation, so
 *  every reported figure is an observation that actually happened. */
function pct(sorted: number[], q: number): number {
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];
}

function stats(samples: number[], firstCall?: number): Stats {
  const s = [...samples].sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0],
    p50: pct(s, 0.5),
    p95: pct(s, 0.95),
    max: s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / s.length,
    firstCall,
  };
}

/** Time `fn` `reps` times after `WARMUP` untimed calls, keeping the very first
 *  (pre-warmup) call as the JIT-cold sample. */
function bench(fn: () => void, reps: number): Stats {
  const t0 = performance.now();
  fn();
  const firstCall = performance.now() - t0;
  for (let i = 0; i < WARMUP; i++) fn();
  const samples: number[] = [];
  for (let i = 0; i < reps; i++) {
    const a = performance.now();
    fn();
    samples.push(performance.now() - a);
  }
  return stats(samples, firstCall);
}

async function benchAsync(fn: () => Promise<unknown>, reps: number): Promise<Stats> {
  const t0 = performance.now();
  await fn();
  const firstCall = performance.now() - t0;
  for (let i = 0; i < WARMUP; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < reps; i++) {
    const a = performance.now();
    await fn();
    samples.push(performance.now() - a);
  }
  return stats(samples, firstCall);
}

// ───────────────────────────────────────────────────────────────  profiles ──

const HRI = "evaluation/experiments/E1-coverage/data/health-ri/src/Formalisation(shacl)";
const EX = "examples";

/**
 * What E4 needs *beyond* E1's file list to stand a live session up: a pinned root
 * shape and focus node, optional data, and the `sh:if` to drive.
 *
 * E1 says WHICH profiles the corpus contains and which files each one is; this
 * says how to measure one. Keeping them apart is the point — the two experiments
 * now describe the same corpus by construction, and E4 can only ever measure a
 * subset of it, never a different set.
 */
interface Rig {
  /** Data graph to validate/project against; absent => a seeded empty graph. */
  data?: string[];
  /**
   * Pinned rather than inferred, for two reasons: focus inference walks the graph
   * in the engine's quad order, which is not stable across runs; and a profile
   * with several shapes on the same target class would otherwise be measured at
   * whichever one happened to win. Every pin below follows one rule — *the
   * profile's own node shape for a dataset*, the entity the corpus is about — so
   * the timings are comparable across profiles rather than each being the biggest
   * shape someone could find.
   */
  rootShape: string;
  focusNode: string;
  /** `(pathIri, onValue, revealedPathIri)` of a SHACL 1.2 `sh:if` this profile
   *  carries, driving the keystroke -> conditional-visibility measurement. */
  conditional?: { path: string; on: Term; revealed: string };
  note?: string;
}

/** Health-RI's published example records: real `dcat:Dataset` instances, so every
 *  DCAT-family profile can be projected and validated against the same data. */
const DCAT_DATA = [`${HRI}/Core/Example-Data`];
const DCAT_FOCUS = "http://example.com/dataset";

const RIGS: Record<string, Rig> = {
  "health-ri-core": {
    data: DCAT_DATA,
    rootShape: "http://data.health-ri.nl/core/p2/DatasetShape",
    focusNode: DCAT_FOCUS,
    note: "Cross-file sh:node. Data = the profile's own Example-Data.",
  },
  "health-ri-fdp": {
    data: DCAT_DATA,
    rootShape: "http://data.health-ri.nl/core/p2/DatasetShape",
    focusNode: DCAT_FOCUS,
  },
  "health-ri-modules": {
    rootShape: "http://coreRule-healthri.nl#Scan_Shape",
    focusNode: "urn:e4:focus",
    note: "No published example data and no dataset shape - an empty, seeded graph on its one node shape.",
  },
  "dcat-ap-3": {
    data: DCAT_DATA,
    rootShape: "http://data.europa.eu/r5r#Dataset_Shape",
    focusNode: DCAT_FOCUS,
    note: "Upstream SEMIC. Same shape IRI as the vendored copy below, so the pair is a like-for-like drift comparison.",
  },
  "dcat-ap-vendored": {
    data: DCAT_DATA,
    rootShape: "http://data.europa.eu/r5r#Dataset_Shape",
    focusNode: DCAT_FOCUS,
  },
  "dcat-ap-3-generated": {
    data: DCAT_DATA,
    rootShape: "https://semiceu.github.io/DCAT-AP/releases/3.0.1#dcat:DatasetShape",
    focusNode: DCAT_FOCUS,
    note: "The generated encoding of the same release; `shacl:` prefix, every node shape closed.",
  },
  "healthdcat-ap": {
    data: DCAT_DATA,
    rootShape: "http://data.europa.eu/r5r#Dataset_Shape",
    focusNode: DCAT_FOCUS,
    note: "Public tier.",
  },
  "healthdcat-ap-restricted": {
    data: DCAT_DATA,
    rootShape: "http://data.europa.eu/r5r#Dataset_Shape",
    focusNode: DCAT_FOCUS,
    note: "Restricted tier of the same shape IRIs.",
  },
  "dcat-ap-de": {
    data: DCAT_DATA,
    rootShape: "http://dcat-ap.de/def/dcatde/Dataset_Shape",
    focusNode: DCAT_FOCUS,
    note: "The German delta's own dataset shape; the DCAT-AP core it extends is counted under dcat-ap-3, not here.",
  },
  "fair-data-point": {
    data: DCAT_DATA,
    rootShape: "http://fairdatapoint.org/DatasetShape",
    focusNode: DCAT_FOCUS,
  },
  "evidenze-health": {
    data: [`${EX}/evidenze-health/sample.ttl`],
    rootShape: "https://dataspace.evidenze.example/shapes#HealthDatasetOnboardingShape",
    focusNode: "https://data.evidenze.ai/resource/msk-demo/dataset",
    conditional: {
      path: "http://healthdataportal.eu/ns/health#hasStructuredData",
      on: literal("true", namedNode("http://www.w3.org/2001/XMLSchema#boolean")),
      revealed: "http://healthdataportal.eu/ns/health#hasVariables",
    },
  },
  "evidenze-dataspace": {
    data: [`${EX}/evidenze-dataspace/sample.ttl`],
    rootShape: "https://dataspace.evidenze.example/shapes#DatasetOnboardingShape",
    focusNode: "https://dataspace.evidenze.example/dataset/registro-oncologico",
    conditional: {
      path: "http://purl.org/dc/terms/accessRights",
      on: namedNode("http://publications.europa.eu/resource/authority/access-right/RESTRICTED"),
      revealed: "https://dataspace.evidenze.example/ns#accessJustification",
    },
  },
};

/**
 * Corpus profiles E4 measures the PARSE of but cannot stand a session up for,
 * with the reason. Parsing needs only the Turtle, so these still carry their
 * weight in the size-scaling claim — including SPHN, the corpus's largest input
 * by two orders of magnitude. They are listed in the report, not dropped.
 */
const NO_RIG: Record<string, string> = {
  sphn:
    "No dataset-equivalent root shape. 1744 node shapes over 208 target classes, " +
    "none of them a record/dataset the other profiles' focus node is comparable to; " +
    "any pick would be an arbitrary one shape in a thousand, and the timing would " +
    "measure that choice rather than the profile.",
  bioschemas:
    "Not one profile but 32 independent ones in a single file, with no shape that " +
    "contains the others. There is no single form to focus, and every path is an " +
    "sh:alternativePath, which the form layer renders read-only.",
  "spdx-3":
    "Zero sh:targetClass in the whole file (E1 Finding: generated SHACL interleaved " +
    "with OWL). Nothing declares what a focus node would be an instance of, so a " +
    "root shape could only be hand-picked from 64 untargeted node shapes.",
};

/** Every `.ttl` under `abs`, minus any path containing an `exclude` substring —
 *  E1's own filter, honoured here so both experiments read the same bytes. */
function ttlUnder(abs: string, exclude: string[] = []): string[] {
  if (exclude.some((e) => abs.includes(e))) return [];
  if (!statSync(abs).isDirectory()) return [abs];
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const p = join(abs, entry);
    if (statSync(p).isDirectory()) out.push(...ttlUnder(p, exclude));
    else if (p.endsWith(".ttl") && !exclude.some((e) => p.includes(e))) out.push(p);
  }
  return out.sort();
}

function readAll(sources: string[] | undefined, exclude: string[] = []): string {
  if (!sources) return "";
  return sources
    .flatMap((s) => ttlUnder(resolve(REPO, s), exclude))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n\n");
}

// ──────────────────────────────────────────────────────────  environment  ──

const wasmPkgDir = dirname(require.resolve("@kanzo-tech/rudof-wasm"));
const wasmPkg = JSON.parse(readFileSync(join(wasmPkgDir, "package.json"), "utf8"));
const wasmBytes = readFileSync(join(wasmPkgDir, "rudof_wasm_bg.wasm"));
const glueBytes = readFileSync(join(wasmPkgDir, "rudof_wasm.js"));

const gz = (b: Buffer) => gzipSync(b, { level: 9 }).byteLength;
const br = (b: Buffer) =>
  brotliCompressSync(b, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  }).byteLength;

function environment() {
  const c = cpus();
  return {
    os: `${process.platform} ${process.arch}`,
    osRelease: (() => {
      try {
        return execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).trim();
      } catch {
        return require("node:os").release();
      }
    })(),
    cpu: c[0]?.model ?? "unknown",
    cores: c.length,
    memGiB: +(totalmem() / 1024 ** 3).toFixed(1),
    node: process.version,
    v8: process.versions.v8,
    wasmPackage: `${wasmPkg.name}@${wasmPkg.version}`,
    wasmSha256: createHash("sha256").update(wasmBytes).digest("hex"),
    runtime: "node + jsdom (NOT a browser)",
    generated: new Date().toISOString().slice(0, 19) + "Z",
  };
}

// ─────────────────────────────────────────────────────────── measurements ──

/** Parsing needs only the Turtle; everything else needs a live session, so it is
 *  present only for a rigged profile. */
interface OpTable {
  loadShapes: Stats;
  projectForm?: Stats;
  projectTree?: Stats;
  validateFull?: Stats;
  validateTree?: Stats;
  serializeTurtle?: Stats;
}

interface ProfileResult {
  id: string;
  label: string;
  origin: "external" | "ours";
  note?: string;
  variantOf?: string;
  shapeFiles: number;
  shapeBytes: number;
  shapeLines: number;
  nodeShapes: number;
  propertyShapes: number;
  conditionals: number;
  /** Absent when the profile has no rig — see `NO_RIG`, reported verbatim. */
  unrigged?: string;
  dataBytes?: number;
  dataTriples?: number;
  rootShapeId?: string;
  treeNodes?: number;
  validationResults?: number;
  ops: OpTable;
}

/**
 * Measure one corpus profile. Parse and the shape statistics are measured for
 * every profile — they need only the Turtle. The session-dependent operations
 * need a pinned root shape, so an unrigged profile gets its `NO_RIG` reason
 * carried into the report instead of being dropped from the corpus.
 */
async function measureProfile(spec: ProfileSpec, rig: Rig | undefined): Promise<ProfileResult> {
  const shapeFiles = spec.sources.flatMap((src) => ttlUnder(resolve(REPO, src), spec.exclude ?? []));
  const shapesTtl = readAll(spec.sources, spec.exclude);

  const engine = createRudofEngine();
  await engine.ready();
  const shapes = await engine.loadShapes(shapesTtl);

  let propertyShapes = 0;
  let conditionals = 0;
  for (const ns of shapes.nodeShapes.values()) {
    propertyShapes += ns.properties.length;
    conditionals += ns.conditionals?.length ?? 0;
  }

  // A fresh engine per parse sample would also pay `newSession`; parsing into the
  // live session is what `useMetadataForm` actually does on a shapes change.
  const parseEngine = createRudofEngine();
  await parseEngine.ready();

  const base: ProfileResult = {
    id: spec.id,
    label: spec.label,
    origin: spec.origin,
    note: rig?.note ?? spec.note,
    variantOf: spec.variantOf,
    shapeFiles: shapeFiles.length,
    shapeBytes: Buffer.byteLength(shapesTtl),
    shapeLines: shapesTtl.split("\n").length,
    nodeShapes: shapes.nodeShapes.size,
    propertyShapes,
    conditionals,
    ops: { loadShapes: await benchAsync(() => parseEngine.loadShapes(shapesTtl), N_PARSE) },
  };

  if (!rig) return { ...base, unrigged: NO_RIG[spec.id] ?? "No measurement rig defined." };

  const dataTtl = readAll(rig.data);
  const session = await engine.createGraph(
    shapes,
    dataTtl || undefined,
    undefined,
    namedNode(rig.focusNode),
    namedNode(rig.rootShape) as never,
  );
  const focus = session.focusNode;
  const rootShapeId = session.rootShapeId;
  const tree = engine.projectValues(shapes, focus, rootShapeId);
  const validation = await engine.validate();

  return {
    ...base,
    dataBytes: Buffer.byteLength(dataTtl),
    dataTriples: session.backend.match(null, null, null).length,
    rootShapeId,
    treeNodes: tree.nodes.length,
    validationResults: validation.length,
    ops: {
      ...base.ops,
      projectForm: bench(() => void engine.projectFormSync(focus, rootShapeId), N),
      projectTree: bench(() => void engine.projectValues(shapes, focus, rootShapeId), N),
      validateFull: await benchAsync(() => engine.validate(), N),
      validateTree: await benchAsync(() => engine.validateTree(tree.nodes), N),
      serializeTurtle: await benchAsync(() => engine.serializeFocus(focus, "text/turtle"), N),
    },
  };
}

// ───────────────────────────────  keystroke → conditional visibility (React) ──

interface EditResult {
  id: string;
  label: string;
  revealed: string;
  /** Graph commit → new FormModel with the conditional field added/removed. */
  commitToModel: Stats;
  /** Same, with the whole <MetadataForm> tree mounted: commit → DOM mutated. */
  commitToDom: Stats;
  /** Debounce the text widgets add before the commit above even starts. */
  textCommitDebounceMs: number;
  fieldsRendered: number;
}

/**
 * Drive one profile's `sh:if` on and off, N times, through the real React path.
 *
 * The conditional is toggled by writing the *committed* value into the graph, the
 * way a discrete widget (select / switch / date) does — those commit on change
 * with no debounce, which is exactly the widget kind a `sh:if` keys off. Free-text
 * widgets debounce 250 ms first; that constant is reported alongside rather than
 * folded into the measurement, because it is a deliberate design choice and not a
 * cost of the engine.
 */
/**
 * Drain React's pending passive effects.
 *
 * `waitFor(ready)` can resolve between the commit that produced the model and the
 * passive-effect flush that runs `useSyncExternalStore`'s `subscribe`. Editing the
 * graph in that window bumps a store nobody is listening to yet: the mutation
 * lands, no re-render is scheduled, and the model silently goes stale. That was an
 * intermittent failure of this harness before this call existed — keep it.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function measureEdits(
  spec: ProfileSpec,
  rig: Rig,
  shapesTtl: string,
  dataTtl: string,
): Promise<EditResult> {
  const cond = rig.conditional!;
  const path = namedNode(cond.path);
  // Each profile starts from an empty document and no mounted React root, so one
  // profile's trees cannot influence the next one's render scheduling.
  cleanup();

  // ── (a) commit → model, through the hook alone.
  const engineA = createRudofEngine();
  const hook = renderHook(() =>
    useMetadataForm({
      shapes: shapesTtl,
      data: dataTtl || undefined,
      engine: engineA,
      rootShape: rig.rootShape,
      focusNode: rig.focusNode,
      locale: "es",
      validateOn: "off",
    }),
  );
  await waitFor(() => {
    if (!hook.result.current.ready) throw new Error("not ready");
  }, { timeout: 30_000 });
  await settle();

  const visible = (): boolean => {
    const m = hook.result.current.model;
    return !!m && allFields(m).some((f) => f.path.value === cond.revealed);
  };
  const graphA = hook.result.current.graph!;
  const focusA = hook.result.current.model!.focusNode;
  // `setValues` replaces the predicate's whole value list — the commit a discrete
  // widget makes, and independent of what the graph happened to hold, so the flip
  // does not depend on reading the current value back first.
  const flip = (on: boolean) => {
    act(() => {
      graphA.setValues(focusA, path, on ? [cond.on] : []);
    });
  };

  // Warm up both directions, then assert the flip actually flips.
  flip(true);
  const onVisible = visible();
  flip(false);
  const offVisible = visible();
  if (!onVisible || offVisible) {
    throw new Error(
      `[E4] ${spec.id}: sh:if did not toggle ${cond.revealed} (on=${onVisible}, off=${offVisible}). ` +
        "The measurement would be meaningless — fix the spec, do not report it.",
    );
  }
  // End the warm-up OFF so the first timed flip is a real state change
  // (`setValues` is a no-op, and would time as ~0 ms, if the value is unchanged).
  for (let i = 0; i < WARMUP; i++) flip(i % 2 === 1);

  const modelSamples: number[] = [];
  for (let i = 0; i < N_EDIT; i++) {
    const on = i % 2 === 0;
    const t = performance.now();
    flip(on);
    modelSamples.push(performance.now() - t);
    // Self-validating: a sample only counts if the flip actually re-shaped the form.
    if (visible() !== on) {
      throw new Error(`[E4] ${spec.id}: model flip ${i} (on=${on}) did not take effect.`);
    }
  }
  hook.unmount();
  cleanup();

  // ── (b) commit → DOM, with the full component tree mounted.
  let controller: ReturnType<typeof useMetadataForm> | undefined;
  const engineB = createRudofEngine();
  function Harnessed() {
    const form = useMetadataForm({
      shapes: shapesTtl,
      data: dataTtl || undefined,
      engine: engineB,
      rootShape: rig.rootShape,
      focusNode: rig.focusNode,
      locale: "es",
      validateOn: "off",
    });
    controller = form;
    return React.createElement(MetadataForm, { form });
  }
  render(React.createElement(Harnessed));
  await waitFor(() => {
    if (!controller?.ready) throw new Error("not ready");
  }, { timeout: 30_000 });
  await settle();

  const graphB = controller!.graph!;
  const focusB = controller!.model!.focusNode;
  const domVisible = () => {
    const field = allFields(controller!.model!).find((f) => f.path.value === cond.revealed);
    return !!field && !!document.querySelector(`[data-field="${CSS.escape(field.id)}"]`);
  };
  const flipB = (on: boolean) => {
    act(() => {
      graphB.setValues(focusB, path, on ? [cond.on] : []);
    });
  };

  flipB(true);
  const domOn = domVisible();
  flipB(false);
  const domOff = domVisible();
  if (!domOn || domOff) {
    const subjects = graphB.allQuads().filter((q) => q.predicate.equals(path)).map((q) => `${q.subject.value} → ${q.object.value}`);
    throw new Error(
      `[E4] ${spec.id}: the conditional field did not appear/disappear in the DOM ` +
        `(on=${domOn}, off=${domOff}). focus=${focusB.value} path=${cond.path} ` +
        `quads=[${subjects.join("; ")}] modelHas=${allFields(controller!.model!).some((f) => f.path.value === cond.revealed)}`,
    );
  }
  for (let i = 0; i < WARMUP; i++) flipB(i % 2 === 1);

  const domSamples: number[] = [];
  for (let i = 0; i < N_EDIT; i++) {
    const on = i % 2 === 0;
    const t = performance.now();
    flipB(on);
    domSamples.push(performance.now() - t);
    if (domVisible() !== on) {
      throw new Error(`[E4] ${spec.id}: DOM flip ${i} (on=${on}) did not take effect.`);
    }
  }
  const fieldsRendered = document.querySelectorAll("[data-field]").length;
  cleanup();

  return {
    id: spec.id,
    label: spec.label,
    revealed: cond.revealed,
    commitToModel: stats(modelSamples),
    commitToDom: stats(domSamples),
    textCommitDebounceMs: 250,
    fieldsRendered,
  };
}

// ──────────────────────────────────────────────────────────────  cold start ──

interface ColdResult {
  n: number;
  readBytes: Stats;
  importGlue: Stats;
  instantiate: Stats;
  newSession: Stats;
  toFirstSession: Stats;
}

function measureColdStart(): ColdResult {
  const samples: Record<string, number>[] = [];
  for (let i = 0; i < N_COLD; i++) {
    const out = execFileSync(process.execPath, [join(HERE, "cold-start.mjs")], {
      encoding: "utf8",
      cwd: HERE,
    });
    samples.push(JSON.parse(out.trim()));
  }
  const col = (k: string) => stats(samples.map((s) => s[k]));
  return {
    n: N_COLD,
    readBytes: col("readBytes"),
    importGlue: col("importGlue"),
    instantiate: col("instantiate"),
    newSession: col("newSession"),
    toFirstSession: col("toFirstSession"),
  };
}

// ─────────────────────────────────────────────────────────────────  report ──

const ms = (x: number) =>
  x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x.toFixed(3);
const kb = (b: number) => `${(b / 1024).toFixed(1)} kB`;
const cell = (s: Stats | undefined) => (s ? `${ms(s.p50)} / ${ms(s.p95)}` : "—");

function markdown(
  env: ReturnType<typeof environment>,
  profiles: ProfileResult[],
  edits: EditResult[],
  cold: ColdResult,
  sizes: Record<string, number>,
  bundle: Record<string, unknown> | null,
): string {
  const L: string[] = [];
  const primary = profiles.filter((p) => !p.variantOf);
  const variants = profiles.filter((p) => p.variantOf);

  L.push("# E4 — performance of per-edit conditional re-evaluation", "");
  L.push(`Generated ${env.generated} by \`perf.harness.ts\`. Do not edit by hand.`, "");
  L.push("Every cell is **median / p95** over the stated sample count, nearest-rank");
  L.push("(no interpolation), so each figure is an observation that happened.", "");

  const biggest = primary.reduce((a, b) => (a.propertyShapes > b.propertyShapes ? a : b));
  const edited = edits.map((e) => e.commitToModel.p95);
  /** Profiles a live session was stood up for — the only ones with graph timings. */
  const rigged = primary.filter((p) => !p.unrigged);
  const projectP95 = rigged.map((p) => p.ops.projectTree!.p95);
  const validateP95 = rigged.map((p) => p.ops.validateFull!.p95);
  L.push("## Headline", "");
  L.push(`- **Per-edit re-evaluation is sub-frame.** Re-projecting the whole form tree from`);
  L.push(`  the graph — the wasm call that re-evaluates every \`sh:if\` — costs`);
  L.push(`  ${ms(Math.min(...projectP95))}–${ms(Math.max(...projectP95))} ms at p95 across ${rigged.length} published profiles, and a committed`);
  L.push(`  edit reaches a new \`FormModel\` with updated conditional visibility in`);
  L.push(`  ${ms(Math.min(...edited))}–${ms(Math.max(...edited))} ms at p95. A 60 Hz frame is 16.7 ms.`);
  const smallest = primary.reduce((a, b) => (a.shapeBytes < b.shapeBytes ? a : b));
  L.push(`- **Parsing is the one-off cost, and it is the one that scales badly.** It`);
  L.push(`  spans ${ms(smallest.ops.loadShapes.p50)} ms for ${smallest.label} (${(smallest.shapeBytes / 1024).toFixed(1)} kB) to`);
  L.push(`  **${ms(biggest.ops.loadShapes.p50)} ms** for ${biggest.label}`);
  L.push(`  (${biggest.propertyShapes} property shapes, ${(biggest.shapeBytes / 1024).toFixed(0)} kB of Turtle) — and it grows faster than`);
  L.push(`  input size, not with it (see Tab. 4). Instantiating the module adds a flat`);
  L.push(`  ${ms(cold.instantiate.p50)} ms. This is a load-time cost, paid once and never per edit, but at the`);
  L.push("  top of the corpus it is seconds, not milliseconds, and a profile of that size");
  L.push("  needs the shapes parsed off the interaction path (a worker, or a cached IR)");
  L.push("  rather than in front of the user. The earlier Health-RI-only corpus topped out");
  L.push("  at 83 kB and did not show this at all.");
  L.push(`- **Validation is off the visibility path.** \`validate()\` is ${ms(Math.max(...validateP95))} ms at worst`);
  L.push("  here, and runs after the edit is drawn (a deferred render), so it never gates a field appearing.");
  L.push(`- **The payload is the weak point.** ${kb(sizes.wasmBrotli)} of brotli-compressed wasm plus`);
  L.push(`  ${bundle ? kb((bundle as { withLib: { jsBrotli: number } }).withLib.jsBrotli - (bundle as { baseline: { jsBrotli: number } }).baseline.jsBrotli) : "the library's JS"} of JS. That is the honest cost of putting a SHACL engine in`);
  L.push("  the browser, and it is a first-load cost, not a per-edit one.");
  L.push("");
  L.push("## What was measured, and where", "");
  L.push("| | |");
  L.push("|---|---|");
  L.push(`| Machine | ${env.cpu}, ${env.cores} cores, ${env.memGiB} GiB |`);
  L.push(`| OS | macOS ${env.osRelease} (${env.os}) |`);
  L.push(`| Runtime | Node ${env.node} (V8 ${env.v8}) |`);
  L.push(`| DOM | jsdom, via vitest — **not a browser** |`);
  L.push(`| Engine | \`${env.wasmPackage}\` |`);
  L.push(`| \`.wasm\` sha256 | \`${env.wasmSha256.slice(0, 16)}…\` |`);
  L.push("");
  L.push("> **Node-only, not a browser measurement.** V8 is the engine Chrome runs and");
  L.push("> the `.wasm` is byte-identical to the one a browser would fetch, so the engine");
  L.push("> timings are indicative of a Chromium desktop browser — but they are not a");
  L.push("> browser measurement, and Firefox (SpiderMonkey) and Safari (JavaScriptCore)");
  L.push("> are not represented at all. jsdom performs no style resolution, layout or");
  L.push("> paint, so the end-to-end figure below stops at the committed DOM mutation.");
  L.push("> See “Not measured” at the foot of this file.", "");

  L.push("## The corpus — the same list E1 measures", "");
  L.push("The profiles below are `E1-coverage/profiles.ts`, imported. E4 does not keep");
  L.push("its own list, so the two experiments' tables describe the same corpus by");
  L.push("construction and Tab. 4 can be read against E1's coverage table row for row.");
  L.push("What E4 adds per profile is a *rig*: a pinned root shape and focus node, and");
  L.push("data to project against. Parsing needs neither, so **every** profile is parsed");
  L.push("and sized here — including the ones no session could be stood up for.", "");
  L.push("| Profile | Origin | In E1 as | Measured |");
  L.push("|---|---|---|---|");
  for (const p of profiles) {
    const how = p.unrigged ? "parse + shape counts only" : "parse + full engine ops";
    L.push(`| ${p.label} | ${p.origin} | ${p.variantOf ? "variant of `" + p.variantOf + "`" : "primary"} | ${how} |`);
  }
  L.push("");
  const unrigged = profiles.filter((p) => p.unrigged);
  if (unrigged.length) {
    L.push(`### Why ${unrigged.length} of the ${profiles.length} carry no session timings`, "");
    L.push("Stated rather than skipped. Each needs a root shape to attach a focus node to,");
    L.push("and for each one, picking that shape would be a choice the timing then measures");
    L.push("instead of the profile:", "");
    for (const p of unrigged) L.push(`- **${p.label}** — ${p.unrigged}`);
    L.push("");
    L.push("Their parse timings and shape counts are in Tab. 4 and are directly comparable;");
    L.push("only the `projectForm` / `projectValues` / `validate` columns read “—”.", "");
  }

  L.push("## Tab. 4 — engine cost by profile size (ms, median / p95)", "");
  L.push("| Profile | Shapes (kB / lines) | Node shapes | Prop. shapes | Data triples | Parse | `projectForm` | `projectValues` (tree) | `validate()` | `validateTree` |");
  L.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const p of primary) {
    L.push(
      `| ${p.label} | ${(p.shapeBytes / 1024).toFixed(1)} / ${p.shapeLines} | ${p.nodeShapes} | ${p.propertyShapes} | ${p.dataTriples ?? "—"} | ${cell(p.ops.loadShapes)} | ${cell(p.ops.projectForm)} | ${cell(p.ops.projectTree)} | ${cell(p.ops.validateFull)} | ${cell(p.ops.validateTree)} |`,
    );
  }
  L.push("");
  L.push("A “—” means no live session was stood up for that profile — see the corpus");
  L.push("table above for why; it never means the operation was slow or failed.", "");
  L.push("**Parse does not scale linearly.** Across the corpus, roughly a 4× larger");
  L.push("shapes document costs 5–6× the parse, so the cost per kB rises with size:");
  L.push("the smallest profiles parse at well under 1 ms/kB and the largest at ~16 ms/kB.");
  L.push("Every other operation is projection- and instance-bound, not document-bound,");
  L.push("and stays sub-frame even on the largest profile a session could be stood up for.", "");
  L.push(`Samples: parse n=${N_PARSE}, everything else n=${N}, after ${WARMUP} warm-up calls.`);
  L.push("All figures are **warm**: the process has already instantiated the module and");
  L.push("V8 has JIT-compiled the wasm↔JS glue. The first call of each operation in a");
  L.push("fresh process is reported separately below.", "");

  L.push("### Warm vs. JIT-cold first call (ms)", "");
  L.push("| Profile | Parse warm p50 | Parse 1st call | `validate()` warm p50 | `validate()` 1st call |");
  L.push("|---|---:|---:|---:|---:|");
  for (const p of primary) {
    const v = p.ops.validateFull;
    L.push(
      `| ${p.label} | ${ms(p.ops.loadShapes.p50)} | ${ms(p.ops.loadShapes.firstCall ?? NaN)} | ${v ? ms(v.p50) : "—"} | ${v?.firstCall !== undefined ? ms(v.firstCall) : "—"} |`,
    );
  }
  L.push("");

  L.push("## Cold start — module instantiate (ms, median / p95)", "");
  L.push(`One fresh Node process per sample, n=${cold.n}.`, "");
  L.push("| Stage | median | p95 |");
  L.push("|---|---:|---:|");
  L.push(`| Read 2.6 MB \`.wasm\` from disk (stands in for \`fetch\`) | ${ms(cold.readBytes.p50)} | ${ms(cold.readBytes.p95)} |`);
  L.push(`| \`import\` the wasm-bindgen glue | ${ms(cold.importGlue.p50)} | ${ms(cold.importGlue.p95)} |`);
  L.push(`| **compile + instantiate** | **${ms(cold.instantiate.p50)}** | **${ms(cold.instantiate.p95)}** |`);
  L.push(`| \`new Session()\` | ${ms(cold.newSession.p50)} | ${ms(cold.newSession.p95)} |`);
  L.push(`| total, bytes in hand → usable session | ${ms(cold.toFirstSession.p50)} | ${ms(cold.toFirstSession.p95)} |`);
  L.push("");
  L.push("**The fetch is not in these numbers.** A disk read is not a network round trip;");
  L.push("a browser's real cold path is `WebAssembly.instantiateStreaming(fetch(…))`,");
  L.push("which overlaps transfer with compilation and is dominated by transfer. Take the");
  L.push("compile+instantiate row as the engine's own cost and add your own transfer");
  L.push(`estimate for ${kb(sizes.wasmBrotli)} over the wire.`, "");

  L.push("## End-to-end: edit → updated conditional visibility (ms, median / p95)", "");
  L.push("| Profile | Fields rendered | commit → new `FormModel` | commit → DOM mutated |");
  L.push("|---|---:|---:|---:|");
  for (const e of edits) {
    L.push(`| ${e.label} | ${e.fieldsRendered} | ${cell(e.commitToModel)} | ${cell(e.commitToDom)} |`);
  }
  L.push("");
  L.push(`n=${N_EDIT} flips per profile (alternating on/off), after ${WARMUP} warm-up flips.`);
  L.push("Each flip writes the committed value into the graph the way a discrete widget");
  L.push("(select, switch, date) does, then the whole chain runs synchronously inside");
  L.push("React's `act()`: wasm graph mutation → version bump → `projectValues` over the");
  L.push("full tree (re-entering wasm once per tree node, `sh:if` re-evaluated) →");
  L.push("`buildFormModel` → React re-render → the revealed field enters or leaves the DOM.");
  L.push("The measurement is asserted, not assumed: a run in which the field fails to");
  L.push("appear and disappear aborts the harness.", "");
  L.push("**Read the two columns differently.** `commit → new FormModel` is the engine and");
  L.push("model work — a wasm re-projection of the tree plus `buildFormModel` plus React");
  L.push("state — and transfers to a browser reasonably well. `commit → DOM mutated` adds");
  L.push("React's render of the whole field tree into **jsdom**, whose DOM is a JavaScript");
  L.push("object graph and is materially slower than a browser's native DOM for the same");
  L.push("mutations; at the same time it does no style resolution, layout or paint, which a");
  L.push("browser must do. It is therefore neither an upper nor a lower bound on browser");
  L.push("latency — it is a different quantity, and the paper should quote the first column");
  L.push("for the engine claim rather than the second.", "");
  L.push("Two deliberate delays sit *outside* this number and are not engine cost:", "");
  L.push(`- free-text widgets buffer keystrokes locally and commit after **${edits[0]?.textCommitDebounceMs ?? 250} ms**`);
  L.push("  (`useCommit` in `defaultWidgets.tsx`), so typing is never blocked by the engine.");
  L.push("  Discrete widgets — the kind a `sh:if` keys off — commit immediately, with no debounce.");
  L.push("- validation runs in the render React defers behind the edit (`useDeferredValue`),");
  L.push("  with no timer, so it never sits on the visibility path at all.", "");
  L.push("So a user typing into a text field sees their character echoed immediately, the");
  L.push("form re-shape ~250 ms after they stop, and errors as soon as React has drawn it. A user");
  L.push("picking from a select sees the form re-shape within the figure above.", "");

  L.push("## Payload", "");
  L.push("| Artefact | Raw | gzip -9 | brotli -11 |");
  L.push("|---|---:|---:|---:|");
  L.push(`| \`rudof_wasm_bg.wasm\` | ${kb(sizes.wasmRaw)} | ${kb(sizes.wasmGzip)} | ${kb(sizes.wasmBrotli)} |`);
  L.push(`| wasm-bindgen glue \`rudof_wasm.js\` | ${kb(sizes.glueRaw)} | ${kb(sizes.glueGzip)} | ${kb(sizes.glueBrotli)} |`);
  if (bundle) {
    type Totals = { js: number; jsGzip: number; jsBrotli: number; css: number; cssGzip: number; wasm: number };
    const b = bundle as {
      baseline: Totals;
      engineOnly: Totals;
      withLib: Totals;
      vite: string;
      react: string;
    };
    L.push(`| App JS, baseline (React ${b.react} + ReactDOM only) | ${kb(b.baseline.js)} | ${kb(b.baseline.jsGzip)} | ${kb(b.baseline.jsBrotli)} |`);
    L.push(`| App JS, + \`metadata-form/rudof\` (engine seam only) | ${kb(b.engineOnly.js)} | ${kb(b.engineOnly.jsGzip)} | ${kb(b.engineOnly.jsBrotli)} |`);
    L.push(`| App JS, + \`metadata-form\` (hook + \`<MetadataForm>\`) | ${kb(b.withLib.js)} | ${kb(b.withLib.jsGzip)} | ${kb(b.withLib.jsBrotli)} |`);
    L.push(`| — of which the engine seam | ${kb(b.engineOnly.js - b.baseline.js)} | ${kb(b.engineOnly.jsGzip - b.baseline.jsGzip)} | ${kb(b.engineOnly.jsBrotli - b.baseline.jsBrotli)} |`);
    L.push(`| **JS delta the full library adds** | **${kb(b.withLib.js - b.baseline.js)}** | **${kb(b.withLib.jsGzip - b.baseline.jsGzip)}** | **${kb(b.withLib.jsBrotli - b.baseline.jsBrotli)}** |`);
    L.push(`| App CSS added by the library | ${kb(b.withLib.css)} | ${kb(b.withLib.cssGzip)} | — |`);
    L.push("");
    L.push(`Three real production builds of the same minimal React app (Vite ${b.vite},`);
    L.push("`bundle-delta.mjs`), differing only in how much of the library they import. The");
    L.push("delta includes everything the library drags in that the app did not already");
    L.push("have — but **not** React, which every build pays for, and **not** the `.wasm`,");
    L.push("which is emitted as a separate on-demand asset and is listed on its own row above.", "");
    L.push("The split matters for the paper's claim. The **engine seam** — the wasm-bindgen");
    L.push("glue, the `RudofEngine` wrapper, the shape IR and projection — is");
    L.push(`${kb(b.engineOnly.jsGzip - b.baseline.jsGzip)} gzipped. Everything above that is the form UI and the design`);
    L.push("system it is built on, which an adopter with their own components does not have");
    L.push("to take: the argument for browser-native SHACL does not rest on the larger number.");
  } else {
    L.push("");
    L.push("_Bundle delta not present — run `bundle-delta.mjs` (or `run.sh`) to regenerate._");
  }
  L.push("");

  L.push("## Per-profile detail", "");
  for (const p of profiles) {
    L.push(`### ${p.label}${p.variantOf ? " *(variant of " + p.variantOf + " — excluded from the headline)*" : ""}`, "");
    if (p.note) L.push(`> ${p.note}`, "");
    L.push(`- ${p.shapeFiles} shape file(s), ${p.shapeBytes} B, ${p.shapeLines} lines`);
    L.push(`- ${p.nodeShapes} node shapes, ${p.propertyShapes} property shapes, ${p.conditionals} \`sh:if\` conditional(s)`);
    if (p.unrigged) {
      L.push(`- **parse only — no live session was stood up.** ${p.unrigged}`);
    } else {
      L.push(`- root shape pinned: \`${p.rootShapeId}\``);
      L.push(`- projected tree: ${p.treeNodes} node(s) — \`validateTree\` re-enters wasm once per node`);
      L.push(`- data graph: ${p.dataBytes} B, ${p.dataTriples} triples; \`validate()\` returned ${p.validationResults} result(s)`);
    }
    L.push("");
    L.push("| Operation | n | min | p50 | p95 | max | 1st call |");
    L.push("|---|---:|---:|---:|---:|---:|---:|");
    for (const [k, s] of Object.entries(p.ops) as [string, Stats | undefined][]) {
      if (!s) continue;
      L.push(`| \`${k}\` | ${s.n} | ${ms(s.min)} | ${ms(s.p50)} | ${ms(s.p95)} | ${ms(s.max)} | ${s.firstCall !== undefined ? ms(s.firstCall) : "—"} |`);
    }
    L.push("");
  }
  if (variants.length) {
    L.push(`(${variants.length} variant profile${variants.length === 1 ? " above is" : "s above are"} reported in full but kept out of`);
    L.push("the headline table. Which profiles are variants, and why, is E1's judgement —");
    L.push("carried here with the corpus rather than decided again.)", "");
  }

  L.push("## Not measured — gaps, stated rather than omitted", "");
  L.push("1. **No browser.** Everything is Node + jsdom. No Chrome, Firefox or Safari");
  L.push("   number appears here. The paper may say the engine cost is *indicative of* a");
  L.push("   Chromium desktop browser (same V8, same `.wasm`); it may not say it was");
  L.push("   measured in one.");
  L.push("2. **No mid-range mobile device.** The spec asks for one; this harness cannot");
  L.push("   produce it. Mobile matters most exactly where this design is weakest —");
  L.push("   wasm compilation and single-core throughput are several times slower on a");
  L.push("   mid-range phone, and the 2.6 MB module is a real cost on a cellular link.");
  L.push("   Treat every timing here as a floor: a phone will be slower, plausibly by a");
  L.push("   multiple, and this experiment says nothing about how large that multiple is.");
  L.push("3. **No network fetch.** The cold-start table reads the module from local disk.");
  L.push("   Transfer time for the compressed module over a real connection is not in any");
  L.push("   figure, and on a slow link it would dominate the cold start entirely.");
  L.push("4. **No style, layout or paint.** jsdom stops at the committed DOM mutation, so");
  L.push("   the user-perceived latency of a field appearing is not measured. jsdom's DOM");
  L.push("   is also slower than a browser's for the mutations it does perform, so the");
  L.push("   `commit → DOM` column errs in both directions at once and is not a browser");
  L.push("   latency estimate — see the note beside that table.");
  L.push("5. **No real keystroke.** The end-to-end figure starts at the committed value,");
  L.push("   not at `keydown`. Input event dispatch and the widget's own local echo are");
  L.push("   excluded; the 250 ms text-commit debounce is reported as a constant, not");
  L.push("   measured.");
  L.push("6. **No memory figure.** Peak wasm heap per session is not measured, and a");
  L.push("   long editing session's memory behaviour is unknown.");
  L.push("7. **The large parse-only profiles are not stable to a single figure.** Across");
  L.push("   repeat runs on the same idle machine, the SPHN and Bioschemas parse *medians*");
  L.push("   moved by up to 4× (Bioschemas: 2.5 s, 2.5 s, 9.6 s), and SPHN's p95 ranged");
  L.push("   from 16 s to 66 s against a median that stayed near 15 s. The small and");
  L.push("   mid-sized profiles repeat to within a few percent. Read the top two rows of");
  L.push("   Tab. 4 as an order of magnitude — seconds, not milliseconds — and not as a");
  L.push("   figure to quote to three digits. Why parse variance grows this sharply with");
  L.push("   input size is not established here; wasm heap growth is the obvious suspect");
  L.push("   and is not measured (see 6).");
  L.push("8. **One machine, one run, and the machine must be idle.** No cross-machine");
  L.push("   variance and no thermal control. This matters more than it sounds: running");
  L.push("   the harness on a loaded machine inflated p95 by up to 3× in our own repeats,");
  L.push("   while the medians moved much less. Regenerate on a quiet machine, and read");
  L.push("   the p95 column as \"p95 under these conditions\", not as a worst case.");
  L.push("");

  return L.join("\n");
}

// ────────────────────────────────────────────────────────────────────  run ──

it("E4: measure engine + per-edit cost across the E1 profiles", async () => {
  const env = environment();

  // The corpus is E1's list, in E1's order — not a second copy of it.
  const profiles: ProfileResult[] = [];
  for (const spec of CORPUS) {
    console.log(`[E4] engine: ${spec.id}${RIGS[spec.id] ? "" : " (parse only)"}…`);
    profiles.push(await measureProfile(spec, RIGS[spec.id]));
  }

  const edits: EditResult[] = [];
  for (const spec of CORPUS) {
    const rig = RIGS[spec.id];
    if (!rig?.conditional) continue;
    console.log(`[E4] edits: ${spec.id}…`);
    edits.push(await measureEdits(spec, rig, readAll(spec.sources, spec.exclude), readAll(rig.data)));
  }

  console.log(`[E4] cold start × ${N_COLD} child processes…`);
  const cold = measureColdStart();

  const sizes = {
    wasmRaw: wasmBytes.byteLength,
    wasmGzip: gz(wasmBytes),
    wasmBrotli: br(wasmBytes),
    glueRaw: glueBytes.byteLength,
    glueGzip: gz(glueBytes),
    glueBrotli: br(glueBytes),
  };

  const bundlePath = join(OUT, "bundle.json");
  const bundle = existsSync(bundlePath)
    ? (JSON.parse(readFileSync(bundlePath, "utf8")) as Record<string, unknown>)
    : null;
  if (!bundle) {
    console.warn("[E4] results/bundle.json missing — run bundle-delta.mjs for the JS delta.");
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, "perf.json"),
    JSON.stringify(
      { env, config: { N, N_PARSE, N_EDIT, N_COLD, WARMUP }, sizes, cold, profiles, edits, bundle },
      null,
      2,
    ),
  );
  writeFileSync(join(OUT, "perf.md"), markdown(env, profiles, edits, cold, sizes, bundle));
  console.log(`[E4] wrote ${join(OUT, "perf.md")}`);
});
