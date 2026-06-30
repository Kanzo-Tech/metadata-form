import type { NamedNode, Term } from "@rdfjs/types";
import { blankNode, namedNode } from "../rdf/factory.js";
import { pickByLanguage } from "../rdf/terms.js";
import { toTerm } from "../rdf/termValue.js";
import { pathKey } from "../engine/pathKey.js";
import { SH_IRI } from "./vocab/shacl.js";
import {
  createEditorResolver,
  deriveContext,
  type EditorResolver,
} from "./editors/EditorResolver.js";
import { Editors } from "./vocab/shacl-ui.js";
import type {
  FieldConstraints,
  FieldModel,
  FieldOption,
  FormModel,
  GroupModel,
  ValueSlot,
} from "../model/FormModel.js";
import type { DiagnosticSink, ProjectedValues } from "../model/SchemaAdapter.js";
import type {
  NodeShapeIR,
  PropertyShapeIR,
  ShapeModel,
} from "../model/ShapeIR.js";

export interface BuildArgs {
  shapes: ShapeModel;
  focusNode: Term;
  shape: NodeShapeIR;
  locale?: string;
  onDiagnostic?: DiagnosticSink;
  /** Editor resolver; defaults to the SHACL-UI rule set. */
  resolver?: EditorResolver;
  /** Pre-projected field values, keyed by `${focusNode}|${pathKey}` (the
   *  single-graph projection). The sole value source; defaults to empty (so
   *  structure-only callers get empty slots). */
  values?: ProjectedValues;
}

/** Inner build args: the editor resolver and projected values are always
 *  resolved (defaulted) before recursion. */
type InnerArgs = Omit<BuildArgs, "resolver" | "values"> & {
  resolver: EditorResolver;
  values: ProjectedValues;
};

const DEFAULT_GROUP = "__default__";

/** Build a FormModel for a focus node against a node shape (recursive). */
export function buildFormModel(args: BuildArgs): FormModel {
  return buildInner(
    { ...args, resolver: args.resolver ?? createEditorResolver(), values: args.values ?? new Map() },
    new Set(),
  );
}

interface FieldCtx {
  shapes: ShapeModel;
  focusNode: Term;
  locale?: string;
  onDiagnostic?: DiagnosticSink;
  resolver: EditorResolver;
  values: ProjectedValues;
}

function buildInner(args: InnerArgs, visited: Set<string>): FormModel {
  const { shapes, focusNode, shape, locale, onDiagnostic, resolver, values } = args;
  const guardKey = `${shape.id}::${focusNode.value}`;
  const cyclic = visited.has(guardKey);
  const nextVisited = new Set(visited).add(guardKey);
  const ctx: FieldCtx = { shapes, focusNode, locale, onDiagnostic, resolver, values };

  const fields: FieldModel[] = [];
  for (const ps of shape.properties) {
    const path = ps.path;
    if (path.kind === "predicate" && path.iri) {
      fields.push(buildField(ps, namedNode(path.iri), ctx, nextVisited, cyclic));
    } else if (path.kind === "inverse" && path.of.kind === "predicate") {
      fields.push(buildInverseField(ps, namedNode(path.of.iri), ctx));
    } else {
      // Complex path (sequence / alternative / quantified / nested inverse): the
      // engine projects its values over the single graph, so render them as a
      // read-only field keyed by the path's canonical key.
      fields.push(buildComplexField(ps, ctx));
    }
  }

  return { focusNode, shape: namedNode(shape.id), groups: groupFields(fields, shapes, locale) };
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
  };

  const editorId = ctx.resolver.resolve(deriveContext(ps));

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
  const description = pickByLanguage(ps.presentation.descriptions, ctx.locale)?.value;
  const slots = ctx.values.get(`${ctx.focusNode.value}|^${predicate.value}`) ?? [];
  const values: ValueSlot[] = slots.map((s, i) => ({ id: `${id}#${i}`, value: s.value }));

  return {
    id,
    path: predicate,
    pathKind: "complex",
    label,
    description,
    editorId: Editors.IRI,
    required: false,
    repeatable: true,
    minCount: 0,
    maxCount: undefined,
    order: ps.presentation.order ?? Number.MAX_SAFE_INTEGER,
    groupId: ps.presentation.groupId ?? DEFAULT_GROUP,
    constraints: { nodeKind: SH_IRI },
    readOnly: true,
    nodeShape: null,
    values,
  };
}

/** Read-only field for an arbitrary complex path (sequence / alternative /
 * quantified / nested inverse): the engine projects its values over the single
 * graph, keyed by the path's canonical {@link pathKey}. Rendered, not deferred. */
function buildComplexField(ps: PropertyShapeIR, ctx: FieldCtx): FieldModel {
  const key = pathKey(ps.path);
  const id = `${ctx.focusNode.value}|${key}`;
  const label = pickByLanguage(ps.presentation.names, ctx.locale)?.value ?? key;
  const description = pickByLanguage(ps.presentation.descriptions, ctx.locale)?.value;
  const slots = ctx.values.get(id) ?? [];
  const values: ValueSlot[] = slots.map((s, i) => ({ id: `${id}#${i}`, value: s.value }));

  return {
    id,
    // A synthetic predicate carrying the canonical path string; the field is
    // read-only, so it is never written back through this term.
    path: namedNode(key),
    pathKind: "complex",
    label,
    description,
    editorId: Editors.IRI,
    required: false,
    repeatable: true,
    minCount: 0,
    maxCount: undefined,
    order: ps.presentation.order ?? Number.MAX_SAFE_INTEGER,
    groupId: ps.presentation.groupId ?? DEFAULT_GROUP,
    constraints: {},
    readOnly: true,
    nodeShape: null,
    values,
  };
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
        { shapes: ctx.shapes, focusNode: sub, shape: nestedShape, locale: ctx.locale, resolver: ctx.resolver, values: ctx.values },
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

export function localName(iri: string): string {
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
  for (const s of shapes.nodeShapes.values()) collectNodeRefs(s.properties, nested);
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
