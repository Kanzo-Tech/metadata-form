import type { Term } from "@rdfjs/types";
import { toTerm } from "./termValue.js";
import type { NodeShapeIR, ProjectedForm, PropertyShapeIR, ShapeModel } from "../form/ShapeIR.js";

/** One projected value occurrence: the value term, plus the sub-focus to recurse
 *  into for nested (sh:node) properties. */
export interface ProjectedSlot {
  value: Term;
  nestedFocus?: Term;
}

/** Pre-projected values keyed by `${focusNode}|${pathKey}` — the sole value source
 *  for `buildFormModel`, projected recursively up front so the build stays sync. */
export type ProjectedValues = Map<string, ProjectedSlot[]>;

/** The whole projected tree: field values plus, per focus, the set of SHACL-1.2
 *  conditional `conditionId`s the focus conforms to (keyed by `focus.value`). Both
 *  are produced in one recursive pass so `buildFormModel` reads them synchronously. */
export interface ProjectedTree {
  values: ProjectedValues;
  satisfied: Map<string, Set<string>>;
}

/** A synchronous projector: `(focus, shapeId) => ProjectedForm` (e.g.
 *  `RudofEngine.projectFormSync`, valid once `ready()` has resolved). */
export type SyncProjector = (focus: Term, shapeId: string) => ProjectedForm;

/** An asynchronous projector: `(focus, shapeId) => Promise<ProjectedForm>` (e.g.
 *  `RudofEngine.projectForm`). */
export type AsyncProjector = (focus: Term, shapeId: string) => Promise<ProjectedForm>;

/**
 * Project a focus node's entire form tree — recursing into every `sh:node`
 * sub-focus — into a flat {@link ProjectedValues} map keyed by `${focus}|${pathKey}`.
 * Done once, up front, so `buildFormModel` can read values synchronously on every
 * edit without re-entering WASM.
 */
export async function projectTree(
  project: AsyncProjector,
  shapes: ShapeModel,
  shapeId: string,
  focus: Term,
): Promise<ProjectedTree> {
  const tree: ProjectedTree = { values: new Map(), satisfied: new Map() };
  await recurse(project, shapes, shapeId, focus, tree, new Set());
  return tree;
}

/** Synchronous {@link projectTree}, driving a {@link SyncProjector}. Lets the
 *  React per-edit rebuild project the whole tree without an await. */
export function projectTreeSync(project: SyncProjector, shapes: ShapeModel, shapeId: string, focus: Term): ProjectedTree {
  const tree: ProjectedTree = { values: new Map(), satisfied: new Map() };
  recurseSync(project, shapes, shapeId, focus, tree, new Set());
  return tree;
}

/** The property shapes whose paths projectForm evaluates for a node shape: its
 *  direct properties plus every conditional branch's (so conditional fields have
 *  their values ready the moment their branch activates). */
function projectedPropertyShapes(node: NodeShapeIR): PropertyShapeIR[] {
  const branch = (node.conditionals ?? []).flatMap((c) => [...c.then, ...c.else]);
  return [...node.properties, ...branch];
}

function recurseSync(
  project: SyncProjector,
  shapes: ShapeModel,
  shapeId: string,
  focus: Term,
  tree: ProjectedTree,
  visited: Set<string>,
): void {
  const guard = `${shapeId}|${focus.value}`;
  if (visited.has(guard)) return;
  visited.add(guard);
  const node = shapes.nodeShapes.get(shapeId);
  if (!node) return;
  const form = project(focus, shapeId);
  tree.satisfied.set(focus.value, new Set(form.satisfied ?? []));
  const propShapes = projectedPropertyShapes(node);
  for (const prop of form.properties) {
    tree.values.set(
      `${focus.value}|${prop.pathKey}`,
      prop.values.map((v) => ({ value: toTerm(v.value), nestedFocus: v.nested ? toTerm(v.nested) : undefined })),
    );
    const ps = propShapes.find((p) => p.pathKey === prop.pathKey);
    if (ps?.node) {
      for (const v of prop.values) {
        if (v.nested) recurseSync(project, shapes, ps.node, toTerm(v.nested), tree, visited);
      }
    }
  }
}

async function recurse(
  project: AsyncProjector,
  shapes: ShapeModel,
  shapeId: string,
  focus: Term,
  tree: ProjectedTree,
  visited: Set<string>,
): Promise<void> {
  const guard = `${shapeId}|${focus.value}`;
  if (visited.has(guard)) return;
  visited.add(guard);

  const node = shapes.nodeShapes.get(shapeId);
  if (!node) return;

  const form = await project(focus, shapeId);
  tree.satisfied.set(focus.value, new Set(form.satisfied ?? []));
  const propShapes = projectedPropertyShapes(node);
  for (const prop of form.properties) {
    tree.values.set(
      `${focus.value}|${prop.pathKey}`,
      prop.values.map((v) => ({ value: toTerm(v.value), nestedFocus: v.nested ? toTerm(v.nested) : undefined })),
    );

    // Recurse into nested node shapes for their sub-focuses.
    const ps = propShapes.find((p) => p.pathKey === prop.pathKey);
    if (ps?.node) {
      for (const v of prop.values) {
        if (v.nested) await recurse(project, shapes, ps.node, toTerm(v.nested), tree, visited);
      }
    }
  }
}
