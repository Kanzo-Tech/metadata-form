import { Editors } from "./ids.js";
import { NS } from "../rdf/factory.js";
import type { EditorId } from "../schema/FormModel.js";

/**
 * Editing-relevant facts of a property, fed to {@link selectEditor}. Adapters
 * (SHACL/ShEx) translate their native constraints into this neutral shape.
 */
export interface EditorMatchInput {
  /** Explicit editor requested by the schema (dash:editor). */
  explicitEditor?: EditorId;
  datatype?: string;
  nodeKind?: string;
  classIri?: string;
  hasIn: boolean;
  /** dash:singleLine — false forces a multi-line editor. */
  singleLine?: boolean;
  /** sh:node present → nested node shape. */
  hasNode: boolean;
}

const XSD = NS.xsd;
const RDF_LANGSTRING = `${NS.rdf}langString`;
const RDF_HTML = `${NS.rdf}HTML`;
const SH_IRI = `${NS.sh}IRI`;

/**
 * Pick a DASH editor for a property: honor an explicit `dash:editor`, otherwise
 * map from the datatype / nodeKind / sh:in / sh:node facts. A plain switch — the
 * DASH selection rules without a scoring engine.
 */
export function selectEditor(input: EditorMatchInput): EditorId {
  if (input.explicitEditor) return input.explicitEditor;
  if (input.hasNode) return Editors.Details;
  if (input.hasIn) return Editors.EnumSelect;

  const dt = input.datatype;
  if (dt === `${XSD}boolean`) return Editors.BooleanSelect;
  if (dt === `${XSD}date`) return Editors.DatePicker;
  if (dt === `${XSD}dateTime`) return Editors.DateTimePicker;
  if (dt === RDF_HTML) return Editors.RichText;
  if (dt === RDF_LANGSTRING) {
    return input.singleLine === false ? Editors.TextAreaWithLang : Editors.TextFieldWithLang;
  }

  if (input.classIri) return Editors.AutoComplete;
  if (input.nodeKind === SH_IRI || dt === `${XSD}anyURI`) return Editors.URI;
  if (input.singleLine === false) return Editors.TextArea;
  return Editors.TextField;
}
