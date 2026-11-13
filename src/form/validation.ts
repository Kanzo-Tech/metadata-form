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
  /** The messages are the shape's own `sh:message`, not the engine's wording. */
  authored?: boolean;
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
  /** The messages are the shape's own `sh:message` (see {@link ValidationResult}). */
  authored?: boolean;
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
      authored: r.authored,
      severity: r.severity,
      constraint: r.constraint,
      value: r.value,
    });
    map.set(key, list);
  }
  return map;
}

/**
 * One problem, said once, in the shape's words when it has them.
 *
 * A profile may split one field's rules over several property shapes on the same
 * path (a SHACL conjunction): one says what the value is (`sh:nodeKind sh:IRI`),
 * another how it is written (`sh:pattern`, with a `sh:message` of its own). A value
 * that breaks them all is reported once per broken constraint, so the reader got
 * the engine's "Expected kind of value: Iri" and the profile's message twice over.
 *
 * Per field, severity and offending value (none, for a missing one): when any of
 * its results speaks in the shape's own words (`authored`), those are what is shown
 * and the engine's wording for the same value goes; and the same messages appear
 * once. A value that breaks rules no `sh:message` covers keeps every one of them,
 * and a violation is never hidden behind a warning.
 */
export function oncePerProblem(errors: Map<string, FieldError[]>): Map<string, FieldError[]> {
  const out = new Map<string, FieldError[]>();
  for (const [key, list] of errors) {
    const problem = (e: FieldError) =>
      `${e.severity}|${e.value ? `${e.value.termType}|${e.value.value}` : ""}`;
    const spokenFor = new Set(list.filter((e) => e.authored).map(problem));
    const seen = new Set<string>();
    const kept = list.filter((e) => {
      if (!e.authored && spokenFor.has(problem(e))) return false;
      const words = `${problem(e)}|${e.messages
        .map((m) => `${m.language}\0${m.value}`)
        .sort()
        .join("\n")}`;
      if (seen.has(words)) return false;
      seen.add(words);
      return true;
    });
    out.set(key, kept);
  }
  return out;
}
