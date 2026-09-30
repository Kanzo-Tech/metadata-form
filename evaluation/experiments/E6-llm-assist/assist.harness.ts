/**
 * E6 — shape-constrained LLM assist.
 *
 * The question is **architectural**, not qualitative: where does the shape bound
 * a model's suggestion, and where does it not? Nothing here evaluates output
 * quality — no model is called at all. Every number and every `file:line` in
 * `results/assist.md` is produced by this harness from the tree.
 *
 * What it measures, per bundled profile:
 *
 *   1. **The separation.** Which modules of `src/` import an AI package
 *      (`ai`, `zod`, `@kanzo-tech/ai`, a provider). (Answer: only those under
 *      `src/ai/`, which is its own export subpath.) Counted by parsing the
 *      imports, not asserted.
 *   2. **Where the ✨ is offered and where it is withheld**, per field, from the
 *      real engine → `buildFormModel` → widget registry path the app uses, and
 *      **what the default prompt states about each assisted field**
 *      (`fieldContext`, the one place a constraint can reach the model).
 *   3. **What survives the commit.** Every suggestion reaches the graph through
 *      one function, `primitiveToTerm`. The harness pushes a battery of hostile
 *      candidate strings through it, per field, and records the term that comes
 *      out — which is how "bounded by the shape" is separated from "bounded by
 *      the prompt" and from "not bounded at all".
 *   4. **What the shape catches afterwards.** The hostile values that survive
 *      the commit are written into a real graph and validated by rudof, so the
 *      report says which of them the shape catches post-hoc.
 *
 * Emits results/assist.json (machine) and results/assist.md (paper).
 *
 * Run:
 *   npx vitest run --config evaluation/experiments/vitest.config.ts E6-llm-assist
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { expect, it } from "vitest";
import { createRudofEngine } from "@/engine/index.js";
import { buildFormModel } from "@/form/buildFormModel.js";
import { allFields, type FieldModel } from "@/form/FormModel.js";
import { fieldContext } from "@/ai/context.js";
import { defaultWidgets } from "@/react/widgets/defaultWidgets.js";
import { widgetAssist } from "@/react/widgets/widgets.js";
import { primitiveToTerm } from "@/form/termBinding.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { namedNode } from "@/form/factory.js";
import { healthDcatApShapes, healthDcatApRootShape } from "@examples/health-dcat-ap/index.js";
import { evidenzeHealthShapes, evidenzeHealthRootShape } from "@examples/evidenze-health/index.js";

const HERE = __dirname;
const REPO = resolve(HERE, "../../..");
const OUT = join(HERE, "results");

// ------------------------------------------------------------------ citations

/**
 * `path:line` for a literal fragment of a source file. Citations in the report
 * are computed, never typed, so a refactor cannot leave the paper pointing at
 * the wrong line — it fails the run instead.
 */
function cite(file: string, needle: string): string {
  const rel = file;
  const lines = readFileSync(resolve(REPO, file), "utf8").split("\n");
  const i = lines.findIndex((l) => l.includes(needle));
  if (i < 0) throw new Error(`E6: anchor not found in ${rel}: ${JSON.stringify(needle)}`);
  return `${rel}:${i + 1}`;
}

// ------------------------------------------------------- the separation claim

const SDK_IMPORT = /^\s*import\s[^;]*?from\s+["'](ai|zod|@kanzo-tech\/ai|@ai-sdk\/[^"']+|openai|@anthropic-ai\/[^"']+)["']/m;

/** Every `.ts`/`.tsx` under a directory. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourcesUnder(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

interface Separation {
  sourceFiles: number;
  /** Files importing an AI package (`ai`, `zod`, `@kanzo-tech/ai`, a provider), and what they import. */
  sdkImporters: { file: string; imports: string[] }[];
  /** The subpath those files are published under, from package.json `exports`. */
  subpath: string | null;
  /** Whether the main barrel re-exports any of them. */
  barrelReexportsAi: boolean;
  /** How `package.json` declares the SDK dependency. */
  peerOptional: Record<string, boolean>;
}

function measureSeparation(): Separation {
  const files = sourcesUnder(resolve(REPO, "src"));
  const sdkImporters: Separation["sdkImporters"] = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    const imports = [...text.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)]
      .map((m) => m[1])
      .filter((s) => SDK_IMPORT.test(`import x from "${s}"`));
    if (imports.length) sdkImporters.push({ file: relative(REPO, f), imports });
  }
  const pkg = JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8"));
  const barrel = readFileSync(resolve(REPO, "src/index.ts"), "utf8");
  return {
    sourceFiles: files.length,
    sdkImporters,
    subpath: Object.keys(pkg.exports ?? {}).find((k) => k.endsWith("/ai")) ?? null,
    barrelReexportsAi: /from\s+["']\.\/ai\//.test(barrel),
    peerOptional: Object.fromEntries(
      ["ai", "zod", "@kanzo-tech/ai"].map((d) => [d, !!pkg.peerDependenciesMeta?.[d]?.optional]),
    ),
  };
}

// ---------------------------------------------------------------- the fields

const REGISTERED = new Set(Object.keys(defaultWidgets));
const NESTED = new Set<string>([Editors.Details, Editors.BlankNode]);

/** The hostile candidates every assisted field is probed with. A model that
 *  ignored the field entirely would produce something in this set. */
const HOSTILE = [
  "Cardiology Outpatient Registry", // plausible free text
  "not-a-number",
  "9999",
  "http://publications.europa.eu/resource/authority/access-right/SECRET", // plausible, not in the enum
  "did:web:evidenze.example.org", // pattern-conformant
  "web:evidenze.example.org", // pattern-violating, one character short of conformant
];

type Bound = "shape" | "prompt" | "unbounded" | "n/a";

interface FieldRow {
  profile: string;
  label: string;
  path: string;
  /** The predicate this field edits (`sh:path`). */
  predicate: string;
  editorId: string;
  /** The editor the registry actually resolves to (stated, or the fallback). */
  effectiveEditor: string | undefined;
  suggest: boolean;
  complete: boolean;
  /** Why assistance is offered or withheld. */
  reason: string;
  constraints: {
    datatype?: string;
    options?: string[];
    pattern?: string;
    minCount?: number;
    maxCount?: number;
    nodeKind?: string;
    classIri?: string;
  };
  /** Which constraints the field carries, and how each one bounds a suggestion. */
  bounding: Record<string, Bound>;
  /** What the field's shape states, and what of it `fieldContext` puts in the
   *  prompt — computed by reading the context the model would be sent. */
  facets: { facet: string; stated: boolean; carried: boolean }[];
  /** Hostile candidate → the term `primitiveToTerm` commits, or null if rejected. */
  commits: { candidate: string; term: string | null }[];
}

/** The facts a field can state that a prompt could carry, with the line
 *  `fieldContext` opens it with when it does. */
const FACETS: [string, string, (f: FieldModel) => boolean][] = [
  ["sh:description", "Description:", (f) => !!f.description],
  ["sh:datatype / sh:nodeKind / sh:class", "Value type:", (f) => !!(f.constraints.datatype ?? f.constraints.nodeKind ?? f.constraints.classIri)],
  ["sh:in", "Allowed values:", (f) => !!f.constraints.options?.length],
  ["sh:pattern", "Must match", (f) => !!f.constraints.pattern],
  ["sh:minLength / sh:maxLength", "Length:", (f) => f.constraints.minLength !== undefined || f.constraints.maxLength !== undefined],
  ["numeric bounds", "Range:", (f) => ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive"].some((k) => (f.constraints as Record<string, unknown>)[k] !== undefined)],
  ["sh:languageIn", "Language tags allowed:", (f) => !!f.constraints.languageIn?.length],
  ["sh:minCount / sh:maxCount", "Cardinality:", () => true],
];

const term = (t: ReturnType<typeof primitiveToTerm>): string | null => {
  if (!t) return null;
  if (t.termType === "NamedNode") return `<${t.value}>`;
  if (t.termType === "Literal") {
    const l = t as { value: string; language: string; datatype?: { value: string } };
    if (l.language) return `"${l.value}"@${l.language}`;
    const dt = l.datatype?.value;
    return dt && dt !== "http://www.w3.org/2001/XMLSchema#string"
      ? `"${l.value}"^^<${dt}>`
      : `"${l.value}"`;
  }
  return `${t.termType}(${t.value})`;
};

const short = (iri: string | undefined): string =>
  iri ? iri.replace(/^.*[#/]/, "") : "—";

async function analyse(
  profile: string,
  shapesTtl: string,
  rootShape: string,
  locale: string,
): Promise<FieldRow[]> {
  const shapes = await createRudofEngine().loadShapes(shapesTtl);
  const shape = shapes.nodeShapes.get(rootShape);
  if (!shape) throw new Error(`E6: root shape ${rootShape} not in ${profile}`);
  const model = buildFormModel({
    shapes,
    focusNode: namedNode("urn:e6:focus"),
    shape,
    languages: [locale],
  });

  const rows: FieldRow[] = [];
  for (const f of allFields(model) as FieldModel[]) {
    if (NESTED.has(f.editorId) || f.nodeShape) continue;
    const eff = REGISTERED.has(f.editorId) ? f.editorId : REGISTERED.has(Editors.TextField) ? Editors.TextField : undefined;
    const entry = eff ? defaultWidgets[eff] : undefined;
    const caps = entry ? widgetAssist(entry) : {};
    const c = f.constraints;

    const reason = !eff
      ? "no widget at all"
      : caps.suggest
        ? "the widget declares suggest"
        : caps.complete
          ? "the widget declares complete"
          : `the widget (${short(eff)}) declares no assistance`;

    // What the prompt says about the field: read off the context the model is
    // sent, not assumed from what the shape states.
    const assisted = !!(caps.suggest || caps.complete);
    const prompt = assisted ? fieldContext(f) : "";
    const facets = FACETS.map(([facet, line, states]) => ({
      facet,
      stated: states(f),
      carried: prompt.includes(line),
    }));
    const inPrompt = (facet: string) => facets.find((x) => x.facet === facet)!.carried;

    // How each constraint the field carries bounds a suggestion: by EXCLUSION
    // (no ✨), at the COMMIT (`shape`), by the PROMPT (asked, not enforced), or not
    // at all.
    const bounding: Record<string, Bound> = {};
    if (c.options?.length) {
      // sh:in routes to a discrete widget, which declares no assistance: the ✨
      // never appears, so the enum is bounded by EXCLUSION, not by filtering.
      bounding["sh:in"] = assisted ? (inPrompt("sh:in") ? "prompt" : "unbounded") : "shape";
    }
    if (c.datatype) bounding["sh:datatype"] = assisted ? "shape" : "n/a";
    if (c.pattern) {
      bounding["sh:pattern"] = assisted ? (inPrompt("sh:pattern") ? "prompt" : "unbounded") : "n/a";
    }
    if (f.maxCount !== undefined) {
      bounding["sh:maxCount"] = assisted ? (inPrompt("sh:minCount / sh:maxCount") ? "prompt" : "unbounded") : "n/a";
    }
    if (c.classIri) {
      bounding["sh:class"] = assisted ? (inPrompt("sh:datatype / sh:nodeKind / sh:class") ? "prompt" : "unbounded") : "n/a";
    }

    rows.push({
      profile,
      label: f.label,
      path: f.id,
      predicate: f.path.value,
      editorId: f.editorId,
      effectiveEditor: eff,
      suggest: !!caps.suggest,
      complete: !!caps.complete,
      reason,
      constraints: {
        datatype: c.datatype,
        options: c.options?.map((o) => o.value.value),
        pattern: c.pattern,
        minCount: f.minCount,
        maxCount: f.maxCount,
        nodeKind: c.nodeKind,
        classIri: c.classIri,
      },
      bounding,
      facets,
      commits:
        caps.suggest || caps.complete
          ? HOSTILE.map((candidate) => ({ candidate, term: term(primitiveToTerm(f, candidate)) }))
          : [],
    });
  }
  return rows;
}

// ------------------------------------------------------- does the shape catch it

interface PostHoc {
  field: string;
  predicate: string;
  value: string;
  /** Total results the whole graph produced (the stub graph is missing every
   *  other required property, so this is large and uninteresting). */
  total: number;
  /** The results on the probed path — the ones the probe is about. */
  results: { constraint: string; severity: string; message: string }[];
}

/** Write a hostile-but-committable value into a real graph and validate it. */
async function postHoc(
  shapesTtl: string,
  rootShape: string,
  dataTtl: string,
  field: string,
  predicate: string,
  value: string,
): Promise<PostHoc> {
  const engine = createRudofEngine();
  await engine.loadShapes(shapesTtl);
  await engine.loadData(dataTtl);
  const all = await engine.validate(rootShape);
  return {
    field,
    predicate,
    value,
    total: all.length,
    results: all
      .filter((r) => r.path?.value === predicate)
      .map((r) => ({
        constraint: r.constraint ?? "—",
        severity: r.severity,
        message:
          (r.messages ?? [])
            .map((m) => `${m.value}${m.language ? ` (@${m.language})` : ""}`)
            .join(" · ") || "(no message)",
      })),
  };
}

// ------------------------------------------------------------------- the report

it("E6 — where the shape bounds a suggestion, and where it does not", async () => {
  const separation = measureSeparation();

  // Each profile is read in a language it actually publishes labels in: the
  // Evidenze shapes carry `@es`/`@ca` only, and reading them as `en` would put a
  // Catalan label in an English table for no reason.
  const health = await analyse("health-dcat-ap", healthDcatApShapes, healthDcatApRootShape, "en");
  const evidenze = await analyse(
    "evidenze-health",
    evidenzeHealthShapes,
    evidenzeHealthRootShape,
    "es",
  );
  const rows = [...health, ...evidenze];

  // The three fields of the worked example, by path.
  const worked = ["title", "description", "keyword"].map(
    (p) => health.find((r) => r.path.includes(p))!,
  );
  expect(worked.every(Boolean)).toBe(true);

  // The pattern case: a free-text field carrying sh:pattern, which is where the
  // ✨ IS offered and the pattern does NOT bound it.
  const patterned = evidenze.filter((r) => r.constraints.pattern && (r.suggest || r.complete));

  // Post-hoc: commit a pattern-violating value the ✨ could have produced.
  const patternField = patterned[0];
  const HOSTILE_VALUE = "web:evidenze.example.org";
  const posthoc = patternField
    ? await postHoc(
        evidenzeHealthShapes,
        evidenzeHealthRootShape,
        evidenzeHostileData(patternField.predicate, HOSTILE_VALUE),
        patternField.label,
        patternField.predicate,
        HOSTILE_VALUE,
      )
    : null;

  // The `sh:datatype` claim, tested rather than assumed. `applySuggestion` calls
  // `primitiveToTerm(field, raw)` with NO language argument, so on an
  // `rdf:langString` field the coercion produces an untagged plain literal — the
  // one datatype in the corpus where coercion can be wrong rather than merely
  // permissive.
  const langField = rows.find(
    (r) => (r.suggest || r.complete) && r.constraints.datatype?.endsWith("langString"),
  );
  const LANG_VALUE = "Cardiology Outpatient Registry";
  const langProbe = langField
    ? {
        field: langField.label,
        predicate: langField.predicate,
        datatype: langField.constraints.datatype!,
        /** What the commit path produces for a candidate with no language. */
        committed: langField.commits.find((c) => c.candidate === LANG_VALUE)!.term,
        // Two probes, because the answer differs and the difference is the point.
        // `asCommitted` is exactly the term `primitiveToTerm` produced, datatype
        // and all. `asSerialized` is what survives a Turtle round-trip: Turtle
        // has no syntax for an `rdf:langString` with an empty tag, so a
        // serialize/reparse cycle degrades it to a plain `xsd:string`.
        asCommitted: await postHoc(
          evidenzeHealthShapes,
          evidenzeHealthRootShape,
          evidenzeHostileData(langField.predicate, LANG_VALUE, langField.constraints.datatype),
          langField.label,
          langField.predicate,
          LANG_VALUE,
        ),
        asSerialized: await postHoc(
          evidenzeHealthShapes,
          evidenzeHealthRootShape,
          evidenzeHostileData(langField.predicate, LANG_VALUE),
          langField.label,
          langField.predicate,
          LANG_VALUE,
        ),
      }
    : null;

  const summary = {
    generated: new Date().toISOString().slice(0, 10),
    separation,
    fields: rows.length,
    assisted: rows.filter((r) => r.suggest || r.complete).length,
    suggest: rows.filter((r) => r.suggest).length,
    complete: rows.filter((r) => r.complete).length,
    withheld: rows.filter((r) => !r.suggest && !r.complete).length,
    enumFields: rows.filter((r) => r.constraints.options?.length).length,
    enumFieldsAssisted: rows.filter((r) => r.constraints.options?.length && (r.suggest || r.complete))
      .length,
    patternFields: rows.filter((r) => r.constraints.pattern).length,
    patternFieldsAssisted: patterned.length,
    /** Datatypes across the assisted fields — the denominator for the
     *  `sh:datatype` claim. */
    assistedDatatypes: Object.entries(
      rows
        .filter((r) => r.suggest || r.complete)
        .reduce<Record<string, number>>((a, r) => {
          const k = short(r.constraints.datatype) || "(none)";
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
    ).sort((a, b) => b[1] - a[1]),
    /** Per facet, over the assisted fields: how many state it, how many have it in the prompt. */
    promptCoverage: FACETS.map(([facet]) => {
      const cells = rows.filter((r) => r.suggest || r.complete).map((r) => r.facets.find((x) => x.facet === facet)!);
      return { facet, stated: cells.filter((x) => x.stated).length, carried: cells.filter((x) => x.stated && x.carried).length };
    }),
    rows,
    posthoc,
    langProbe,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "assist.json"), JSON.stringify(summary, null, 2) + "\n");
  writeFileSync(join(OUT, "assist.md"), report(summary, worked, patterned, posthoc));

  // Guards — the claims in the report, asserted so a refactor breaks the run
  // rather than the paper.
  expect(separation.sdkImporters.map((s) => s.file).sort()).toEqual(["src/ai/adapter.ts", "src/ai/ui.ts"]);
  expect(separation.barrelReexportsAi).toBe(false);
  expect(separation.subpath).toBe("./ai");
  expect(summary.enumFieldsAssisted).toBe(0); // sh:in is bounded by exclusion
  expect(patterned.length).toBeGreaterThan(0); // sh:pattern is asked for, never enforced
  // Whatever a field states, the prompt carries: a constraint stated and not carried is a gap.
  expect(summary.promptCoverage.every((c) => c.stated === c.carried)).toBe(true);
});

/**
 * A minimal data graph carrying the hostile value on the given predicate, typed
 * so the root shape's `sh:targetClass` reaches it. Only the probed property is
 * present, so every other result in the report is a missing-required one — which
 * is why the report filters to the probed path.
 */
function evidenzeHostileData(predicate: string, value: string, datatype?: string): string {
  const object = datatype ? `"${value}"^^<${datatype}>` : `"${value}"`;
  return `
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
<urn:e6:dataset> rdf:type dcat:Dataset ;
  <${predicate}> ${object} .
`;
}

// -------------------------------------------------------------------- markdown

function report(
  s: ReturnType<typeof Object> & Record<string, never> extends never ? never : any,
  worked: FieldRow[],
  patterned: FieldRow[],
  posthoc: PostHoc | null,
): string {
  const C = {
    adapter: cite("src/ai/adapter.ts", "export function createFormAssist"),
    suggestPrompt: cite("src/ai/adapter.ts", "const suggestPrompt"),
    completePrompt: cite("src/ai/adapter.ts", "const completePrompt"),
    fieldContext: cite("src/ai/context.ts", "export function fieldContext"),
    assistUi: cite("src/ai/ui.ts", "export const assistUi"),
    assistUiSlot: cite("src/react/assistUi.ts", "export interface AssistUi"),
    seam: cite("src/assist.ts", "export interface FormAssist"),
    caps: cite("src/react/widgets/widgets.ts", "export interface AssistSupport"),
    wire: cite("src/react/form/FieldRenderer.tsx", "const suggests = assist?.suggest"),
    wireComplete: cite("src/react/form/FieldRenderer.tsx", "const complete ="),
    apply: cite("src/react/form/FieldRenderer.tsx", "const applySuggestion"),
    coerce: cite("src/form/termBinding.ts", "export function primitiveToTerm"),
    enumOptOut: cite("src/react/widgets/defaultWidgets.tsx", "[Editors.EnumSelect]:"),
    enumWhy: cite("src/react/widgets/defaultWidgets.tsx", "an LLM ✨ suggestion is redundant"),
    patternNote: cite("src/react/form/FieldRenderer.tsx", "never as an HTML `pattern` attribute"),
    ghost: cite("src/react/widgets/defaultWidgets.tsx", "function AssistedTextarea"),
    playgroundWiring: cite("playground/src/lib/assist.ts", "export function makeAssist"),
    fallback: cite("src/react/widgets/widgets.ts", "export function resolveWidget"),
    factoryLiteral: cite("src/form/factory.ts", "export function literal"),
  };

  const fieldTable = (rows: FieldRow[]) =>
    [
      "| Field | Editor | ✨ | ghost | Constraints | Bounded by |",
      "|---|---|:-:|:-:|---|---|",
      ...rows.map((r) => {
        const cons = [
          r.constraints.datatype && `\`${short(r.constraints.datatype)}\``,
          r.constraints.options?.length && `\`sh:in\` (${r.constraints.options.length})`,
          r.constraints.pattern && `\`sh:pattern\``,
          r.constraints.classIri && `\`sh:class\``,
          r.constraints.maxCount !== undefined && `\`maxCount ${r.constraints.maxCount}\``,
        ]
          .filter(Boolean)
          .join(", ");
        const bound = Object.entries(r.bounding)
          .filter(([, v]) => v !== "n/a")
          .map(([k, v]) => `${k}: **${v}**`)
          .join("<br>");
        return `| ${r.label} | \`${short(r.effectiveEditor)}\` | ${r.suggest ? "yes" : "—"} | ${
          r.complete ? "yes" : "—"
        } | ${cons || "—"} | ${bound || "—"} |`;
      }),
    ].join("\n");

  const commitTable = (r: FieldRow) =>
    [
      `| Candidate a model could return | What \`primitiveToTerm\` commits |`,
      "|---|---|",
      ...r.commits.map((c) => `| \`${c.candidate}\` | ${c.term ? `\`${c.term}\`` : "*rejected*"} |`),
    ].join("\n");

  return `# E6 — shape-constrained LLM assist

*Generated by \`assist.harness.ts\` on ${s.generated}. Nothing in this file is
hand-typed; every \`file:line\` is located by anchor text at generation time.*

**No model was called.** This experiment makes no claim about suggestion quality —
see "What is not evaluated" at the end. It measures one thing: where the shape
bounds what a model may put into the graph, and where it does not.

## 1. The seam

The library core never imports an AI package. Measured, not asserted: of
**${s.separation.sourceFiles}** TypeScript files under \`src/\`,
**${s.separation.sdkImporters.length}** import \`ai\`, \`zod\`, \`@kanzo-tech/ai\`, or any provider
package —

${s.separation.sdkImporters.map((i: any) => `- \`${i.file}\` → ${i.imports.map((m: string) => `\`${m}\``).join(", ")}`).join("\n")}

— all of them under \`src/ai/\`, which is published on its own export subpath,
\`metadata-form${s.separation.subpath?.slice(1)}\`. The main barrel does not re-export it
(\`barrelReexportsAi = ${s.separation.barrelReexportsAi}\`), and the form draws no assistance UI
unless it is handed one, so the packages are **optional** peer dependencies
(${Object.entries(s.separation.peerOptional)
    .map(([k, v]) => `\`${k}\`: ${v ? "optional" : "required"}`)
    .join(", ")}). A consumer who wires no model pays nothing and installs nothing.

What the core *does* define is an interface, not an implementation:

| | |
|---|---|
| \`FormAssist\` — the whole seam (\`search\`, \`suggest\`, \`complete\`) | \`${C.seam}\` |
| \`AssistSupport\` — which assistance a *widget* declares it accepts | \`${C.caps}\` |
| \`AssistUi\` — the parts of the ✨ and ghost-text UI the form composes, supplied by the consumer | \`${C.assistUiSlot}\` |
| \`assistUi\` — that UI, from \`@kanzo-tech/ai\` | \`${C.assistUi}\` |
| \`fieldContext\` — what the default prompts state about a field | \`${C.fieldContext}\` |
| \`createFormAssist\` — the optional Vercel-AI-SDK adapter | \`${C.adapter}\` |
| the playground's wiring of a real provider | \`${C.playgroundWiring}\` |

\`FormAssist\` is an async-iterable contract over plain strings. The test suite
fills it with a generator that yields fixed values, so the seam is exercised
end-to-end with no network and no key.

## 2. Where the shape bounds the suggestion

Assistance is **opt-in per widget**, and the widget is chosen from the shape.
That indirection is the whole mechanism: a constraint bounds a suggestion by
deciding which editor the property gets, and the editor decides whether a model
is asked at all (\`${C.wire}\`, \`${C.wireComplete}\`; the engine chooses the editor, and one the
registry has no widget for renders through \`${C.fallback}\`).

Across the two bundled health profiles: **${s.fields}** leaf fields,
**${s.assisted}** assisted (${s.suggest} ✨ menu, ${s.complete} ghost text),
**${s.withheld}** with no assistance offered at all.

### health-dcat-ap

${fieldTable(s.rows.filter((r: FieldRow) => r.profile === "health-dcat-ap"))}

### evidenze-health

${fieldTable(s.rows.filter((r: FieldRow) => r.profile === "evidenze-health"))}

### The four constraints, one at a time

**\`sh:in\` — bounded, by exclusion.** ${s.enumFields} fields in the corpus carry
\`sh:in\`; **${s.enumFieldsAssisted}** of them are assisted. An enumerated property
resolves to \`shui:EnumSelectEditor\`, which is registered as a bare widget with no
\`assist\` key (\`${C.enumOptOut}\`), so the ✨ never renders. The registry says why
in as many words (\`${C.enumWhy}\`): *"the control already lists exactly the allowed
values, so an LLM ✨ suggestion is redundant and could propose an out-of-enum
value."* This is the strongest bound in the system and it is worth being precise
about its shape: the enumeration is enforced by **not asking a model**, not by
filtering what one returns.

**\`sh:datatype\` — applied at the commit, but it *coerces* rather than rejects.**
Every suggestion enters the graph through one function, \`primitiveToTerm\`
(\`${C.coerce}\`), called from \`applySuggestion\` (\`${C.apply}\`). It is driven by
the field's *constraints*, not by whichever control rendered it, so which term a
value becomes is a fact about the shape and two editors over the same property
agree. What it does not do is refuse. Pushing the hostile battery through the
**${worked[0].label}** field (\`${short(worked[0].constraints.datatype)}\`):

${commitTable(worked[0])}

Every candidate is accepted verbatim, which for \`xsd:string\` is correct and also
vacuous. And \`xsd:string\` is nearly all there is: the datatypes across the
**${s.assisted}** assisted fields in this corpus are
${s.assistedDatatypes.map(([d, n]: [string, number]) => `\`${d}\` ×${n}`).join(", ")}.
The typed fields — \`xsd:integer\`, \`xsd:date\`, \`xsd:boolean\` — get typed widgets,
and typed widgets declare no assistance, so the coercion never has a non-string
datatype to enforce. \`sh:datatype\` bounds the *commit*; on the fields where a
model is actually asked, it does not bound the *value*.

${
  s.langProbe
    ? `There is one datatype where the coercion is not merely permissive but
questionable. **${s.langProbe.field}** carries \`sh:datatype ${short(s.langProbe.datatype)}\`.
\`applySuggestion\` calls \`primitiveToTerm(field, raw)\` with **no language
argument** (\`${C.apply}\`), so the coercion produces
\`${s.langProbe.committed}\` — an \`rdf:langString\` with an **empty** language tag,
which RDF does not admit (\`${C.factoryLiteral}\`: a string language argument sets
the datatype to \`rdf:langString\` whether or not the string is empty).

Validating that, two ways:

| The literal in the graph | Results on that path |
|---|---|
| \`"${s.langProbe.asCommitted.value}"^^rdf:langString\` — exactly what the commit produces | ${
        s.langProbe.asCommitted.results.length
          ? s.langProbe.asCommitted.results.map((r: any) => `\`${short(r.constraint)}\``).join(", ")
          : "**none** — the engine's datatype check compares the IRI and is satisfied"
      } |
| \`"${s.langProbe.asCommitted.value}"\` — what survives a Turtle round-trip, since Turtle cannot write an empty tag | ${
        s.langProbe.asSerialized.results.length
          ? s.langProbe.asSerialized.results
              .map((r: any) => `**${short(r.constraint)}** (${r.severity})`)
              .join(", ")
          : "none"
      } |

So the ✨ on a multilingual field commits a literal that validates in memory and
stops validating the moment the document is written out. Recorded rather than
quietly fixed: it is the sharpest available illustration of the gap, and it is a
defect in the assist path, not in the shape.`
    : ""
}

**\`sh:pattern\` — asked for, not enforced.** ${s.patternFields} of the ${s.fields} fields carry
\`sh:pattern\`, and **${s.patternFieldsAssisted}** of those ${s.patternFieldsAssisted === 1 ? "is" : "are"} assisted.
The pattern reaches the prompt (\`${C.fieldContext}\`: *Must match the regular expression*) and
not the commit. It is deliberately not applied in the UI either — an unanchored XPath
regex is not an HTML \`pattern\` attribute, and treating it as one would reject values
the shape accepts (\`${C.patternNote}\`).
${patterned.map((r) => `On **${r.label}** (\`${r.constraints.pattern}\`):\n\n${commitTable(r)}`).join("\n\n")}

The last two rows are the point: the shape distinguishes \`did:web:…\` from
\`web:…\` and the commit does not. A model that was told the pattern is asked to
satisfy it; nothing checks that it did.

**Cardinality — asked for, not enforced.** \`sh:maxCount\` is in the prompt
(*Cardinality*) and gates the *+ Add* button, but not \`applySuggestion\`, which calls
\`addValue\` directly (\`${C.apply}\`). A stream of candidates picked one after another
on a repeatable field is not stopped at \`maxCount\` by this code path.

**\`sh:class\` — asked for, and not the same problem.** Reference fields declare
\`suggest\`, and the prompt names the class (*Value type*), but a model may still be
asked for an IRI it has no way to know exists. The adapter's docblock is explicit
that \`reference\` autocomplete should hit a real vocabulary service and ships no
\`search\` for that reason (\`${C.adapter}\`) — but \`suggest\` is still offered on those
fields.

### What the prompt carries

The default prompts (\`${C.suggestPrompt}\`, \`${C.completePrompt}\`) are written from
\`fieldContext\` (\`${C.fieldContext}\`), which reads the field model and states each
fact the field has, and from the literals already entered on the same resource.
Over the **${s.assisted}** assisted fields, per fact the shape can state, how many
state it and how many have it in the prompt — computed by reading the context
that would be sent:

| Fact | Fields stating it | Of those, in the prompt |
|---|--:|--:|
${s.promptCoverage.map((c: { facet: string; stated: number; carried: number }) => `| ${c.facet} | ${c.stated} | ${c.carried} |`).join("\n")}

**That is the finding, and it is the reverse of what the first version of this
experiment measured** (a default prompt that carried only the label): the shape now
reaches the model in full. What it does not do is reach the *answer*. The bounding
is structural (which fields a model may be asked about) plus a **request** (what the
prompt says); once a model has answered, \`sh:datatype\` decides which kind of term
the answer becomes and no constraint decides whether the answer is admissible.
Overriding \`suggestPrompt\`/\`completePrompt\` replaces the request; nothing filters
what comes back.

## 3. Worked example — title, description, keywords

A health dataset in the bundled \`health-dcat-ap\` profile
(\`examples/health-dcat-ap/shapes.ttl\`):

${[
  "| Property | Shape says | Editor | Assistance |",
  "|---|---|---|---|",
  ...worked.map(
    (r) =>
      `| \`${short(r.path.replace(/\|$/, ""))}\` | ${[
        r.constraints.datatype && `\`sh:datatype ${short(r.constraints.datatype)}\``,
        r.constraints.minCount !== undefined && `\`sh:minCount ${r.constraints.minCount}\``,
        r.constraints.maxCount !== undefined && `\`sh:maxCount ${r.constraints.maxCount}\``,
      ]
        .filter(Boolean)
        .join(", ")} | \`${short(r.effectiveEditor)}\` | ${
        r.suggest ? "✨ menu" : r.complete ? "inline ghost text" : "none"
      } |`,
  ),
].join("\n")}

Three properties, three different answers, none of them configured: **Title** is a
single-valued string, so it gets a text field and the ✨ menu — a short discrete
value where a list of alternatives is the useful gesture. **Description** carries
\`shui:TextAreaEditor\`, so it gets streaming ghost text instead: one continuation
of what the author is already writing, because a menu of paragraphs is not usable
(\`${C.ghost}\`). **Keywords** has no \`sh:maxCount\`, so it is repeatable, and a
repeatable text field renders as one tags input with the ✨ over the whole list.

The same profile's **Access rights** carries \`sh:in\` with three
\`publications.europa.eu\` authority IRIs, and gets no assistance at all. That
contrast — free text assisted, controlled vocabulary not — is the architecture in
one screen.

## 4. What the shape catches afterwards

${
  posthoc
    ? `A pattern-violating value that survives the commit is still caught by the
shape, just later. Writing \`"${posthoc.value}"\` to **${posthoc.field}** and
validating with rudof:

${
  posthoc.results.length
    ? [
        "| Constraint | Severity | Message |",
        "|---|---|---|",
        ...posthoc.results.map(
          (r) => `| \`${short(r.constraint)}\` | ${r.severity} | ${r.message} |`,
        ),
      ].join("\n")
    : "*(no results — see the caveat below)*"
}

${
  posthoc.results.length
    ? `So the guardrail is real but it is the **validator**, not the suggester. The
shape does not stop a model proposing an ill-formed value; it stops the author
saving one without being told. For \`sh:in\` the suggester is the guardrail, and
for everything else the validator is.`
    : `The probe produced no results, which is itself worth recording rather than
hiding: see "Threats" below.`
}`
    : "*No pattern-carrying assisted field found — probe skipped.*"
}

## 5. What is **not** evaluated

Stated plainly because a reviewer will ask, and because the honest answer is
"nothing":

- **No output quality.** No model was called by this harness. There is no
  accuracy, usefulness, acceptance-rate or hallucination measurement, and none is
  claimed anywhere in the paper.
- **No user study.** Whether an author accepts, edits or ignores a suggestion is
  unmeasured.
- **No comparison** against an unassisted form, another assist design, or another
  model.
- **No cost or latency** figure for the assisted path.

The contribution here is architectural: an LLM is an *optional consumer* of a
form the shape already defines, wired through one interface the core does not
implement, and the shape decides — before any model is asked — which fields a
model is allowed to speak for at all. That claim is supported by the tables
above. Nothing beyond it is.

## Threats to validity

1. **Two profiles, both ours or health-domain.** The field counts here describe
   \`health-dcat-ap\` and \`evidenze-health\`, not published SHACL in general. E1 is
   where profile generality is measured.
2. **The bounding is measured statically.** \`primitiveToTerm\` is exercised
   directly with a fixed battery of strings; the report does not observe a real
   model's output distribution, because that would be an evaluation and there
   isn't one.
3. **The \`sh:in\` bound is a registry convention, not an invariant.** A consumer
   registering their own widget for \`shui:EnumSelectEditor\` with
   \`assist: { suggest: true }\` re-opens exactly the hole the default registry
   closes. Nothing in the library prevents that.
4. **The prompt is a default, not a contract.** A consumer overriding
   \`suggestPrompt\` changes what the model sees; the ✨/no-✨ decision is the only
   part of the bounding that survives such an override.
5. **"In the prompt" is a fact about the text sent, not about the answer.** No
   model was called, so whether a model honours a stated constraint is unmeasured.
`;
}
