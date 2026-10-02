// `@kanzo-tech/metadata-form/ai` — the optional AI layer: model assistance around a field
// (`assistUi`, over @kanzo-tech/ai's `Assist`), its words for the host's
// `AssistProvider` (`assistTranslations`), and the prompt context read off a field
// (`fieldContext`, `siblingValues`). The core imports none of it; peers:
// @kanzo-tech/ai, @kanzo-tech/llm, ai, @ai-sdk/react.

export { assistTranslations, assistUi } from "./ui.js";
export { DEFAULT_CONTEXT_LIMITS, fieldContext, siblingValues, type ContextLimits } from "./context.js";
