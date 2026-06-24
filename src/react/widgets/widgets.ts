import type { ReactNode } from "react";
import type { Term } from "@rdfjs/types";
import { literal, namedNode, NS } from "../../core/rdf/factory.js";
import { Editors } from "../../core/editors/ids.js";
import type { FieldModel } from "../../core/schema/FormModel.js";
import type { GraphState } from "../../core/state/GraphState.js";

/**
 * The presentation contract. Widgets are *dumb*: they render an input for a
 * primitive value and never touch RDF. All term ⇄ primitive conversion lives in
 * this one binding layer, so a theme is just a set of widgets — no duplication.
 */
export type WidgetKind =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "url"
  | "textarea"
  | "boolean"
  | "select"
  | "reference"
  | "lang";

export interface WidgetOption {
  value: string;
  label: string;
}

export interface WidgetProps {
  kind: WidgetKind;
  /** Primitive value: the literal/IRI string, or "true"/"false" for booleans. */
  value: string | null;
  /** Commit a value. `language` applies to `lang` (rdf:langString) fields. */
  onChange: (value: string | null, language?: string) => void;
  options?: WidgetOption[];
  /** Current language tag (for `lang` fields). */
  language?: string;
  /** Async suggestion loader for `reference` fields (from `assist.search`). */
  loadOptions?: (query: string, signal?: AbortSignal) => Promise<WidgetOption[]>;
  /** Streaming inline completion for free text (from `assist.complete`) — ghost
   * text. Yields continuation chunks; pass an `AbortSignal` to cancel a stale run. */
  complete?: (value: string, signal?: AbortSignal) => AsyncIterable<string>;
  /** The sh:class IRI for `reference` fields. */
  classIri?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Numeric step ("1" for integers, "any" otherwise). */
  step?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
  placeholder?: string;
}

export type Widget = (props: WidgetProps) => ReactNode;

/** Which assistance a widget supports. Declared by the widget itself (a
 * tester-style capability, like JSON Forms pairing a renderer with a tester) so
 * the ✨ menu / ghost text appear only where they make sense — and a custom widget
 * can opt in/out without any central list. */
export interface AssistSupport {
  /** Offers discrete value suggestions (the ✨ menu, fed by `assist.suggest`). */
  suggest?: boolean;
  /** Offers inline streaming completion / ghost text (fed by `assist.complete`). */
  complete?: boolean;
}

/** A registry entry: a bare render function, or a render function paired with the
 * assistance it supports. */
export interface WidgetDef {
  render: Widget;
  assist?: AssistSupport;
}
export type WidgetEntry = Widget | WidgetDef;
export type WidgetRegistry = Partial<Record<WidgetKind, WidgetEntry>>;

/** Resolve a registry entry to its render function. */
export function widgetRender(entry: WidgetEntry): Widget {
  return typeof entry === "function" ? entry : entry.render;
}
/** A registry entry's declared assistance (none for a bare function). */
export function widgetAssist(entry: WidgetEntry): AssistSupport {
  return typeof entry === "function" ? {} : entry.assist ?? {};
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
  search?(args: { classIri: string; query: string; signal?: AbortSignal }): Promise<WidgetOption[]>;
  suggest?(args: { field: FieldModel; graph: GraphState; locale: string; signal?: AbortSignal }): AsyncIterable<FieldSuggestion>;
  complete?(args: { field: FieldModel; value: string; graph: GraphState; locale: string; signal?: AbortSignal }): AsyncIterable<string>;
}

const XSD = NS.xsd;
const RDF_LANGSTRING = `${NS.rdf}langString`;
const SH_IRI = `${NS.sh}IRI`;
const NUMERIC = new Set(
  ["integer", "int", "long", "short", "byte", "decimal", "float", "double",
   "nonNegativeInteger", "positiveInteger", "negativeInteger", "nonPositiveInteger",
   "unsignedInt", "unsignedLong", "unsignedShort", "unsignedByte"].map((t) => `${XSD}${t}`),
);
const INTEGRAL = new Set(
  ["integer", "int", "long", "short", "byte", "nonNegativeInteger", "positiveInteger",
   "negativeInteger", "nonPositiveInteger", "unsignedInt", "unsignedLong", "unsignedShort",
   "unsignedByte"].map((t) => `${XSD}${t}`),
);

/** Map a field (its selected editor + datatype) to a presentational widget kind. */
export function widgetKind(field: FieldModel): WidgetKind {
  switch (field.editorId) {
    case Editors.TextArea:
    case Editors.RichText:
      return "textarea";
    case Editors.TextFieldWithLang:
    case Editors.TextAreaWithLang:
      return "lang";
    case Editors.DatePicker:
      return "date";
    case Editors.DateTimePicker:
      return "datetime";
    case Editors.BooleanSelect:
      return "boolean";
    case Editors.EnumSelect:
      return "select";
    case Editors.InstancesSelect:
    case Editors.AutoComplete:
      return "reference";
    case Editors.URI:
      return "url";
    default: {
      const dt = field.constraints.datatype;
      if (dt === RDF_LANGSTRING) return "lang";
      if (dt && NUMERIC.has(dt)) return "number";
      if (field.constraints.nodeKind === SH_IRI || dt === `${XSD}anyURI`) return "url";
      return "text";
    }
  }
}

export function stepFor(field: FieldModel): string | undefined {
  const dt = field.constraints.datatype;
  if (!dt || !NUMERIC.has(dt)) return undefined;
  return INTEGRAL.has(dt) ? "1" : "any";
}

export function optionsFor(field: FieldModel): WidgetOption[] | undefined {
  const opts = field.constraints.options;
  if (!opts) return undefined;
  return opts.map((o) => ({ value: o.value.value, label: o.label ?? o.value.value }));
}

/** RDF term → primitive string for a widget. */
export function termToPrimitive(term: Term | null): string | null {
  return term ? term.value : null;
}

/** Language tag of a term (for `lang` fields), if any. */
export function languageOf(term: Term | null): string {
  return term && term.termType === "Literal" ? term.language : "";
}

/** Primitive string from a widget → RDF term (the single binding direction). */
export function primitiveToTerm(
  field: FieldModel,
  kind: WidgetKind,
  raw: string | null,
  language?: string,
): Term | null {
  if (raw === null || raw === "") return null;
  switch (kind) {
    case "boolean":
      return literal(raw === "true" ? "true" : "false", namedNode(`${XSD}boolean`));
    case "url":
    case "reference":
      return namedNode(raw);
    case "lang":
      return literal(raw, language ?? "");
    case "number":
      return literal(raw, namedNode(field.constraints.datatype ?? `${XSD}decimal`));
    case "select": {
      const opt = field.constraints.options?.find((o) => o.value.value === raw);
      if (opt) return opt.value;
      return field.constraints.nodeKind === SH_IRI ? namedNode(raw) : literal(raw);
    }
    default: {
      const dt = field.constraints.datatype;
      if (dt && dt !== `${XSD}string` && dt !== RDF_LANGSTRING) {
        return literal(raw, namedNode(dt));
      }
      return literal(raw);
    }
  }
}
