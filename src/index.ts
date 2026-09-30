// Public entry. The UI is built on @kanzo-tech/ui — compile its Tailwind entry
// (see "metadata-form/tailwind.css") and put the theme attributes on <html> (see
// KanzoThemeProvider). There is no wrapper component to render inside: Ark's
// overlays portal to document.body, so a wrapper could not reach them.
//
// Deliberately small: a hook, the components that render it, and the types a
// consumer writes against. The rudof engine and the shape IR are on the
// `metadata-form/rudof` subpath, the AI adapter on `metadata-form/ai`.

export { useMetadataForm } from "./react/hooks/useMetadataForm.js";
export type { MetadataFormController, UseMetadataFormOptions } from "./react/hooks/useMetadataForm.js";
export { MetadataForm } from "./react/form/MetadataForm.js";
export type { MetadataFormProps } from "./react/form/MetadataForm.js";
export type { FormLayout, GridLayout } from "./react/form/context.js";
export { ValidationSummary } from "./react/validation/ValidationSummary.js";
export type { ValidationSummaryProps } from "./react/validation/ValidationSummary.js";
export { ValidationPanel } from "./react/validation/ValidationPanel.js";
export type { ValidationPanelProps, ValidationPanelLabels } from "./react/validation/ValidationPanel.js";
export { FormAssistant } from "./react/assistant/FormAssistant.js";
export type { FormAssistantProps } from "./react/assistant/FormAssistant.js";
export type { MascotCharacter, MascotMood } from "./react/assistant/mascot.js";

// Widgets — the presentation contract (a theme is a set of these, keyed by editor IRI).
export { defaultWidgets } from "./react/widgets/defaultWidgets.js";
export { Editors } from "./form/vocab/shacl-ui.js";
export type {
  Widget,
  WidgetProps,
  MultiWidget,
  MultiWidgetProps,
  WidgetRegistry,
  WidgetDef,
  WidgetEntry,
  AssistSupport,
} from "./react/widgets/widgets.js";
export type { WidgetOption, FormAssist, FieldSuggestion } from "./assist.js";

// The form model and the report derived from it.
export type {
  FormModel,
  GroupModel,
  FieldModel,
  ValueSlot,
  FieldConstraints,
  FieldOption,
  FieldAlternative,
  EditorId,
  ReadOnlyCode,
  ReadOnlyReason,
} from "./form/FormModel.js";
export type { FieldError, Severity } from "./form/validation.js";
export type { Diagnostic, DiagnosticSink } from "./form/buildFormModel.js";
export type { FormReport, FormProgress, FormMood, IssueRow, GroupIssues } from "./react/validation/formReport.js";

// UI string catalog (en/es/ca) — pass `strings` to override any of it.
export type { Strings, DeepPartial } from "./i18n/strings.js";
