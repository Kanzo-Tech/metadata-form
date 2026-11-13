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
const SH_BNODE_OR_IRI = `${NS.sh}BlankNodeOrIRI`;

/** The integer datatypes: a value of one is written without a fraction. */
export const INTEGRAL = new Set(
  ["integer", "int", "long", "short", "byte", "nonNegativeInteger", "positiveInteger",
   "negativeInteger", "nonPositiveInteger", "unsignedInt", "unsignedLong", "unsignedShort",
   "unsignedByte"].map((t) => `${XSD}${t}`),
);

/** Every numeric datatype a value is bound as itself, rather than as text. */
export const NUMERIC = new Set([...INTEGRAL, ...["decimal", "float", "double"].map((t) => `${XSD}${t}`)]);

/**
 * An absolute IRI as Turtle can write it between `<` and `>`: a scheme (`https:`,
 * `urn:`, `mailto:`…) and none of the characters IRIREF forbids (spaces and
 * controls, `<>"{}|^\``, backslash). Anything else, written as `<…>`, is a record
 * no parser reads back, or one that resolves against wherever it is read.
 */
// eslint-disable-next-line no-control-regex -- IRIREF forbids control characters, so the class names them on purpose
const ABSOLUTE_IRI = /^[A-Za-z][A-Za-z0-9+.-]*:[^\u0000-\u0020<>"{}|^`\\]*$/;

/**
 * What was typed or pasted where the shape asks for an IRI. The spaces around it
 * go (a browser's address bar or a mail client copies them); if it is then an
 * absolute IRI it is one, and otherwise it stays the text it is, a literal, so the
 * record can always be read back and the shape's own `sh:nodeKind` (or
 * `sh:pattern`) says what is wrong with it.
 */
function iriOrText(raw: string): Term {
  const trimmed = raw.trim();
  return ABSOLUTE_IRI.test(trimmed) ? namedNode(trimmed) : literal(raw);
}

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
    // A language the reader picked is the text's, whether or not the shape says
  // rdf:langString: SHACL-UI's …WithLangEditor offers the picker on plain text
  // too, and the tag stays optional unless the shape asks for it.
  if (dt === RDF_LANGSTRING || (language && !dt && c.nodeKind !== SH_IRI && !c.classIri))
    return literal(raw, language ?? "");
  if (dt && NUMERIC.has(dt)) return literal(raw, namedNode(dt));
  // sh:BlankNodeOrIRI with no sh:node to build a block from is a box like any
  // other: an address is one, and any other text stays text for the shape to report.
  if (c.nodeKind === SH_IRI || c.nodeKind === SH_BNODE_OR_IRI || (!dt && c.classIri)) return iriOrText(raw);
  if (dt && dt !== `${XSD}string`) return literal(raw, namedNode(dt));
  return literal(raw);
}
