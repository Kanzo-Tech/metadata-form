import type { NamedNode, Term } from "@rdfjs/types";
import { blankNode } from "../form/factory.js";
import type { NodeShapeIR, ShapeIR, ShapeModel } from "../form/ShapeIR.js";

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
