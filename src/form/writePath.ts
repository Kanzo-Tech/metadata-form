import type { NamedNode, Term } from "@rdfjs/types";
import { namedNode } from "./factory.js";
import type { PathExpr } from "./ShapeIR.js";

/**
 * Turning a property path into the statement that writes a value through it.
 *
 * SHACL defines paths for **reading**. §3.7 (Value Nodes) says the value nodes
 * of a property shape are "the set of nodes in the data graph that can be reached
 * from the focus node with the path mapping of `p`", §2.3.1 gives the seven path
 * kinds and their mappings onto SPARQL property paths, and every constraint
 * component is a test over the resulting set. The spec never says how a value
 * gets into it, because a validator never puts one there. A form does, so it has to supply the missing
 * half itself — and the only defensible way to supply it is to demand that
 * writing be the exact inverse of the reading the spec *does* define:
 *
 *   after the write, the value MUST be one of the value nodes the same path
 *   yields for the same focus node.
 *
 * That read-back test is what sorts the seven path kinds, and it sorts them
 * unevenly. Treating them as one bucket — "not a predicate, therefore not
 * editable" — is a statement about our implementation, not about the paths:
 *
 * - **predicate** `ex:p` — one statement, `(focus, p, value)`.
 * - **inverse** `^ex:p` — also one statement, with the focus and the value at
 *   opposite ends: `(value, p, focus)`. Nothing is under-determined; the path is
 *   only "complex" in the sense of not being an IRI.
 * - **alternative** `ex:a|ex:b` — reading is the union of the branches, so a
 *   value written through *any* branch reads back. Which branch is therefore not
 *   determined by the spec at all, and is settled by {@link chooseBranch}.
 * - **sequence** `ex:a/ex:b` — the value hangs off an intermediate node, so the
 *   write is a statement on *that* node, not on the focus. Writable exactly when
 *   the intermediate already exists and is unique; see {@link resolveCarrier}.
 * - **zeroOrMore / oneOrMore / zeroOrOne** — read-only, and not as an apology.
 *   See {@link planWrite}.
 *
 * This module is pure and vocabulary-agnostic: it maps a {@link PathExpr} to a
 * plan, and takes the one graph capability it needs — {@link StepReader} — as a
 * callback. The graph never appears here, so the same plans drive a SHACL-backed
 * form, a ShEx-backed one, or a test with a hand-built IR.
 */

/**
 * Which end of the statement the focus node sits on. `"forward"` is
 * `(focus, predicate, value)`; `"inverse"` is `(value, predicate, focus)` — the
 * SHACL `sh:inversePath` of a predicate, and the only inversion RDF itself can
 * express as a single triple.
 */
export type WriteDirection = "forward" | "inverse";

/** One statement's worth of path: a predicate, plus which end the value is on. */
export interface WriteStep {
  predicate: NamedNode;
  direction: WriteDirection;
}

/**
 * One way to assert a value for a field.
 *
 * `via` is the walk from the focus node to the node that actually carries the
 * value — empty for every path but a sequence, where it is the sequence's
 * leading steps. `step` is the statement the value lives in. A field has more
 * than one branch only for an alternative path, whose branches are read as a
 * union and written one at a time.
 */
export interface WriteBranch {
  via: WriteStep[];
  step: WriteStep;
}

/** How a field's values are asserted in the graph. `branches` is never empty. */
export interface FieldWrite {
  branches: WriteBranch[];
}

/**
 * Why no statement can be written through this **path**. Stable codes, so a
 * surface can filter, translate or count them; the human sentence is in the i18n
 * catalog under `strings.readOnly[code]`.
 *
 * A path is not the only thing that can leave a field uneditable — knowing where
 * to put a statement is no use without knowing what term to put there — so this
 * is a subset of {@link ReadOnlyCode}, which is the whole list and lives with the
 * field model. What is decided here is decided from the path alone.
 */
export type PathReadOnlyCode =
  /** `p*`, `p+`, `p?`, or a path containing one. */
  | "variable-length-path"
  /** A path whose shape is not a chain of single steps (`^(a/b)`, `a|(b/c)`, …). */
  | "compound-path"
  /** A sequence whose intermediate node does not exist yet. */
  | "intermediate-missing"
  /** A sequence whose intermediate step reaches more than one node. */
  | "intermediate-ambiguous";

/** The outcome of planning a path: a write plan, or the reason there is none. */
export type WritePlan = { write: FieldWrite } | { readOnly: PathReadOnlyCode };

/** Reads one step of a path: the nodes reachable from `from` by `step`. The only
 *  graph capability the write layer needs, passed as a callback so this module
 *  stays free of the store. */
export type StepReader = (from: Term, step: WriteStep) => Term[];

const forward = (iri: string): WriteStep => ({ predicate: namedNode(iri), direction: "forward" });
const inverse = (iri: string): WriteStep => ({ predicate: namedNode(iri), direction: "inverse" });

/** The path as ONE statement, if it is one: a predicate, or the inverse of a
 *  predicate. Everything else needs more than a triple and is handled above. */
function singleStep(path: PathExpr): WriteStep | undefined {
  if (path.kind === "predicate") return forward(path.iri);
  if (path.kind === "inverse" && path.of.kind === "predicate") return inverse(path.of.iri);
  return undefined;
}

/** Every single step an alternative offers, flattened. Nesting is flattened
 *  because SPARQL's `AlternativePath` is associative — the value nodes of
 *  `a|(b|c)` and `(a|b)|c` are the same union — so a nested alternative is the
 *  same set of branches written with extra brackets. Returns undefined if any
 *  branch is not a single step, which is what makes the whole field read-only:
 *  see {@link planWrite}. */
function alternativeSteps(path: PathExpr): WriteStep[] | undefined {
  if (path.kind !== "alternative") {
    const step = singleStep(path);
    return step ? [step] : undefined;
  }
  const steps: WriteStep[] = [];
  for (const option of path.options) {
    const branch = alternativeSteps(option);
    if (!branch) return undefined;
    steps.push(...branch);
  }
  return steps;
}

/** True if a quantifier appears anywhere in the path. Checked first, so
 *  `(a/b*)` is reported as variable-length rather than as a bad sequence — the
 *  quantifier is the reason, and the more specific reason is the useful one. */
function hasQuantifier(path: PathExpr): boolean {
  switch (path.kind) {
    case "zeroOrMore":
    case "oneOrMore":
    case "zeroOrOne":
      return true;
    case "inverse":
      return hasQuantifier(path.of);
    case "sequence":
      return path.steps.some(hasQuantifier);
    case "alternative":
      return path.options.some(hasQuantifier);
    default:
      return false;
  }
}

/**
 * Plan how to write a value through a property path.
 *
 * The quantified kinds are refused, and that is the correct answer rather than a
 * gap. `p*` and `p+` reach a value at an unbounded depth; "add this value" does
 * not name a depth, so there is no statement it could mean — and any statement we
 * picked (say, always depth 1) would silently discard what the author asked for.
 * `p?` is worse than under-determined: its value nodes always include the focus
 * node itself, by the zero-length match, and no statement asserts that a node is
 * its own value. A field that shows a value the user cannot delete, on a path
 * where "add" has no referent, is honest only while it stays read-only.
 *
 * The compound cases — `^(a/b)`, an alternative with a sequence branch, a
 * sequence with an alternative step — are refused for a narrower reason: writing
 * one is definable, but *removing* through it is not, because the value may sit
 * on a branch we cannot reach with a single retraction. Editing that leaves the
 * old value behind is worse than not editing, so they stay read-only until a
 * value's own branch can be identified.
 */
export function planWrite(path: PathExpr): WritePlan {
  if (hasQuantifier(path)) return { readOnly: "variable-length-path" };

  const single = singleStep(path);
  if (single) return { write: { branches: [{ via: [], step: single }] } };

  if (path.kind === "alternative") {
    const steps = alternativeSteps(path);
    return steps && steps.length > 0
      ? { write: { branches: steps.map((step) => ({ via: [], step })) } }
      : { readOnly: "compound-path" };
  }

  if (path.kind === "sequence") {
    const steps: WriteStep[] = [];
    for (const part of path.steps) {
      const step = singleStep(part);
      if (!step) return { readOnly: "compound-path" };
      steps.push(step);
    }
    if (steps.length < 2) return { readOnly: "compound-path" };
    return { write: { branches: [{ via: steps.slice(0, -1), step: steps[steps.length - 1] }] } };
  }

  return { readOnly: "compound-path" };
}

/** A branch resolved against the data: the node the value's statement hangs off
 *  (the focus itself, unless the path is a sequence), or why it cannot be found. */
export type CarrierResolution =
  | { carrier: Term }
  | { readOnly: "intermediate-missing" | "intermediate-ambiguous" };

const termKey = (t: Term) => `${t.termType} ${t.value}`;

function distinct(terms: Term[]): Term[] {
  const seen = new Set<string>();
  return terms.filter((t) => {
    const key = termKey(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Walk a branch's `via` from the focus to the node that carries the value.
 *
 * A sequence is writable exactly when every intermediate step lands on ONE node.
 * Zero nodes means the write would have to *create* the intermediate, and nothing
 * in the property shape says what that node should be — `sh:class` and `sh:node`
 * on a sequence property describe the value at the far end, not the resource in
 * the middle — so inventing an untyped blank node there would be us guessing at
 * the author's model. More than one node means the write would have to pick which
 * intermediate to hang the value off, and the two are not interchangeable: the
 * path reads the union of both, so the choice is visible in the data and
 * invisible in the form.
 *
 * Both are properties of the *data*, not of the shape, so a sequence field is
 * read-only exactly while the graph leaves it under-determined and becomes
 * editable the moment the intermediate is filled in through its own field.
 *
 * Note that the carrier can be shared: if two focus nodes reach the same
 * intermediate, editing the sequence value through one of them changes what the
 * other reads. That is not an artefact of this design — it is what the shared
 * node means in RDF, and the same is true of any editor over that graph.
 */
export function resolveCarrier(
  read: StepReader | undefined,
  focus: Term,
  branch: WriteBranch,
): CarrierResolution {
  let node = focus;
  for (const step of branch.via) {
    // No reader is no evidence of an intermediate — a structure-only build (no
    // data graph) is exactly the case where none exists yet.
    const next = read ? distinct(read(node, step)) : [];
    if (next.length === 0) return { readOnly: "intermediate-missing" };
    if (next.length > 1) return { readOnly: "intermediate-ambiguous" };
    node = next[0];
  }
  return { carrier: node };
}

/** The values this ONE branch currently carries for the focus — as opposed to the
 *  field's values, which are the union over every branch. */
export function branchValues(read: StepReader, focus: Term, branch: WriteBranch): Term[] {
  const resolved = resolveCarrier(read, focus, branch);
  return "carrier" in resolved ? distinct(read(resolved.carrier, branch.step)) : [];
}

/**
 * Which branch of an alternative path a NEW value is written through.
 *
 * SHACL does not answer this and cannot: the value nodes of `a|b` are the union
 * of both branches, so every branch reads back identically, and every constraint
 * component on the property shape — `sh:minCount`, `sh:maxCount`, `sh:datatype`,
 * `sh:in`, all of them — sees the same value node set whichever we pick. The
 * choice is invisible to the validator and visible to everyone downstream who
 * queries one predicate rather than the path. So it is a policy, and a policy
 * has to be stated:
 *
 *  1. **The branch the record already uses.** If the focus node currently holds
 *     values through exactly one branch, the new value joins it. A record that
 *     says `schema:name` twice in one namespace and once in another is a record
 *     that reads as inconsistent to every consumer that is not a SHACL engine,
 *     and we are the ones who would have made it so.
 *  2. **Otherwise, the first branch the author listed.** `sh:alternativePath`
 *     takes a SHACL list, and a list is the one ordered construct in the
 *     language. SHACL attaches no meaning to that order — the union does not
 *     care — but it is the only preference the author expressed, and reading it
 *     is less arbitrary than any order we would invent (preferring `https`,
 *     preferring the longest IRI, sorting). Guessing "wrong" here is bounded:
 *     the value still reads back through the same path and still validates.
 *
 * Literals narrow the field first, on RDF's own grammar rather than on policy: an
 * inverse branch writes the value as the *subject* of a statement, and a literal
 * cannot be a subject. So a literal is only ever offered the forward branches.
 */
export function chooseBranch(
  read: StepReader,
  focus: Term,
  write: FieldWrite,
  value: Term,
): WriteBranch {
  const eligible =
    value.termType === "Literal"
      ? write.branches.filter((b) => b.step.direction === "forward")
      : write.branches;
  if (eligible.length === 0) {
    throw new Error(
      "This value can only be written as the subject of a statement (the path is " +
        "inverse), and a literal cannot be a subject.",
    );
  }
  if (eligible.length === 1) return eligible[0];
  const inUse = eligible.filter((b) => branchValues(read, focus, b).length > 0);
  return inUse.length === 1 ? inUse[0] : eligible[0];
}

/** The statement that puts `value` on `carrier` through `step`. */
export function statementFor(
  carrier: Term,
  step: WriteStep,
  value: Term,
): { subject: Term; predicate: NamedNode; object: Term } {
  if (step.direction === "forward") {
    return { subject: carrier, predicate: step.predicate, object: value };
  }
  if (value.termType === "Literal") {
    throw new Error(
      `Cannot write the literal "${value.value}" through the inverse path ` +
        `^<${step.predicate.value}>: it would have to be the subject of a statement.`,
    );
  }
  return { subject: value, predicate: step.predicate, object: carrier };
}

/** A one-statement forward plan — the degenerate case, for callers that hold a
 *  predicate rather than a field. */
export function forwardWrite(predicate: NamedNode): FieldWrite {
  return { branches: [{ via: [], step: { predicate, direction: "forward" } }] };
}

/** True when every branch of the plan ends in an inverse step, i.e. every value
 *  of this field is a statement's subject and therefore an IRI or a blank node.
 *  A fact about RDF, used to fill in a `sh:nodeKind` the shape left unstated. */
export function writesSubjects(write: FieldWrite): boolean {
  return write.branches.every((b) => b.step.direction === "inverse");
}
