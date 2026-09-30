/**
 * SHACL 1.2 User Interfaces vocabulary — the canonical editor/viewer terms.
 *
 * The Editor's Draft's namespace, `http://www.w3.org/ns/shacl-ui/` (the earlier
 * `…shacl-ui#` is not recognised by the engine). IRIs subject to change; see
 * https://w3c.github.io/data-shapes/shacl12-ui/.
 *
 * This is the ONLY module that hard-codes SHACL-UI IRIs. Everything else
 * references these symbols, so a spec correction is a one-file edit.
 */

export const SHUI = "http://www.w3.org/ns/shacl-ui/";

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
