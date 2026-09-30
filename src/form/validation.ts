import type { Term } from "@rdfjs/types";
import type { LangString } from "./ShapeIR.js";

export type Severity = "violation" | "warning" | "info";

/**
 * Schema-agnostic validation result. A SHACL or ShEx validator maps its native
 * report into this shape so the React layer is independent of the language.
 */
export interface ValidationResult {
  focusNode: Term;
  /** The path the result is about, as the canonical key the fields are indexed
   *  by — for every path kind, not only a predicate. Absent for a node-level
   *  result. */
  pathKey?: string;
  /**
   * Lang-tagged messages for this result: the shape author's `sh:message`
   * literals, or, when it has none, the engine's default wording in each language
   * of its catalog. `messageOf` picks the one for the reader's languages.
   */
  messages: LangString[];
  severity: Severity;
  /** Native constraint identifier (e.g. sh:sourceConstraintComponent IRI). */
  constraint?: string;
  value?: Term;
}

/** Per-field error as surfaced to editor components. */
export interface FieldError {
  /** The result's lang-tagged messages, untouched: which one is shown depends on
   *  the reader's languages, so the choice is made where the text is rendered
   *  (`messageOf` on the controller), not here — a form whose language changes
   *  re-words its errors without validating again. */
  messages: LangString[];
  severity: Severity;
  constraint?: string;
  /** The offending value (`sh:value`). For a `sh:node` rollup this IS the nested
   *  focus node, which is how `computeFormReport` recognises and drops it. */
  value?: Term;
}

/** Key matching FieldModel.id: `${focusNode}|${path}`. */
export function fieldKey(focusNode: Term, path: Term): string {
  return `${focusNode.value}|${path.value}`;
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
    const key = `${r.focusNode.value}|${r.pathKey ?? ""}`;
    const list = map.get(key) ?? [];
    list.push({
      messages: r.messages,
      severity: r.severity,
      constraint: r.constraint,
      value: r.value,
    });
    map.set(key, list);
  }
  return map;
}
