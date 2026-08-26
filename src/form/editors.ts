import { NS } from "../engine/factory.js";
import { Editors } from "./vocab/shacl-ui.js";
import { SH_IRI } from "./vocab/shacl.js";
import type { FieldModel } from "./FormModel.js";

const XSD = NS.xsd;
const RDF_LANGSTRING = `${NS.rdf}langString`;

/**
 * The RDF-facts side of editor resolution.
 *
 * Editor *selection* lives in rudof, which emits a `shui:` editor IRI on every
 * property — explicit when the profile states one, inferred from the property's
 * type facts otherwise. A widget registry is therefore keyed by that IRI and
 * nothing else: the SHACL-UI vocabulary is the taxonomy, and there is no second
 * one here to keep in step with it.
 *
 * What remains is the case rudof cannot cover: an editor IRI the registry has no
 * widget for — a profile stating a `shui:` term we do not implement, or a custom
 * one. {@link fallbackEditorId} answers it in the *same* vocabulary, so
 * resolution is one lookup, a derivation, and the same lookup again.
 */

export const NUMERIC = new Set(
  ["integer", "int", "long", "short", "byte", "decimal", "float", "double",
   "nonNegativeInteger", "positiveInteger", "negativeInteger", "nonPositiveInteger",
   "unsignedInt", "unsignedLong", "unsignedShort", "unsignedByte"].map((t) => `${XSD}${t}`),
);

/**
 * A canonical editor IRI derived from the field's own type facts, for when its
 * stated editor has no widget. Deliberately conservative — it answers "what can
 * this value be edited as at all", not "what would be nicest".
 */
export function fallbackEditorId(field: FieldModel): string {
  const c = field.constraints;
  if (c.options?.length) return Editors.EnumSelect;
  const dt = c.datatype;
  if (dt === RDF_LANGSTRING) return Editors.TextFieldWithLang;
  if (dt === `${XSD}boolean`) return Editors.Boolean;
  if (dt === `${XSD}date`) return Editors.DatePicker;
  if (dt === `${XSD}dateTime`) return Editors.DateTimePicker;
  if (dt && NUMERIC.has(dt)) return Editors.NumberField;
  if (c.classIri) return Editors.AutoComplete;
  if (c.nodeKind === SH_IRI || dt === `${XSD}anyURI`) return Editors.IRI;
  return Editors.TextField;
}
