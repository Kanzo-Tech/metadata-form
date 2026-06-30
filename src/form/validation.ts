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

/** Key matching FieldModel.id: `${focusNode}|${path}`. */
export function fieldKey(focusNode: Term, path: Term): string {
  return `${focusNode.value}|${path.value}`;
}

const FRIENDLY: Record<string, string> = {
  "http://www.w3.org/ns/shacl#MinCountConstraintComponent": "This field is required",
  "http://www.w3.org/ns/shacl#MaxCountConstraintComponent": "Too many values",
  "http://www.w3.org/ns/shacl#DatatypeConstraintComponent": "Invalid value type",
  "http://www.w3.org/ns/shacl#NodeKindConstraintComponent": "Invalid value kind",
  "http://www.w3.org/ns/shacl#PatternConstraintComponent": "Value does not match the required pattern",
  "http://www.w3.org/ns/shacl#MinLengthConstraintComponent": "Value is too short",
  "http://www.w3.org/ns/shacl#MaxLengthConstraintComponent": "Value is too long",
  "http://www.w3.org/ns/shacl#ClassConstraintComponent": "Value is not of the expected type",
  "http://www.w3.org/ns/shacl#InConstraintComponent": "Value is not an allowed option",
};

function friendly(result: ValidationResult): string {
  // Prefer the curated message for known constraint components, so the wording is
  // friendly and consistent regardless of the engine (rudof, rdf-validate-shacl…).
  if (result.constraint && FRIENDLY[result.constraint]) return FRIENDLY[result.constraint];
  const msg = result.message?.trim();
  return msg && msg !== "Invalid value" ? msg : "Invalid value";
}

/**
 * Group agnostic validation results into a per-field error map keyed by
 * `${focusNode}|${path}`. Results without a path are collected under the
 * focus node key with an empty path segment (node-level errors).
 */
export function mapResults(results: ValidationResult[]): Map<string, FieldError[]> {
  const map = new Map<string, FieldError[]>();
  for (const r of results) {
    if (!r.focusNode) continue;
    const key = r.path ? fieldKey(r.focusNode, r.path) : `${r.focusNode.value}|`;
    const list = map.get(key) ?? [];
    list.push({ message: friendly(r), severity: r.severity, constraint: r.constraint });
    map.set(key, list);
  }
  return map;
}
