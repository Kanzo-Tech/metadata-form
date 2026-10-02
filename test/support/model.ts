import { MockLanguageModelV4 } from "ai/test";

type Call = Parameters<MockLanguageModelV4["doStream"]>[0];

/** The prompt of a call, flattened to text, so a test can ask what the model was told. */
export const promptOf = (call: Call) =>
  call.prompt
    .flatMap((m) => (typeof m.content === "string" ? [m.content] : m.content.map((p) => ("text" in p ? p.text : ""))))
    .join("\n");

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/** A model that answers every call with `reply`, streamed a word at a time. No network. */
export function mockModel(reply: () => string) {
  return new MockLanguageModelV4({
    doStream: async () => {
      const chunks = [
        { type: "stream-start" as const, warnings: [] },
        { type: "text-start" as const, id: "t" },
        ...(reply().match(/\S+\s*|\s+/g) ?? []).map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
        { type: "text-end" as const, id: "t" },
        { type: "finish" as const, finishReason: { unified: "stop" as const, raw: "stop" }, usage },
      ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const c of chunks) controller.enqueue(c);
            controller.close();
          },
        }),
      };
    },
  });
}
