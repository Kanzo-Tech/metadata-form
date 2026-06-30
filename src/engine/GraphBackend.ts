import type { Quad, Term } from "@rdfjs/types";

/**
 * A mutable, queryable RDF graph backend (port). The default adapter wraps
 * rudof's in-WASM store; a fake in-memory implementation backs unit tests.
 * {@link GraphState} observes one of these and adds change tracking.
 */
export interface GraphBackend {
  add(subject: Term, predicate: Term, object: Term): void;
  remove(subject: Term, predicate: Term, object: Term): void;
  /** Quads matching the pattern; null/undefined positions are wildcards. */
  match(subject?: Term | null, predicate?: Term | null, object?: Term | null): Quad[];
  /** Serialize the whole graph to the given RDF media type. */
  serialize(mediaType: string): string | Promise<string>;
}
