import { streamText, streamObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { FieldModel } from "../core/schema/FormModel.js";
import type { GraphState } from "../core/state/GraphState.js";
import type { FieldSuggestion, FormAssist } from "../react/widgets/widgets.js";

/**
 * Optional adapter: turn any Vercel AI SDK `LanguageModel` into a {@link FormAssist}
 * with sensible defaults — streamed `suggest`ions (`streamObject` array, one element
 * at a time) and a streaming inline `complete`ion (`streamText().textStream`). Bring
 * your own provider:
 *
 *   import { createAnthropic } from "@ai-sdk/anthropic";
 *   import { createFormAssist } from "metadata-form/ai";
 *   const assist = createFormAssist(createAnthropic({ apiKey })("claude-opus-4-8"));
 *
 * The core library never imports `ai`; this subpath has `ai`/`zod` as optional
 * peer deps. It ships `suggest` + `complete` only — `reference` autocomplete should
 * hit a real vocabulary service, so add `search` yourself:
 *   assist={{ ...createFormAssist(model), search: myVocabSearch }}
 */
export interface CreateFormAssistOptions {
  /** Override the prompt used for the ✨ value suggestions. */
  suggestPrompt?(args: { field: FieldModel; graph: GraphState; locale: string }): string;
  /** Override the prompt used for inline ghost-text completion. */
  completePrompt?(args: { field: FieldModel; value: string; graph: GraphState; locale: string }): string;
}

/** One suggestion element — streamed one at a time via `streamObject`'s array output. */
const SUGGESTION = z.object({
  value: z.string(),
  rationale: z.string().optional(),
});

/** Best-effort dataset title from the graph, for a touch of context in prompts. */
function datasetTitle(graph: GraphState): string | undefined {
  return graph.store
    .getQuads(null, null, null, null)
    .find((q) => q.predicate.value.endsWith("title"))?.object.value;
}

function defaultSuggestPrompt(field: FieldModel, graph: GraphState, locale: string): string {
  const title = datasetTitle(graph);
  return `You are filling in RDF dataset metadata${title ? ` for the dataset titled "${title}"` : ""}. Propose up to 8 distinct, realistic suggestions for the field "${field.label}", written in ${locale}, ordered best first — they stream in and the user keeps a few, discarding the rest, so give variety and never repeat a value. For short fields give concise values; for long free-text fields a single, well-written value is fine. Each suggestion has a "value" (the exact text to put in the field) and a brief "rationale".`;
}

function defaultCompletePrompt(field: FieldModel, value: string): string {
  return `You are autocompleting the metadata field "${field.label}". Reply with ONLY the text to append directly after the current value, so that (current value + your reply) reads naturally. Do NOT repeat any of the current value, and add no preamble, quotes, or explanation. If a separating space is needed, make it the first character of your reply.\n\nCurrent value:\n${value}`;
}

export function createFormAssist(model: LanguageModel, opts?: CreateFormAssistOptions): FormAssist {
  return {
    suggest: async function* ({ field, graph, locale, signal }) {
      const { elementStream } = streamObject({
        model,
        abortSignal: signal,
        output: "array",
        schema: SUGGESTION,
        prompt: opts?.suggestPrompt?.({ field, graph, locale }) ?? defaultSuggestPrompt(field, graph, locale),
      });
      for await (const s of elementStream) yield s satisfies FieldSuggestion;
    },
    complete: ({ field, value, graph, locale, signal }) =>
      streamText({
        model,
        abortSignal: signal,
        prompt: opts?.completePrompt?.({ field, value, graph, locale }) ?? defaultCompletePrompt(field, value),
      }).textStream,
  };
}
