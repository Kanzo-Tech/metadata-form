/**
 * E5 — what the form ACTUALLY renders for the profile this experiment validates.
 *
 * `validate.py` used to assert that L1 and L2 defects are "preventable at entry
 * by construction — a shape-driven form cannot submit a graph that violates a
 * shape it is generated from". That is a piece of reasoning, not a measurement,
 * and E1 already showed it is too strong: some constructs reach the IR and no
 * widget reads them.
 *
 * So this harness measures the form instead of arguing about it. It loads the
 * same two shapes graphs the validator ran (`data/dcat-ap-3.0.1/dcat-ap-SHACL.ttl`
 * and `data/vocab-shapes.ttl`), builds the real `FormModel` through the real
 * `buildFormModel`, and writes out, for every field the form would render, the
 * facts that decide whether a given defect could have been typed into it:
 *
 *   - which node shape and which path (so a defect can be joined to a field)
 *   - `readOnly` and why (a read-only field takes no input, and — see
 *     `buildComplexField` — has its constraints erased from the field model)
 *   - the resolved editor, after the same fallback the renderer applies
 *   - whether the editor is a *closed* control: an enumeration whose options are
 *     the permitted values, versus an open text/reference control
 *   - the constraint facets the field carries, and — separately — the ones a
 *     widget actually reads
 *
 * `preventability.py` joins this against the 1,369 observed defects. Nothing
 * here touches a harvested record; the output is derived from committed shapes
 * only, so it is committed too.
 *
 * Run:
 *   npx vitest run --config evaluation/experiments/vitest.config.ts \
 *     evaluation/experiments/E5-errors-in-the-wild
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { expect, it } from "vitest";
import { createRudofEngine } from "@/engine/index.js";
import { buildFormModel } from "@/form/buildFormModel.js";
import { allFields, type FieldModel } from "@/form/FormModel.js";
import { fallbackEditorId } from "@/form/editors.js";
import { defaultWidgets } from "@/react/widgets/defaultWidgets.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { namedNode } from "@/form/factory.js";
import type { ShapeModel } from "@/form/ShapeIR.js";

const HERE = __dirname;
const REGISTERED = new Set(Object.keys(defaultWidgets));

/** Editors that render a nested sub-form. `FieldRenderer` branches on these (or
 *  on a non-null `nodeShape`) before it ever asks the widget registry. */
const NESTED_EDITORS = new Set<string>([Editors.Details, Editors.BlankNode]);

/**
 * Editors whose control cannot emit a value outside the enumeration.
 *
 * `makeSelect` picks one of three shapes by option count — a segmented radio
 * group (≤4), a native `<select>` (≤15), or a combobox with `allowCustomValue`
 * OFF (>15) — and `primitiveToTerm` echoes the matched option term back
 * verbatim. All three are closed. `ReferenceField` is deliberately NOT here:
 * its combobox sets `allowCustomValue` on purpose, because "an IRI nobody
 * suggested must survive being typed".
 */
const CLOSED_EDITORS = new Set<string>([Editors.EnumSelect, Editors.EnumMulti]);

/** Constraint facets that reach `WidgetProps` AND are read by a default widget.
 *  Everything else on `FieldConstraints` is carried and never rendered. */
const FACETS_A_WIDGET_READS = new Set([
  "options",      // makeSelect — the enumeration IS the control
  "maxLength",    // Input maxLength — blocks the keystroke
  "languageIn",   // LanguagePicker allowCustomValue={!constrained}
  "minInclusive", // NumberField min, clamped on blur
  "maxInclusive", // NumberField max, clamped on blur
  "datatype",     // not a widget prop, but primitiveToTerm stamps it — see below
  "nodeKind",     // idem
]);

interface FieldRow {
  shapeId: string;
  /** Short local name of the target class, matching validate.py's focus_class. */
  focusClasses: string[];
  pathKey: string;
  pathKind: string;
  editorId: string;
  effectiveEditorId: string | null;
  widgetRegistered: boolean;
  nested: boolean;
  readOnly: boolean;
  readOnlyReason: string | null;
  minCount: number;
  maxCount: number | null;
  repeatable: boolean;
  /** Facets present on the field model. */
  constraints: string[];
  /** Of those, the ones a default widget actually reads. */
  constraintsRead: string[];
  optionCount: number;
  closedControl: boolean;
  datatype: string | null;
  nodeKind: string | null;
  classIri: string | null;
}

function localName(iri: string): string {
  return iri.split(/[#/]/).pop() ?? iri;
}

function rowFor(shapeId: string, targetClasses: string[], f: FieldModel): FieldRow {
  const c = f.constraints ?? {};
  const present = Object.entries(c)
    .filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
    .map(([k]) => k)
    .sort();
  const fb = fallbackEditorId(f);
  const effective = REGISTERED.has(f.editorId) ? f.editorId : REGISTERED.has(fb) ? fb : null;
  const nested = NESTED_EDITORS.has(f.editorId) || !!f.nodeShape;
  return {
    shapeId,
    focusClasses: targetClasses.map(localName),
    pathKey: f.path.value,
    pathKind: f.pathKind,
    editorId: f.editorId,
    effectiveEditorId: effective,
    widgetRegistered: effective !== null,
    nested,
    readOnly: !!f.readOnly,
    readOnlyReason: f.readOnlyReason?.code ?? null,
    minCount: f.minCount,
    maxCount: f.maxCount ?? null,
    repeatable: f.repeatable,
    constraints: present,
    constraintsRead: present.filter((k) => FACETS_A_WIDGET_READS.has(k)),
    optionCount: c.options?.length ?? 0,
    closedControl:
      !f.readOnly && effective !== null && CLOSED_EDITORS.has(effective) && (c.options?.length ?? 0) > 0,
    datatype: c.datatype ?? null,
    nodeKind: c.nodeKind ?? null,
    classIri: c.classIri ?? null,
  };
}

async function inventory(label: string, ttl: string) {
  const shapes: ShapeModel = await createRudofEngine().loadShapes(ttl);
  const focus = namedNode("urn:e5:focus");
  const rows: FieldRow[] = [];
  const failed: string[] = [];
  for (const [shapeId, shape] of shapes.nodeShapes) {
    let model;
    try {
      model = buildFormModel({ shapes, focusNode: focus, shape, locale: "en" });
    } catch (err) {
      failed.push(`${shapeId}: ${String((err as Error)?.message ?? err).slice(0, 120)}`);
      continue;
    }
    const targets = shape.targetClasses ?? [];
    for (const f of allFields(model) as FieldModel[]) rows.push(rowFor(shapeId, targets, f));
  }
  return {
    label,
    nodeShapes: shapes.nodeShapes.size,
    shapesFailed: failed,
    fields: rows.length,
    readOnly: rows.filter((r) => r.readOnly).length,
    complexPath: rows.filter((r) => r.pathKind !== "predicate").length,
    nested: rows.filter((r) => r.nested).length,
    closedControls: rows.filter((r) => r.closedControl).length,
    noWidget: rows.filter((r) => !r.widgetRegistered && !r.nested).length,
    // A TOTAL order, deliberately. rudof iterates a shape's property shapes in
    // hash order, which varies between runs, and this profile puts up to four
    // property shapes on one (node shape, path) — so sorting by
    // (shapeId, pathKey) alone leaves genuine ties whose resolution churns the
    // committed file on every re-run with no change in the data. Falling back
    // to the row's own canonical form settles them. The multiset was always
    // stable; only the order was not.
    rows: rows.sort(
      (a, b) =>
        a.shapeId.localeCompare(b.shapeId) ||
        a.pathKey.localeCompare(b.pathKey) ||
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
    ),
  };
}

it("E5 — form field inventory for the validated profile", async () => {
  const l1Path = join(HERE, "data/dcat-ap-3.0.1/dcat-ap-SHACL.ttl");
  const l2Path = join(HERE, "data/vocab-shapes.ttl");
  const l1 = readFileSync(l1Path, "utf8");
  const l2 = readFileSync(l2Path, "utf8");

  // Three inventories, because the honest answer differs between them:
  //   published  — DCAT-AP 3.0.1 exactly as SEMIC ships it (the L1 the records
  //                claim). It carries zero sh:in and zero sh:pattern.
  //   vocab      — the L2 shapes this study had to write to express the
  //                controlled-vocabulary requirements the same document states
  //                in prose.
  //   merged     — both, i.e. a form generated from everything the validator
  //                actually enforced.
  const published = await inventory("published", l1);
  const vocab = await inventory("vocab", l2);
  const merged = await inventory("merged", `${l1}\n${l2}`);

  // Only the merged row inventory is written out; the other two would be
  // subsets of it and this file is committed. Each row records which of the two
  // shapes graphs its node shape came from, which is what lets
  // preventability.py rebuild the published-only view — the honest baseline,
  // since DCAT-AP as published carries no sh:in.
  const vocabShapes = new Set(vocab.rows.map((r) => r.shapeId));
  const mergedRows = merged.rows.map((r) => ({ ...r, fromVocab: vocabShapes.has(r.shapeId) }));

  // Guards. If any of these stop holding, the join in preventability.py is
  // reading a form that no longer exists and the run must fail rather than
  // quietly report the wrong number.
  expect(published.nodeShapes).toBeGreaterThan(0);
  expect(vocab.closedControls).toBeGreaterThan(0); // sh:in must reach a closed control
  expect(published.closedControls).toBe(0); // …and the published profile has none

  // These two pin the scope of the whole preventability measurement.
  //
  // The shapes this experiment validates against use 302 `sh:path` values and
  // every one of them is a plain predicate IRI: no sequence, inverse or
  // alternative paths, no `sh:node`, no `sh:or`. So E1's two largest "cannot
  // render" classes cannot appear here, and — the reason this is an assertion
  // rather than a comment — a change to how the form treats complex paths
  // cannot move E5's numbers either. When `src/form/writePath.ts` made inverse,
  // alternative and resolvable-sequence paths writable, E1's read-only count
  // fell sharply and E5's did not move, because E5's is 0 both before and
  // after. If a future revision of these shapes introduces a complex path this
  // fails, and preventability.py's buckets have to be revisited.
  expect(merged.complexPath).toBe(0);
  expect(merged.readOnly).toBe(0);

  // Guard for the other half of the join: `preventability.py` matches a defect
  // to a field by (target class local name, path IRI), so every field must
  // carry at least one target class or the join silently drops it.
  const untargeted = mergedRows.filter((r) => r.focusClasses.length === 0).length;
  expect(untargeted).toBe(0);

  const out = {
    generated_by: "form_fields.harness.ts",
    library: "metadata-form (this repo), rudof wasm engine",
    note:
      "Derived from committed shapes only. No harvested record is read here; " +
      "join to the corpus happens in preventability.py.",
    inventories: {
      published: { ...published, rows: undefined },
      vocab: { ...vocab, rows: undefined },
      merged: { ...merged, rows: mergedRows },
    },
  };
  mkdirSync(resolve(HERE, "results"), { recursive: true });
  // Compact on purpose: the row inventory is 600+ fields and this file is
  // committed. It is machine input for preventability.py, not something to read.
  writeFileSync(resolve(HERE, "results/form-fields.json"), JSON.stringify(out));
});
