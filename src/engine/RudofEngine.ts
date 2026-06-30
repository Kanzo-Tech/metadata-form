import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { namedNode, quad, rdf } from "./factory.js";
import { toTerm, toTermValue } from "./termValue.js";
import { freshFocusNode, resolveRootShapeFromTypes } from "../form/buildFormModel.js";
import { projectTreeSync, type ProjectedValues } from "./projectTree.js";
import type { NodeShapeIR, ProjectedForm, ShapeModel } from "../form/ShapeIR.js";
import type { GraphBackend } from "./GraphBackend.js";
import type { Severity, ValidationResult } from "../form/validation.js";
import type { RudofLoader, RudofResult, RudofSession, ShapeModelJson } from "./abi.js";

const TURTLE = "text/turtle";
const RDF_TYPE = namedNode(rdf("type").value);

function mapSeverity(s: string | undefined): Severity {
  if (s?.endsWith("Warning")) return "warning";
  if (s?.endsWith("Info")) return "info";
  return "violation";
}

function toValidationResult(r: RudofResult): ValidationResult {
  return {
    focusNode: toTerm(r.focusNode),
    path: r.path ? toTerm(r.path) : undefined,
    message: r.message.join(" "),
    severity: mapSeverity(r.severity),
    constraint: r.sourceConstraintComponent,
    value: r.value ? toTerm(r.value) : undefined,
  };
}

/** Rehydrate the JSON shape model (arrays) into the {@link ShapeModel} (Maps). */
function shapeModelFromJson(json: ShapeModelJson): ShapeModel {
  return {
    nodeShapes: new Map(json.nodeShapes.map((s) => [s.id, s])),
    groups: new Map(json.groups.map((g) => [g.id, g])),
    byTargetClass: new Map(json.byTargetClass),
  };
}

/** The focus node's rdf:type values, read from the live session backend. */
function typesOf(backend: GraphBackend, focus: Term): string[] {
  return backend.match(focus, RDF_TYPE, null).map((q) => q.object.value);
}

/** Infer the subject to edit from the session graph: the first instance of the
 *  root shape's target class. Returns undefined when none is found. */
function inferFocusFromBackend(
  shapes: ShapeModel,
  backend: GraphBackend,
  rootShape?: NamedNode,
): Term | undefined {
  const shape = rootShape ? shapes.nodeShapes.get(rootShape.value) : undefined;
  const targetClasses = shape ? shape.targetClasses : [...shapes.byTargetClass.keys()];
  for (const cls of targetClasses) {
    const q = backend.match(null, RDF_TYPE, namedNode(cls))[0];
    if (q) return q.subject as Term;
  }
  return undefined;
}

/** Stamp the focus node with the root shape's target class plus any sh:hasValue /
 *  sh:defaultValue seeds, directly into the session graph, so a new instance is
 *  complete and validation targets it. */
function seedIntoBackend(backend: GraphBackend, focus: Term, shape: NodeShapeIR): void {
  if (shape.instanceClass) {
    const cls = namedNode(shape.instanceClass);
    if (backend.match(focus, RDF_TYPE, cls).length === 0) backend.add(focus, RDF_TYPE, cls);
  }
  for (const ps of shape.properties) {
    if (ps.path.kind !== "predicate" || !ps.path.iri) continue;
    const seed = ps.value.hasValue ?? ps.value.defaultValue;
    if (!seed) continue;
    const predicate = namedNode(ps.path.iri);
    if (backend.match(focus, predicate, null).length === 0) backend.add(focus, predicate, toTerm(seed));
  }
}

/** The live editable graph of a form session: the engine-owned {@link GraphBackend}
 *  (the single source of truth) plus the resolved subject and root shape, returned
 *  by {@link RudofEngine.createGraph}. */
export interface GraphSession {
  /** The live, mutable, queryable data graph (the engine session). */
  backend: GraphBackend;
  /** The resolved subject to edit (inferred/seeded when not given). */
  focusNode: Term;
  /** The resolved root node-shape id — for projection + scoped validation. */
  rootShapeId: string;
}

/** A {@link GraphBackend} over a rudof session's current graph. The session owns
 *  the single in-wasm graph; this just adapts term marshalling to RDF/JS. */
export class RudofGraphBackend implements GraphBackend {
  constructor(private readonly session: RudofSession) {}

  add(s: Term, p: Term, o: Term): void {
    this.session.add(toTermValue(s), toTermValue(p), toTermValue(o));
  }
  remove(s: Term, p: Term, o: Term): void {
    this.session.remove(toTermValue(s), toTermValue(p), toTermValue(o));
  }
  match(s?: Term | null, p?: Term | null, o?: Term | null): Quad[] {
    return this.session
      .quads(s ? toTermValue(s) : null, p ? toTermValue(p) : null, o ? toTermValue(o) : null)
      .map((q) => quad(toTerm(q.subject) as never, toTerm(q.predicate) as never, toTerm(q.object) as never));
  }
  serialize(mediaType: string): string {
    return this.session.serialize(mediaType);
  }
}

/**
 * The rudof-over-WASM engine: a single stateful session that owns BOTH the parsed
 * shapes AND the live data graph (the "single graph in rudof" model — SHACL 1.2,
 * spec-aligned). Parsing, projection AND validation all run in-wasm against that
 * one session, with no per-edit reload. Lazy, memoized init via the injected
 * {@link RudofLoader}, the only seam that touches wasm (tests swap the loader).
 *
 * Lifecycle: `loadShapes` (loads + retains the shapes), then `createGraph` (loads
 * the initial data once, resolves + seeds the focus, returns the live editable
 * {@link GraphSession}); `projectValues` re-derives field values on every edit and
 * `validateFocus` validates the live graph in place. `serialize` emits the live
 * graph (rudof owns all RDF I/O — there is no n3/jsonld here).
 */
export class RudofEngine {
  private session?: RudofSession;
  private initOnce?: Promise<void>;

  constructor(private readonly load: RudofLoader) {}

  /** Resolve once the engine is usable (awaits WASM; memoized). */
  ready(): Promise<void> {
    return (this.initOnce ??= this.load().then((m) => {
      this.session = m.newSession();
    }));
  }

  private get s(): RudofSession {
    if (!this.session) throw new Error("RudofEngine.ready() must be awaited before use");
    return this.session;
  }

  /** Parse a shapes document (Turtle / JSON-LD / N-Triples by media type) into the
   *  agnostic {@link ShapeModel} and retain it in the session. */
  async loadShapes(text: string, mediaType = TURTLE): Promise<ShapeModel> {
    await this.ready();
    return shapeModelFromJson(this.s.loadShapes(text, mediaType));
  }

  /** Parse a data document into the session graph; returns the live backend. */
  async loadData(text: string, mediaType = TURTLE): Promise<GraphBackend> {
    await this.ready();
    this.s.loadData(text, mediaType);
    return new RudofGraphBackend(this.s);
  }

  /** Start an empty editable graph backend. */
  async newGraph(): Promise<GraphBackend> {
    await this.ready();
    this.s.newData();
    return new RudofGraphBackend(this.s);
  }

  /** Serialize the live data graph to the given RDF media type (Turtle /
   *  JSON-LD / N-Triples). Prefixes parsed from the input are retained + emitted. */
  async serialize(mediaType: string): Promise<string> {
    await this.ready();
    return this.s.serialize(mediaType);
  }

  /** Serialize only the subgraph reachable from `focus` — the focus-scoped form
   *  output (one record), vs the whole-graph {@link serialize}. */
  async serializeFocus(focus: Term, mediaType: string): Promise<string> {
    await this.ready();
    return this.s.serializeFocus(toTermValue(focus), mediaType);
  }

  /**
   * Load the initial data into a fresh session graph ONCE, resolve + seed the
   * focus node into it, and return the live editable {@link GraphSession} — the
   * single source of truth the form edits, projects and validates against (no
   * per-edit reload). `data` is either a document string (rudof parses it by
   * `mediaType`) or a quad list (re-added as-is, preserving blank-node labels —
   * used by `reset` to reload a captured baseline).
   */
  async createGraph(
    shapes: ShapeModel,
    data?: string | Quad[],
    mediaType = TURTLE,
    focusNode?: Term,
    rootShape?: NamedNode,
  ): Promise<GraphSession> {
    const backend = await this.newGraph();
    if (typeof data === "string") {
      this.s.loadData(data, mediaType);
    } else if (data) {
      for (const q of data) backend.add(q.subject as Term, q.predicate as Term, q.object as Term);
    }

    const focus = focusNode ?? inferFocusFromBackend(shapes, backend, rootShape) ?? freshFocusNode();
    const shape = resolveRootShapeFromTypes(shapes, typesOf(backend, focus), rootShape);
    if (!shape) {
      throw new Error("Could not resolve a root node shape. Pass `rootShape` explicitly.");
    }
    seedIntoBackend(backend, focus, shape);
    return { backend, focusNode: focus, rootShapeId: shape.id };
  }

  /** Project the focus node's value tree (recursively, sync) from the current
   *  session graph into the {@link ProjectedValues} consumed by `buildFormModel`.
   *  Called on every edit to re-derive field values from the single graph. */
  projectValues(shapes: ShapeModel, focusNode: Term, rootShapeId: string): ProjectedValues {
    return projectTreeSync((f, s) => this.projectFormSync(f, s), shapes, rootShapeId, focusNode);
  }

  /** Validate the current graph (optionally scoped to one shape) against the shapes. */
  async validate(shapeId?: string): Promise<ValidationResult[]> {
    await this.ready();
    return this.s.validate(shapeId ?? null).results.map(toValidationResult);
  }

  /** Validate a single focus node against one shape — scoped revalidation for a
   *  form bound to one focus (cheaper than re-validating the whole graph). */
  async validateFocus(focus: Term, shapeId: string): Promise<ValidationResult[]> {
    await this.ready();
    return this.s.validateFocus(toTermValue(focus), shapeId).results.map(toValidationResult);
  }

  /** Evaluate every property path of a shape for a focus node against the graph. */
  async projectForm(focus: Term, shapeId: string): Promise<ProjectedForm> {
    await this.ready();
    return this.s.projectForm(toTermValue(focus), shapeId);
  }

  /**
   * Synchronous projection — requires {@link ready} to have already resolved
   * (throws otherwise). wasm-bindgen calls are synchronous once the module is
   * instantiated, so this lets the React per-edit rebuild stay synchronous (no
   * await straddling the model `useMemo`).
   */
  projectFormSync(focus: Term, shapeId: string): ProjectedForm {
    return this.s.projectForm(toTermValue(focus), shapeId);
  }
}
