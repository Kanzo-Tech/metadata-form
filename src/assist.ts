import type { Term } from "@rdfjs/types";
import type { FieldModel } from "./form/FormModel.js";
import type { GraphState } from "./engine/GraphState.js";

/** One option of an enumeration or a reference search: the value to commit and
 *  the label to show for it. */
export interface WidgetOption {
  value: string;
  label: string;
}

/**
 * One suggested value for a field. Structurally identical to `@kanzo-tech/ai`'s
 * `Candidate` — declared here rather than imported so the core's types name no
 * package the consumer may not have installed; `metadata-form/ai` asserts the
 * two stay mutually assignable.
 */
export interface Candidate {
  /** Primitive value to commit (passed through the binding layer). */
  value: string;
  /** Human label shown in the picker; defaults to `value`. */
  label?: string;
  /** Optional rationale shown under the label. */
  rationale?: string;
}

/** What an inline completion is asked: the whole value and the caret it continues. */
export interface CompletionRequest {
  value: string;
  /** Where in `value` the continuation goes. */
  position: number;
  signal?: AbortSignal;
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
 * The form draws no assistance UI by itself: pass `assistUi` from
 * `metadata-form/ai` to `<MetadataForm>` for the ✨ and the ghost text, and see
 * `createFormAssist` there for a one-line setup over the Vercel AI SDK.
 * `focus` is the node the field belongs to, so an implementation can read what
 * else has been entered about it from `graph`.
 */
export interface FormAssist {
  /** `classIn` carries every class the value may belong to when an `sh:or`
   *  allowed more than one; `classIri` is the first of them, so an implementation
   *  that only reads it keeps working and simply searches one of the alternatives. */
  search?(args: { classIri: string; classIn?: string[]; query: string; signal?: AbortSignal }): Promise<WidgetOption[]>;
  suggest?(args: { field: FieldModel; focus: Term; graph: GraphState; locale: string; signal?: AbortSignal }): AsyncIterable<Candidate>;
  complete?(args: CompletionRequest & { field: FieldModel; focus: Term; graph: GraphState; locale: string }): AsyncIterable<string>;
}
