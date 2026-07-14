import type { NamedNode, Term } from "@rdfjs/types";
import { blankNode, namedNode } from "../engine/factory.js";
import { pickByLanguage } from "../engine/terms.js";
import { toTerm } from "../engine/termValue.js";
import { SH_IRI } from "./vocab/shacl.js";
import { Editors } from "./vocab/shacl-ui.js";
import type {
  FieldConstraints,
  FieldModel,
  FieldOption,
  FormModel,
  GroupModel,
  ValueSlot,
} from "../form/FormModel.js";
import type { ProjectedValues } from "../engine/projectTree.js";
import type {
  NodeShapeIR,
  PropertyShapeIR,
  ShapeModel,
} from "../form/ShapeIR.js";

/** A non-fatal issue surfaced while building the form (instead of failing
 * silently) — e.g. a property dropped for an unsupported path, or a `sh:node`
 * pointing at a missing shape. Opt-in via `onDiagnostic`. */
export interface Diagnostic {
  level: "warning" | "info";
  /** Stable code for filtering/i18n. */
  code: "unsupported-path" | "missing-shape" | string;
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
}

/** Inner build args: projected values are always resolved (defaulted) before recursion. */
type InnerArgs = Omit<BuildArgs, "values" | "satisfied"> & {
  values: ProjectedValues;
  satisfied: Map<string, Set<string>>;
};

const DEFAULT_GROUP = "__default__";

/** Build a FormModel for a focus node against a node shape (recursive). */
export function buildFormModel(args: BuildArgs): FormModel {
  return buildInner(
    { ...args, values: args.values ?? new Map(), satisfied: args.satisfied ?? new Map() },
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
}

function buildInner(args: InnerArgs, visited: Set<string>): FormModel {
  const { shapes, focusNode, shape, locale, onDiagnostic, values, satisfied } = args;
  const guardKey = `${shape.id}::${focusNode.value}`;
  const cyclic = visited.has(guardKey);
  const nextVisited = new Set(visited).add(guardKey);
  const ctx: FieldCtx = { shapes, focusNode, locale, onDiagnostic, values, satisfied };

  const fields = buildFields(shape.properties, ctx, nextVisited, cyclic);

  // SHACL 1.2 conditionals: for each sh:if on this node shape, add the active
  // branch's fields (then when the focus conforms to the condition, else when it
  // doesn't). rudof evaluated conformance canonically — we only read `satisfied`.
  const active = satisfied.get(focusNode.value) ?? EMPTY_SET;
  for (const cond of shape.conditionals ?? []) {
    const branch: "then" | "else" = active.has(cond.conditionId) ? "then" : "else";
    const branchFields = buildFields(cond[branch], ctx, nextVisited, cyclic);
    for (const f of branchFields) f.guard = { conditionId: cond.conditionId, branch };
    fields.push(...branchFields);
  }

  return { focusNode, shape: namedNode(shape.id), groups: groupFields(fields, shapes, locale) };
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/** Build the field models for a list of property shapes (shared by a node shape's
 *  own properties and its conditional branches). */
function buildFields(
  properties: PropertyShapeIR[],
  ctx: FieldCtx,
  visited: Set<string>,
  cyclic: boolean,
): FieldModel[] {
  const fields: FieldModel[] = [];
  for (const ps of properties) {
    const path = ps.path;
    if (path.kind === "predicate" && path.iri) {
      fields.push(buildField(ps, namedNode(path.iri), ctx, visited, cyclic));
    } else if (path.kind === "inverse" && path.of.kind === "predicate") {
      fields.push(buildInverseField(ps, namedNode(path.of.iri), ctx));
    } else {
      // Complex path (sequence / alternative / quantified / nested inverse): the
      // engine projects its values over the single graph, so render them as a
      // read-only field keyed by the path's canonical key.
      fields.push(buildComplexField(ps, ctx));
    }
  }
  return fields;
}

function buildField(
  ps: PropertyShapeIR,
  path: NamedNode,
  ctx: FieldCtx,
  visited: Set<string>,
  cyclic: boolean,
): FieldModel {
  const id = `${ctx.focusNode.value}|${path.value}`;
  const label = pickByLanguage(ps.presentation.names, ctx.locale)?.value ?? localName(path.value);
  const description = pickByLanguage(ps.presentation.descriptions, ctx.locale)?.value;

  const v = ps.value;
  const constraints: FieldConstraints = {
    datatype: v.datatype,
    nodeKind: v.nodeKind,
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
  // always emits it; the UI only maps the IRI → widget.
  const editorId = ps.presentation.editor ?? Editors.TextField;

  const minCount = ps.cardinality.min ?? 0;
  const maxCount = ps.cardinality.max;
  const repeatable = maxCount === undefined || maxCount > 1;

  const nestedShape = ps.node ? ctx.shapes.nodeShapes.get(ps.node) : undefined;
  if (ps.node && !nestedShape) {
    ctx.onDiagnostic?.({
      level: "warning",
      code: "missing-shape",
      message: "sh:node references a shape that is not defined; the nested form will not render.",
      detail: ps.node,
    });
  }

  const values = projectValues(ps, path, ctx, editorId, nestedShape, visited, cyclic);
  const nestedTypeIri = nestedShape?.instanceClass;

  return {
    id,
    path,
    pathKind: "predicate",
    label,
    description,
    editorId,
    required: minCount >= 1,
    repeatable,
    minCount,
    maxCount,
    order: ps.presentation.order ?? Number.MAX_SAFE_INTEGER,
    groupId: ps.presentation.groupId ?? DEFAULT_GROUP,
    constraints,
    nodeShape: ps.node ? namedNode(ps.node) : null,
    nestedTypeIri,
    values,
  };
}

/** Read-only field for an inverse predicate path: its values are the subjects
 * that point at the focus node via the inverse predicate. */
function buildInverseField(ps: PropertyShapeIR, predicate: NamedNode, ctx: FieldCtx): FieldModel {
  const id = `${ctx.focusNode.value}|^${predicate.value}`;
  const label = pickByLanguage(ps.presentation.names, ctx.locale)?.value ?? `← ${localName(predicate.value)}`;
  return buildReadOnlyField(ps, ctx, { id, label, path: predicate, constraints: { nodeKind: SH_IRI } });
}

/** A read-only IRI field whose values rudof projects over the graph (inverse and
 * complex paths share this shape). Keyed by `id`; never written back. */
function buildReadOnlyField(
  ps: PropertyShapeIR,
  ctx: FieldCtx,
  opts: { id: string; label: string; path: NamedNode; constraints: FieldConstraints },
): FieldModel {
  const description = pickByLanguage(ps.presentation.descriptions, ctx.locale)?.value;
  const slots = ctx.values.get(opts.id) ?? [];
  return {
    id: opts.id,
    path: opts.path,
    pathKind: "complex",
    label: opts.label,
    description,
    editorId: Editors.IRI,
    required: false,
    repeatable: true,
    minCount: 0,
    maxCount: undefined,
    order: ps.presentation.order ?? Number.MAX_SAFE_INTEGER,
    groupId: ps.presentation.groupId ?? DEFAULT_GROUP,
    constraints: opts.constraints,
    readOnly: true,
    nodeShape: null,
    values: slots.map((s, i) => ({ id: `${opts.id}#${i}`, value: s.value })),
  };
}

/** Read-only field for an arbitrary complex path (sequence / alternative /
 * quantified / nested inverse): rudof projects its values, keyed by the path's
 * canonical `pathKey`. The synthetic `namedNode(key)` path is never written back. */
function buildComplexField(ps: PropertyShapeIR, ctx: FieldCtx): FieldModel {
  const key = ps.pathKey;
  const id = `${ctx.focusNode.value}|${key}`;
  const label = pickByLanguage(ps.presentation.names, ctx.locale)?.value ?? key;
  return buildReadOnlyField(ps, ctx, { id, label, path: namedNode(key), constraints: {} });
}

function projectValues(
  ps: PropertyShapeIR,
  path: NamedNode,
  ctx: FieldCtx,
  editor: string,
  nestedShape: NodeShapeIR | undefined,
  visited: Set<string>,
  cyclic: boolean,
): ValueSlot[] {
  const isNested = (editor === Editors.Details || !!ps.node) && !cyclic;
  const slots = ctx.values.get(`${ctx.focusNode.value}|${path.value}`) ?? [];

  return slots.map((s, i) => {
    const slot: ValueSlot = { id: `${ctx.focusNode.value}|${path.value}#${i}`, value: s.value };
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

function localName(iri: string): string {
  const m = iri.match(/[#/]([^#/]+)$/);
  return m ? m[1] : iri;
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

  for (const t of types) {
    const id = shapes.byTargetClass.get(t);
    if (id) return shapes.nodeShapes.get(id);
  }

  // Prefer the entry shape: a target-class shape that no other shape nests via
  // sh:node. Order-independent, so it's robust to non-deterministic shape order
  // from the parser (e.g. rudof's HashMap-backed AST).
  const nested = new Set<string>();
  for (const s of shapes.nodeShapes.values()) {
    collectNodeRefs(s.properties, nested);
    for (const c of s.conditionals ?? []) collectNodeRefs([...c.then, ...c.else], nested);
  }
  const targets = [...shapes.nodeShapes.values()].filter((s) => s.targetClasses.length > 0);
  const root = targets.find((s) => !nested.has(s.id)) ?? targets[0];
  if (root) return root;
  return [...shapes.nodeShapes.values()][0];
}

/** Collect every `sh:node` reference reachable from these property shapes
 *  (including logical and/or/xone/not branches). */
function collectNodeRefs(properties: PropertyShapeIR[], out: Set<string>): void {
  for (const ps of properties) {
    if (ps.node) out.add(ps.node);
    const { or, and, xone, not } = ps.logical;
    for (const branch of [...(or ?? []), ...(and ?? []), ...(xone ?? []), ...(not ? [not] : [])]) {
      collectNodeRefs([branch], out);
    }
  }
}
