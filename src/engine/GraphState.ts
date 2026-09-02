import type { Quad, Term } from "@rdfjs/types";
import { blankNode, namedNode, rdf } from "./factory.js";
import {
  branchValues,
  chooseBranch,
  resolveCarrier,
  statementFor,
  type FieldWrite,
  type StepReader,
  type WriteBranch,
  type WriteStep,
} from "../form/writePath.js";
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
 *
 * Every mutation is addressed by a {@link FieldWrite} rather than a predicate,
 * because a field's path is not always a predicate: the same "set this value"
 * means `(focus, p, value)` for `ex:p`, `(value, p, focus)` for `^ex:p`, and a
 * statement on an intermediate node for `ex:a/ex:b`. The plan says which; this
 * class supplies the graph the plan needs to resolve against, and `form/writePath`
 * holds the rules. A caller holding a bare predicate wraps it with `forwardWrite`.
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

  /**
   * One step of a property path, read from the live graph — the {@link StepReader}
   * the write layer and `buildFormModel` take as a callback. A bound property, not
   * a method, so it can be handed over as the capability it is.
   */
  readStep: StepReader = (from: Term, step: WriteStep): Term[] =>
    step.direction === "forward"
      ? this.backend.match(from, step.predicate, null).map((q) => q.object as Term)
      : this.backend.match(null, step.predicate, from).map((q) => q.subject as Term);

  /**
   * Replace a single (focus, path, oldValue) with newValue.
   *
   * The branch is chosen BEFORE the retraction, not after. `chooseBranch` follows
   * the branch the record already uses, and retracting first erases exactly that
   * evidence — so an edit to a value living on the second branch of an alternative
   * would silently move it to the first. Editing a value is not a reason to change
   * where it is stored.
   */
  setValue(focus: Term, write: FieldWrite, oldValue: Term | null, newValue: Term | null): void {
    if (oldValue && newValue && oldValue.equals(newValue)) return;
    const branch = newValue ? chooseBranch(this.readStep, focus, write, newValue) : undefined;
    if (oldValue) this.retract(focus, write, oldValue);
    if (newValue && branch) this.assertThrough(focus, branch, newValue);
    this.bump();
  }

  /**
   * Replace *every* value of (focus, path) with `next`.
   *
   * For a control that owns the whole list — a tags input, a multi-select — which
   * cannot say "the third one changed", only "here is the list now". Diffing rather
   * than clear-and-refill keeps blank-node subgraphs a survivor still points at, and
   * the single {@link bump} is the point: a per-value loop would rebuild the form
   * model and re-enter wasm validation once per tag typed.
   */
  setValues(focus: Term, write: FieldWrite, next: Term[]): void {
    const current = this.currentValues(focus, write);
    const has = (list: Term[], t: Term) => list.some((x) => x.equals(t));
    const removed = current.filter((t) => !has(next, t));
    const added = next.filter((t) => !has(current, t));
    if (removed.length === 0 && added.length === 0) return;
    // Branches chosen against the list as it stands — see `setValue`.
    const additions = added.map((t) => [t, chooseBranch(this.readStep, focus, write, t)] as const);
    for (const t of removed) this.retract(focus, write, t);
    for (const [t, branch] of additions) this.assertThrough(focus, branch, t);
    this.bump();
  }

  addValue(focus: Term, write: FieldWrite, value: Term): void {
    this.assert(focus, write, value);
    this.bump();
  }

  removeValue(focus: Term, write: FieldWrite, value: Term): void {
    this.retract(focus, write, value);
    this.bump();
  }

  /**
   * Create a nested resource (blank node) as the value of focus→path,
   * optionally typed, and return it so a sub-form can be built for it.
   */
  createNested(focus: Term, write: FieldWrite, typeIri?: string): Term {
    const node = blankNode(nextBlankId());
    this.assert(focus, write, node);
    if (typeIri) {
      this.backend.add(node, RDF_TYPE, namedNode(typeIri));
    }
    this.bump();
    return node;
  }

  /** Every value the field currently holds — the union over the plan's branches,
   *  matching what the path reads back. */
  private currentValues(focus: Term, write: FieldWrite): Term[] {
    const out: Term[] = [];
    for (const branch of write.branches) {
      for (const value of branchValues(this.readStep, focus, branch)) {
        if (!out.some((t) => t.equals(value))) out.push(value);
      }
    }
    return out;
  }

  /** Add the one statement that makes `value` a value of this field. Which branch
   *  of an alternative that is, is `chooseBranch`'s stated rule. */
  private assert(focus: Term, write: FieldWrite, value: Term): void {
    this.assertThrough(focus, chooseBranch(this.readStep, focus, write, value), value);
  }

  /** Add the statement for a branch already chosen — the half of {@link assert}
   *  that must run after a retraction, when the branch could no longer be chosen. */
  private assertThrough(focus: Term, branch: WriteBranch, value: Term): void {
    const st = statementFor(this.carrierOf(focus, branch), branch.step, value);
    this.backend.add(st.subject, st.predicate, st.object);
  }

  /**
   * Remove `value` from EVERY branch that asserts it.
   *
   * Not a choice: a path reads the union of its branches, so a value left on a
   * second branch is a value the field still shows after the user deleted it. The
   * asymmetry with {@link assert} — write one, retract all — is what makes the
   * round trip hold.
   */
  private retract(focus: Term, write: FieldWrite, value: Term): void {
    for (const branch of write.branches) {
      const carrier = resolveCarrier(this.readStep, focus, branch);
      if (!("carrier" in carrier)) continue;
      if (branch.step.direction === "inverse" && value.termType === "Literal") continue;
      const st = statementFor(carrier.carrier, branch.step, value);
      this.backend.remove(st.subject, st.predicate, st.object);
    }
    this.pruneOrphan(value);
  }

  /** Prune a blank-node value once nothing points at it any more: an orphaned
   *  blank node is unreachable, so its statements are unreadable rather than
   *  merely unused. Named nodes are left alone — they are addressable, and the
   *  form does not own them. */
  private pruneOrphan(value: Term): void {
    if (value.termType !== "BlankNode") return;
    if (this.backend.match(null, null, value).length > 0) return;
    this.pruneNode(value, new Set());
  }

  private carrierOf(focus: Term, branch: WriteBranch): Term {
    const resolved = resolveCarrier(this.readStep, focus, branch);
    if ("carrier" in resolved) return resolved.carrier;
    // The build gate should have made this field read-only. Reaching here means
    // the graph changed under a model built from it, so say which of the two it is
    // rather than writing the value somewhere plausible.
    throw new Error(
      `Cannot write through this path: its intermediate resource is ${
        resolved.readOnly === "intermediate-missing" ? "missing" : "ambiguous"
      }.`,
    );
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

/** Re-exported so a caller that holds a predicate rather than a field can address
 *  these mutations without reaching into the form layer. */
export { forwardWrite } from "../form/writePath.js";
export type { FieldWrite } from "../form/writePath.js";
