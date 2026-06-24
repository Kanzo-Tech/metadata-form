import type { Store } from "n3";
import type { NamedNode, Term } from "@rdfjs/types";
import type { FormModel } from "./FormModel.js";
import type { Validator } from "./validation.js";

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
  /** The data graph being edited (may be empty for a blank form). */
  data: Store;
  /** Subject to edit; created fresh if absent. */
  focusNode?: Term;
  /** Explicit root shape to use; otherwise inferred from targets. */
  rootShape?: NamedNode;
  /** UI locale for label/description language selection. */
  locale?: string;
  /** Receives non-fatal issues instead of dropping them silently. */
  onDiagnostic?: DiagnosticSink;
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
   * Optionally infer the subject to edit from an existing data graph (e.g. the
   * first instance of a target class). Returns undefined when none is found.
   */
  inferFocusNode?(schema: ParsedSchema, data: Store, rootShape?: NamedNode): Term | undefined;
  /**
   * Seed required type triples (e.g. the target class) on the focus node so the
   * validator targets it and the output graph is complete. Mutates `store`.
   */
  seedFocusNode?(schema: ParsedSchema, store: Store, focusNode: Term, rootShape?: NamedNode): void;
}
