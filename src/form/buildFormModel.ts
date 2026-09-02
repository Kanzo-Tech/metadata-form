import type { NamedNode, Term } from "@rdfjs/types";
import { blankNode, namedNode } from "../engine/factory.js";
import { localName, pickByLanguage } from "../engine/terms.js";
import { toTerm } from "../engine/termValue.js";
import { SH_IRI } from "./vocab/shacl.js";
import { Editors } from "./vocab/shacl-ui.js";
import { conjoinByPath } from "./conjunction.js";
import { nodeDisjunction, planDisjunction, type Disjunction } from "./disjunction.js";
import { planWrite, resolveCarrier, writesSubjects } from "./writePath.js";
import { resolveStrings, type Strings } from "../i18n/strings.js";
import type { FieldWrite, StepReader, WriteStep } from "./writePath.js";
import type {
  FieldAlternative,
  FieldConstraints,
  FieldModel,
  FieldOption,
  FormModel,
  GroupModel,
  ReadOnlyCode,
  ReadOnlyReason,
  ValueSlot,
} from "../form/FormModel.js";
import type { ProjectedValues } from "../engine/projectTree.js";
import type {
  NodeShapeIR,
  PropertyShapeIR,
  ShapeIR,
  ShapeModel,
} from "../form/ShapeIR.js";

/** A non-fatal issue surfaced while building the form (instead of failing
 * silently) — e.g. a property dropped for an unsupported path, or a `sh:node`
 * pointing at a missing shape. Opt-in via `onDiagnostic`. */
export interface Diagnostic {
  level: "warning" | "info";
  /** Stable code for filtering/i18n. */
  code:
    | "unsupported-path"
    | "missing-shape"
    | "deactivated-shape"
    /** One arm of an `sh:or` the field cannot offer, so the control accepts less
     *  than the profile allows. Never a silent narrowing. */
    | "unrenderable-alternative"
    /** Several property shapes on one path became one field, as SHACL's
     *  conjunction says they are. `detail` is the path, the message the count. */
    | "conjoined-property"
    /** A demand of one of those shapes that the merged control cannot carry
     *  (two `sh:class`es, two `sh:pattern`s), though a value still satisfies it.
     *  The validator still checks it; only the widget hint is partial. */
    | "conflicting-constraint"
    /** The conjunction admits no value at all — the field is read-only, and the
     *  contradiction is a defect in the profile. */
    | "unsatisfiable-property"
    | string;
  message: string;
  /** The shape/path/node the diagnostic concerns, if any. */
  detail?: string;
}

export type DiagnosticSink = (diagnostic: Diagnostic) => void;

export interface BuildArgs {
  shapes: ShapeModel;
  focusNode: Term;
  shape: NodeShapeIR;
  locale?: string;
  onDiagnostic?: DiagnosticSink;
  /** Pre-projected field values, keyed by `${focusNode}|${pathKey}` (the
   *  single-graph projection). The sole value source; defaults to empty (so
   *  structure-only callers get empty slots). */
  values?: ProjectedValues;
  /** Per-focus set of satisfied SHACL-1.2 conditional `conditionId`s (keyed by
   *  `focus.value`), from the projection. Gates which conditional branch's fields
   *  are built. Defaults to empty (no conditional is active). */
  satisfied?: Map<string, Set<string>>;
  /**
   * Reads one step of a property path from a node (see {@link StepReader}) —
   * `GraphState.readStep` in the running form.
   *
   * Only a **sequence** path needs it, and only to answer a question about the
   * data rather than the shape: does the intermediate node this value hangs off
   * exist, and is it unique? Without a reader the honest answer is "no
   * intermediate" — which is exactly right for a structure-only build over no
   * data graph — so those fields come out read-only with that reason.
   */
  readStep?: StepReader;
  /** UI string catalog for the read-only reasons. Defaults to the built-in table
   *  for `locale`; pass the controller's resolved catalog so a consumer override
   *  reaches the field model too. */
  strings?: Strings;
}

/** Inner build args: projected values are always resolved (defaulted) before recursion. */
type InnerArgs = Omit<BuildArgs, "values" | "satisfied" | "strings"> & {
  values: ProjectedValues;
  satisfied: Map<string, Set<string>>;
  strings: Strings;
};

const DEFAULT_GROUP = "__default__";

/** Build a FormModel for a focus node against a node shape (recursive). */
export function buildFormModel(args: BuildArgs): FormModel {
  return buildInner(
    {
      ...args,
      values: args.values ?? new Map(),
      satisfied: args.satisfied ?? new Map(),
      strings: args.strings ?? resolveStrings(args.locale),
    },
    new Set(),
  );
}

interface FieldCtx {
  shapes: ShapeModel;
  focusNode: Term;
  locale?: string;
  onDiagnostic?: DiagnosticSink;
  values: ProjectedValues;
  satisfied: Map<string, Set<string>>;
  readStep?: StepReader;
  strings: Strings;
}

function buildInner(args: InnerArgs, visited: Set<string>): FormModel {
  const { shapes, focusNode, shape, locale, onDiagnostic, values, satisfied, readStep, strings } = args;
  const guardKey = `${shape.id}::${focusNode.value}`;
  const cyclic = visited.has(guardKey);
  const nextVisited = new Set(visited).add(guardKey);
  const ctx: FieldCtx = { shapes, focusNode, locale, onDiagnostic, values, satisfied, readStep, strings };

  // A deactivated shape constrains nothing (SHACL §2.1.6: every term conforms to
  // it, and the validator reports nothing for it), so it renders nothing — down to
  // its conditionals. Rendering its fields would collect input nobody validates.
  if (shape.deactivated) {
    onDiagnostic?.({
      level: "info",
      code: "deactivated-shape",
      message: "Node shape is sh:deactivated; no fields are built for it.",
      detail: shape.id,
    });
    return { focusNode, shape: namedNode(shape.id), groups: [] };
  }

  // Every property shape that applies to this focus right now: the node shape's
  // own, plus the active branch of each SHACL 1.2 conditional (then when the focus
  // conforms to the sh:if, else when it doesn't — rudof evaluated conformance
  // canonically, we only read `satisfied`). They are gathered before any field is
  // built because they are conjoined by path, and a branch that is active applies
  // exactly as the node shape's own do.
  const active = satisfied.get(focusNode.value) ?? EMPTY_SET;
  const applicable: Applicable[] = shape.properties.map((ps) => ({ ps }));
  for (const cond of shape.conditionals ?? []) {
    const branch: "then" | "else" = active.has(cond.conditionId) ? "then" : "else";
    for (const ps of cond[branch]) {
      applicable.push({ ps, guard: { conditionId: cond.conditionId, branch } });
    }
  }

  const fields = buildFields(applicable, ctx, nextVisited, cyclic);
  return { focusNode, shape: namedNode(shape.id), groups: groupFields(fields, shapes, locale) };
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/** A property shape that applies to the focus, with the conditional branch it
 *  came from when it came from one. */
interface Applicable {
  ps: PropertyShapeIR;
  guard?: FieldModel["guard"];
}

/**
 * Build one field per (focus, path) — the identity the model already declares,
 * since `FieldModel.id` is `fieldKey(focusNode, path)` and that key is what the
 * projection files values under and what validation results are matched by.
 *
 * A profile may state the same path over several property shapes, and generated
 * ones do; SHACL requires the focus to conform to all of them, so they are one
 * field whose constraints are their conjunction. See {@link conjoinByPath}.
 */
function buildFields(
  applicable: Applicable[],
  ctx: FieldCtx,
  visited: Set<string>,
  cyclic: boolean,
): FieldModel[] {
  // sh:deactivated (SHACL §2.1.6): the profile switched this property shape off,
  // so the validator ignores it. A field here would be filled in and never
  // checked — silently producing unvalidated data, and its constraints would
  // narrow the conjunction its path's live shapes make. Drop it before merging.
  const live = applicable.filter(({ ps }) => {
    if (!ps.deactivated) return true;
    ctx.onDiagnostic?.({
      level: "info",
      code: "deactivated-shape",
      message: "Property shape is sh:deactivated; no field is built for it.",
      detail: ps.id ?? ps.pathKey,
    });
    return false;
  });

  const fields: FieldModel[] = [];
  for (const conjoined of conjoinByPath(live.map((a) => a.ps))) {
    const { shape: ps, sources } = conjoined;
    if (sources > 1) {
      ctx.onDiagnostic?.({
        level: "info",
        code: "conjoined-property",
        message: `${sources} property shapes state this path; the field is their conjunction.`,
        detail: ps.pathKey,
      });
    }
    for (const n of conjoined.notes) {
      ctx.onDiagnostic?.({
        level: n.kind === "constraint" ? "warning" : "info",
        code: "conflicting-constraint",
        message:
          `Property shapes on this path disagree on ${n.facet}: kept ${n.kept}, ` +
          `not carried ${n.dropped.join(", ")}.` +
          (n.kind === "constraint" ? " The validator still checks all of them." : ""),
        detail: ps.pathKey,
      });
    }
    if (conjoined.unsatisfiable) {
      ctx.onDiagnostic?.({
        level: "warning",
        code: "unsatisfiable-property",
        message: `No value can satisfy every property shape on this path: ${conjoined.unsatisfiable}.`,
        detail: ps.pathKey,
      });
    }
    const field = buildField(ps, ctx, visited, cyclic, conjoined.unsatisfiable);
    // A field is conditional only when *every* shape behind it is, and on the
    // same branch: a constraint the condition adds to a property the node shape
    // already has does not make the property conditional.
    const guards = live.filter((a) => a.ps.pathKey === ps.pathKey).map((a) => a.guard);
    const [first] = guards;
    if (first && guards.every((g) => g?.conditionId === first.conditionId && g.branch === first.branch)) {
      field.guard = first;
    }
    fields.push(field);
  }
  return fields;
}

/**
 * Decide whether this property is editable, and how.
 *
 * Two gates, in this order, because they answer different questions. The first
 * is about the *shape*: {@link planWrite} asks whether the path is one a value
 * can be asserted through at all. The second is about the *data*: a sequence's
 * intermediate node has to exist and be unique, which the shape cannot say and
 * only the graph can. A field can therefore pass the shape gate and still be
 * read-only right now — and become editable when the intermediate is filled in,
 * which is the correct behaviour and not a glitch.
 */
function resolveWrite(
  ps: PropertyShapeIR,
  ctx: FieldCtx,
): { write: FieldWrite } | { reason: ReadOnlyReason } {
  const reason = (code: ReadOnlyCode): { reason: ReadOnlyReason } => ({
    reason: { code, message: ctx.strings.readOnly[code], detail: ps.pathKey },
  });

  const plan = planWrite(ps.path);
  if ("readOnly" in plan) return reason(plan.readOnly);

  for (const branch of plan.write.branches) {
    if (branch.via.length === 0) continue;
    const carrier = resolveCarrier(ctx.readStep, ctx.focusNode, branch);
    if ("readOnly" in carrier) return reason(carrier.readOnly);
  }
  return { write: plan.write };
}

function buildField(
  ps: PropertyShapeIR,
  ctx: FieldCtx,
  visited: Set<string>,
  cyclic: boolean,
  /** Set when the property shapes on this path contradict each other, so no term
   *  conforms to all of them (see {@link conjoinByPath}). */
  unsatisfiable?: string,
): FieldModel {
  // One key for the field, its projected values and its validation results: the
  // engine's canonical path key, which is the predicate IRI for a predicate path.
  const path = namedNode(ps.pathKey);
  const id = `${ctx.focusNode.value}|${ps.pathKey}`;
  const resolved = resolveWrite(ps, ctx);
  const write = "write" in resolved ? resolved.write : undefined;
  const label =
    pickByLanguage(ps.presentation.names, ctx.locale)?.value ?? fallbackLabel(ps, write);
  const description = pickByLanguage(ps.presentation.descriptions, ctx.locale)?.value;

  const v = ps.value;
  const constraints: FieldConstraints = {
    datatype: v.datatype,
    // An inverse path writes its value as the SUBJECT of a statement, so the value
    // is an IRI or a blank node by RDF's own grammar — a fact the shape rarely
    // bothers to restate. Filled in only where the author left it unstated, and
    // only where every branch is inverse (a mixed alternative can still take a
    // literal, through its forward branch).
    nodeKind: v.nodeKind ?? (write && writesSubjects(write) ? SH_IRI : undefined),
    classIri: v.classIri,
    pattern: v.pattern,
    flags: v.flags,
    minLength: v.minLength,
    maxLength: v.maxLength,
    minInclusive: v.minInclusive,
    maxInclusive: v.maxInclusive,
    minExclusive: v.minExclusive,
    maxExclusive: v.maxExclusive,
    options: optionsFrom(ps),
    defaultValue: v.defaultValue ? toTerm(v.defaultValue) : undefined,
    hasValue: v.hasValue ? toTerm(v.hasValue) : undefined,
    uniqueLang: v.uniqueLang,
    languageIn: v.languageIn,
  };

  // rudof resolves the editor (explicit shui:editor else a datatype default) and
  // always emits it; the UI only maps the IRI → widget. The one case it cannot
  // resolve is a property with NO type facts on an inverse path: its default is a
  // text field, and we know the one fact it was missing (see `nodeKind` above).
  // An editor the author actually stated is left alone — a bare text default is
  // not a preference, and this is the only way to tell the two apart.
  const statedEditor = ps.presentation.editor ?? Editors.TextField;
  const inferredIri = !v.nodeKind && constraints.nodeKind === SH_IRI;
  const editorId = inferredIri && statedEditor === Editors.TextField ? Editors.IRI : statedEditor;

  const minCount = ps.cardinality.min ?? 0;
  const maxCount = ps.cardinality.max;
  const repeatable = maxCount === undefined || maxCount > 1;

  const referenced = ps.node ? ctx.shapes.nodeShapes.get(ps.node) : undefined;
  if (ps.node && !referenced) {
    ctx.onDiagnostic?.({
      level: "warning",
      code: "missing-shape",
      message: "sh:node references a shape that is not defined; the nested form will not render.",
      detail: ps.node,
    });
  }

  // A `sh:node` whose target is nothing but an `sh:or` is not a sub-form: it is a
  // value kind the profile named once so it could be reused. Treat its branches
  // as this property's own, and drop the reference — a nested form for it would
  // be an empty box, which is what 16 DCAT-AP / HealthDCAT-AP properties get today.
  const inlined = referenced ? nodeDisjunction(referenced) : undefined;
  const nestedShape = inlined ? undefined : referenced;
  const branches: ShapeIR[] = [...(ps.logical.or ?? []), ...(inlined ?? [])];

  // The editor rudof emitted is a derivation wherever it is the bare text default,
  // and the `Details` of an inlined `sh:node` came from a reference we have just
  // established is not a sub-form. Neither is a control the property really has, so
  // neither yields to a branch's editor — nor counts as one worth protecting from
  // a refusal.
  const derivedDefault = statedEditor === Editors.TextField || (!!inlined && statedEditor === Editors.Details);

  const disjunction = branches.length
    ? planDisjunction({
        branches,
        own: constraints,
        fieldId: id,
        locale: ctx.locale,
        ownControl: !derivedDefault,
      })
    : undefined;
  reportDropped(disjunction, ps, ctx);

  // The disjunction is not allowed to overrule a path we already refused: a value
  // we know where to put but not what to make of it, and a value we know what to
  // make of but not where to put, are both unwritable, and the path's reason is
  // the one the user can act on (fill in the intermediate resource).
  const refused = write !== undefined && disjunction?.kind === "refused";
  const alternatives = disjunction?.kind === "renderable" ? disjunction.alternatives : undefined;
  const chosen: FieldAlternative | undefined = refused ? undefined : alternatives?.[0];

  const effective = chosen?.constraints ?? constraints;
  const effectiveEditor = chosen && derivedDefault ? chosen.editorId : editorId;

  const values = projectValues(ps, id, ctx, effectiveEditor, nestedShape, visited, cyclic);
  const nestedTypeIri = nestedShape?.instanceClass;

  // Three ways a field can take no input, in the order of what they say. A
  // contradiction between the shapes on this path comes first: it is the only one
  // that no data and no user action can resolve, because no term at all conforms.
  // Then the path (a value we know what to make of but not where to put), then a
  // disjunction of structures (a value we know where to put but not what to make
  // of) — the path's reason wins there because filling in the intermediate is
  // something the user can actually do.
  const code: ReadOnlyCode | undefined = unsatisfiable
    ? "unsatisfiable-conjunction"
    : "reason" in resolved
      ? resolved.reason.code
      : refused
        ? "disjunction-of-shapes"
        : undefined;
  const readOnlyReason: ReadOnlyReason | undefined = code
    ? { code, message: ctx.strings.readOnly[code], detail: ps.pathKey }
    : undefined;

  return {
    id,
    path,
    pathKind: ps.path.kind === "predicate" ? "predicate" : "complex",
    label,
    description,
    editorId: effectiveEditor,
    required: minCount >= 1,
    repeatable,
    minCount,
    maxCount,
    order: ps.presentation.order ?? Number.MAX_SAFE_INTEGER,
    groupId: ps.presentation.groupId ?? DEFAULT_GROUP,
    constraints: effective,
    // Only a disjunction that left more than one KIND of value open is a choice
    // the user has to make; one that resolved to a single editor is already folded
    // into `constraints` and would be a picker with one entry.
    alternatives: alternatives && alternatives.length > 1 ? alternatives : undefined,
    write: readOnlyReason ? undefined : write,
    readOnly: readOnlyReason ? true : undefined,
    readOnlyReason,
    nodeShape: nestedShape ? namedNode(nestedShape.id) : null,
    nestedTypeIri,
    values,
  };
}

/** Report every arm of a disjunction the field could not offer. A control that
 *  accepts less than the profile allows is sound — `sh:or` only narrows — but it
 *  is never something to do quietly. */
function reportDropped(
  disjunction: Disjunction | undefined,
  ps: PropertyShapeIR,
  ctx: FieldCtx,
): void {
  for (const d of disjunction?.dropped ?? []) {
    if (d.code === "no-kind") continue; // it ruled nothing out; nothing was lost
    ctx.onDiagnostic?.({
      level: "info",
      code: "unrenderable-alternative",
      message: `sh:or alternative ${d.index + 1} is not offered: ${d.why}.`,
      detail: d.id ?? ps.id ?? ps.pathKey,
    });
  }
}

/**
 * The label for a property the author did not name.
 *
 * A single step reads as its own local name (an inverse one prefixed, because
 * "← parent" and "parent" are opposite questions and would otherwise share a
 * label). An alternative whose branches agree on their local name is the
 * interesting case: `(http://schema.org/name|https://schema.org/name)` is not two
 * properties, it is one property written in two namespaces to paper over a
 * vocabulary split — the whole of Bioschemas is built this way — and "name" is
 * what it is called. Where the branches genuinely differ, the path key is shown
 * rather than a name picked from one branch, since that would hide the other.
 */
function fallbackLabel(ps: PropertyShapeIR, write: FieldWrite | undefined): string {
  const steps: WriteStep[] | undefined = write?.branches.every((b) => b.via.length === 0)
    ? write.branches.map((b) => b.step)
    : undefined;
  if (!steps || steps.length === 0) return ps.pathKey;
  const names = new Set(steps.map((s) => localName(s.predicate.value)));
  const directions = new Set(steps.map((s) => s.direction));
  if (names.size !== 1 || directions.size !== 1) return ps.pathKey;
  const [name] = names;
  return steps[0].direction === "inverse" ? `← ${name}` : name;
}

function projectValues(
  ps: PropertyShapeIR,
  id: string,
  ctx: FieldCtx,
  editor: string,
  nestedShape: NodeShapeIR | undefined,
  visited: Set<string>,
  cyclic: boolean,
): ValueSlot[] {
  const isNested = (editor === Editors.Details || !!ps.node) && !cyclic;
  const slots = ctx.values.get(id) ?? [];

  return slots.map((s, i) => {
    const slot: ValueSlot = { id: `${id}#${i}`, value: s.value };
    const sub = s.nestedFocus;
    if (isNested && nestedShape && sub && (sub.termType === "NamedNode" || sub.termType === "BlankNode")) {
      slot.nested = buildInner(
        {
          shapes: ctx.shapes,
          focusNode: sub,
          shape: nestedShape,
          locale: ctx.locale,
          onDiagnostic: ctx.onDiagnostic,
          values: ctx.values,
          satisfied: ctx.satisfied,
          readStep: ctx.readStep,
          strings: ctx.strings,
        },
        visited,
      );
    }
    return slot;
  });
}

function optionsFrom(ps: PropertyShapeIR): FieldOption[] | undefined {
  const list = ps.value.in;
  if (!list || list.length === 0) return undefined;
  return list.map((tv) => ({
    value: toTerm(tv),
    label: tv.termType === "Literal" ? tv.value : localName(tv.value),
  }));
}

function groupFields(fields: FieldModel[], shapes: ShapeModel, locale: string | undefined): GroupModel[] {
  const byGroup = new Map<string, FieldModel[]>();
  for (const f of fields) {
    const arr = byGroup.get(f.groupId) ?? [];
    arr.push(f);
    byGroup.set(f.groupId, arr);
  }

  const groups: GroupModel[] = [];
  for (const [groupId, groupFieldsList] of byGroup) {
    const meta = shapes.groups.get(groupId);
    groupFieldsList.sort(orderCompare);
    groups.push({
      id: groupId,
      label: meta ? pickByLanguage(meta.labels, locale)?.value : undefined,
      order: meta?.order ?? (groupId === DEFAULT_GROUP ? Number.MAX_SAFE_INTEGER : 0),
      fields: groupFieldsList,
    });
  }
  groups.sort((a, b) => a.order - b.order);
  return groups;
}

function orderCompare(a: FieldModel, b: FieldModel): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.label.localeCompare(b.label);
}

/** Create a fresh focus node (blank node) for an empty form. */
export function freshFocusNode(): Term {
  return blankNode();
}

/** Resolve the root node shape from the focus node's rdf:type values (read from
 *  the engine session backend): explicit > rdf:type vs target class > first shape
 *  with a target class > first shape. */
export function resolveRootShapeFromTypes(
  shapes: ShapeModel,
  types: string[],
  rootShape?: NamedNode,
): NodeShapeIR | undefined {
  if (rootShape) return shapes.nodeShapes.get(rootShape.value);

  // A deactivated shape (SHACL §2.1.6) constrains nothing, so it is never the
  // shape a form is built from — keep looking for a live one.
  const live = (s: NodeShapeIR | undefined) => (s && !s.deactivated ? s : undefined);

  for (const t of types) {
    const id = shapes.byTargetClass.get(t);
    const shape = id ? live(shapes.nodeShapes.get(id)) : undefined;
    if (shape) return shape;
  }

  // Prefer the entry shape: a target-class shape that no other shape nests via
  // sh:node. Order-independent, so it's robust to non-deterministic shape order
  // from the parser (e.g. rudof's HashMap-backed AST).
  const nested = new Set<string>();
  for (const s of shapes.nodeShapes.values()) {
    collectNodeRefs(s.properties, nested);
    for (const c of s.conditionals ?? []) collectNodeRefs([...c.then, ...c.else], nested);
  }
  const active = [...shapes.nodeShapes.values()].filter((s) => !s.deactivated);
  const targets = active.filter((s) => s.targetClasses.length > 0);
  const root = targets.find((s) => !nested.has(s.id)) ?? targets[0];
  if (root) return root;
  return active[0];
}

/** Collect every `sh:node` reference reachable from these shapes (including
 *  logical and/or/xone/not branches, which are shapes and may carry one). */
function collectNodeRefs(properties: ShapeIR[], out: Set<string>): void {
  for (const ps of properties) {
    if (ps.node) out.add(ps.node);
    const { or, and, xone, not } = ps.logical;
    for (const branch of [...(or ?? []), ...(and ?? []), ...(xone ?? []), ...(not ? [not] : [])]) {
      collectNodeRefs([branch], out);
    }
  }
}
