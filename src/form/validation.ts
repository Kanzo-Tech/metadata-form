import type { Term } from "@rdfjs/types";
import type { LangString } from "./ShapeIR.js";
import { pickByLanguage } from "../engine/terms.js";
import { resolveStrings, type Strings } from "../i18n/strings.js";

export type Severity = "violation" | "warning" | "info";

/**
 * Schema-agnostic validation result. A SHACL or ShEx validator maps its native
 * report into this shape so the React layer is independent of the language.
 */
export interface ValidationResult {
  focusNode: Term;
  /** The predicate/path the result is about, if any. */
  path?: Term;
  /**
   * Lang-tagged messages for this result: the engine's default (untagged, i.e.
   * `language: ""`) merged with the shape author's per-language `sh:message`.
   * `friendly()` picks the best for the active locale.
   */
  messages: LangString[];
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

/** Strict author-message match: exact tag → base language, over lang-TAGGED
 *  messages only (untagged/engine defaults are excluded so they don't shadow a
 *  localized fallback). Returns undefined when the author wrote no message for
 *  this locale. */
function authorMessage(messages: LangString[], locale: string | undefined): string | undefined {
  const want = (locale || "").toLowerCase();
  const wantBase = want.split("-")[0];
  let exact: string | undefined;
  let base: string | undefined;
  for (const m of messages) {
    if (!m.language) continue;
    const lang = m.language.toLowerCase();
    if (want && lang === want) exact ??= m.value;
    else if (wantBase && lang.split("-")[0] === wantBase) base ??= m.value;
  }
  return exact ?? base;
}

/**
 * Resolve a result to one displayable, localized string. Priority:
 *  1. the shape author's `sh:message` matched to `locale` (multilingual SHACL);
 *  2. a localized default for known constraint components (the built-in catalog);
 *  3. any remaining message (e.g. an untagged ShEx message), else the fallback.
 *
 * Step 2 keeps parity with the old English `FRIENDLY` table: an untagged author
 * message on a *known* constraint still yields the catalog wording (no regression),
 * while ShEx/unknown-constraint messages fall through to step 3 — engine-neutral.
 */
function friendly(result: ValidationResult, locale: string | undefined, strings: Strings): string {
  const authored = authorMessage(result.messages, locale);
  if (authored) return authored;
  if (result.constraint && strings.validationDefaults[result.constraint]) {
    return strings.validationDefaults[result.constraint];
  }
  const msg = pickByLanguage(result.messages, locale)?.value?.trim();
  return msg && msg !== "Invalid value" ? msg : strings.validationDefaults._fallback;
}

/**
 * Group agnostic validation results into a per-field error map keyed by
 * `${focusNode}|${path}`. Results without a path are collected under the
 * focus node key with an empty path segment (node-level errors).
 */
export function mapResults(
  results: ValidationResult[],
  locale?: string,
  strings: Strings = resolveStrings(locale),
): Map<string, FieldError[]> {
  const map = new Map<string, FieldError[]>();
  for (const r of results) {
    if (!r.focusNode) continue;
    const key = r.path ? fieldKey(r.focusNode, r.path) : `${r.focusNode.value}|`;
    const list = map.get(key) ?? [];
    list.push({ message: friendly(r, locale, strings), severity: r.severity, constraint: r.constraint });
    map.set(key, list);
  }
  return map;
}
