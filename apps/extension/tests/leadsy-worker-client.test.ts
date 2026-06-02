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
});
