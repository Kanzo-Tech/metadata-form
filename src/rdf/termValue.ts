import type { Term } from "@rdfjs/types";
import { blankNode, literal, namedNode } from "./factory.js";
import type { TermValue } from "../model/ShapeIR.js";

/**
 * Conversion between RDF/JS {@link Term}s and the JSON-ish {@link TermValue} used
 * across the IR and the rudof ABI. One home, so the marshalling boundary is
 * consistent everywhere (reader, engine, validation mapping).
 */

export function toTerm(tv: TermValue): Term {
  if (tv.termType === "NamedNode") return namedNode(tv.value);
  if (tv.termType === "BlankNode") return blankNode(tv.value);
  if (tv.language) return literal(tv.value, tv.language);
  if (tv.datatype) return literal(tv.value, namedNode(tv.datatype));
  return literal(tv.value);
}

export function toTermValue(t: Term): TermValue {
  if (t.termType === "Literal") {
    const lit = t as { value: string; datatype?: { value: string }; language?: string };
    return {
      termType: "Literal",
      value: t.value,
      datatype: lit.datatype?.value,
      language: lit.language ? lit.language : undefined,
    };
  }
  if (t.termType === "BlankNode") return { termType: "BlankNode", value: t.value };
  return { termType: "NamedNode", value: t.value };
}
