import { Store } from "n3";
import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { blankNode, namedNode, quad, rdf } from "../rdf/factory.js";

const RDF_TYPE = namedNode(rdf("type").value);

type Listener = () => void;

let blankCounter = 0;
function nextBlankId(): string {
  blankCounter += 1;
  return `mf${blankCounter}`;
}

/**
 * Holds the editable data graph — the single source of truth. Form fields are
 * projections of this graph. Mutations bump a version and notify subscribers
 * (consumed via useSyncExternalStore in the React layer).
 */
export class GraphState {
  private _store: Store;
  private version = 0;
  private listeners = new Set<Listener>();

  constructor(store?: Store) {
    this._store = store ?? new Store();
  }

  get store(): Store {
    return this._store;
  }

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
    if (newValue) this._store.addQuad(quad(focus as never, predicate as never, newValue as never));
    this.bump();
  }

  addValue(focus: Term, predicate: NamedNode, value: Term): void {
    this._store.addQuad(quad(focus as never, predicate as never, value as never));
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
    this._store.addQuad(quad(focus as never, predicate as never, node as never));
    if (typeIri) {
      this._store.addQuad(quad(node as never, RDF_TYPE as never, namedNode(typeIri) as never));
    }
    this.bump();
    return node;
  }

  /** Remove a value and, if it is a blank node, its reachable subgraph. */
  private removeSubgraph(focus: Term, predicate: NamedNode, value: Term): void {
    this._store.removeQuad(quad(focus as never, predicate as never, value as never));
    if (value.termType === "BlankNode") {
      // Only prune if no other statement still references this blank node.
      const stillReferenced = this._store.getQuads(null, null, value, null).length > 0;
      if (!stillReferenced) this.pruneNode(value, new Set());
    }
  }

  private pruneNode(node: Term, visited: Set<string>): void {
    if (visited.has(node.value)) return;
    visited.add(node.value);
    const outgoing = this._store.getQuads(node, null, null, null) as Quad[];
    for (const q of outgoing) {
      this._store.removeQuad(q as never);
      if (q.object.termType === "BlankNode") {
        const refs = this._store.getQuads(null, null, q.object, null).length;
        if (refs === 0) this.pruneNode(q.object, visited);
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
      for (const q of this._store.getQuads(node, null, null, null) as Quad[]) {
        out.push(q);
        if (q.object.termType === "BlankNode" || q.object.termType === "NamedNode") {
          walk(q.object);
        }
      }
    };
    walk(focus);
    return out;
  }

  allQuads(): Quad[] {
    return this._store.getQuads(null, null, null, null) as Quad[];
  }
}

export { nextBlankId };
