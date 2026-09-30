import type { ReactNode } from "react";
import { NS } from "../../form/factory.js";
import { fallbackEditorId, NUMERIC } from "../../form/editors.js";
import type { FieldModel } from "../../form/FormModel.js";
import type { CompletionRequest, WidgetOption } from "../../assist.js";

/**
 * The presentation contract. Widgets are *dumb*: they render an input for a
 * primitive value and never touch RDF. All term ⇄ primitive conversion lives in
 * one binding (`form/termBinding`), so a theme is just a set of widgets — no
 * duplication.
 *
 * A registry is keyed by the property's **SHACL-UI editor IRI**, which rudof
 * resolves for every property. There is no intermediate widget taxonomy: both
 * ends of the mapping are vocabularies someone else maintains — `shui:` on one
 * side, the component library's own names on the other — and a third invented in
 * between could only lose information. It did: `InstancesSelectEditor`,
 * `AutoCompleteEditor` and `SubClassEditor` are three different controls, and
 * `TextFieldWithLangEditor` and `TextAreaWithLangEditor` differ by exactly the
 * thing a user notices.
 *
 * Keying on the IRI also makes the registry open: a profile with a custom
 * `shui:editor` is a new entry, not a new case in a union in core.
 */

export interface WidgetProps {
  /** Primitive value: the literal/IRI string, or "true"/"false" for booleans. */
  value: string | null;
  /** Commit a value. `language` applies to `lang` (rdf:langString) fields. */
  onChange: (value: string | null, language?: string) => void;
  options?: WidgetOption[];
  /** Current language tag (for `lang` fields). */
  language?: string;
  /** Allowed language tags (sh:languageIn) — constrains a `lang` field's picker. */
  languageIn?: string[];
  /** Async suggestion loader for `reference` fields (from `assist.search`). */
  loadOptions?: (query: string, signal?: AbortSignal) => Promise<WidgetOption[]>;
  /** Streaming inline completion for free text (from `assist.complete`) — ghost
   * text at the caret. Yields continuation chunks; the request's `AbortSignal`
   * cancels a stale run. Present only when the form has an `assistUi` to draw it. */
  complete?: (request: CompletionRequest) => AsyncIterable<string>;
  /** The sh:class IRI for `reference` fields. */
  classIri?: string;
  /** Every class the value may belong to, when an `sh:or` allowed more than one
   *  (`classIri` is the first). A widget that searches instances should search all
   *  of them; one that reads a single class still works off `classIri`. */
  classIn?: string[];
  /** True when the field must hold a value (`sh:minCount` ≥ 1). Presentational
   *  only — a widget may pick a different control (a switch has no "unset"). The
   *  *state* props a widget would otherwise thread — invalid, disabled — are NOT
   *  here: `Field` owns them and Ark propagates them by context to every input
   *  under it, so the accessible fact and the visible one cannot drift apart. */
  required?: boolean;
  /** Numeric step ("1" for integers, "any" otherwise). */
  step?: string;
  /** `sh:minInclusive` / `sh:maxInclusive` — the bounds a number input can hold. */
  min?: number;
  max?: number;
  /** `sh:minExclusive` / `sh:maxExclusive`. Carried, not rendered: every numeric
   *  control here takes inclusive bounds, and there is no epsilon that is right for
   *  both `xsd:integer` and `xsd:double`. The engine still rejects on commit. */
  minExclusive?: number;
  maxExclusive?: number;
  minLength?: number;
  maxLength?: number;
  /** The raw `sh:pattern` — an **unanchored XPath regex**, which is not what the
   *  HTML `pattern` attribute means (that one is implicitly `^(?:…)$`). Passed for a
   *  widget that wants to show it as a hint; do not hand it to an input. See
   *  {@link flags}, which the attribute cannot express at all. */
  pattern?: string;
  /** `sh:flags` for {@link pattern}. */
  flags?: string;
  /** `sh:minCount` / `sh:maxCount`, and whether the field holds more than one value. */
  minCount?: number;
  maxCount?: number;
  repeatable?: boolean;
  /** `sh:defaultValue` as a primitive — a widget may use it to decide whether an
   *  empty field is genuinely unanswered (a boolean's third state) or just off. */
  defaultValue?: string | null;
  placeholder?: string;
}

export type Widget = (props: WidgetProps) => ReactNode;

/**
 * The contract for a widget that renders **all** of a repeatable field's values as
 * ONE control — a tags input, a multi-select — instead of N single-value rows in a
 * `FieldArray`.
 *
 * Selection is by **cardinality**, not by a new editor IRI: `sh:maxCount 1` and no
 * max are the same editor asked for a different number of answers, and inventing
 * `shui:MultiEnumSelectEditor` would put a fact SHACL already states into a second
 * vocabulary that could drift from it. An explicit `shui:editor` still wins in
 * {@link resolveWidget}, so overriding one field remains one registry entry.
 *
 * The values are primitives in the same binding as {@link WidgetProps.value}; the
 * commit is a whole-list replace, which is what a control that owns the list can
 * honestly report.
 */
export interface MultiWidgetProps {
  /** Every current value, in the order the graph projected them. */
  values: string[];
  /** Replace the whole list. Diffed against the graph, one change notification. */
  onChange: (values: string[]) => void;
  options?: WidgetOption[];
  loadOptions?: (query: string, signal?: AbortSignal) => Promise<WidgetOption[]>;
  classIri?: string;
  /** See {@link WidgetProps.classIn}. */
  classIn?: string[];
  minCount?: number;
  maxCount?: number;
  placeholder?: string;
}

export type MultiWidget = (props: MultiWidgetProps) => ReactNode;

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
 * assistance it supports and, optionally, the one-control form of the same editor
 * for a repeatable field. */
export interface WidgetDef {
  render: Widget;
  /** Renders every value of a repeatable field as one control. Used only when the
   *  field actually is repeatable; the single-value `render` stays the answer for
   *  `sh:maxCount 1`. */
  multi?: MultiWidget;
  assist?: AssistSupport;
}
export type WidgetEntry = Widget | WidgetDef;
/** Editor IRI → widget. Keys are `shui:` editor IRIs (see {@link Editors}). */
export type WidgetRegistry = Readonly<Record<string, WidgetEntry>>;

/** Resolve a registry entry to its render function. */
export function widgetRender(entry: WidgetEntry): Widget {
  return typeof entry === "function" ? entry : entry.render;
}
/** A registry entry's declared assistance (none for a bare function). */
export function widgetAssist(entry: WidgetEntry): AssistSupport {
  return typeof entry === "function" ? {} : entry.assist ?? {};
}
/** The entry's one-control form for a repeatable field, if it declares one. */
export function widgetMulti(entry: WidgetEntry): MultiWidget | undefined {
  return typeof entry === "function" ? undefined : entry.multi;
}

const XSD = NS.xsd;
const INTEGRAL = new Set(
  ["integer", "int", "long", "short", "byte", "nonNegativeInteger", "positiveInteger",
   "negativeInteger", "nonPositiveInteger", "unsignedInt", "unsignedLong", "unsignedShort",
   "unsignedByte"].map((t) => `${XSD}${t}`),
);

/**
 * The widget for a field: its stated editor, else one derived from its own type
 * facts — the same lookup twice, never a separate taxonomy.
 *
 * Returns `undefined` only if the derived fallback is unregistered too, which
 * means the registry is missing `shui:TextFieldEditor` and every field is broken;
 * the caller reports that rather than rendering nothing in silence.
 */
export function resolveWidget(field: FieldModel, registry: WidgetRegistry): WidgetEntry | undefined {
  return registry[field.editorId] ?? registry[fallbackEditorId(field)];
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
