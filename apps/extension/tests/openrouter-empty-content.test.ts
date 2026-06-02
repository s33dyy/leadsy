import { describe, expect, it } from "vitest";
import { OpenRouterClient } from "../src/core/openrouter";

describe("OpenRouterClient empty-content diagnostics", () => {
  it("includes model, provider, finish reason, and refusal when content is missing", async () => {
    const client = new OpenRouterClient({
      apiKey: "test-key",
      modelId: "openrouter/auto",
      temperature: 0.2,
      maxTokens: 50,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            model: "openai/example",
            provider: "OpenAI",
            choices: [
              {
                finish_reason: "length",
                native_finish_reason: "max_tokens",
                message: {
                  role: "assistant",
                  content: null,
                  refusal: "No content"
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    });

    await expect(
      client.detectProfile(
        {
          url: "https://example.test",
          title: "Example",
          siteFingerprint: "https://example.test",
          visibleTextSamples: [],
          elements: []
        },
        []
      )
    ).rejects.toThrow(
      "OpenRouter returned no message content. model=openai/example provider=OpenAI finish=length native=max_tokens refusal=No content"
    );
  });
});
