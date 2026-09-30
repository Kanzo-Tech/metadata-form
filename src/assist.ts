import type { FieldModel } from "./form/FormModel.js";
import type { GraphState } from "./engine/GraphState.js";

/** One option of an enumeration or a reference search: the value to commit and
 *  the label to show for it. */
export interface WidgetOption {
  value: string;
  label: string;
}

/** A suggested value for a field (e.g. produced by an LLM in the consumer). */
export interface FieldSuggestion {
  /** Primitive value to commit (passed through the binding layer). */
  value: string;
  /** Human label shown in the picker; defaults to `value`. */
  label?: string;
  /** Optional rationale shown under the label. */
  rationale?: string;
}

/**
 * The single assistance seam — the one place the consumer wires data/AI help.
 * The library **never calls an LLM or a vocabulary service itself**; it only
 * hands over context and renders what these callbacks return. Maps to the two
 * canonical editor patterns — a *candidate list* and *inline completion*:
 *   - `search`   — instances of an `sh:class` for `reference` autocomplete (typeahead).
 *   - `suggest`  — discrete value candidates for a field (the ✨ menu), streamed one
 *                  at a time so they appear as they are produced.
 *   - `complete` — a streaming inline continuation for free text (ghost text).
 * Every callback gets an optional `AbortSignal` so the UI can cancel stale runs.
 * For a one-line setup over the Vercel AI SDK, see the `metadata-form/ai` adapter.
 */
export interface FormAssist {
  /** `classIn` carries every class the value may belong to when an `sh:or`
   *  allowed more than one; `classIri` is the first of them, so an implementation
   *  that only reads it keeps working and simply searches one of the alternatives. */
  search?(args: { classIri: string; classIn?: string[]; query: string; signal?: AbortSignal }): Promise<WidgetOption[]>;
  suggest?(args: { field: FieldModel; graph: GraphState; locale: string; signal?: AbortSignal }): AsyncIterable<FieldSuggestion>;
  complete?(args: { field: FieldModel; value: string; graph: GraphState; locale: string; signal?: AbortSignal }): AsyncIterable<string>;
}
