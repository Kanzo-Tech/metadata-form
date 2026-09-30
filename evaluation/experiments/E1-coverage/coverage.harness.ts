/**
 * E1 — coverage of shape-driven form generation across published SHACL profiles.
 *
 * Question: how much of a real, published profile renders as a usable form with
 * no per-profile code and no modification to the profile?
 *
 * This measures the honest baseline: rudof reads only `shui:editor`, so the DASH
 * annotations most real profiles carry are ignored and every editor is inferred
 * from datatype/nodeKind facts. That is exactly what a data space adopting an
 * official profile gets today. (Verified, not assumed — see the `dashHonoured`
 * assertion at the bottom of this file, which fails the run if it ever changes.)
 *
 * Reports, per profile:
 *   - node shapes, property shapes, property groups
 *   - the share of property shapes that render with zero custom widget code,
 *     split by *how* they render (typed widget / nested sub-form / plain-text
 *     floor / read-only / nothing at all)
 *   - the constraint-component histogram (`sh:sourceConstraintComponent`, derived
 *     statically from the parameters the profile uses)
 *   - complex paths by kind
 *   - **what we cannot render, and why** — the list §8 is built from
 *
 * Emits results/coverage.json (machine) and results/coverage.md (paper).
 *
 * Run:
 *   npx vitest run --config evaluation/experiments/vitest.config.ts
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { expect, it } from "vitest";
import { createRudofEngine } from "@/engine/index.js";
import { buildFormModel, type Diagnostic } from "@/form/buildFormModel.js";
import { allFields, type FieldModel } from "@/form/FormModel.js";
import { fallbackEditorId } from "@/form/editors.js";
import { defaultWidgets } from "@/react/widgets/defaultWidgets.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { namedNode } from "@/form/factory.js";
import type { ShapeModel, PathExpr, PropertyShapeIR } from "@/form/ShapeIR.js";
import { PROFILES, type ProfileSpec } from "./profiles.js";
import {
  ENGINE_DROP_REASON,
  LEDGER,
  NAMESPACES,
  PARAM_TO_COMPONENT,
  PLUMBING,
  localName,
} from "./constructs.js";

const HERE = __dirname;
const REPO = resolve(HERE, "../../..");

/** Editor IRIs that render as a nested sub-form rather than through the widget
 *  registry, so their absence from the registry is not a gap. `FieldRenderer`
 *  branches on both before it ever asks for a widget. */
const NESTED_EDITORS = new Set<string>([Editors.Details, Editors.BlankNode]);

const REGISTERED = new Set(Object.keys(defaultWidgets));

// -------------------------------------------------------------------- helpers

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

const bump = (m: Record<string, number>, k: string, by = 1) => { m[k] = (m[k] ?? 0) + by; };

/**
 * Every SHACL / SHACL-UI / DASH term mentioned in the Turtle source, as full
 * IRIs. Prefix-aware, because a profile is free to bind the SHACL namespace to
 * anything — DCAT-AP 3.0.1's generated encoding uses `shacl:`, Flanders' OSLO
 * likewise, and a naive `sh:` grep scores both as containing no SHACL at all.
 */
/**
 * Turtle with its `#` comments removed, for the TEXTUAL counts only.
 *
 * Every source-level number in this harness is a regex over the document, and a
 * regex cannot tell a term from prose about a term. That is not hypothetical:
 * an earlier revision of this work reported a profile as carrying three `sh:if`
 * conditionals when two of the three hits were sentences in comments. Anything
 * counting what the AUTHOR WROTE must count triples, not documentation.
 *
 * `#` is only a comment outside a literal and outside an IRI — `<...#Frag>` and
 * `"a # b"` both contain one and neither starts a comment — so the scan tracks
 * which of the three it is in. Parsing still sees the original text.
 */
function stripComments(ttl: string): string {
  let out = "";
  let i = 0;
  while (i < ttl.length) {
    const c = ttl[i];
    if (c === "<" && !/\s/.test(ttl[i + 1] ?? " ")) {
      const end = ttl.indexOf(">", i);
      if (end !== -1) { out += ttl.slice(i, end + 1); i = end + 1; continue; }
    }
    if (c === '"') {
      const long = ttl.startsWith('"""', i);
      const q = long ? '"""' : '"';
      let j = i + q.length;
      while (j < ttl.length) {
        if (ttl[j] === "\\") { j += 2; continue; }
        if (ttl.startsWith(q, j)) { j += q.length; break; }
        j += 1;
      }
      out += ttl.slice(i, j); i = j; continue;
    }
    if (c === "#") {
      const nl = ttl.indexOf("\n", i);
      if (nl === -1) break;
      i = nl; continue;               // drop the comment, keep the newline
    }
    out += c; i += 1;
  }
  return out;
}

function sourceTerms(ttl: string): Set<string> {
  const nsOf = new Map<string, string>();
  for (const m of ttl.matchAll(/@prefix\s+([A-Za-z][\w.-]*)?:\s*<([^>]+)>/g)) {
    const iri = m[2];
    if (iri === NAMESPACES.SH || iri === NAMESPACES.SHUI || iri === NAMESPACES.DASH) {
      nsOf.set(m[1] ?? "", iri);
    }
  }
  const terms = new Set<string>();
  for (const [prefix, ns] of nsOf) {
    const re = new RegExp(`(?:^|[\\s;,\\[(])${prefix}:([A-Za-z][\\w-]*)`, "g");
    for (const m of ttl.matchAll(re)) terms.add(`${ns}${m[1]}`);
  }
  // Absolute IRIs too — rare, but a generated profile may not use a prefix.
  for (const m of ttl.matchAll(/<((?:http:\/\/www\.w3\.org\/ns\/shacl(?:-ui)?#|http:\/\/datashapes\.org\/dash#)[A-Za-z][\w-]*)>/g)) {
    terms.add(m[1]);
  }
  return terms;
}

/**
 * `sh:message` values, and how many of them carry a language tag.
 *
 * Textual, like the rest of `sourceTerms` — it counts what the author wrote, not
 * what the engine parsed. Each `sh:message` predicate is followed to the end of
 * its object list (`;`, `.` or `]`), because Turtle lets one predicate carry
 * several literals — `sh:message "a"@en, "b"@es` is two messages, and counting
 * only the first is how a profile with full translations reads as monolingual.
 * Long-quoted (`"""`) literals are handled; a `;` inside a literal is not, which
 * would end the scan early and UNDER-count. That direction is the safe one.
 */
function messageStats(ttl: string): { total: number; langTagged: number } {
  let total = 0;
  let langTagged = 0;
  const lit = /(?:"""[\s\S]*?"""|"(?:[^"\\]|\\.)*")(@[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)*)?/g;
  for (const m of ttl.matchAll(/\b(?:sh|shacl):message(?![\w-])/g)) {
    const from = m.index! + m[0].length;
    const end = ttl.slice(from).search(/[;.\]]\s|[;.\]]$/);
    const objects = ttl.slice(from, end === -1 ? undefined : from + end);
    lit.lastIndex = 0;
    for (const o of objects.matchAll(lit)) {
      total += 1;
      if (o[1]) langTagged += 1;
    }
  }
  return { total, langTagged };
}

// -------------------------------------------------------------------- results

/** One construct we cannot render, with the reason. The §8 list. */
interface Gap {
  term: string;
  /** How many property shapes carry it (source occurrences for engine drops). */
  count: number;
  /** `unrendered` — reached the IR and changes nothing. `carried` — reached the
   *  field and no widget reads it. `dropped` — never reached the IR at all. */
  kind: "unrendered" | "carried" | "dropped";
  why: string;
}

interface ProfileResult {
  id: string;
  label: string;
  origin: "external" | "ours";
  note?: string;
  variantOf?: string;
  files: number;
  fileNames: string[];
  turtleLines: number;
  turtleBytes: number;
  parsed: boolean;
  parseError?: string;
  /** Set when a whole-profile parse failed and the files were re-parsed one by
   *  one to name the culprit. A profile that breaks the engine is a RESULT. */
  parseIsolation?: { file: string; ok: boolean; error?: string }[];
  /** Source-level annotation counts (textual — what the author actually wrote). */
  source: {
    shuiEditor: number; dashEditor: number; shGroup: number; shName: number;
    langTags: Record<string, number>;
    /** `sh:message` values written, and how many carry a language tag. The
     *  multilingual half of SHACL messages is invisible without this pair. */
    shMessage: number; shMessageLangTagged: number;
    /** Conditionals as written: an implication `sh:or ( [ sh:not C ] T )` (SHACL
     *  Core §4.6.1, §4.6.3), plus any `sh:if`. Counted over comment-stripped text. */
    conditionals: number;
  };
  /** Structural counts from the parsed IR. */
  ir: {
    nodeShapes: number;
    /** Node shapes carrying at least one property shape — the ones a form can be
     *  built from at all. SPARQL-constraint-only shapes have none. */
    nodeShapesWithProperties: number;
    propertyShapes: number;
    /** Property shapes carrying a human-readable `sh:name` / `sh:description`.
     *  Without a name the field label is the local name of the predicate — the
     *  form renders, but it reads like a database dump. */
    named: number;
    described: number;
    groups: number;
    pathKinds: Record<string, number>;
    /** Constraint components, as a validation report would name them. */
    components: Record<string, number>;
    /** Raw parameter IRIs behind that histogram, incl. annotations. */
    parameters: Record<string, number>;
    editors: Record<string, number>;
    conditionals: number;
  };
  /** What the form layer produced when each node shape was built as a root. */
  form: {
    shapesBuilt: number;
    shapesFailed: { shape: string; error: string }[];
    fields: number;
    editorIds: Record<string, number>;
    /** Fields whose stated `shui:editor` the registry could honour directly. */
    statedEditorHonoured: number;
    /** Fields whose editor was inferred from type facts (no `shui:editor`). */
    inferred: number;
    /** Editor stated but unregistered — degraded to the type-fact fallback. */
    degradedToFallback: number;
    /** Renders as a nested sub-form (sh:node / Details / BlankNode). */
    nested: number;
    /** A control more specific than a bare text input. */
    typedWidget: number;
    /** Degraded to a bare text input — the fallback of last resort. */
    plainTextFallback: number;
    /** Read-only: the path is not a simple predicate, or is an inverse. */
    readOnly: number;
    /** No widget at all, from either the stated editor or the fallback. */
    noWidget: number;
    complexPathFields: number;
    diagnostics: Record<string, number>;
    diagnosticSamples: string[];
  };
  /** Each source file measured ALONE, for profiles that ship more than one.
   *  Real profiles partition the facts a widget is chosen from across files, so
   *  what a consumer loads decides what it gets — see the DCAT-AP note in the
   *  README. Only computed when the profile has more than one file. */
  perFile?: { file: string; nodeShapes: number; fields: number; typed: number; nested: number; plain: number; readOnly: number }[];
  /** The list §8 is built from. */
  gaps: Gap[];
}

/** The coverage tally for one shapes graph, used for both a whole profile and a
 *  single file of one. */
function tally(shapes: ShapeModel): { fields: number; typed: number; nested: number; plain: number; readOnly: number } {
  const acc = { fields: 0, typed: 0, nested: 0, plain: 0, readOnly: 0 };
  const focus = namedNode("urn:e1:focus");
  for (const [, shape] of shapes.nodeShapes) {
    let model;
    try {
      model = buildFormModel({ shapes, focusNode: focus, shape, languages: ["en"] });
    } catch { continue; }
    for (const f of allFields(model) as FieldModel[]) {
      acc.fields++;
      if (f.readOnly) { acc.readOnly++; continue; }
      if (NESTED_EDITORS.has(f.editorId) || f.nodeShape) { acc.nested++; continue; }
      const fb = fallbackEditorId(f);
      const eff = REGISTERED.has(f.editorId) ? f.editorId : REGISTERED.has(fb) ? fb : undefined;
      if (eff === Editors.TextField) acc.plain++;
      else if (eff) acc.typed++;
    }
  }
  return acc;
}

// ------------------------------------------------------------------- analysis

async function analyse(spec: ProfileSpec): Promise<ProfileResult> {
  const files = spec.sources.flatMap((s) => ttlFilesUnder(resolve(REPO, s), spec.exclude));
  const texts = files.map((f) => readFileSync(f, "utf8"));
  const ttl = texts.join("\n\n");
  // Every textual count below runs over `prose`, never `ttl`: a comment that
  // MENTIONS a term must not be counted as a use of it. Parsing uses `ttl`.
  const prose = stripComments(ttl);

  const count = (re: RegExp) => (prose.match(re) ?? []).length;
  const langTags: Record<string, number> = {};
  for (const m of prose.matchAll(/(?<!\\)"@([a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)?)(?![\w-])/g)) bump(langTags, m[1].toLowerCase());
  const messages = messageStats(prose);

  const result: ProfileResult = {
    id: spec.id,
    label: spec.label,
    origin: spec.origin,
    note: spec.note,
    variantOf: spec.variantOf,
    files: files.length,
    fileNames: files.map((f) => relative(REPO, f)),
    turtleLines: ttl.split("\n").length,
    turtleBytes: Buffer.byteLength(ttl, "utf8"),
    parsed: false,
    source: {
      shuiEditor: count(/shui:editor|shacl-ui/editor/g),
      dashEditor: count(/dash:editor|dash#editor/g),
      // Word boundaries matter: `sh:name` is a prefix of `sh:namespace`, which
      // DCAT-AP.de uses 23 times for its SPARQL prefix declarations. Counting
      // those as labels would have reported a profile with no labels as labelled.
      shGroup: count(/\b(?:sh|shacl):group(?![\w-])/g),
      shName: count(/\b(?:sh|shacl):name(?![\w-])/g),
      langTags,
      shMessage: messages.total,
      shMessageLangTagged: messages.langTagged,
      conditionals: count(/\b(?:sh|shacl):or\s*\(\s*\[\s*(?:sh|shacl):not\b/g) + count(/\b(?:sh|shacl):if(?![\w-])/g),
    },
    ir: {
      nodeShapes: 0, nodeShapesWithProperties: 0, propertyShapes: 0, named: 0, described: 0, groups: 0,
      pathKinds: {}, components: {}, parameters: {}, editors: {}, conditionals: 0,
    },
    form: {
      shapesBuilt: 0, shapesFailed: [], fields: 0, editorIds: {},
      statedEditorHonoured: 0, inferred: 0, degradedToFallback: 0,
      nested: 0, typedWidget: 0, plainTextFallback: 0, readOnly: 0, noWidget: 0,
      complexPathFields: 0, duplicatePath: 0, diagnostics: {}, diagnosticSamples: [],
    },
    gaps: [],
  };

  let shapes: ShapeModel;
  try {
    shapes = await createRudofEngine().loadShapes(ttl);
  } catch (e) {
    // A profile that breaks the engine is a RESULT, not a reason to drop it.
    // Re-parse file by file so the report names the construct that did it.
    result.parseError = e instanceof Error ? e.message : String(e);
    result.parseIsolation = [];
    for (let i = 0; i < files.length; i++) {
      try {
        await createRudofEngine().loadShapes(texts[i]);
        result.parseIsolation.push({ file: relative(REPO, files[i]), ok: true });
      } catch (inner) {
        result.parseIsolation.push({
          file: relative(REPO, files[i]),
          ok: false,
          error: inner instanceof Error ? inner.message : String(inner),
        });
      }
    }
    return result;
  }
  result.parsed = true;

  // --- IR structure -------------------------------------------------------
  const irTerms = new Set<string>();
  /** Property shapes carrying each parameter, for the gap counts. */
  const carriers: Record<string, number> = {};
  result.ir.nodeShapes = shapes.nodeShapes.size;
  result.ir.groups = shapes.groups.size;
  for (const ns of shapes.nodeShapes.values()) {
    result.ir.conditionals += ns.conditionals?.length ?? 0;
    if (ns.properties.length) result.ir.nodeShapesWithProperties++;
    for (const ps of ns.properties as PropertyShapeIR[]) {
      result.ir.propertyShapes++;
      if (ps.presentation.names.length) result.ir.named++;
      if (ps.presentation.descriptions.length) result.ir.described++;
      const kinds = pathKinds(ps.path);
      for (const [k, n] of Object.entries(kinds)) bump(result.ir.pathKinds, k, n);
      for (const c of ps.components) {
        irTerms.add(c.iri);
        bump(carriers, c.iri);
        bump(result.ir.parameters, localName(c.iri));
        const comp = PARAM_TO_COMPONENT[c.iri];
        if (comp) bump(result.ir.components, comp);
      }
      if (ps.presentation.editor) bump(result.ir.editors, localName(ps.presentation.editor));
    }
  }

  // --- what the form layer made of it ------------------------------------
  const focus = namedNode("urn:e1:focus");
  for (const [id, shape] of shapes.nodeShapes) {
    const diags: Diagnostic[] = [];
    try {
      const model = buildFormModel({
        shapes, focusNode: focus, shape, languages: ["en"],
        onDiagnostic: (d) => diags.push(d),
      });
      result.form.shapesBuilt++;
      // Every property shape is classified — including two on one node shape
      // that share a path. Deduplicating them would make the totals depend on
      // rudof's (hash-ordered) property order, and the first-wins survivor
      // carries different constraints from run to run. `duplicatePath` records
      // how often the profile does it; nothing is silently dropped.
      const seenPath = new Set<string>();
      for (const f of allFields(model) as FieldModel[]) {
        if (seenPath.has(f.id)) result.form.duplicatePath++;
        seenPath.add(f.id);
        result.form.fields++;
        classify(f, result);
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

  result.gaps = gapsFor(prose, irTerms, carriers);

  if (files.length > 1) {
    result.perFile = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const one = await createRudofEngine().loadShapes(texts[i]);
        result.perFile.push({ file: files[i].split("/").pop()!, nodeShapes: one.nodeShapes.size, ...tally(one) });
      } catch {
        result.perFile.push({ file: files[i].split("/").pop()!, nodeShapes: 0, fields: 0, typed: 0, nested: 0, plain: 0, readOnly: 0 });
      }
    }
  }
  return result;
}

/**
 * Which of the five renderings a field got. "Zero custom widget code" means the
 * default registry answered — through the stated editor, the type-fact fallback,
 * or a nested sub-form. `noWidget` is the only outright failure; `plainText` and
 * `readOnly` are honest degradations and are reported as such rather than being
 * folded into a single percentage that would hide them.
 */
function classify(f: FieldModel, r: ProfileResult): void {
  bump(r.form.editorIds, localName(f.editorId));

  if (f.pathKind === "complex") r.form.complexPathFields++;
  if (f.readOnly) { r.form.readOnly++; return; }

  if (NESTED_EDITORS.has(f.editorId) || f.nodeShape) { r.form.nested++; return; }

  const stated = REGISTERED.has(f.editorId);
  const fallback = fallbackEditorId(f);
  const effective = stated ? f.editorId : REGISTERED.has(fallback) ? fallback : undefined;

  // rudof always emits an editor; TextFieldEditor is what it emits when the type
  // facts said nothing, so it is inference, not an author's statement.
  if (f.editorId === Editors.TextField) r.form.inferred++;
  else if (stated) r.form.statedEditorHonoured++;
  else r.form.degradedToFallback++;

  if (!effective) { r.form.noWidget++; return; }
  if (effective === Editors.TextField) r.form.plainTextFallback++;
  else r.form.typedWidget++;
}

/**
 * The constructs we cannot render, with the reason — assembled from three
 * places, because they fail in three different ways:
 *   1. terms that reach the IR and change nothing (`unrendered`)
 *   2. terms that reach the field and no widget reads (`carried`)
 *   3. terms in the source that never reach the IR at all (`dropped`)
 * Only (3) requires the source scan; (1) and (2) are read off the parsed IR.
 */
function gapsFor(ttl: string, irTerms: Set<string>, carriers: Record<string, number>): Gap[] {
  const gaps = new Map<string, Gap>();
  const add = (iri: string, count: number, kind: Gap["kind"], why: string) => {
    const term = prefixed(iri);
    const prev = gaps.get(term);
    // A term can be seen twice — once on a property shape, once in the raw
    // source. Keep the larger count and the more specific mode; never two rows.
    if (!prev) gaps.set(term, { term, count, kind, why });
    else prev.count = Math.max(prev.count, count);
  };

  for (const [iri, n] of Object.entries(carriers)) {
    const entry = LEDGER[iri];
    if (!entry) {
      add(iri, n, "unrendered", "Not in the construct ledger — unclassified, and therefore unread by the form layer.");
      continue;
    }
    if (entry.how === "consumed") continue;
    add(iri, n, entry.how === "carried" ? "carried" : "unrendered", entry.why);
  }

  for (const term of sourceTerms(ttl)) {
    if (PLUMBING.has(term)) continue;
    const drop = ENGINE_DROP_REASON[term];
    if (drop) { add(term, occurrences(ttl, term), "dropped", drop); continue; }
    const ledger = LEDGER[term];
    if (!ledger || ledger.how === "consumed") continue; // unrecognised: not our claim to make
    // In the source and not on any property shape we enumerated: it sits on a
    // node shape, or inside a nested/qualified value shape. Either way nothing
    // downstream reads it, so it is the same finding with a wider count.
    add(term, occurrences(ttl, term), irTerms.has(term) ? (ledger.how === "carried" ? "carried" : "unrendered") : "dropped", ledger.why);
  }
  return [...gaps.values()].sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

function prefixed(iri: string): string {
  if (iri.startsWith(NAMESPACES.SH)) return `sh:${localName(iri)}`;
  if (iri.startsWith(NAMESPACES.SHUI)) return `shui:${localName(iri)}`;
  if (iri.startsWith(NAMESPACES.DASH)) return `dash:${localName(iri)}`;
  if (iri.startsWith(NAMESPACES.RDF)) return `rdf:${localName(iri)}`;
  return `<${iri}>`;
}

function occurrences(ttl: string, iri: string): number {
  const name = localName(iri);
  const re = new RegExp(`[A-Za-z][\\w.-]*:${name}(?![\\w-])`, "g");
  return (ttl.match(re) ?? []).length;
}

// -------------------------------------------------------------------- report

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`;
}

function markdown(results: ProfileResult[], stamp: string): string {
  const L: string[] = [];
  const primary = results.filter((r) => !r.variantOf);
  const variants = results.filter((r) => r.variantOf);
  const external = primary.filter((r) => r.origin === "external");

  L.push("# E1 — coverage across published SHACL profiles", "");
  L.push(`Generated ${stamp} by \`coverage.harness.ts\`. Do not edit by hand.`, "");
  L.push("**Baseline measured:** rudof reads only `shui:editor`, so the `dash:editor`");
  L.push("hints most published profiles carry are recorded and ignored, and every");
  L.push("editor is inferred from datatype/nodeKind facts. This is what a data space");
  L.push("adopting an official profile gets today, unmodified. The harness asserts");
  L.push("this rather than assuming it.", "");
  L.push(`**n = ${primary.length} independent profiles, ${external.length} of them externally authored.**`);
  L.push(`${variants.length} further input sets proved to be re-serialisations or redundant`);
  L.push("slices of a profile already counted; they are reported in full below but kept");
  L.push("out of the headline tables. See each one's note for the evidence.", "");

  // ---- Tab. 3 ----------------------------------------------------------
  L.push("## Tab. 3 — coverage", "");
  L.push("| Profile | Node shapes | Property shapes | Groups | Labelled | Fields | Typed widget | Nested form | Plain-text floor | Read-only | No widget | **Zero-code control** |");
  L.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of primary) L.push(row(r));
  L.push("");
  L.push("*Labelled* = property shapes carrying an `sh:name`; the rest fall back to the");
  L.push("local name of their predicate. *Fields* ≤ *property shapes*: two property");
  L.push("shapes on one node shape with the same path are one field, which is what the");
  L.push("user sees. *Typed widget* = a control more specific than a text input (date,");
  L.push("number, boolean, enum select, autocomplete, IRI, lang-string…). *Nested form* =");
  L.push("an `sh:node` reference, rendered as a sub-form. *Plain-text floor* = the engine");
  L.push("could say nothing better than a bare text input. *Read-only* = the path is not");
  L.push("a simple predicate, so values are shown but not editable. *No widget* = nothing");
  L.push("rendered at all.", "");
  L.push("**Zero-code control** = (typed widget + nested form) / fields: the share that");
  L.push("gets a control reflecting what the property actually *is*, with no per-profile");
  L.push("code and no edit to the profile. The plain-text floor and the read-only column");
  L.push("are the complement and are deliberately not folded in — a bare text box for a");
  L.push("controlled vocabulary is a form that renders, not a form that works.", "");
  const nothing = primary.filter((r) => r.parsed && r.form.noWidget > 0);
  L.push(nothing.length
    ? `Fields with no widget at all: ${nothing.map((r) => `${short(r)}=${r.form.noWidget}`).join(", ")}.`
    : "**No widget** is zero in every profile: the type-fact fallback always resolves " +
      "to *something*, so nothing fails to render outright. The whole question is what " +
      "it degrades to, which is why the literal 'renders with zero custom widget code' " +
      "figure would be 100% everywhere and is not the number reported.", "");

  // ---- what authoring for this engine actually buys -----------------------
  //
  // Two comparisons, because they answer different questions and only the first
  // is the one the paper claims. LIKE-FOR-LIKE pairs our HealthDCAT-AP profile
  // against the national HealthDCAT-AP implementation: same specification, same
  // domain, one written knowing this engine and one written without ever having
  // heard of it. The corpus EXTREMES are also printed, because the best external
  // profile in the corpus is not a HealthDCAT-AP one and comparing against it
  // would be comparing shape styles rather than measuring adoption cost.
  {
    const scored = primary.filter((r) => r.parsed && r.form.fields > 0);
    const share = (r: ProfileResult) => (100 * (r.form.typedWidget + r.form.nested)) / r.form.fields;
    const byId = (id: string) => scored.find((r) => r.id === id);
    const best = (o: "external" | "ours") =>
      scored.filter((r) => r.origin === o).sort((a, b) => share(b) - share(a))[0];

    const rows: [string, ProfileResult | undefined, ProfileResult | undefined][] = [
      ["like for like — the same profile, authored twice", byId("evidenze-health"), byId("health-ri-core")],
      ["corpus extremes — best of each origin", best("ours"), best("external")],
    ];
    L.push("### What authoring a profile for this engine buys", "");
    L.push("| Comparison | Ours | | Externally authored | | Difference |");
    L.push("|---|---|---:|---|---:|---:|");
    for (const [what, a, b] of rows) {
      if (!a || !b) { L.push(`| ${what} | — | — | — | — | — |`); continue; }
      const d = share(a) - share(b);
      L.push(`| ${what} | ${short(a)} | ${share(a).toFixed(1)}% | ${short(b)} | ${share(b).toFixed(1)}% | **${d >= 0 ? "+" : ""}${d.toFixed(1)} points** |`);
    }
    L.push("");
    L.push("The first row is the adoption-cost measurement: both are implementations of");
    L.push("the same application profile, one written with complete knowledge of this");
    L.push("engine and one written by people who had never heard of it. The second row is");
    L.push("reported so the first cannot be mistaken for a corpus maximum — the highest");
    L.push("external score belongs to a profile from another domain with a different");
    L.push("shape style, and comparing against it would measure that, not adoption.", "");
  }

  // ---- variants: same spec, different encoding ----------------------------
  if (variants.length) {
    L.push("### Variants — excluded from the headline, reported because the pairs are informative", "");
    L.push("| Variant | Variant of | Fields | Typed widget | Nested form | **Zero-code control** |");
    L.push("|---|---|---:|---:|---:|---:|");
    for (const r of variants) {
      if (!r.parsed) { L.push(`| ${r.label} | ${r.variantOf} | **parse failed** | — | — | — |`); continue; }
      const f = r.form;
      L.push(`| ${short(r)} | \`${r.variantOf}\` | ${f.fields} | ${f.typedWidget} | ${f.nested} | **${pct(f.typedWidget + f.nested, f.fields)}** |`);
    }
    L.push("");
    L.push("A variant is a second encoding or a re-serialisation of a profile already");
    L.push("counted, so it is kept out of Tab. 3. The figures are here because the *pairs*");
    L.push("say something Tab. 3 cannot: the same specification, encoded twice, does not");
    L.push("produce the same form.", "");
  }

  // ---- annotation as authored -------------------------------------------
  L.push("## Scale and annotation as authored", "");
  L.push("| Profile | Files | kB | `shui:editor` | `dash:editor` | `sh:group` | `sh:name` | `sh:message` | of those, lang-tagged | Languages |");
  L.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const r of primary) {
    const langs = Object.entries(r.source.langTags).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l, n]) => `${l} (${n})`).join(", ") || "—";
    const msg = r.source.shMessage;
    const tagged = msg === 0 ? "—" : `${r.source.shMessageLangTagged} (${pct(r.source.shMessageLangTagged, msg)})`;
    L.push(`| ${r.label} | ${r.files} | ${(r.turtleBytes / 1024).toFixed(0)} | ${r.source.shuiEditor} | ${r.source.dashEditor} | ${r.source.shGroup} | ${r.source.shName} | ${msg} | ${tagged} | ${langs} |`);
  }
  L.push("");
  L.push("These are textual counts over the whole profile, i.e. what the author wrote.");
  L.push("They can exceed the *Labelled* column of Tab. 3, which counts only property");
  L.push("shapes: DCAT-AP.de's 23 `sh:name`s are all on **node** shapes, and a node");
  L.push("shape's name has nowhere to go in a form that renders one shape as one page.", "");
  L.push("The `sh:message` pair is what makes the multilingual gap visible: a profile can");
  L.push("carry hundreds of author-written error messages and still offer the reader only");
  L.push("one language. Counted per literal, not per predicate — one `sh:message` may");
  L.push("carry several translations in one object list.", "");

  // ---- paths -------------------------------------------------------------
  L.push("## Property paths", "");
  L.push("| Profile | predicate | inverse | sequence | alternative | zeroOrMore | oneOrMore | zeroOrOne |");
  L.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of primary) {
    if (!r.parsed) { L.push(`| ${r.label} | — | — | — | — | — | — | — |`); continue; }
    const k = r.ir.pathKinds;
    const c = (n: string) => (k[n] ? String(k[n]) : "·");
    L.push(`| ${r.label} | ${c("predicate")} | ${c("inverse")} | ${c("sequence")} | ${c("alternative")} | ${c("zeroOrMore")} | ${c("oneOrMore")} | ${c("zeroOrOne")} |`);
  }
  L.push("");

  // ---- component histogram ----------------------------------------------
  L.push("## Constraint components", "");
  L.push("Derived statically from the parameters each profile uses; these are the");
  L.push("components a validation report over that profile would name in");
  L.push("`sh:sourceConstraintComponent`. Counted per property shape.", "");
  const allComps = new Map<string, number>();
  for (const r of primary) for (const [c, n] of Object.entries(r.ir.components)) allComps.set(c, (allComps.get(c) ?? 0) + n);
  const compOrder = [...allComps.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  L.push(`| Component | ${primary.map((r) => `\`${r.id}\``).join(" | ")} | Total |`);
  L.push(`|---|${primary.map(() => "---:").join("|")}|---:|`);
  for (const c of compOrder) {
    L.push(`| \`sh:${c}\` | ${primary.map((r) => r.ir.components[c] ?? "·").join(" | ")} | ${allComps.get(c)} |`);
  }
  L.push("");

  // ---- the gap list ------------------------------------------------------
  L.push("## What we cannot render, and why", "");
  L.push("The list §8 is built from. Three failure modes, kept apart because they are");
  L.push("not the same problem:", "");
  L.push("- **unrendered** — the construct reaches the IR and changes nothing the user sees.");
  L.push("- **carried** — it reaches the field model and no widget reads it.");
  L.push("- **dropped** — it is in the published source and never reaches the IR at all.", "");
  const merged = new Map<string, { kinds: Set<string>; why: string; total: number; where: string[] }>();
  for (const r of primary) {
    for (const g of r.gaps) {
      const e = merged.get(g.term) ?? { kinds: new Set<string>(), why: g.why, total: 0, where: [] };
      e.kinds.add(g.kind);
      e.total += g.count;
      e.where.push(`${r.id}=${g.count}`);
      merged.set(g.term, e);
    }
  }
  const ranked = [...merged.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));
  L.push("| Construct | Mode | Occurrences | Profiles | Why we cannot render it |");
  L.push("|---|---|---:|---|---|");
  for (const [term, e] of ranked) {
    L.push(`| \`${term}\` | ${[...e.kinds].sort().join(" / ")} | ${e.total} | ${e.where.join(", ")} | ${e.why} |`);
  }
  L.push("");
  if (!ranked.length) L.push("*(none — which would itself want checking)*", "");

  // ---- per profile -------------------------------------------------------
  for (const r of results) {
    L.push(`## ${r.label}${r.variantOf ? ` *(variant of \`${r.variantOf}\` — excluded from headline)*` : ""}`, "");
    if (r.note) L.push(`> ${r.note}`, "");
    L.push(`- source: ${r.files} file(s), ${r.turtleLines} lines, ${(r.turtleBytes / 1024).toFixed(0)} kB`);
    if (!r.parsed) {
      L.push("", "**Did not parse. This is a result, not an exclusion.**", "", "```", r.parseError ?? "", "```", "");
      if (r.parseIsolation) {
        L.push("Re-parsed file by file to locate the cause:", "");
        for (const f of r.parseIsolation) L.push(`- ${f.ok ? "ok" : "**FAILED**"} \`${f.file}\`${f.error ? ` — ${f.error}` : ""}`);
        L.push("");
      }
      continue;
    }
    L.push(`- node shapes: ${r.ir.nodeShapes} (${r.ir.nodeShapesWithProperties} carry property shapes)`);
    L.push(`- property shapes: ${r.ir.propertyShapes}; property groups: ${r.ir.groups}`);
    L.push(`- carrying sh:name: ${r.ir.named} (${pct(r.ir.named, r.ir.propertyShapes)}); sh:description: ${r.ir.described} (${pct(r.ir.described, r.ir.propertyShapes)})`);
    L.push(`- conditionals stated as an implication (\`sh:or ( [ sh:not C ] T )\`): ${r.source.conditionals} in the source, ${r.ir.conditionals} reported by the engine`);
    if (r.form.duplicatePath) L.push(`- property shapes sharing a path with a sibling on the same node shape: ${r.form.duplicatePath} (they collapse into one control)`);
    L.push(`- editor resolution: ${r.form.statedEditorHonoured} from a stated \`shui:editor\`, ${r.form.inferred} inferred, ${r.form.degradedToFallback} degraded to the type-fact fallback`);
    L.push("");
    const eds = Object.entries(r.form.editorIds).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (eds.length) L.push(`**Editors resolved:** ${eds.map(([k, n]) => `${k}=${n}`).join(", ")}`, "");
    const params = Object.entries(r.ir.parameters).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (params.length) L.push(`**SHACL parameters present:** ${params.map(([k, n]) => `${k}=${n}`).join(", ")}`, "");
    if (r.form.shapesFailed.length) {
      L.push(`**Shapes that failed to build (${r.form.shapesFailed.length}):**`, "");
      for (const f of r.form.shapesFailed.slice(0, 10)) L.push(`- \`${f.shape}\` — ${f.error}`);
      L.push("");
    }
    const diags = Object.entries(r.form.diagnostics).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (diags.length) {
      L.push(`**Diagnostics:** ${diags.map(([k, n]) => `${k}=${n}`).join(", ")}`, "");
      for (const s of r.form.diagnosticSamples) L.push(`- ${s}`);
      L.push("");
    }
    if (r.perFile?.length) {
      L.push("**Each file loaded alone** — a profile is only a graph once someone concatenates it:", "");
      L.push("| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |");
      L.push("|---|---:|---:|---:|---:|---:|---:|---:|");
      for (const f of r.perFile) {
        L.push(`| \`${f.file}\` | ${f.nodeShapes} | ${f.fields} | ${f.typed} | ${f.nested} | ${f.plain} | ${f.readOnly} | ${pct(f.typed + f.nested, f.fields)} |`);
      }
      L.push("");
    }
    if (r.gaps.length) {
      L.push("**Cannot render:**", "");
      for (const g of r.gaps) L.push(`- \`${g.term}\` ×${g.count} (${g.kind}) — ${g.why}`);
      L.push("");
    }
  }
  return L.join("\n");
}

function row(r: ProfileResult): string {
  if (!r.parsed) return `| ${r.label} | **parse failed** | — | — | — | — | — | — | — | — | — | — |`;
  const f = r.form;
  const usable = f.typedWidget + f.nested;
  return `| ${r.label} | ${r.ir.nodeShapes} | ${r.ir.propertyShapes} | ${r.ir.groups} | ${r.ir.named} (${pct(r.ir.named, r.ir.propertyShapes)}) | ${f.fields} | ${f.typedWidget} | ${f.nested} | ${f.plainTextFallback} | ${f.readOnly} | ${f.noWidget} | **${pct(usable, f.fields)}** |`;
}

/** A short column header: the label up to its first parenthesis or dash. */
function short(r: ProfileResult): string {
  return r.label.split(/[(—]/)[0].trim();
}

// ---------------------------------------------------------------------- run

it("E1: measure coverage across published SHACL profiles", async () => {
  const results: ProfileResult[] = [];
  for (const spec of PROFILES) {
    console.log(`[E1] ${spec.id}…`);
    results.push(await analyse(spec));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const out = join(HERE, "results");
  mkdirSync(out, { recursive: true });
  const primary = results.filter((r) => !r.variantOf);
  // Sort the histogram records on the way out. Their insertion order comes from
  // rudof's hash iteration and is not stable between runs; the values are, and a
  // committed artefact that churns on every run is one nobody will trust.
  const stable = (_k: string, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v;
  writeFileSync(
    join(out, "coverage.json"),
    JSON.stringify({
      generated: stamp,
      n: primary.length,
      nExternal: primary.filter((r) => r.origin === "external").length,
      widgetRegistry: [...REGISTERED].sort(),
      results,
    }, stable, 2),
  );
  writeFileSync(join(out, "coverage.md"), markdown(results, stamp));
  console.log(`[E1] wrote ${join(out, "coverage.md")}`);
});

/**
 * The baseline the whole experiment reports rests on one fact: `dash:editor` is
 * recorded and NOT acted on, while `shui:editor` selects the widget. If the fork
 * ever starts honouring DASH, every percentage above changes meaning, so it is
 * asserted here rather than described in prose that could go stale.
 */
it("E1: the measured baseline — dash:editor is ignored, shui:editor is honoured", async () => {
  const shapes = await createRudofEngine().loadShapes(`
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix dash: <http://datashapes.org/dash#> .
    @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix ex: <http://example.org/> .
    ex:S a sh:NodeShape ; sh:targetClass ex:C ;
      sh:property [ sh:path ex:dashed ; sh:datatype xsd:string ; dash:editor dash:TextAreaEditor ] ,
                  [ sh:path ex:shui   ; sh:datatype xsd:string ; shui:editor shui:TextAreaEditor ] .
  `);
  const props = [...shapes.nodeShapes.values()][0].properties;
  const editorOf = (p: string) => props.find((x) => x.pathKey.endsWith(p))!.presentation.editor;
  expect(editorOf("dashed")).toBe(Editors.TextField);
  expect(editorOf("shui")).toBe(Editors.TextArea);
});
