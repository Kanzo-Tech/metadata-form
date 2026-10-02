/** One option of an enumeration or a reference search: the value to commit and
 *  the label to show for it. */
export interface WidgetOption {
  value: string;
  label: string;
}

/**
 * The data seam — the one place the consumer wires lookups the form cannot make
 * itself. The library **never calls a vocabulary service on its own**; it only
 * hands over the query and renders what comes back.
 *   - `search` — instances of an `sh:class` for `reference` autocomplete (typeahead).
 * The signal lets the UI cancel a stale run.
 *
 * Model assistance is not here: it is `@kanzo-tech/ai`'s `Assist`, drawn by
 * `assistUi` from `metadata-form/ai` under the host's own `AssistProvider`.
 */
export interface FormAssist {
  /** `classIn` carries every class the value may belong to when an `sh:or`
   *  allowed more than one; `classIri` is the first of them, so an implementation
   *  that only reads it keeps working and simply searches one of the alternatives. */
  search?(args: { classIri: string; classIn?: string[]; query: string; signal?: AbortSignal }): Promise<WidgetOption[]>;
}
