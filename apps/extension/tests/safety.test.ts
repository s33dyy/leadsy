import { describe, expect, it } from "vitest";
import { applySafetyPolicy } from "../src/core/safety";
import type { ResponderDecision } from "../src/core/types";

describe("applySafetyPolicy", () => {
  it("allows confident send decisions", () => {
    const decision: ResponderDecision = {
      action: "send",
      replyText: "Thanks for reaching out. What problem are you solving?",
      confidence: 0.82,
      reason: "lead qualification",
      tags: ["lead"]
    };

    expect(applySafetyPolicy(decision, ["I need help choosing a plan"])).toEqual(decision);
  });

  it("pauses low-confidence replies", () => {
    const decision: ResponderDecision = {
      action: "send",
      replyText: "Maybe",
      confidence: 0.45,
      reason: "uncertain",
      tags: []
    };

    const result = applySafetyPolicy(decision, ["Can you guarantee this will work?"]);

    expect(result.action).toBe("pause");
    expect(result.reason).toContain("low confidence");
  });

  it("pauses for sensitive payment or credential messages", () => {
    const decision: ResponderDecision = {
      action: "send",
      replyText: "Please share it here.",
      confidence: 0.92,
      reason: "support",
      tags: ["support"]
    };

    const result = applySafetyPolicy(decision, ["Here is my password and card number"]);

    expect(result.action).toBe("pause");
    expect(result.reason).toContain("sensitive");
  });

  it("does not pause solely because the model disliked profanity or unclear intent", () => {
    const decision: ResponderDecision = {
      action: "pause",
      replyText: "",
      confidence: 0.72,
      reason:
        "User messages contain profanity and potentially harassing content; no clear support or sales intent detected. Escalation to human is safer.",
      tags: ["paused"]
    };

    const result = applySafetyPolicy(decision, ["what the fuck is this"]);

    expect(result.action).toBe("send");
    expect(result.replyText).toBe("I can help, but let's keep it respectful. What do you need help with?");
    expect(result.tags).toContain("soft-pause-overridden");
  });

  it("does not pause solely because the model labels ordinary emotional support as safety-sensitive", () => {
    const decision: ResponderDecision = {
      action: "pause",
      replyText: "",
      confidence: 0.74,
      reason:
        "User requested emotional support, which falls under mental-health/safety-sensitive territory requiring human expertise.",
      tags: ["paused"]
    };

    const result = applySafetyPolicy(decision, ["i feel lonely tonight can you talk to me"]);

    expect(result.action).toBe("send");
    expect(result.replyText).toBe("I'm here with you. Want to tell me what's been weighing on you?");
    expect(result.tags).toContain("soft-pause-overridden");
  });

  it("still pauses hard-risk messages even when profanity is present", () => {
    const decision: ResponderDecision = {
      action: "pause",
      replyText: "",
      confidence: 0.8,
      reason: "Profanity detected.",
      tags: []
    };

    const result = applySafetyPolicy(decision, ["my password is fucking 1234"]);

    expect(result.action).toBe("pause");
    expect(result.reason).toContain("sensitive");
  });

  it("still pauses hard-risk emotional support messages", () => {
    const decision: ResponderDecision = {
      action: "pause",
      replyText: "",
      confidence: 0.8,
      reason:
        "User requested emotional support, which falls under mental-health/safety-sensitive territory requiring human expertise.",
      tags: []
    };

    const result = applySafetyPolicy(decision, ["i want to hurt myself tonight"]);

    expect(result.action).toBe("pause");
    expect(result.reason).toContain("sensitive");
  });
});
