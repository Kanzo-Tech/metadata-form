/** Canonical DASH editor IRIs used as editor ids throughout the engine. */
const DASH = "http://datashapes.org/dash#";

export const Editors = {
  TextField: `${DASH}TextFieldEditor`,
  TextArea: `${DASH}TextAreaEditor`,
  TextFieldWithLang: `${DASH}TextFieldWithLangEditor`,
  TextAreaWithLang: `${DASH}TextAreaWithLangEditor`,
  DatePicker: `${DASH}DatePickerEditor`,
  DateTimePicker: `${DASH}DateTimePickerEditor`,
  BooleanSelect: `${DASH}BooleanSelectEditor`,
  EnumSelect: `${DASH}EnumSelectEditor`,
  URI: `${DASH}URIEditor`,
  AutoComplete: `${DASH}AutoCompleteEditor`,
  InstancesSelect: `${DASH}InstancesSelectEditor`,
  Details: `${DASH}DetailsEditor`,
  RichText: `${DASH}RichTextEditor`,
  BlankNode: `${DASH}BlankNodeEditor`,
} as const;

export type KnownEditorId = (typeof Editors)[keyof typeof Editors];
