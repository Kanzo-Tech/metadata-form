import type { Store } from "n3";
import type { NamedNode, Term } from "@rdfjs/types";
import { blankNode, sh } from "../../rdf/factory.js";
import { selectByLanguage } from "../../rdf/terms.js";
import { selectEditor, type EditorMatchInput } from "../../editors/selectEditor.js";
import { Editors } from "../../editors/ids.js";
import type {
  FieldConstraints,
  FieldModel,
  FieldOption,
  FormModel,
  GroupModel,
  ValueSlot,
} from "../../schema/FormModel.js";
import type { DiagnosticSink } from "../../schema/SchemaAdapter.js";
import { objects } from "./graphReader.js";
import {
  instanceClass,
  type ShaclNodeShape,
  type ShaclPropertyShape,
  type ShapesGraph,
} from "./readShapesGraph.js";

export interface BuildArgs {
  shapes: ShapesGraph;
  data: Store;
  focusNode: Term;
  shape: ShaclNodeShape;
  locale?: string;
  onDiagnostic?: DiagnosticSink;
}

const DEFAULT_GROUP = "__default__";

/** Build a FormModel for a focus node against a node shape (recursive). */
export function buildFormModel(args: BuildArgs): FormModel {
  return buildInner(args, new Set());
}

function buildInner(args: BuildArgs, visited: Set<string>): FormModel {
  const { shapes, data, focusNode, shape, locale, onDiagnostic } = args;
  const guardKey = `${shape.id.value}::${focusNode.value}`;
  const cyclic = visited.has(guardKey);
  const nextVisited = new Set(visited).add(guardKey);
  const ctx: FieldCtx = { shapes, data, focusNode, locale, onDiagnostic };

  const fields: FieldModel[] = [];
  for (const ps of shape.properties) {
    if (ps.path) {
      fields.push(buildField(ps, ctx, nextVisited, cyclic));
    } else if (ps.inversePath) {
      fields.push(buildInverseField(ps, ctx));
    } else {
      // Unsupported complex path (e.g. a sequence) — dropped, but surfaced.
      onDiagnostic?.({
        level: "warning",
        code: "unsupported-path",
        message: "Property dropped: only simple predicates and sh:inversePath are rendered.",
        detail: shape.id.value,
      });
    }
  }

  return { focusNode, shape: shape.id, groups: groupFields(fields, shapes, locale) };
}

interface FieldCtx {
  shapes: ShapesGraph;
  data: Store;
  focusNode: Term;
  locale?: string;
  onDiagnostic?: DiagnosticSink;
}

function buildField(
  ps: ShaclPropertyShape,
  ctx: FieldCtx,
  visited: Set<string>,
  cyclic: boolean,
): FieldModel {
  const path = ps.path as NamedNode;
  const id = `${ctx.focusNode.value}|${path.value}`;
  const label =
    selectByLanguage(ps.names, ctx.locale)?.value ?? localName(path.value);
  const description = selectByLanguage(ps.descriptions, ctx.locale)?.value;

  const options = optionsFrom(ps);
  const constraints: FieldConstraints = {
    datatype: ps.datatype,
    nodeKind: ps.nodeKind,
    classIri: ps.classIri,
    pattern: ps.pattern,
    flags: ps.flags,
    minLength: ps.minLength,
    maxLength: ps.maxLength,
    minInclusive: ps.minInclusive,
    maxInclusive: ps.maxInclusive,
    minExclusive: ps.minExclusive,
    maxExclusive: ps.maxExclusive,
    options,
    defaultValue: ps.defaultValue,
    hasValue: ps.hasValue,
    uniqueLang: ps.uniqueLang,
  };

  const matchInput: EditorMatchInput = {
    explicitEditor: ps.editor,
    datatype: ps.datatype,
    nodeKind: ps.nodeKind,
    classIri: ps.classIri,
    hasIn: !!ps.inList && ps.inList.length > 0,
    singleLine: ps.singleLine,
    hasNode: !!ps.node,
  };
  const editorId = selectEditor(matchInput);

  const minCount = ps.minCount ?? 0;
  const maxCount = ps.maxCount;
  const repeatable = maxCount === undefined || maxCount > 1;

  const values = projectValues(ps, ctx, editorId, visited, cyclic);
  const nestedShape = ps.node ? ctx.shapes.nodeShapes.get(ps.node.value) : undefined;
  if (ps.node && !nestedShape) {
    ctx.onDiagnostic?.({
      level: "warning",
      code: "missing-shape",
      message: "sh:node references a shape that is not defined; the nested form will not render.",
      detail: ps.node.value,
    });
  }
  const nestedTypeIri = nestedShape ? instanceClass(nestedShape)?.value : undefined;

  return {
    id,
    path,
    pathKind: ps.pathKind,
    label,
    description,
    editorId,
    required: minCount >= 1,
    repeatable,
    minCount,
    maxCount,
    order: ps.order ?? Number.MAX_SAFE_INTEGER,
    groupId: ps.group?.value ?? DEFAULT_GROUP,
    constraints,
    nodeShape: ps.node,
    nestedTypeIri,
    values,
  };
}

/** Build a read-only field for a `sh:inversePath`: its values are the subjects
 * that point at the focus node via the inverse predicate. */
function buildInverseField(ps: ShaclPropertyShape, ctx: FieldCtx): FieldModel {
  const path = ps.inversePath as NamedNode;
  const id = `${ctx.focusNode.value}|^${path.value}`;
  const label = selectByLanguage(ps.names, ctx.locale)?.value ?? `← ${localName(path.value)}`;
  const description = selectByLanguage(ps.descriptions, ctx.locale)?.value;
  const subjects = ctx.data.getQuads(null, path, ctx.focusNode, null).map((q) => q.subject as Term);
  const values: ValueSlot[] = subjects.map((value, i) => ({ id: `${id}#${i}`, value }));

  return {
    id,
    path,
    pathKind: "complex",
    label,
    description,
    editorId: Editors.URI,
    required: false,
    repeatable: true,
    minCount: 0,
    maxCount: undefined,
    order: ps.order ?? Number.MAX_SAFE_INTEGER,
    groupId: ps.group?.value ?? DEFAULT_GROUP,
    constraints: { nodeKind: sh("IRI").value },
    readOnly: true,
    nodeShape: null,
    values,
  };
}

function projectValues(
  ps: ShaclPropertyShape,
  ctx: FieldCtx,
  editor: string,
  visited: Set<string>,
  cyclic: boolean,
): ValueSlot[] {
  const path = ps.path as NamedNode;
  const existing = objects(ctx.data, ctx.focusNode, path);
  const isNested = (editor === Editors.Details || !!ps.node) && !cyclic;

  const slots: ValueSlot[] = existing.map((value, i) => {
    const slot: ValueSlot = { id: `${ctx.focusNode.value}|${path.value}#${i}`, value };
    if (isNested && ps.node && (value.termType === "NamedNode" || value.termType === "BlankNode")) {
      const nodeShape = ctx.shapes.nodeShapes.get(ps.node.value);
      if (nodeShape) {
        slot.nested = buildInner(
          { shapes: ctx.shapes, data: ctx.data, focusNode: value, shape: nodeShape, locale: ctx.locale },
          visited,
        );
      }
    }
    return slot;
  });

  // Only real graph values are projected; empty UI rows are managed by the
  // React FieldRenderer (keeps the graph as the single source of truth).
  return slots;
}

function optionsFrom(ps: ShaclPropertyShape): FieldOption[] | undefined {
  if (!ps.inList || ps.inList.length === 0) return undefined;
  return ps.inList.map((value) => ({
    value,
    label: value.termType === "Literal" ? value.value : localName(value.value),
  }));
}

function groupFields(
  fields: FieldModel[],
  shapes: ShapesGraph,
  locale: string | undefined,
): GroupModel[] {
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
      label: meta ? selectByLanguage(meta.labels, locale)?.value : undefined,
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
