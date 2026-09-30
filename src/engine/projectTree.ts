import type { Term } from "@rdfjs/types";
import { toTerm } from "../form/termValue.js";
import type { ProjectedSlot, ProjectedValues } from "../form/buildFormModel.js";
import type { LangString, NodeShapeIR, ProjectedForm, PropertyShapeIR, ShapeModel } from "../form/ShapeIR.js";

/** One node of the projected tree: a focus and the node shape it was projected
 *  against. The pair `validateFocus` needs — see {@link ProjectedTree.nodes}. */
export interface ProjectedNode {
  focus: Term;
  shapeId: string;
  /** Set when the node is a conditional's `then` branch: the node shape that
   *  declares the conditional. The branch is validated on its own so its
   *  path-level results reach the fields; see `RudofEngine.validateTree`. */
  branchOf?: string;
}

/** The whole projected tree: field values plus, per focus, the set of
 *  conditional `conditionId`s the focus conforms to (keyed by `focus.value`). Both
 *  are produced in one recursive pass so `buildFormModel` reads them synchronously. */
export interface ProjectedTree {
  values: ProjectedValues;
  /** The `rdfs:label`s the data graph holds for each projected predicate, keyed
   *  like {@link values}: the second step of SHACL-UI's property labels. */
  labels: Map<string, LangString[]>;
  satisfied: Map<string, Set<string>>;
  /**
   * Every `(focus, shapeId)` the walk visited, root first — the `visited` guard
   * set, kept as terms instead of thrown away. `RudofEngine.validateTree` replays
   * it: rudof's `sh:node` handler computes the inner results and keeps only a
   * boolean, and a nested shape without `sh:targetClass` is reached by no target,
   * so a required field inside a `sh:node` is reported by neither `validateFocus`
   * on the root nor whole-graph `validate()`. Validating each pair recovers it.
   */
  nodes: ProjectedNode[];
}

/** A projector: `(focus, shapeId) => ProjectedForm` (e.g.
 *  `RudofEngine.projectFormSync`, valid once `ready()` has resolved). */
export type Projector = (focus: Term, shapeId: string) => ProjectedForm;

/**
 * Project a focus node's entire form tree — recursing into every `sh:node`
 * sub-focus — into a flat {@link ProjectedValues} map keyed by `${focus}|${pathKey}`.
 * Done once per edit, synchronously, so `buildFormModel` reads values without
 * re-entering WASM or awaiting.
 */
export function projectTree(project: Projector, shapes: ShapeModel, shapeId: string, focus: Term): ProjectedTree {
  const tree: ProjectedTree = { values: new Map(), labels: new Map(), satisfied: new Map(), nodes: [] };
  recurse(project, shapes, shapeId, focus, tree, new Set());
  return tree;
}

/** The property shapes whose paths projectForm evaluates for a node shape: its
 *  direct properties plus every conditional branch's (so conditional fields have
 *  their values ready the moment their branch activates).
 *
 *  Deactivated shapes (SHACL §2.1.6) are excluded: they build no field, so
 *  descending into their `sh:node` sub-forms would project — and later validate —
 *  a subtree the form never shows. */
function projectedPropertyShapes(node: NodeShapeIR): PropertyShapeIR[] {
  const branch = (node.conditionals ?? []).flatMap((c) => [...c.then, ...c.else]);
  return [...node.properties, ...branch].filter((ps) => !ps.deactivated);
}

function recurse(
  project: Projector,
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
  // A deactivated node shape (SHACL §2.1.6) renders nothing and validates nothing.
  if (!node || node.deactivated) return;
  tree.nodes.push({ focus, shapeId });
  const form = project(focus, shapeId);
  const satisfied = new Set(form.satisfied ?? []);
  tree.satisfied.set(focus.value, satisfied);
  // A satisfied conditional's `then` shape is validated as a node of its own:
  // validating the parent yields only one pathless `sh:or` result, whereas the
  // branch yields the path-level results the conditional fields show inline.
  for (const c of node.conditionals ?? []) {
    if (c.thenId && satisfied.has(c.conditionId)) tree.nodes.push({ focus, shapeId: c.thenId, branchOf: shapeId });
  }
  const propShapes = projectedPropertyShapes(node);
  for (const prop of form.properties) {
    tree.values.set(
      `${focus.value}|${prop.pathKey}`,
      prop.values.map((v) => ({ value: toTerm(v.value), nestedFocus: v.nested ? toTerm(v.nested) : undefined })),
    );
    if (prop.pathLabels?.length) tree.labels.set(`${focus.value}|${prop.pathKey}`, prop.pathLabels);
    const ps = propShapes.find((p) => p.pathKey === prop.pathKey);
    if (ps?.node) {
      for (const v of prop.values) {
        if (v.nested) recurse(project, shapes, ps.node, toTerm(v.nested), tree, visited);
      }
    }
  }
}

export type { ProjectedSlot, ProjectedValues };
