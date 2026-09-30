import { NS } from "./factory.js";
import type { LangString, NodeShapeIR, ShapeIR, ShapeModel } from "./ShapeIR.js";

const SH_MESSAGE = `${NS.sh}message`;

/**
 * The languages a shapes graph is written in: the language tags found on its
 * `sh:name`, `sh:description`, `sh:message`, on the `rdfs:label`s of its property
 * groups and of its predicates. An untagged literal contributes no language. Most
 * written first (by the number of tagged literals), ties in alphabetical order, so
 * the order is the same for the same shapes.
 *
 * Read off the IR, not the Turtle: the IR already carries every one of these as a
 * language-tagged record, including the shapes reached through `sh:or`, `sh:and`,
 * `sh:xone`, `sh:not` and a conditional's branches.
 */
export function shapeLanguages(shapes: ShapeModel): string[] {
  const counts = new Map<string, number>();
  const count = (tagged: readonly Pick<LangString, "language">[] | undefined) => {
    for (const { language } of tagged ?? []) if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  };

  const shape = (s: ShapeIR): void => {
    count(s.presentation.names);
    count(s.presentation.descriptions);
    count(s.presentation.pathLabels);
    for (const c of s.components) {
      if (c.iri !== SH_MESSAGE) continue;
      for (const terms of c.params.values()) count(terms.filter((t) => t.termType === "Literal").map((t) => ({ language: t.language ?? "" })));
    }
    const { or, and, xone, not } = s.logical;
    for (const member of [...(or ?? []), ...(and ?? []), ...(xone ?? []), ...(not ? [not] : [])]) shape(member);
  };
  const node = (n: NodeShapeIR): void => {
    n.properties.forEach(shape);
    for (const c of n.conditionals ?? []) [...c.then, ...c.else].forEach(shape);
  };

  shapes.nodeShapes.forEach(node);
  shapes.groups.forEach((g) => count(g.labels));
  return [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).map(([language]) => language);
}
