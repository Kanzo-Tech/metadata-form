import type { Store } from "n3";
import type { NamedNode, Term } from "@rdfjs/types";
import { blankNode, namedNode, quad, rdf } from "../rdf/factory.js";
import { pickByLanguage } from "../rdf/terms.js";
import { toTerm } from "../rdf/termValue.js";
import { Sh } from "../vocab/shacl.js";
import {
  createEditorResolver,
  deriveContext,
  type EditorResolver,
} from "../editors/EditorResolver.js";
import { Editors } from "../vocab/shacl-ui.js";
import type {
  FieldConstraints,
  FieldModel,
  FieldOption,
  FormModel,
  GroupModel,
  ValueSlot,
} from "../schema/FormModel.js";
import type { DiagnosticSink } from "../schema/SchemaAdapter.js";
import type {
  NodeShapeIR,
  PropertyShapeIR,
  ShapeModel,
} from "../shape/ShapeIR.js";

/** Objects of `subject predicate ?o` in the n3 data store. */
function objects(store: Store, subject: Term, predicate: NamedNode): Term[] {
  return store.getQuads(subject, predicate, null, null).map((q) => q.object as Term);
}

/** One projected value occurrence: the value term, plus the sub-focus to recurse
 *  into for nested (sh:node) properties. */
export interface ProjectedSlot {
  value: Term;
  nestedFocus?: Term;
}

/** Pre-projected values keyed by `${focusNode}|${pathKey}`. When supplied, values
 *  come from here (the rudof engine's `projectForm`, projected recursively up
 *  front so the build stays sync) instead of being read from the n3 `data` store. */
export type ProjectedValues = Map<string, ProjectedSlot[]>;

export interface BuildArgs {
  shapes: ShapeModel;
  data: Store;
  focusNode: Term;
  shape: NodeShapeIR;
  locale?: string;
  onDiagnostic?: DiagnosticSink;
  /** Editor resolver; defaults to the SHACL-UI rule set. */
  resolver?: EditorResolver;
  /** Optional pre-projected values; when absent, values are read from `data` (n3). */
  values?: ProjectedValues;
}

const DEFAULT_GROUP = "__default__";

/** Build a FormModel for a focus node against a node shape (recursive). */
export function buildFormModel(args: BuildArgs): FormModel {
  return buildInner({ ...args, resolver: args.resolver ?? createEditorResolver() }, new Set());
}

interface FieldCtx {
  shapes: ShapeModel;
  data: Store;
  focusNode: Term;
  locale?: string;
  onDiagnostic?: DiagnosticSink;
  resolver: EditorResolver;
  values?: ProjectedValues;
}

function buildInner(args: Required<Pick<BuildArgs, "resolver">> & BuildArgs, visited: Set<string>): FormModel {
  const { shapes, data, focusNode, shape, locale, onDiagnostic, resolver, values } = args;
  const guardKey = `${shape.id}::${focusNode.value}`;
  const cyclic = visited.has(guardKey);
  const nextVisited = new Set(visited).add(guardKey);
  const ctx: FieldCtx = { shapes, data, focusNode, locale, onDiagnostic, resolver, values };

  const fields: FieldModel[] = [];
  for (const ps of shape.properties) {
    const path = ps.path;
    if (path.kind === "predicate" && path.iri) {
      fields.push(buildField(ps, namedNode(path.iri), ctx, nextVisited, cyclic));
    } else if (path.kind === "inverse" && path.of.kind === "predicate") {
      fields.push(buildInverseField(ps, namedNode(path.of.iri), ctx));
    } else {
      // Complex path captured losslessly in the IR, but value projection over an
      // arbitrary path is delegated to the rudof engine (Phase 2). The n3
      // transition reader cannot evaluate it, so it is surfaced, not rendered.
      onDiagnostic?.({
        level: "info",
        code: "deferred-path",
        message: "Complex path not yet projected by the n3 transition engine (rudof projects it).",
        detail: shape.id,
      });
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
  const slots = ctx.values
    ? (ctx.values.get(`${ctx.focusNode.value}|^${predicate.value}`) ?? [])
    : ctx.data.getQuads(null, predicate, ctx.focusNode, null).map((q) => ({ value: q.subject as Term }));
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
    constraints: { nodeKind: Sh.IRI },
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
  const slots = ctx.values
    ? (ctx.values.get(`${ctx.focusNode.value}|${path.value}`) ?? [])
    : objects(ctx.data, ctx.focusNode, path).map((value) => ({ value, nestedFocus: value }));

  return slots.map((s, i) => {
    const slot: ValueSlot = { id: `${ctx.focusNode.value}|${path.value}#${i}`, value: s.value };
    const sub = s.nestedFocus;
    if (isNested && nestedShape && sub && (sub.termType === "NamedNode" || sub.termType === "BlankNode")) {
      slot.nested = buildInner(
        { shapes: ctx.shapes, data: ctx.data, focusNode: sub, shape: nestedShape, locale: ctx.locale, resolver: ctx.resolver, values: ctx.values },
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

const RDF_TYPE = namedNode(rdf("type").value);

/** Resolve the root node shape: explicit > focus-node's rdf:type vs target class
 *  > first shape with a target class > first shape. */
export function resolveRootShape(
  shapes: ShapeModel,
  data: Store,
  focusNode: Term,
  rootShape?: NamedNode,
): NodeShapeIR | undefined {
  const types = data.getQuads(focusNode, RDF_TYPE, null, null).map((q) => q.object.value);
  return resolveRootShapeFromTypes(shapes, types, rootShape);
}

/** {@link resolveRootShape} over a pre-read list of the focus node's rdf:type
 *  values — so the single-graph path can resolve from the engine session backend
 *  without an n3 `Store`. */
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

/** Stamp the focus node with the root shape's target class (so it's targeted and
 *  the output declares its type) plus any sh:hasValue / sh:defaultValue seeds, so
 *  a new instance is complete. Mutates `store`. */
export function seedFocusNode(
  shapes: ShapeModel,
  store: Store,
  focusNode: Term,
  rootShape?: NamedNode,
): void {
  const shape = resolveRootShape(shapes, store, focusNode, rootShape);
  if (!shape) return;

  if (shape.instanceClass) {
    const cls = namedNode(shape.instanceClass);
    if (store.getQuads(focusNode, RDF_TYPE, cls, null).length === 0) {
      store.addQuad(quad(focusNode as never, RDF_TYPE as never, cls as never));
    }
  }

  for (const ps of shape.properties) {
    if (ps.path.kind !== "predicate" || !ps.path.iri) continue;
    const seed = ps.value.hasValue ?? ps.value.defaultValue;
    if (!seed) continue;
    const predicate = namedNode(ps.path.iri);
    if (store.getQuads(focusNode, predicate, null, null).length === 0) {
      store.addQuad(quad(focusNode as never, predicate as never, toTerm(seed) as never));
    }
  }
}
