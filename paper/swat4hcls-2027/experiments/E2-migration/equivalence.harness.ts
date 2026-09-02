/**
 * E2 — the behavioural-equivalence run.
 *
 * Eleven data graphs × five encodings of one conditional requirement, validated
 * by the engine this paper is about and the one that drives the form: rudof,
 * compiled to WebAssembly (`@kanzo-tech/rudof-wasm`).
 *
 * This is the only SHACL implementation in the experiment. The claim it
 * supports is therefore "rudof accepts and rejects the same data under both
 * encodings" — a demonstration in the engine that matters, not a cross-
 * validated proof. §7 of results/migration.md states what that costs.
 *
 * Emits results/equivalence-rudof.json.
 *
 * Run:
 *   npx vitest run --config paper/swat4hcls-2027/experiments/vitest.config.ts \
 *     paper/swat4hcls-2027/experiments/E2-migration/equivalence.harness.ts
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { it } from "vitest";
import { createRudofEngine } from "@/engine/index.js";
import type { ValidationResult } from "@/form/validation.js";

const HERE = __dirname;
const BEFORE = join(HERE, "data", "before");
const AFTER = join(HERE, "data", "after");
const CASES = join(HERE, "data", "cases");
const RESULTS = join(HERE, "results");

const DPV = "https://w3id.org/dpv#";
const CONDITIONAL_PATHS = new Set([`${DPV}hasLegalBasis`, `${DPV}hasPurpose`]);

const ttl = (p: string) => readFileSync(p, "utf8");

/** The verbatim published Health-RI Core shapes, concatenated into one graph. */
const coreFiles = readdirSync(join(BEFORE, "health-ri-core"))
  .filter((f) => f.endsWith(".ttl"))
  .sort();
const core = coreFiles.map((f) => ttl(join(BEFORE, "health-ri-core", f))).join("\n");

const ENCODINGS: { id: string; overlay: string }[] = [
  { id: "shipped", overlay: join(BEFORE, "overlay-00-shipped.ttl") },
  { id: "partition-subjectsof", overlay: join(BEFORE, "overlay-01-partition-subjectsof.ttl") },
  { id: "partition-sparql", overlay: join(BEFORE, "overlay-02-partition-sparql.ttl") },
  { id: "implication", overlay: join(BEFORE, "overlay-03-implication.ttl") },
  { id: "shacl12-if", overlay: join(AFTER, "overlay-04-shacl12-if.ttl") },
];

/** Reduce a report to a comparable signature — base results compared exactly,
 *  conditional results compared as the set of focus nodes they fire on, because
 *  each encoding necessarily names a different source shape and constraint
 *  component for the same failure. */
function summarise(results: readonly ValidationResult[]) {
  const base = new Set<string>();
  const conditional = new Set<string>();
  for (const r of results) {
    const path = r.path?.value;
    const comp = r.constraint ?? "";
    const focus = r.focusNode.value;
    if (path && CONDITIONAL_PATHS.has(path)) conditional.add(`${focus}\t${path}`);
    else if (/(Or|If)ConstraintComponent$/.test(comp)) conditional.add(`${focus}\t<node-level>`);
    else base.add(`${focus}\t${path ?? ""}\t${comp}`);
  }
  return {
    base: [...base].sort(),
    conditional: [...conditional].sort(),
    conditional_fired: conditional.size > 0,
    conforms: results.length === 0,
  };
}

it("E2 — rudof validates every case under every encoding", async () => {
  mkdirSync(RESULTS, { recursive: true });
  const caseFiles = readdirSync(CASES)
    .filter((f) => f.endsWith(".ttl"))
    .sort();

  const wasmVersion = JSON.parse(
    readFileSync(resolve(HERE, "../../../../node_modules/@kanzo-tech/rudof-wasm/package.json"), "utf8"),
  ).version as string;

  const out: Record<string, unknown> = {
    validator: "rudof (wasm)",
    package: "@kanzo-tech/rudof-wasm",
    version: wasmVersion,
    shapes: {
      verbatim_core_files: coreFiles,
      encodings: Object.fromEntries(ENCODINGS.map((e) => [e.id, basename(e.overlay)])),
    },
    cases: {} as Record<string, Record<string, unknown>>,
  };
  const cases = out.cases as Record<string, Record<string, unknown>>;

  for (const enc of ENCODINGS) {
    const engine = createRudofEngine();
    let loadError: string | undefined;
    try {
      await engine.loadShapes(`${core}\n${ttl(enc.overlay)}`);
    } catch (e) {
      loadError = String(e);
    }
    for (const cf of caseFiles) {
      const id = cf.replace(/\.ttl$/, "");
      cases[id] ??= {};
      if (loadError) {
        cases[id][enc.id] = { error: loadError };
        continue;
      }
      try {
        await engine.newGraph();
        await engine.loadData(ttl(join(CASES, cf)));
        cases[id][enc.id] = summarise(await engine.validate());
      } catch (e) {
        cases[id][enc.id] = { error: String(e) };
      }
    }
  }

  for (const id of Object.keys(cases).sort()) {
    const row = ENCODINGS.map((e) => {
      const r = cases[id][e.id] as { conforms?: boolean; error?: string };
      return `${e.id}=${r.error ? "E" : r.conforms ? "C" : "V"}`;
    }).join("  ");
    console.log(`${id.padEnd(42)} ${row}`);
  }

  writeFileSync(join(RESULTS, "equivalence-rudof.json"), `${JSON.stringify(out, null, 2)}\n`);
});
