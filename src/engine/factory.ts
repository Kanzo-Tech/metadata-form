import type { BlankNode, DefaultGraph, Literal, NamedNode, Quad, Term } from "@rdfjs/types";

/**
 * A minimal, dependency-free RDF/JS term factory. The TS side only needs terms
 * to talk to the rudof ABI ({@link TermValue} marshalling) and to track the
 * editable graph (GraphState) — rudof owns all real RDF I/O (parse/serialize),
 * so there is no RDF library at runtime — `@rdfjs/types` is type-only.
 */

/** Base IRIs for the vocabularies used across the form engine. */
export const NS = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  sh: "http://www.w3.org/ns/shacl#",
} as const;

const RDF_LANGSTRING = `${NS.rdf}langString`;
const XSD_STRING = `${NS.xsd}string`;

export function namedNode(value: string): NamedNode {
  return {
    termType: "NamedNode",
    value,
    equals: (o?: Term | null) => !!o && o.termType === "NamedNode" && o.value === value,
  };
}

let blankCounter = 0;
export function blankNode(value?: string): BlankNode {
  const id = value ?? `b${(blankCounter += 1)}`;
  return {
    termType: "BlankNode",
    value: id,
    equals: (o?: Term | null) => !!o && o.termType === "BlankNode" && o.value === id,
  };
}

export function literal(value: string, langOrDatatype?: string | NamedNode): Literal {
  const language = typeof langOrDatatype === "string" ? langOrDatatype : "";
  const datatype =
    typeof langOrDatatype === "string"
      ? namedNode(RDF_LANGSTRING)
      : langOrDatatype ?? namedNode(XSD_STRING);
  return {
    termType: "Literal",
    value,
    language,
    datatype,
    equals: (o?: Term | null) =>
      !!o &&
      o.termType === "Literal" &&
      o.value === value &&
      (o as Literal).language === language &&
      (o as Literal).datatype.value === datatype.value,
  };
}

const DEFAULT_GRAPH: DefaultGraph = {
  termType: "DefaultGraph",
  value: "",
  equals: (o?: Term | null) => !!o && o.termType === "DefaultGraph",
};

export function quad(subject: Term, predicate: Term, object: Term, graph: Term = DEFAULT_GRAPH): Quad {
  return {
    termType: "Quad",
    value: "",
    subject: subject as Quad["subject"],
    predicate: predicate as Quad["predicate"],
    object: object as Quad["object"],
    graph: graph as Quad["graph"],
    equals: (o?: Term | null) =>
      !!o &&
      o.termType === "Quad" &&
      subject.equals((o as Quad).subject) &&
      predicate.equals((o as Quad).predicate) &&
      object.equals((o as Quad).object),
  } as Quad;
}

/** A callable namespace helper: `rdf("type")` → NamedNode. */
const ns = (base: string) => (local: string): NamedNode => namedNode(`${base}${local}`);

export const rdf = ns(NS.rdf);
