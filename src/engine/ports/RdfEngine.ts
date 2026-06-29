import type { Term } from "@rdfjs/types";
import type { ProjectedForm, ShapeModel } from "../../model/ShapeIR.js";
import type { ValidationResult } from "../../model/validation.js";
import type { GraphBackend } from "./GraphBackend.js";

/**
 * Port for the RDF/shapes engine — a single stateful session that owns BOTH the
 * data graph and the parsed shapes (the "single graph in rudof" model). The
 * default adapter is rudof-over-WASM; isolating it behind this interface keeps
 * the domain free of any WASM dependency (Ports & Adapters), and lets unit tests
 * run against an in-memory fake.
 *
 * Lifecycle: `ready()` once, then `loadShapes` + (`loadData` | `newGraph`); the
 * returned {@link GraphBackend} is the live editable graph. `validate` and
 * `projectForm` operate on the session's current graph against its shapes.
 */
export interface RdfEngine {
  /** Resolve once the engine is usable (no-op for sync engines; awaits WASM). */
  ready(): Promise<void>;
  /** Parse a shapes document into the agnostic {@link ShapeModel} and retain it. */
  loadShapes(text: string, mediaType?: string): ShapeModel | Promise<ShapeModel>;
  /** Parse a data document; returns the live editable graph backend. */
  loadData(text: string, mediaType?: string): GraphBackend | Promise<GraphBackend>;
  /** Start an empty editable graph backend. */
  newGraph(): GraphBackend | Promise<GraphBackend>;
  /** Validate the current graph (optionally scoped to one shape) against the shapes. */
  validate(shapeId?: string): ValidationResult[] | Promise<ValidationResult[]>;
  /** Validate a single focus node against one shape — scoped revalidation for a
   *  form bound to one focus (cheaper than re-validating the whole graph). */
  validateFocus(focus: Term, shapeId: string): ValidationResult[] | Promise<ValidationResult[]>;
  /** Evaluate every property path of a shape for a focus node against the graph. */
  projectForm(focus: Term, shapeId: string): ProjectedForm | Promise<ProjectedForm>;
  /** Synchronous projection — valid once {@link ready} has resolved. Lets the
   *  React per-edit rebuild project the live graph without an await straddling the
   *  model `useMemo` (the single-graph sync path). */
  projectFormSync(focus: Term, shapeId: string): ProjectedForm;
}
