import { NS } from "../rdf/factory.js";
import { Editors } from "../vocab/shacl-ui.js";
import type { FieldModel } from "../schema/FormModel.js";

/**
 * Presentational widget kinds. The canonical home is core (not React) so the
 * editor-IRI → kind mapping is theme-agnostic and unit-testable. A theme is just
 * a set of widgets keyed by these kinds.
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

const XSD = NS.xsd;
const RDF_LANGSTRING = `${NS.rdf}langString`;
const SH_IRI = `${NS.sh}IRI`;

export const NUMERIC = new Set(
  ["integer", "int", "long", "short", "byte", "decimal", "float", "double",
   "nonNegativeInteger", "positiveInteger", "negativeInteger", "nonPositiveInteger",
   "unsignedInt", "unsignedLong", "unsignedShort", "unsignedByte"].map((t) => `${XSD}${t}`),
);

export type WidgetKindMap = ReadonlyMap<string, WidgetKind>;

/** Canonical SHACL-UI editor IRI → widget kind. Extend by passing a superset map. */
export const defaultWidgetKindMap: WidgetKindMap = new Map<string, WidgetKind>([
  [Editors.TextArea, "textarea"],
  [Editors.RichText, "textarea"],
  [Editors.TextFieldWithLang, "lang"],
  [Editors.TextAreaWithLang, "lang"],
  [Editors.DatePicker, "date"],
  [Editors.DateTimePicker, "datetime"],
  [Editors.Boolean, "boolean"],
  [Editors.EnumSelect, "select"],
  [Editors.InstancesSelect, "reference"],
  [Editors.AutoComplete, "reference"],
  [Editors.SubClass, "reference"],
  [Editors.IRI, "url"],
  [Editors.NumberField, "number"],
]);

/**
 * Resolve a field's widget kind from its editor IRI (map-driven), falling back
 * to its datatype/nodeKind facts. Replaces a hardcoded switch; consumers add a
 * map entry plus a widget-registry entry — no core edit.
 */
export function resolveWidgetKind(field: FieldModel, map: WidgetKindMap = defaultWidgetKindMap): WidgetKind {
  const mapped = map.get(field.editorId);
  if (mapped) return mapped;

  const dt = field.constraints.datatype;
  if (dt === RDF_LANGSTRING) return "lang";
  if (dt && NUMERIC.has(dt)) return "number";
  if (field.constraints.nodeKind === SH_IRI || dt === `${XSD}anyURI`) return "url";
  return "text";
}
