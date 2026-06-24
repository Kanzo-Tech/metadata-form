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
  widgetKind,
  optionsFor,
  stepFor,
  termToPrimitive,
  primitiveToTerm,
  widgetRender,
  widgetAssist,
} from "./react/widgets/widgets.js";
export type {
  Widget,
  WidgetKind,
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

// Schema-agnostic core (the seam that keeps the UI independent of SHACL/ShEx)
export type {
  SchemaAdapter,
  ParsedSchema,
  BuildFormModelArgs,
  Diagnostic,
  DiagnosticSink,
} from "./core/schema/SchemaAdapter.js";
export type {
  FormModel,
  GroupModel,
  FieldModel,
  ValueSlot,
  FieldConstraints,
  FieldOption,
  EditorId,
} from "./core/schema/FormModel.js";
export { allFields } from "./core/schema/FormModel.js";
export type {
  Validator,
  ValidationResult,
  FieldError,
  Severity,
} from "./core/schema/validation.js";

// Editors (DASH editor ids + selection)
export { Editors } from "./core/editors/ids.js";
export { selectEditor, type EditorMatchInput } from "./core/editors/selectEditor.js";

// SHACL adapter (default)
export { shaclAdapter } from "./core/adapters/shacl/index.js";
export type { ShaclParsedSchema } from "./core/adapters/shacl/index.js";

// RDF utilities
export { toStore, toStoreSync, parseTurtle, parseJsonLd } from "./core/rdf/parse.js";
export { toTurtle, toJsonLd, toNQuads } from "./core/rdf/serialize.js";
export { GraphState } from "./core/state/GraphState.js";
export * as ns from "./core/rdf/factory.js";
