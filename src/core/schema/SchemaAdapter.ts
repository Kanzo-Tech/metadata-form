import type { Store } from "n3";
import type { NamedNode, Quad, Term } from "@rdfjs/types";
import type { FormModel } from "./FormModel.js";
import type { Validator } from "./validation.js";
import type { GraphBackend } from "../ports/GraphBackend.js";
import type { ProjectedValues } from "../form/buildFormModel.js";

/**
 * Opaque, adapter-specific parsed schema. The SHACL adapter stores the shapes
 * graph here; a future ShEx adapter would store its own representation.
 */
export interface ParsedSchema {
  readonly language: string;
}

/** A non-fatal issue surfaced while building the form (instead of failing
 * silently) — e.g. a property dropped for an unsupported path, or a `sh:node`
 * pointing at a missing shape. Opt-in via `onDiagnostic`. */
export interface Diagnostic {
  level: "warning" | "info";
  /** Stable code for filtering/i18n. */
  code: "unsupported-path" | "missing-shape" | string;
  message: string;
  /** The shape/path/node the diagnostic concerns, if any. */
  detail?: string;
}

export type DiagnosticSink = (diagnostic: Diagnostic) => void;

export interface BuildFormModelArgs {
  schema: ParsedSchema;
  /** The data graph being edited (may be empty for a blank form). Unused when
   *  `values` is supplied (the single-graph path projects values from the
   *  engine session instead of reading this store). */
  data: Store;
  /** Subject to edit; created fresh if absent. */
  focusNode?: Term;
  /** Explicit root shape to use; otherwise inferred from targets. */
  rootShape?: NamedNode;
  /** UI locale for label/description language selection. */
  locale?: string;
  /** Receives non-fatal issues instead of dropping them silently. */
  onDiagnostic?: DiagnosticSink;
  /** Pre-projected field values (the single-graph path). When present, values
   *  come from here rather than being read from `data`. */
  values?: ProjectedValues;
}

/**
 * The live editable graph of a form session: the engine-owned {@link GraphBackend}
 * (the single source of truth) plus the resolved subject and root shape, returned
 * by {@link SchemaAdapter.createGraph}.
 */
export interface GraphSession {
  /** The live, mutable, queryable data graph (the engine session). */
  backend: GraphBackend;
  /** The resolved subject to edit (inferred/seeded when not given). */
  focusNode: Term;
  /** The resolved root node-shape id — for projection + scoped validation. */
  rootShapeId: string;
}

/**
 * The single seam that isolates the shape language from the rest of the engine.
 * SHACL is the v1 implementation; ShEx can be added by implementing this
 * interface — no React, validation-display or serialization code changes.
 */
export interface SchemaAdapter {
  readonly language: string;
  parseSchema(input: string | Store): ParsedSchema | Promise<ParsedSchema>;
  buildFormModel(args: BuildFormModelArgs): FormModel;
  createValidator(schema: ParsedSchema): Validator;
  /**
   * Load the initial data into the engine session ONCE, resolve + seed the focus
   * node into it, and return the live editable {@link GraphSession} — the single
   * source of truth the form edits, projects and validates against (no per-edit
   * reload). Replaces the old infer/seed-into-an-n3-store dance.
   */
  createGraph(
    schema: ParsedSchema,
    initialData: Quad[],
    focusNode?: Term,
    rootShape?: NamedNode,
  ): Promise<GraphSession>;
  /**
   * Project the focus node's value tree (recursively, sync) from the current
   * session graph into the {@link ProjectedValues} consumed by `buildFormModel`.
   * Called on every edit to re-derive field values from the single graph.
   */
  projectValues(schema: ParsedSchema, focusNode: Term, rootShapeId: string): ProjectedValues;
}
