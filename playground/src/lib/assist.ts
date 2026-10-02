import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "@kanzo-tech/llm";

/** The model the form's assistance calls — the consumer's choice, never the
 *  library's: metadata-form imports no LLM SDK. `dangerous-direct-browser-access`
 *  is only needed because this demo calls Anthropic straight from the browser. */
export function makeModel(apiKey: string, model: string): LanguageModel {
  const provider = createAnthropic({
    apiKey,
    headers: { "anthropic-dangerous-direct-browser-access": "true" },
  });
  return provider(model);
}
