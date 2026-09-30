// `metadata-form/ai` — the optional AI layer: the UI that draws a `FormAssist`
// (`assistUi`, from @kanzo-tech/ai), the prompt context read off a field
// (`fieldContext`), and an adapter from a Vercel AI SDK model (`createFormAssist`).
// The core imports none of it; peers: @kanzo-tech/ai, ai, zod.

export { assistUi } from "./ui.js";
export { DEFAULT_CONTEXT_LIMITS, fieldContext, siblingValues, type ContextLimits } from "./context.js";
export { createFormAssist } from "./adapter.js";
export type { CreateFormAssistOptions } from "./adapter.js";
