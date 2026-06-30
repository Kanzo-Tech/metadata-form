import { createAnthropic } from "@ai-sdk/anthropic";
import { createFormAssist } from "metadata-form/ai";
import type { FormAssist } from "metadata-form";

/** The assistance seam, wired to Claude via the `metadata-form/ai` adapter over the
 * Vercel AI SDK (the library core stays LLM-agnostic). `createFormAssist` gives
 * streaming ghost-text (`complete`) and typed ✨ suggestions (`suggest`) for free.
 * `dangerous-direct-browser-access` is only needed because this demo calls Anthropic
 * straight from the browser. */
export function makeAssist(apiKey: string): FormAssist {
  const provider = createAnthropic({
    apiKey,
    headers: { "anthropic-dangerous-direct-browser-access": "true" },
  });
  return createFormAssist(provider("claude-opus-4-8"));
}
