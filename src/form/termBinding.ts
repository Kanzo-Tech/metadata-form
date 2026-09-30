import type { Term } from "@rdfjs/types";
import { literal, namedNode, NS } from "./factory.js";
import type { FieldModel } from "./FormModel.js";

/**
 * The term ⇄ primitive binding: what a widget's string value means as an RDF
 * term, and back. Widgets are dumb and never touch RDF; this is the one place
 * the conversion lives, so a theme is just a set of widgets.
 */

const XSD = NS.xsd;
const RDF_LANGSTRING = `${NS.rdf}langString`;
const SH_IRI = `${NS.sh}IRI`;

/** The integer datatypes: a value of one is written without a fraction. */
export const INTEGRAL = new Set(
  ["integer", "int", "long", "short", "byte", "nonNegativeInteger", "positiveInteger",
   "negativeInteger", "nonPositiveInteger", "unsignedInt", "unsignedLong", "unsignedShort",
   "unsignedByte"].map((t) => `${XSD}${t}`),
);

/** Every numeric datatype a value is bound as itself, rather than as text. */
export const NUMERIC = new Set([...INTEGRAL, ...["decimal", "float", "double"].map((t) => `${XSD}${t}`)]);

/** RDF term → primitive string for a widget. */
export function termToPrimitive(term: Term | null): string | null {
  return term ? term.value : null;
}

/** Language tag of a term (for `lang` fields), if any. */
export function languageOf(term: Term | null): string {
  return term && term.termType === "Literal" ? term.language : "";
}

/**
 * Primitive string from a widget → RDF term — the single binding direction.
 *
 * Driven by the field's **constraints**, not by whatever control rendered it.
 * Which term a value becomes is a fact about the shape (`sh:datatype`,
 * `sh:nodeKind`, `sh:in`), and reading it from the shape is what lets two
 * different editors over the same property agree.
 */
export function primitiveToTerm(
  field: FieldModel,
  raw: string | null,
  language?: string,
): Term | null {
  if (raw === null || raw === "") return null;
  const c = field.constraints;

  // sh:in first: the enumeration carries the term verbatim, datatype, language
  // and all, so echoing it back beats reconstructing it.
  const opt = c.options?.find((o) => o.value.value === raw);
  if (opt) return opt.value;

  const dt = c.datatype;
  if (dt === `${XSD}boolean`) return literal(raw === "true" ? "true" : "false", namedNode(`${XSD}boolean`));
  if (dt === RDF_LANGSTRING) return literal(raw, language ?? "");
  if (dt && NUMERIC.has(dt)) return literal(raw, namedNode(dt));
  if (c.nodeKind === SH_IRI || dt === `${XSD}anyURI` || (!dt && c.classIri)) return namedNode(raw);
  if (dt && dt !== `${XSD}string`) return literal(raw, namedNode(dt));
  return literal(raw);
}
