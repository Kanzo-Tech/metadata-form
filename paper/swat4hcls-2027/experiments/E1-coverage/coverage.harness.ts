/**
 * E1 — coverage of shape-driven form generation across published SHACL profiles.
 *
 * Question: how much of a real, published health-metadata profile renders as a
 * usable form with no per-profile code and no modification to the profile?
 *
 * This measures the honest baseline: rudof reads only `shui:editor`, so the
 * DASH annotations real profiles carry are ignored and every editor is inferred
 * from datatype/nodeKind facts. That is exactly what a data space adopting an
 * official profile gets today.
 *
 * Emits results/coverage.json (machine) and results/coverage.md (paper).
 *
 * Run:
 *   npx vitest run --config paper/swat4hcls-2027/experiments/vitest.config.ts
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { it } from "vitest";
import { createRudofEngine } from "@/engine/index.js";
import { buildFormModel, type Diagnostic } from "@/form/buildFormModel.js";
import { allFields, type FieldModel } from "@/form/FormModel.js";
import { resolveWidgetKind } from "@/form/editors.js";
import { namedNode } from "@/engine/factory.js";
import type { ShapeModel, PathExpr, PropertyShapeIR } from "@/form/ShapeIR.js";

const HERE = __dirname;
const REPO = resolve(HERE, "../../../..");

/**
 * A profile is a set of Turtle files concatenated into one graph. Real profiles
 * ship split across files with cross-file `sh:node` references, so nothing works
 * until they are assembled — a finding in its own right (§7.1).
 */
interface ProfileSpec {
  id: string;
  label: string;
  /** Directories (recursive) and/or single files, relative to the repo root. */
  sources: string[];
  /** Substrings; any path containing one is skipped. */
  exclude?: string[];
  note?: string;
  /**
   * A re-serialisation of another profile rather than an independent one:
   * measured and reported, but excluded from the headline table so it cannot
   * inflate n. Carries the evidence for that judgement.
   */
  variantOf?: string;
}

const HRI = "paper/swat4hcls-2027/experiments/E1-coverage/data/health-ri/src/Formalisation(shacl)";

const PROFILES: ProfileSpec[] = [
  {
    id: "health-ri-core",
    label: "Health-RI Core (HealthDCAT-AP)",
    sources: [`${HRI}/Core/PiecesShape`],
    note: "Per-class shapes with cross-file sh:node references. DASH-annotated.",
  },
  {
    id: "health-ri-fdp",
    label: "Health-RI FAIR Data Point",
    sources: [`${HRI}/Core/FairDataPointShape`],
    variantOf: "health-ri-core",
    note:
      "NOT an independent profile. It declares the same shape IRIs (hri:AgentShape, " +
      "hri:CatalogShape, …) as PiecesShape, and its 178 sh:path lines collapse to the " +
      "same 137 distinct (shape, path) pairs — each FDP file is self-contained and " +
      "redefines the shared shapes, so concatenation merges them by identity. Reported " +
      "for the record; excluded from the headline table so it cannot inflate n.",
  },
  {
    id: "health-ri-modules",
    label: "Health-RI domain modules (health, imaging, omics)",
    sources: [`${HRI}/Modules(Leaves_Petals)`],
    note: "Small; expected to be mostly rules rather than form-bearing shapes.",
  },
  {
    id: "dcat-ap",
    label: "DCAT-AP (as vendored by Health-RI)",
    sources: [`${HRI}/Core/ReusedCommunityStandards/dcatap.shapes.ttl`],
    note: "Prefer the upstream SEMIC release once vendored; this is a copy.",
  },
  {
    id: "evidenze-health",
    label: "Evidenze HealthDCAT-AP R7 onboarding (ours)",
    sources: ["playground/examples/evidenze-health/shapes.ttl"],
    note: "Pure SHACL 1.2 + SHACL-UI. The deployment.",
  },
  {
    id: "evidenze-dataspace",
    label: "Evidenze data space onboarding (ours)",
    sources: ["playground/examples/evidenze-dataspace/shapes.ttl"],
    note: "Pure SHACL 1.2 + SHACL-UI.",
  },
];

// Health-RI's ValidationShape is the assembled concatenation of PiecesShape.
// Counting both would inflate n. Deliberately absent above; see README.

function ttlFilesUnder(abs: string, exclude: string[] = []): string[] {
  const skip = (p: string) => exclude.some((e) => p.includes(e));
  if (!statSync(abs).isDirectory()) return skip(abs) ? [] : [abs];
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const p = join(abs, entry);
    if (skip(p)) continue;
    if (statSync(p).isDirectory()) out.push(...ttlFilesUnder(p, exclude));
    else if (p.endsWith(".ttl")) out.push(p);
  }
  return out.sort();
}

function pathKinds(p: PathExpr, acc: Record<string, number> = {}): Record<string, number> {
  acc[p.kind] = (acc[p.kind] ?? 0) + 1;
  if (p.kind === "inverse") pathKinds(p.of, acc);
  else if (p.kind === "sequence") p.steps.forEach((s) => pathKinds(s, acc));
  else if (p.kind === "alternative") p.options.forEach((o) => pathKinds(o, acc));
  else if (p.kind === "zeroOrMore" || p.kind === "oneOrMore" || p.kind === "zeroOrOne") pathKinds(p.path, acc);
  return acc;
}

const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1; };
const localName = (iri: string) => iri.split(/[#/]/).pop() || iri;

interface ProfileResult {
  id: string;
  label: string;
  note?: string;
  variantOf?: string;
  files: number;
  turtleLines: number;
  parsed: boolean;
  parseError?: string;
  /** Source-level annotation counts (textual — what the author actually wrote). */
  source: { shuiEditor: number; dashEditor: number; shGroup: number; shName: number; langTags: Record<string, number> };
  /** Structural counts from the parsed IR. */
  ir: {
    nodeShapes: number;
    propertyShapes: number;
    groups: number;
    pathKinds: Record<string, number>;
    components: Record<string, number>;
    editors: Record<string, number>;
    conditionals: number;
  };
  /** What the form layer produced when each node shape was built as a root. */
  form: {
    shapesBuilt: number;
    shapesFailed: { shape: string; error: string }[];
    fields: number;
    widgetKinds: Record<string, number>;
    /** Fields that degraded to a bare text input — the fallback of last resort. */
    plainTextFallback: number;
    /** Fields whose path is not a simple predicate (rendered read-only). */
    complexPathFields: number;
    diagnostics: Record<string, number>;
    diagnosticSamples: string[];
  };
}

async function analyse(spec: ProfileSpec): Promise<ProfileResult> {
  const files = spec.sources.flatMap((s) => ttlFilesUnder(resolve(REPO, s), spec.exclude));
  const texts = files.map((f) => readFileSync(f, "utf8"));
  const ttl = texts.join("\n\n");

  const count = (re: RegExp) => (ttl.match(re) ?? []).length;
  const langTags: Record<string, number> = {};
  for (const m of ttl.matchAll(/"@([a-zA-Z]{2}(?:-[a-zA-Z0-9]+)?)/g)) bump(langTags, m[1].toLowerCase());

  const result: ProfileResult = {
    id: spec.id,
    label: spec.label,
    note: spec.note,
    variantOf: spec.variantOf,
    files: files.length,
    turtleLines: ttl.split("\n").length,
    parsed: false,
    source: {
      shuiEditor: count(/shui:editor|shacl-ui#editor/g),
      dashEditor: count(/dash:editor|dash#editor/g),
      shGroup: count(/sh:group/g),
      shName: count(/sh:name/g),
      langTags,
    },
    ir: { nodeShapes: 0, propertyShapes: 0, groups: 0, pathKinds: {}, components: {}, editors: {}, conditionals: 0 },
    form: {
      shapesBuilt: 0, shapesFailed: [], fields: 0, widgetKinds: {},
      plainTextFallback: 0, complexPathFields: 0, diagnostics: {}, diagnosticSamples: [],
    },
  };

  let shapes: ShapeModel;
  try {
    shapes = await createRudofEngine().loadShapes(ttl);
  } catch (e) {
    // A profile that breaks the engine is a RESULT, not a reason to drop it.
    result.parseError = e instanceof Error ? e.message : String(e);
    return result;
  }
  result.parsed = true;

  result.ir.nodeShapes = shapes.nodeShapes.size;
  result.ir.groups = shapes.groups.size;
  for (const ns of shapes.nodeShapes.values()) {
    result.ir.conditionals += ns.conditionals?.length ?? 0;
    for (const ps of ns.properties as PropertyShapeIR[]) {
      result.ir.propertyShapes++;
      const kinds = pathKinds(ps.path);
      for (const [k, n] of Object.entries(kinds)) result.ir.pathKinds[k] = (result.ir.pathKinds[k] ?? 0) + n;
      for (const c of ps.components) bump(result.ir.components, localName(c.iri));
      if (ps.presentation.editor) bump(result.ir.editors, localName(ps.presentation.editor));
    }
  }

  const focus = namedNode("urn:e1:focus");
  const seenField = new Set<string>();
  for (const [id, shape] of shapes.nodeShapes) {
    const diags: Diagnostic[] = [];
    try {
      const model = buildFormModel({
        shapes, focusNode: focus, shape, locale: "en",
        onDiagnostic: (d) => diags.push(d),
      });
      result.form.shapesBuilt++;
      for (const f of allFields(model) as FieldModel[]) {
        // Nested sh:node recursion means a field can appear under several roots.
        const key = `${id}|${f.id}`;
        if (seenField.has(key)) continue;
        seenField.add(key);
        result.form.fields++;
        const kind = resolveWidgetKind(f);
        bump(result.form.widgetKinds, kind);
        if (kind === "text") result.form.plainTextFallback++;
        if (f.pathKind === "complex") result.form.complexPathFields++;
      }
    } catch (e) {
      result.form.shapesFailed.push({ shape: id, error: e instanceof Error ? e.message : String(e) });
    }
    for (const d of diags) {
      bump(result.form.diagnostics, d.code);
      if (result.form.diagnosticSamples.length < 12) {
        result.form.diagnosticSamples.push(`[${d.code}] ${d.message}${d.detail ? ` — ${d.detail}` : ""}`);
      }
    }
  }
  return result;
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`;
}

function markdown(results: ProfileResult[], stamp: string): string {
  const L: string[] = [];
  L.push("# E1 — coverage across published SHACL profiles", "");
  L.push(`Generated ${stamp} by \`coverage.harness.ts\`. Do not edit by hand.`, "");
  L.push("Baseline measured: rudof reads only `shui:editor`, so `dash:editor`");
  L.push("annotations are ignored and every editor is inferred from datatype/nodeKind");
  L.push("facts. This is what a data space adopting an official profile gets today.", "");

  const primary = results.filter((r) => !r.variantOf);
  const variants = results.filter((r) => r.variantOf);

  L.push(`**n = ${primary.length} independent profiles.** ${variants.length} further input set(s)`);
  L.push("proved to be re-serialisations of a profile already counted; they are reported");
  L.push("in full below but kept out of the headline tables. See each one's note for the");
  L.push("evidence.", "");

  L.push("## Scale and annotation as authored", "");
  L.push("| Profile | Files | Node shapes | Property shapes | `shui:editor` | `dash:editor` | `sh:group` | Languages |");
  L.push("|---|---:|---:|---:|---:|---:|---:|---|");
  for (const r of primary) {
    const langs = Object.keys(r.source.langTags).sort().join(", ") || "—";
    L.push(`| ${r.label} | ${r.files} | ${r.parsed ? r.ir.nodeShapes : "—"} | ${r.parsed ? r.ir.propertyShapes : "—"} | ${r.source.shuiEditor} | ${r.source.dashEditor} | ${r.source.shGroup} | ${langs} |`);
  }
  L.push("");

  L.push("## Coverage", "");
  L.push("| Profile | Parsed | Shapes built | Fields | Typed editor | Plain-text fallback | Complex paths |");
  L.push("|---|:--:|---:|---:|---:|---:|---:|");
  for (const r of primary) {
    if (!r.parsed) { L.push(`| ${r.label} | ✗ | — | — | — | — | — |`); continue; }
    const typed = r.form.fields - r.form.plainTextFallback;
    L.push(`| ${r.label} | ✓ | ${r.form.shapesBuilt}/${r.ir.nodeShapes} | ${r.form.fields} | ${typed} (${pct(typed, r.form.fields)}) | ${r.form.plainTextFallback} (${pct(r.form.plainTextFallback, r.form.fields)}) | ${r.form.complexPathFields} |`);
  }
  L.push("");
  L.push("*Typed editor* = the engine resolved a datatype-appropriate widget");
  L.push("(date, number, boolean, select, reference, URL, lang-string…). *Plain-text");
  L.push("fallback* = it could say nothing better than a bare text input.", "");

  for (const r of results) {
    L.push(`## ${r.label}${r.variantOf ? " *(variant — excluded from headline)*" : ""}`, "");
    if (r.note) L.push(`> ${r.note}`, "");
    if (!r.parsed) {
      L.push("**Did not parse.** This is a result, not an exclusion.", "", "```", r.parseError ?? "", "```", "");
      continue;
    }
    L.push(`- ${r.files} file(s), ${r.turtleLines} lines of Turtle`);
    L.push(`- SHACL 1.2 conditionals (\`sh:if\`): **${r.ir.conditionals}**`);
    L.push(`- property groups: ${r.ir.groups}`);
    const paths = Object.entries(r.ir.pathKinds).sort((a, b) => b[1] - a[1]);
    L.push(`- path kinds: ${paths.map(([k, n]) => `${k}=${n}`).join(", ") || "—"}`);
    L.push("");
    const widgets = Object.entries(r.form.widgetKinds).sort((a, b) => b[1] - a[1]);
    if (widgets.length) L.push(`**Widgets resolved:** ${widgets.map(([k, n]) => `${k}=${n}`).join(", ")}`, "");
    const comps = Object.entries(r.ir.components).sort((a, b) => b[1] - a[1]).slice(0, 15);
    if (comps.length) L.push(`**Constraint components (top 15):** ${comps.map(([k, n]) => `${k}=${n}`).join(", ")}`, "");
    if (r.form.shapesFailed.length) {
      L.push(`**Shapes that failed to build (${r.form.shapesFailed.length}):**`, "");
      for (const f of r.form.shapesFailed.slice(0, 10)) L.push(`- \`${f.shape}\` — ${f.error}`);
      L.push("");
    }
    const diags = Object.entries(r.form.diagnostics).sort((a, b) => b[1] - a[1]);
    if (diags.length) {
      L.push(`**Diagnostics:** ${diags.map(([k, n]) => `${k}=${n}`).join(", ")}`, "");
      L.push("Samples:", "");
      for (const s of r.form.diagnosticSamples) L.push(`- ${s}`);
      L.push("");
    }
  }
  return L.join("\n");
}

it("E1: measure coverage across published SHACL profiles", async () => {
  const results: ProfileResult[] = [];
  for (const spec of PROFILES) {
    // eslint-disable-next-line no-console
    console.log(`[E1] ${spec.id}…`);
    results.push(await analyse(spec));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const out = join(HERE, "results");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "coverage.json"), JSON.stringify({ generated: stamp, results }, null, 2));
  writeFileSync(join(out, "coverage.md"), markdown(results, stamp));
  // eslint-disable-next-line no-console
  console.log(`[E1] wrote ${join(out, "coverage.md")}`);
});
