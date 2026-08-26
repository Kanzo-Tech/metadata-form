// Public entry. The UI is built on @radix-ui/themes — render inside a <Theme>
// and import "@radix-ui/themes/styles.css".

// React layer — the single, unified API: useMetadataForm() + <MetadataForm>.
export { useMetadataForm } from "./react/hooks/useMetadataForm.js";
export type {
  MetadataFormController,
  UseMetadataFormOptions,
} from "./react/hooks/useMetadataForm.js";
export { MetadataForm } from "./react/form/MetadataForm.js";
export type { MetadataFormProps } from "./react/form/MetadataForm.js";
export type { FormLayout, GridLayout } from "./react/form/context.js";
export { ValidationSummary } from "./react/validation/ValidationSummary.js";
export type { ValidationSummaryProps } from "./react/validation/ValidationSummary.js";
// Derived form state — the single source for validation + completion + health.
export { computeFormReport, useFormReport } from "./react/validation/useFormReport.js";
export type { FormReport, FormProgress, FormMood, IssueRow, GroupIssues } from "./react/validation/useFormReport.js";
export { FormAssistant } from "./react/assistant/FormAssistant.js";
export type { FormAssistantProps } from "./react/assistant/FormAssistant.js";
export { defaultMascot } from "./react/assistant/mascot.js";
export type { MascotCharacter, MascotMood } from "./react/assistant/mascot.js";
// Widgets — the presentation contract (build a theme = a set of these).
export { defaultWidgets } from "./react/widgets/defaultWidgets.js";
export {
  resolveWidget,
  optionsFor,
  stepFor,
  termToPrimitive,
  primitiveToTerm,
  widgetRender,
  widgetAssist,
} from "./react/widgets/widgets.js";
export type {
  Widget,
  WidgetProps,
  WidgetOption,
  WidgetRegistry,
  WidgetDef,
  WidgetEntry,
  AssistSupport,
  FormAssist,
  FieldSuggestion,
} from "./react/widgets/widgets.js";
// Lower-level building blocks (for custom layouts).
export { NodeForm } from "./react/form/NodeForm.js";
export { FieldRenderer } from "./react/form/FieldRenderer.js";
export { useField } from "./react/hooks/useField.js";
export { useFormContext, useFocusNode } from "./react/form/context.js";

// Schema-agnostic form model
export type {
  FormModel,
  GroupModel,
  FieldModel,
  ValueSlot,
  FieldConstraints,
  FieldOption,
  EditorId,
} from "./form/FormModel.js";
export { allFields } from "./form/FormModel.js";
export type {
  ValidationResult,
  FieldError,
  Severity,
} from "./form/validation.js";
// Non-fatal build diagnostics (dropped paths, missing shapes).
export type { Diagnostic, DiagnosticSink } from "./form/buildFormModel.js";

// Built-in UI string catalog (en/es/ca) — pass `strings` to useMetadataForm to
// override the language-picker chrome or the default validation messages.
export { resolveStrings, DEFAULTS as defaultStrings } from "./i18n/strings.js";
export type { Strings, DeepPartial } from "./i18n/strings.js";

// Editors — the SHACL-UI editor IRIs rudof emits + the editor-IRI → widget-kind
// map (the one UI-specific mapping; editor *selection* lives in rudof).
export { Editors, type KnownEditorId } from "./form/vocab/shacl-ui.js";
export {
  fallbackEditorId,
} from "./form/editors.js";

// Shape IR (vocabulary-agnostic parsing seam)
export type {
  ShapeModel,
  NodeShapeIR,
  PropertyShapeIR,
  PathExpr,
  ValueConstraints,
  PresentationHints,
  ComponentIR,
  TermValue,
  LangString,
  ProjectedForm,
  ProjectedProperty,
  ProjectedValue,
} from "./form/ShapeIR.js";

// The default engine is rudof-over-WASM. Its internals — RudofEngine,
// createRudofEngine, projectTree, the wasm ABI types, RudofGraphBackend — live on
// the `metadata-form/rudof` subpath for power-user wiring (shared engine, custom
// projection), so the main entry stays UI-focused.

// RDF term factory (namedNode/literal/blankNode/quad + the NS base IRIs). All RDF
// parsing & serialization lives in rudof now — use the engine session for I/O.
export * as ns from "./engine/factory.js";
