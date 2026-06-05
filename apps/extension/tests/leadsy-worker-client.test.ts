import { describe, expect, it, vi } from "vitest";
import { LeadsyWorkerClient } from "../src/core/leadsy-client";
import type { ResponderDecision } from "../src/core/types";

const leadsyDecision: ResponderDecision = {
  action: "send",
  replyText: "Leadsy says: ask for their preferred call time.",
  confidence: 0.91,
  reason: "Leadsy matched this chat to an imported lead.",
  tags: ["leadsy", "qualified"]
};

describe("LeadsyWorkerClient", () => {
  it("asks the Leadsy operation layer before using the local model", async () => {
    const localDecision: ResponderDecision = {
      action: "send",
      replyText: "local fallback",
      confidence: 0.7,
      reason: "fallback",
      tags: ["fallback"]
    };
    const local = {
      detectProfile: vi.fn(),
      decideReply: vi.fn(async () => localDecision)
    };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ decision: leadsyDecision }), { status: 200 }));
    const client = new LeadsyWorkerClient({
      baseUrl: "http://localhost:3000",
      token: "tok_test",
      fetchFn,
      fallback: local
    });

    const result = await client.decideReply(
      {
        chatFingerprint: "https://web.whatsapp.com/chat/1",
        approvalState: "approved",
        messages: [],
        createdAt: 1,
        updatedAt: 1
      },
      [
        {
          id: "incoming:1",
          direction: "incoming",
          text: "Can I book a demo?",
          timestamp: 1,
          sourceUrl: "https://web.whatsapp.com/"
        }
      ],
      {
        businessPrompt: "Leadsy owns the data.",
        supportNotes: [],
        leadQualificationHints: []
      },
      {
        modelId: "openrouter/free",
        fallbackBusinessPrompt: "",
        escalationRules: [],
        requireFirstReplyApproval: false,
        temperature: 0.2,
        maxTokens: 200
      }
    );

    expect(result).toEqual(leadsyDecision);
    expect(local.decideReply).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:3000/api/extension/reply",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer tok_test" })
      })
    );
  });

  it("falls back to the local model when Leadsy is unavailable", async () => {
    const fallbackDecision: ResponderDecision = {
      action: "send",
      replyText: "Fallback reply",
      confidence: 0.72,
      reason: "Leadsy is offline.",
      tags: ["fallback"]
    };
    const local = {
      detectProfile: vi.fn(),
      decideReply: vi.fn(async () => fallbackDecision)
    };
    const client = new LeadsyWorkerClient({
      baseUrl: "http://localhost:3000",
      token: "tok_test",
      fetchFn: vi.fn(async () => new Response("offline", { status: 503 })),
      fallback: local
    });

    const result = await client.decideReply(
      {
        chatFingerprint: "https://web.whatsapp.com/chat/1",
        approvalState: "approved",
        messages: [],
        createdAt: 1,
        updatedAt: 1
      },
      [],
      {
        businessPrompt: "Leadsy owns the data.",
        supportNotes: [],
        leadQualificationHints: []
      },
      {
        modelId: "openrouter/free",
        fallbackBusinessPrompt: "",
        escalationRules: [],
        requireFirstReplyApproval: false,
        temperature: 0.2,
        maxTokens: 200
      }
    );

    expect(result).toEqual(fallbackDecision);
    expect(local.decideReply).toHaveBeenCalledTimes(1);
  });

  it("syncs the full captured conversation history to Leadsy", async () => {
    const local = {
      detectProfile: vi.fn(),
      decideReply: vi.fn()
    };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new LeadsyWorkerClient({
      baseUrl: "http://localhost:3000",
      token: "tok_test",
      fetchFn,
      fallback: local
    });
    const messages = Array.from({ length: 75 }, (_, index) => ({
      id: `message:${index + 1}`,
      direction: index % 2 === 0 ? ("incoming" as const) : ("outgoing" as const),
      text: `Captured message ${index + 1}`,
      timestamp: Date.UTC(2026, 5, 3, 9, index),
      sourceUrl: "https://web.whatsapp.com/send?phone=919830000000"
    }));

    await client.syncConversation({
      chat: {
        chatFingerprint: "https://web.whatsapp.com/send?phone=919830000000",
        approvalState: "approved",
        messages,
        createdAt: 1,
        updatedAt: 1
      },
      messages
    });

    const calls = fetchFn.mock.calls as unknown as Array<[string, RequestInit]>;
    const request = calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body.messages).toHaveLength(75);
    expect(body.messages[0].externalId).toBe("message:1");
    expect(body.messages.at(-1).externalId).toBe("message:75");
  });

  it("syncs WhatsApp inbound messages with visible contact identity when the page URL is generic", async () => {
    const local = {
      detectProfile: vi.fn(),
      decideReply: vi.fn()
    };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new LeadsyWorkerClient({
      baseUrl: "http://localhost:3000",
      token: "tok_test",
      fetchFn,
      fallback: local
    });
    const messages = [
      {
        id: "outbound:1",
        direction: "outgoing" as const,
        text: "Hi Bibhor Das, just following up.",
        timestamp: Date.UTC(2026, 5, 5, 13, 51),
        sourceUrl: "https://web.whatsapp.com/"
      },
      {
        id: "incoming:2",
        direction: "incoming" as const,
        text: "Can I get more info?",
        timestamp: Date.UTC(2026, 5, 5, 16, 40),
        sourceUrl: "https://web.whatsapp.com/"
      }
    ];

    await client.syncConversation({
      chat: {
        chatFingerprint: "https://web.whatsapp.com/",
        contact: {
          displayName: "Mr. Sigma"
        },
        approvalState: "approved",
        messages,
        createdAt: 1,
        updatedAt: 1
      },
      messages
    });

    const calls = fetchFn.mock.calls as unknown as Array<[string, RequestInit]>;
    const request = calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body.platform).toBe("whatsapp-web");
    expect(body.contact).toEqual(expect.objectContaining({ displayName: "Mr. Sigma" }));
    expect(body.messages.at(-1)).toEqual(
      expect.objectContaining({
        externalId: "incoming:2",
        direction: "inbound",
        body: "Can I get more info?"
      })
    );
  });
});
