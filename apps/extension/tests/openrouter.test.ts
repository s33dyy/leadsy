import { describe, expect, it } from "vitest";
import { OpenRouterClient, parseStrictJsonObject } from "../src/core/openrouter";

describe("parseStrictJsonObject", () => {
  it("parses raw JSON objects returned by a model", () => {
    expect(parseStrictJsonObject<{ action: string }>('{"action":"send"}')).toEqual({
      action: "send"
    });
  });

  it("parses JSON objects wrapped in markdown fences", () => {
    const text = "```json\n{\"action\":\"pause\",\"confidence\":0.3}\n```";

    expect(parseStrictJsonObject<{ action: string; confidence: number }>(text)).toEqual({
      action: "pause",
      confidence: 0.3
    });
  });

  it("throws a useful error when the model returns non-json text", () => {
    expect(() => parseStrictJsonObject("I would say hello")).toThrow(
      "OpenRouter response did not contain a valid JSON object"
    );
  });
});

describe("OpenRouterClient", () => {
  it("calls the default browser fetch with the correct global receiver", async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: unknown[] = [];

    globalThis.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      fetchCalls.push(this);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"action":"send","replyText":"Hello","confidence":0.9,"reason":"test","tags":[]}'
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    } as typeof fetch;

    try {
      const client = new OpenRouterClient({
        apiKey: "test-key",
        modelId: "openrouter/auto",
        temperature: 0.2,
        maxTokens: 50
      });

      await client.decideReply(
        {
          chatFingerprint: "chat",
          approvalState: "approved",
          messages: [],
          createdAt: 1,
          updatedAt: 1
        },
        [],
        {
          businessPrompt: "Test",
          supportNotes: [],
          leadQualificationHints: []
        },
        {
          modelId: "openrouter/auto",
          fallbackBusinessPrompt: "Test",
          escalationRules: [],
          requireFirstReplyApproval: false,
          temperature: 0.2,
          maxTokens: 50
        }
      );

      expect(fetchCalls).toEqual([globalThis]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("tries fallback models when the cheapest primary model returns no content", async () => {
    const requestedModels: string[] = [];
    const client = new OpenRouterClient({
      apiKey: "test-key",
      modelId: "openrouter/free",
      fallbackModelIds: ["inclusionai/ling-2.6-flash"],
      temperature: 0.2,
      maxTokens: 50,
      fetchFn: async (_input, init) => {
        const body = JSON.parse(String(init?.body));
        requestedModels.push(body.model);

        if (body.model === "openrouter/free") {
          return new Response(
            JSON.stringify({
              model: "free-model",
              provider: "FreeProvider",
              choices: [
                {
                  finish_reason: "length",
                  native_finish_reason: "max_output_tokens",
                  message: { role: "assistant", content: null, refusal: null }
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"action":"send","replyText":"Hello","confidence":0.9,"reason":"test","tags":[]}'
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const decision = await client.decideReply(
      {
        chatFingerprint: "chat",
        approvalState: "approved",
        messages: [],
        createdAt: 1,
        updatedAt: 1
      },
      [],
      {
        businessPrompt: "Test",
        supportNotes: [],
        leadQualificationHints: []
      },
      {
        modelId: "openrouter/free",
        fallbackBusinessPrompt: "Test",
        escalationRules: [],
        requireFirstReplyApproval: false,
        temperature: 0.2,
        maxTokens: 50
      }
    );

    expect(requestedModels).toEqual(["openrouter/free", "inclusionai/ling-2.6-flash"]);
    expect(decision.replyText).toBe("Hello");
  });

  it("tries fallback models when the cheapest primary model returns non-json text", async () => {
    const requestedModels: string[] = [];
    const client = new OpenRouterClient({
      apiKey: "test-key",
      modelId: "openrouter/free",
      fallbackModelIds: ["inclusionai/ling-2.6-flash"],
      temperature: 0.2,
      maxTokens: 50,
      fetchFn: async (_input, init) => {
        const body = JSON.parse(String(init?.body));
        requestedModels.push(body.model);

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    body.model === "openrouter/free"
                      ? "Sure, I can help with that."
                      : '{"action":"send","replyText":"Fallback works","confidence":0.9,"reason":"test","tags":[]}'
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const decision = await client.decideReply(
      {
        chatFingerprint: "chat",
        approvalState: "approved",
        messages: [],
        createdAt: 1,
        updatedAt: 1
      },
      [],
      {
        businessPrompt: "Test",
        supportNotes: [],
        leadQualificationHints: []
      },
      {
        modelId: "openrouter/free",
        fallbackBusinessPrompt: "Test",
        escalationRules: [],
        requireFirstReplyApproval: false,
        temperature: 0.2,
        maxTokens: 50
      }
    );

    expect(requestedModels).toEqual(["openrouter/free", "inclusionai/ling-2.6-flash"]);
    expect(decision.replyText).toBe("Fallback works");
  });

  it("sends censored recent messages and returns censored reply text", async () => {
    let requestBody: { messages: Array<{ role: string; content: string }> } | undefined;
    const client = new OpenRouterClient({
      apiKey: "test-key",
      modelId: "inclusionai/ling-2.6-flash",
      temperature: 0.2,
      maxTokens: 50,
      fetchFn: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"action":"send","replyText":"That fucking works","confidence":0.9,"reason":"test","tags":[]}'
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const decision = await client.decideReply(
      {
        chatFingerprint: "chat",
        approvalState: "approved",
        messages: [],
        createdAt: 1,
        updatedAt: 1
      },
      [
        {
          id: "m1",
          direction: "incoming",
          text: "what the fuck is this",
          timestamp: 1,
          sourceUrl: "https://chat.test"
        }
      ],
      {
        businessPrompt: "Test",
        supportNotes: [],
        leadQualificationHints: []
      },
      {
        modelId: "inclusionai/ling-2.6-flash",
        fallbackBusinessPrompt: "Test",
        escalationRules: [],
        requireFirstReplyApproval: false,
        temperature: 0.2,
        maxTokens: 50
      }
    );

    expect(requestBody?.messages.at(-1)?.content).toContain("what the f*** is this");
    expect(decision.replyText).toBe("That f***ing works");
  });
});
