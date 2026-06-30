import type { Term } from "@rdfjs/types";
import { toTerm } from "./termValue.js";
import type { ProjectedForm, ShapeModel } from "../form/ShapeIR.js";

/** One projected value occurrence: the value term, plus the sub-focus to recurse
 *  into for nested (sh:node) properties. */
export interface ProjectedSlot {
  value: Term;
  nestedFocus?: Term;
}

/** Pre-projected values keyed by `${focusNode}|${pathKey}` — the sole value source
 *  for `buildFormModel`, projected recursively up front so the build stays sync. */
export type ProjectedValues = Map<string, ProjectedSlot[]>;

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
): Promise<ProjectedValues> {
  const map: ProjectedValues = new Map();
  await recurse(project, shapes, shapeId, focus, map, new Set());
  return map;
}

/** Synchronous {@link projectTree}, driving a {@link SyncProjector}. Lets the
 *  React per-edit rebuild project the whole tree without an await. */
export function projectTreeSync(project: SyncProjector, shapes: ShapeModel, shapeId: string, focus: Term): ProjectedValues {
  const map: ProjectedValues = new Map();
  recurseSync(project, shapes, shapeId, focus, map, new Set());
  return map;
}

function recurseSync(
  project: SyncProjector,
  shapes: ShapeModel,
  shapeId: string,
  focus: Term,
  map: ProjectedValues,
  visited: Set<string>,
): void {
  const guard = `${shapeId}|${focus.value}`;
  if (visited.has(guard)) return;
  visited.add(guard);
  const node = shapes.nodeShapes.get(shapeId);
  if (!node) return;
  const form = project(focus, shapeId);
  for (const prop of form.properties) {
    map.set(
      `${focus.value}|${prop.pathKey}`,
      prop.values.map((v) => ({ value: toTerm(v.value), nestedFocus: v.nested ? toTerm(v.nested) : undefined })),
    );
    const ps = node.properties.find((p) => p.pathKey === prop.pathKey);
    if (ps?.node) {
      for (const v of prop.values) {
        if (v.nested) recurseSync(project, shapes, ps.node, toTerm(v.nested), map, visited);
      }
    }
  }
}

async function recurse(
  project: AsyncProjector,
  shapes: ShapeModel,
  shapeId: string,
  focus: Term,
  map: ProjectedValues,
  visited: Set<string>,
): Promise<void> {
  const guard = `${shapeId}|${focus.value}`;
  if (visited.has(guard)) return;
  visited.add(guard);

  const node = shapes.nodeShapes.get(shapeId);
  if (!node) return;

  const form = await project(focus, shapeId);
  for (const prop of form.properties) {
    map.set(
      `${focus.value}|${prop.pathKey}`,
      prop.values.map((v) => ({ value: toTerm(v.value), nestedFocus: v.nested ? toTerm(v.nested) : undefined })),
    );

    // Recurse into nested node shapes for their sub-focuses.
    const ps = node.properties.find((p) => p.pathKey === prop.pathKey);
    if (ps?.node) {
      for (const v of prop.values) {
        if (v.nested) await recurse(project, shapes, ps.node, toTerm(v.nested), map, visited);
      }
    }
  }
}
