import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { blankNode, namedNode, rdf } from "./factory.js";
import type { GraphBackend } from "./GraphBackend.js";

const RDF_TYPE = namedNode(rdf("type").value);

type Listener = () => void;

let blankCounter = 0;
function nextBlankId(): string {
  blankCounter += 1;
  return `mf${blankCounter}`;
}

/**
 * Holds the editable data graph — the single source of truth. The graph itself
 * lives in the engine session behind a {@link GraphBackend} (rudof-over-WASM by
 * default); this class adds React change tracking (version + subscribe) over it.
 * Form fields are projections of this graph. Mutations route to the backend and
 * bump a version, notifying subscribers (consumed via useSyncExternalStore).
 */
export class GraphState {
  private version = 0;
  private listeners = new Set<Listener>();

  constructor(private readonly backend: GraphBackend) {}

  getVersion = (): number => this.version;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private bump(): void {
    this.version += 1;
    for (const l of this.listeners) l();
  }

  /** Replace a single (focus, predicate, oldValue) with newValue. */
  setValue(focus: Term, predicate: NamedNode, oldValue: Term | null, newValue: Term | null): void {
    if (oldValue && newValue && oldValue.equals(newValue)) return;
    if (oldValue) this.removeSubgraph(focus, predicate, oldValue);
    if (newValue) this.backend.add(focus, predicate, newValue);
    this.bump();
  }

  addValue(focus: Term, predicate: NamedNode, value: Term): void {
    this.backend.add(focus, predicate, value);
    this.bump();
  }

  removeValue(focus: Term, predicate: NamedNode, value: Term): void {
    this.removeSubgraph(focus, predicate, value);
    this.bump();
  }

  /**
   * Create a nested resource (blank node) as the object of focus→predicate,
   * optionally typed, and return it so a sub-form can be built for it.
   */
  createNested(focus: Term, predicate: NamedNode, typeIri?: string): Term {
    const node = blankNode(nextBlankId());
    this.backend.add(focus, predicate, node);
    if (typeIri) {
      this.backend.add(node, RDF_TYPE, namedNode(typeIri));
    }
    this.bump();
    return node;
  }

  /** Remove a value and, if it is a blank node, its reachable subgraph. */
  private removeSubgraph(focus: Term, predicate: NamedNode, value: Term): void {
    this.backend.remove(focus, predicate, value);
    if (value.termType === "BlankNode") {
      // Only prune if no other statement still references this blank node.
      const stillReferenced = this.backend.match(null, null, value).length > 0;
      if (!stillReferenced) this.pruneNode(value, new Set());
    }
  }

  private pruneNode(node: Term, visited: Set<string>): void {
    if (visited.has(node.value)) return;
    visited.add(node.value);
    const outgoing = this.backend.match(node, null, null);
    for (const q of outgoing) {
      this.backend.remove(q.subject as Term, q.predicate as Term, q.object as Term);
      if (q.object.termType === "BlankNode") {
        const refs = this.backend.match(null, null, q.object as Term).length;
        if (refs === 0) this.pruneNode(q.object as Term, visited);
      }
    }
  }

  /** All quads reachable from a focus node (its subgraph), for serialization. */
  subgraphFrom(focus: Term): Quad[] {
    const out: Quad[] = [];
    const seen = new Set<string>();
    const walk = (node: Term) => {
      if (seen.has(node.value)) return;
      seen.add(node.value);
      for (const q of this.backend.match(node, null, null)) {
        out.push(q);
        if (q.object.termType === "BlankNode" || q.object.termType === "NamedNode") {
          walk(q.object as Term);
        }
      }
    };
    walk(focus);
    return out;
  }

  allQuads(): Quad[] {
    return this.backend.match(null, null, null);
  }
}
