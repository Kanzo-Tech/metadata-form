import type { NamedNode, Quad, Term } from "@rdfjs/types";

export type Severity = "violation" | "warning" | "info";

/**
 * Schema-agnostic validation result. A SHACL or ShEx validator maps its native
 * report into this shape so the React layer is independent of the language.
 */
export interface ValidationResult {
  focusNode: Term;
  /** The predicate/path the result is about, if any. */
  path?: Term;
  message: string;
  severity: Severity;
  /** Native constraint identifier (e.g. sh:sourceConstraintComponent IRI). */
  constraint?: string;
  value?: Term;
}

/** Per-field error as surfaced to editor components. */
export interface FieldError {
  message: string;
  severity: Severity;
  constraint?: string;
}

export interface Validator {
  /**
   * Validate a data graph. `focusNode` optionally scopes validation to one
   * subject. Returns a flat list of agnostic results.
   */
  validate(input: ValidatorInput): Promise<ValidationResult[]> | ValidationResult[];
}

export interface ValidatorInput {
  /** The data graph to validate, as RDF/JS quads. */
  data: Quad[];
  /** When set, validate just this focus node against its resolved root shape
   *  (scoped revalidation) instead of every target of every shape. */
  focusNode?: Term;
  /** Explicit root shape; otherwise resolved from the focus node's type. */
  rootShape?: NamedNode;
}
