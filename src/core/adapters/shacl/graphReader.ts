import type { Store } from "n3";
import type { Literal, NamedNode, Term } from "@rdfjs/types";
import { namedNode, rdf } from "../../rdf/factory.js";

/** Small typed helpers over an n3.Store for reading a shapes graph. */

export function objects(store: Store, subject: Term, predicate: NamedNode): Term[] {
  return store.getQuads(subject, predicate, null, null).map((q) => q.object as Term);
}

export function object(store: Store, subject: Term, predicate: NamedNode): Term | undefined {
  return objects(store, subject, predicate)[0];
}

export function literalValue(
  store: Store,
  subject: Term,
  predicate: NamedNode,
): string | undefined {
  const o = object(store, subject, predicate);
  return o && o.termType === "Literal" ? o.value : undefined;
}

export function numberValue(
  store: Store,
  subject: Term,
  predicate: NamedNode,
): number | undefined {
  const v = literalValue(store, subject, predicate);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export function booleanValue(
  store: Store,
  subject: Term,
  predicate: NamedNode,
): boolean | undefined {
  const v = literalValue(store, subject, predicate);
  if (v === undefined) return undefined;
  return v === "true" || v === "1";
}

export function namedNodeValue(
  store: Store,
  subject: Term,
  predicate: NamedNode,
): NamedNode | undefined {
  const o = object(store, subject, predicate);
  return o && o.termType === "NamedNode" ? (o as NamedNode) : undefined;
}

/** Collect all language-tagged (and plain) literals for a predicate. */
export function literals(store: Store, subject: Term, predicate: NamedNode): Literal[] {
  return objects(store, subject, predicate).filter(
    (o): o is Literal => o.termType === "Literal",
  );
}

const RDF_FIRST = namedNode(rdf("first").value);
const RDF_REST = namedNode(rdf("rest").value);
const RDF_NIL = rdf("nil");

/** Resolve an RDF list (rdf:first/rdf:rest) starting at `head` into an array. */
export function rdfList(store: Store, head: Term): Term[] {
  const out: Term[] = [];
  let current: Term | undefined = head;
  const guard = new Set<string>();
  while (current && !current.equals(RDF_NIL)) {
    const key = current.value;
    if (guard.has(key)) break; // malformed cyclic list
    guard.add(key);
    const first = object(store, current, RDF_FIRST);
    if (first) out.push(first);
    current = object(store, current, RDF_REST);
  }
  return out;
}
