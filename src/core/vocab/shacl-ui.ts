/**
 * SHACL 1.2 User Interfaces vocabulary — the canonical editor/viewer terms.
 *
 * FPWD — IRIs subject to change; confirmed against
 * https://www.w3.org/TR/shacl12-ui/ (namespace http://www.w3.org/ns/shacl-ui#).
 *
 * This is the ONLY module that hard-codes SHACL-UI IRIs. Everything else
 * references these symbols, so a spec correction is a one-file edit.
 */

export const SHUI = "http://www.w3.org/ns/shacl-ui#";

/** Property assigning an editor to a property shape (≈ legacy dash:editor). */
export const SHUI_EDITOR = `${SHUI}editor`;
/** Property assigning a viewer to a property shape (≈ legacy dash:viewer). */
export const SHUI_VIEWER = `${SHUI}viewer`;

/** Canonical SHACL-UI editor IRIs, used as {@link EditorId} values engine-wide. */
export const Editors = {
  TextField: `${SHUI}TextFieldEditor`,
  TextArea: `${SHUI}TextAreaEditor`,
  TextFieldWithLang: `${SHUI}TextFieldWithLangEditor`,
  TextAreaWithLang: `${SHUI}TextAreaWithLangEditor`,
  NumberField: `${SHUI}NumberFieldEditor`,
  DatePicker: `${SHUI}DatePickerEditor`,
  DateTimePicker: `${SHUI}DateTimePickerEditor`,
  Boolean: `${SHUI}BooleanEditor`,
  EnumSelect: `${SHUI}EnumSelectEditor`,
  IRI: `${SHUI}IRIEditor`,
  AutoComplete: `${SHUI}AutoCompleteEditor`,
  InstancesSelect: `${SHUI}InstancesSelectEditor`,
  SubClass: `${SHUI}SubClassEditor`,
  Details: `${SHUI}DetailsEditor`,
  RichText: `${SHUI}RichTextEditor`,
  BlankNode: `${SHUI}BlankNodeEditor`,
} as const;

export type KnownEditorId = (typeof Editors)[keyof typeof Editors];
