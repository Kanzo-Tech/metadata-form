import { streamText, streamObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { Term } from "@rdfjs/types";
import type { GraphState } from "../engine/GraphState.js";
import type { FieldModel } from "../form/FormModel.js";
import type { CompletionRequest, FormAssist } from "../assist.js";
import { fieldContext, siblingValues } from "./context.js";

/** What a prompt is written from: the field, and where it sits. */
interface PromptArgs {
  field: FieldModel;
  focus: Term;
  graph: GraphState;
  locale: string;
}

export interface CreateFormAssistOptions {
  /** Override the prompt used for value suggestions. */
  suggestPrompt?(args: PromptArgs): string;
  /** Override the prompt used for inline ghost-text completion. */
  completePrompt?(args: PromptArgs & CompletionRequest): string;
}

/** One suggestion element, streamed one at a time via `streamObject`'s array output. */
const SUGGESTION = z.object({ value: z.string(), rationale: z.string().optional() });

/** The field's constraints, then the rest of the record it belongs to. */
function context(args: PromptArgs): string {
  const record = siblingValues(args);
  return `${fieldContext(args.field)}${record ? `\n\nAlready entered for the same record:\n${record}` : ""}`;
}

const suggestPrompt = (args: PromptArgs) =>
  `You are filling in a metadata form.\n\n${context(args)}\n\nPropose up to 8 distinct, realistic values for this field, written in ${args.locale} unless the field allows other language tags, best first. They stream in and the user keeps a few, so give variety and never repeat one. Every value must satisfy the constraints above. For short fields give concise values; for long free text a single well-written value is fine. Each has a "value" (the exact text to put in the field) and a brief "rationale".`;

const completePrompt = (args: PromptArgs & CompletionRequest) =>
  `You are autocompleting a metadata form field.\n\n${context(args)}\n\nText before the cursor:\n${args.value.slice(0, args.position)}\n\nText after the cursor:\n${args.value.slice(args.position)}\n\nReply with ONLY the text to insert at the cursor, written in ${args.locale}, so that the whole reads naturally and satisfies the constraints above. Do not repeat the text before it, and add no preamble, quotes or explanation. If a separating space is needed, make it the first character of your reply.`;

/**
 * Turn a Vercel AI SDK `LanguageModel` into a {@link FormAssist}: streamed
 * `suggest`ions (`streamObject`, one array element at a time) and a streaming
 * `complete`ion (`streamText`), prompted from {@link fieldContext}. Bring your own
 * provider, and add `search` yourself (it should hit a real vocabulary service):
 *
 *   const assist = { ...createFormAssist(createAnthropic({ apiKey })("claude-opus-4-8")), search };
 *
 * This function knows nothing about forms or SHACL beyond the shapes it returns —
 * it only maps the SDK's streams onto the `AsyncIterable` sources `@kanzo-tech/ai`
 * consumes, so it could live in that package as an `ai-sdk` subpath.
 */
export function createFormAssist(model: LanguageModel, opts?: CreateFormAssistOptions): FormAssist {
  return {
    suggest: async function* (args) {
      const { elementStream } = streamObject({
        model,
        abortSignal: args.signal,
        output: "array",
        schema: SUGGESTION,
        prompt: (opts?.suggestPrompt ?? suggestPrompt)(args),
      });
      yield* elementStream;
    },
    complete: (args) =>
      streamText({
        model,
        abortSignal: args.signal,
        prompt: (opts?.completePrompt ?? completePrompt)(args),
      }).textStream,
  };
}
