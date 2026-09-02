// E5 — validate the staged record graphs with rudof, the engine this project ships.
//
// The engine harness. `validate.py` builds each record's validation graph once,
// serializes it to the stage directory, and this script parses that file. The
// bytes the engine reads are therefore on disk and inspectable, and the parse
// can be accounted for: a validator that discards part of its input and then
// reports conformance is not lenient, it is silent.
//
// rudof is loaded exactly the way the library loads it in production — the
// published `@kanzo-tech/rudof-wasm` package, instantiated headlessly, driven
// through the same `Session` ABI that `src/engine/RudofEngine.ts` programs
// against. No test double, no fork checkout.
//
// Two modes, both driven from a stage directory:
//
//   records  (default)  `keys.json` + `L1.ttl` + `L2.ttl` + one `<key>.ttl` per
//                       record. Emits every validation result, plus the number
//                       of quads rudof's parser actually kept — a validator
//                       that silently drops a triple reports conformance for
//                       the wrong reason, so the parse is accounted separately.
//   cases               `cases.json`: a list of {id, shapes, data} minimal
//                       SHACL cases. Emits each one's verdict. Used for the
//                       spec-conformance probe.
//
// Classification happens in validate.py, so that the triage lives beside the
// counting rather than being re-implemented next to the engine.
//
// Usage: node rudof_validate.mjs <stage-dir> <out.json>

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("@kanzo-tech/rudof-wasm"));
const pkgVersion = JSON.parse(
  readFileSync(join(pkgDir, "package.json"), "utf8"),
).version;

const mod = await import("@kanzo-tech/rudof-wasm");
await mod.default({
  module_or_path: readFileSync(join(pkgDir, "rudof_wasm_bg.wasm")),
});

const [stage, outPath] = process.argv.slice(2);
if (!stage || !outPath) {
  console.error("usage: node rudof_validate.mjs <stage-dir> <out.json>");
  process.exit(2);
}

const RDF_TYPE = {
  termType: "NamedNode",
  value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
};

/** Flatten one rudof result into the shape validate.py classifies on.
 *
 *  Two things are resolved from the live session rather than from the report,
 *  because a blank node has no identity across the engine boundary — each
 *  parser mints its own labels:
 *
 *    * `focus_types` — the focus node's own `rdf:type`, which is what lets the
 *      Python side name the focus class without depending on a blank-node label;
 *    * `focus_out` / `value_out` — how many triples the node has outgoing.
 *      `validate.py` sets aside any result about a node the harvest never
 *      described, and "described" means exactly "has an outgoing triple". For
 *      an IRI the Python side can check that itself; for a blank node only the
 *      engine holding the graph can. */
function outDegree(session, term) {
  if (!term || term.termType === "Literal") return 0;
  return session.quads(term, null, null).length;
}

function flatten(session, r) {
  const types = session
    .quads(r.focusNode, RDF_TYPE, null)
    .map((q) => q.object.value);
  return {
    component: (r.sourceConstraintComponent ?? "").split("#").pop(),
    path: r.path?.value ?? "",
    path_kind: r.path?.termType ?? "",
    focus: { kind: r.focusNode.termType, value: r.focusNode.value },
    focus_types: types,
    focus_out: outDegree(session, r.focusNode),
    value: r.value
      ? {
          kind: r.value.termType,
          value: r.value.value,
          datatype: r.value.datatype ?? null,
          language: r.value.language ?? null,
        }
      : null,
    value_out: outDegree(session, r.value),
    severity: (r.severity ?? "").split("#").pop(),
  };
}

const out = {
  engine: "rudof",
  package: "@kanzo-tech/rudof-wasm",
  version: pkgVersion,
  node: process.version,
};

// ------------------------------------------------------------- cases mode
if (existsSync(join(stage, "cases.json"))) {
  const cases = JSON.parse(readFileSync(join(stage, "cases.json"), "utf8"));
  out.mode = "cases";
  out.cases = {};
  for (const c of cases) {
    const s = new mod.Session();
    const rec = { loaded_quads: null, error: null, results: [] };
    try {
      s.loadShapes(c.shapes, "text/turtle");
      s.loadData(c.data, "text/turtle");
      rec.loaded_quads = s.quads(null, null, null).length;
      const report = s.validate(null);
      rec.conforms = report.conforms;
      rec.results = report.results.map((r) => ({
        component: (r.sourceConstraintComponent ?? "").split("#").pop(),
        path: r.path?.value ?? "",
      }));
    } catch (err) {
      rec.error = String(err?.message ?? err).slice(0, 300);
    }
    out.cases[c.id] = rec;
    try {
      s.free();
    } catch {
      /* already gone */
    }
  }
  writeFileSync(outPath, JSON.stringify(out));
  console.error(`rudof ${out.version}: ${cases.length} probe case(s)`);
} else {
  // ---------------------------------------------------------- records mode
  const keys = JSON.parse(readFileSync(join(stage, "keys.json"), "utf8"));
  const layers = ["L1", "L2"];
  out.mode = "records";
  out.records = {};
  out.errors = {};
  out.timings_ms = {};
  out.loaded_quads = {};

  // One session per layer, shapes parsed once. `newData()` clears the graph
  // between records; the shapes stay loaded. Errors are caught per record and
  // per layer: a record rudof cannot process is a finding, not a reason to stop.
  for (const layer of layers) {
    const shapesTtl = readFileSync(join(stage, `${layer}.ttl`), "utf8");
    let session = new mod.Session();
    session.loadShapes(shapesTtl, "text/turtle");

    let n = 0;
    const t0 = Date.now();
    for (const key of keys) {
      try {
        session.newData();
        session.loadData(
          readFileSync(join(stage, `${key}.ttl`), "utf8"),
          "text/turtle",
        );
        // How many triples survived the parse. validate.py compares this
        // against the triple count of the file it staged: a triple no report
        // can mention is a triple the engine never saw.
        if (layer === "L1") {
          out.loaded_quads[key] = session.quads(null, null, null).length;
        }
        const report = session.validate(null);
        (out.records[key] ??= {})[layer] = report.results.map((r) =>
          flatten(session, r),
        );
      } catch (err) {
        (out.errors[key] ??= {})[layer] = String(err?.message ?? err).slice(0, 400);
        (out.records[key] ??= {})[layer] = null;
        // A throw may have left the session in an indeterminate state; start a
        // fresh one so one bad record cannot contaminate the rest of the run.
        try {
          session.free();
        } catch {
          /* already gone */
        }
        session = new mod.Session();
        session.loadShapes(shapesTtl, "text/turtle");
      }
      if (++n % 50 === 0) console.error(`  rudof ${layer} ${n}/${keys.length}`);
    }
    out.timings_ms[layer] = Date.now() - t0;
    session.free();
  }

  writeFileSync(outPath, JSON.stringify(out));
  console.error(
    `rudof ${out.version}: ${keys.length} records x ${layers.length} layers, ` +
      `${Object.keys(out.errors).length} record(s) with an engine error`,
  );
}
