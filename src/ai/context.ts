import type { Term } from "@rdfjs/types";
import type { GraphState } from "../engine/GraphState.js";
import type { FieldModel } from "../form/FormModel.js";
import { localName } from "../form/terms.js";

/** How much of a field's surroundings goes into a prompt. A prompt is a budget, not
 *  an export: these bound what a large enumeration or a long value can spend. */
export interface ContextLimits {
  /** How many `sh:in` values are listed; the rest are counted. */
  maxOptions: number;
  /** How many literals of the same resource {@link siblingValues} lists. */
  maxSiblings: number;
  /** How many characters of one entered value are kept. */
  maxValue: number;
}

export const DEFAULT_CONTEXT_LIMITS: ContextLimits = { maxOptions: 25, maxSiblings: 12, maxValue: 200 };

/**
 * What a model needs to know about a field, read off the field model — the only
 * SHACL-specific part of the AI layer, and the only part that changes for another
 * shape language: the constraints are already the model's, whatever wrote them.
 * One line per fact the field states; a fact it does not state is not mentioned.
 */
export function fieldContext(field: FieldModel, limits: Partial<ContextLimits> = {}): string {
  const { maxOptions, maxValue } = { ...DEFAULT_CONTEXT_LIMITS, ...limits };
  const c = field.constraints;
  const lines = [`Field: ${field.label}`];
  if (field.description) lines.push(`Description: ${field.description}`);

  const kind = c.datatype ?? c.nodeKind ?? (c.classIn ?? (c.classIri ? [c.classIri] : [])).join(" | ");
  if (kind) lines.push(`Value type: ${localName(kind)}`);
  if (field.alternatives) {
    lines.push(`Alternatives: ${field.alternatives.map((a) => a.label).join(" | ")}`);
  }
  if (c.options?.length) {
    const shown = c.options.slice(0, maxOptions).map((o) => o.label ?? o.value.value);
    const more = c.options.length - shown.length;
    lines.push(`Allowed values: ${shown.join(", ")}${more > 0 ? `, … (${more} more)` : ""}`);
  }
  if (c.pattern) lines.push(`Must match the regular expression: ${c.pattern}${c.flags ? ` (flags ${c.flags})` : ""}`);
  if (c.minLength !== undefined || c.maxLength !== undefined) {
    lines.push(`Length: ${c.minLength ?? 0} to ${c.maxLength ?? "any"} characters`);
  }
  const bounds = [
    c.minInclusive !== undefined && `at least ${c.minInclusive}`,
    c.minExclusive !== undefined && `more than ${c.minExclusive}`,
    c.maxInclusive !== undefined && `at most ${c.maxInclusive}`,
    c.maxExclusive !== undefined && `less than ${c.maxExclusive}`,
  ].filter(Boolean);
  if (bounds.length) lines.push(`Range: ${bounds.join(", ")}`);
  if (c.languageIn?.length) lines.push(`Language tags allowed: ${c.languageIn.join(", ")}`);
  if (c.uniqueLang) lines.push("At most one value per language");

  const count = field.repeatable
    ? `${field.minCount > 0 ? `at least ${field.minCount}` : "any number"}${field.maxCount !== undefined ? `, at most ${field.maxCount}` : ""} values`
    : field.required ? "exactly one value" : "optional, one value";
  lines.push(`Cardinality: ${count}`);

  const held = field.values.map((s) => s.value?.value).filter((v): v is string => !!v);
  if (field.repeatable && held.length) lines.push(`Values already entered: ${held.map((v) => clip(v, maxValue)).join("; ")}`);
  return lines.join("\n");
}

/**
 * What has been entered about the same resource under other properties, as
 * `name: value` lines — the record the field belongs to, in the words the graph
 * has for it (a predicate's local name). Literal objects only, bounded in count
 * and length: this is context for a prompt, not an export.
 */
export function siblingValues(
  { graph, focus, field }: { graph: GraphState; focus: Term; field: FieldModel },
  limits: Partial<ContextLimits> = {},
): string {
  const { maxSiblings, maxValue } = { ...DEFAULT_CONTEXT_LIMITS, ...limits };
  const lines: string[] = [];
  for (const q of graph.allQuads()) {
    if (q.subject.value !== focus.value || q.object.termType !== "Literal") continue;
    if (q.predicate.value === field.path.value) continue;
    lines.push(`${localName(q.predicate.value)}: ${clip(q.object.value, maxValue)}`);
    if (lines.length === maxSiblings) break;
  }
  return lines.join("\n");
}

const clip = (v: string, max: number) => (v.length > max ? `${v.slice(0, max)}…` : v);
