import { NS } from "../../engine/factory.js";

/**
 * The SHACL Core IRIs the form layer still needs — the `sh:nodeKind` individuals,
 * used to map a property to an editor and to intersect two shapes' demands.
 * (Everything else SHACL-specific comes from rudof's projected IR.)
 */
export const SH_IRI = `${NS.sh}IRI` as const;

/** The `sh:BlankNode` nodeKind individual. A blank node is the one kind of value
 *  a text input cannot produce — it has no lexical form — so a shape asking for
 *  one is asking for something other than typed input. */
export const SH_BLANK_NODE = `${NS.sh}BlankNode` as const;

/** The three kinds of RDF term `sh:nodeKind` ranges over. */
export type TermKind = "IRI" | "BlankNode" | "Literal";

/**
 * The six `sh:nodeKind` individuals as the sets of term kinds they admit (SHACL
 * §4.4.1.4: the value is one of `sh:IRI`, `sh:BlankNode`, `sh:Literal`,
 * `sh:BlankNodeOrIRI`, `sh:BlankNodeOrLiteral`, `sh:IRIOrLiteral`).
 *
 * A *set*, because that is what makes two of them combinable: a node kind is a
 * disjunction over three alternatives, so conjoining two shapes' node kinds is
 * intersecting their sets — and the six individuals are exactly the six non-empty
 * subsets the vocabulary can name, which is why {@link nodeKindFor} can always
 * name the result when it is not empty.
 */
export const NODE_KINDS: Readonly<Record<string, readonly TermKind[]>> = {
  [`${NS.sh}IRI`]: ["IRI"],
  [`${NS.sh}BlankNode`]: ["BlankNode"],
  [`${NS.sh}Literal`]: ["Literal"],
  [`${NS.sh}BlankNodeOrIRI`]: ["BlankNode", "IRI"],
  [`${NS.sh}BlankNodeOrLiteral`]: ["BlankNode", "Literal"],
  [`${NS.sh}IRIOrLiteral`]: ["IRI", "Literal"],
};

const KIND_ORDER: readonly TermKind[] = ["BlankNode", "IRI", "Literal"];

/**
 * The `sh:nodeKind` individual admitting exactly these term kinds.
 *
 * Undefined when all three are admitted — that is not a missing name but an
 * absent constraint, and `sh:nodeKind sh:IRIOrBlankNodeOrLiteral` does not exist
 * because it would say nothing. The empty set has no name either; a caller
 * conjoining node kinds must test for it *before* asking, because an empty
 * intersection is a finding (nothing conforms) rather than a value.
 */
export function nodeKindFor(kinds: ReadonlySet<TermKind>): string | undefined {
  const want = KIND_ORDER.filter((k) => kinds.has(k));
  if (want.length === 0 || want.length === 3) return undefined;
  for (const [iri, members] of Object.entries(NODE_KINDS)) {
    if (members.length === want.length && members.every((m) => kinds.has(m))) return iri;
  }
  return undefined;
}
