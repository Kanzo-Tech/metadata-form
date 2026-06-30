import type { Term } from "@rdfjs/types";

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
