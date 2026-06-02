import type { ResponderDecision } from "./types";
import { censorProfanity } from "./profanity";

const SENSITIVE_PATTERN =
  /\b(password|passcode|otp|one[-\s]?time|credit card|card number|cvv|ssn|social security|bank account|wire transfer|medical emergency|suicide|suicidal|self[-\s]?harm|hurt myself|harm myself|want to die|end it all|can't go on|lawsuit|legal advice|investment advice|financial advice)\b/i;

const ESCALATION_PATTERN =
  /\b(manager|supervisor|refund now|scam|fraud|complaint|lawsuit|police|threat|kill|hurt you|hurt someone|hurt them|hurt him|hurt her|doxx)\b|(?:talk|speak|chat|connect|transfer)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|agent|representative)|\breal person\b|\bhuman agent\b/i;

const EMOTIONAL_SUPPORT_REASON_PATTERN =
  /\b(emotional support|mental\W?health|safety\W?sensitive|human expertise|lonely|sad|stressed|stress|anxious|anxiety)\b/i;

const SOFT_PAUSE_REASON_PATTERN =
  /\b(profanity|harassing|unclear support|unclear sales|no clear support|no clear sales|no clear .*intent|emotional support|mental\W?health|safety\W?sensitive|human expertise)\b/i;

export function applySafetyPolicy(
  decision: ResponderDecision,
  recentMessageTexts: string[],
  minConfidence = 0.6
): ResponderDecision {
  const recentText = recentMessageTexts.join("\n");
  if (SENSITIVE_PATTERN.test(recentText)) {
    return pauseDecision(decision, "Paused because the conversation appears sensitive.");
  }

  if (ESCALATION_PATTERN.test(recentText)) {
    return pauseDecision(decision, "Paused because the conversation may need human escalation.");
  }

  if (decision.action === "pause") {
    if (SOFT_PAUSE_REASON_PATTERN.test(decision.reason)) {
      return {
        ...decision,
        action: "send",
        replyText: censorProfanity(decision.replyText.trim() || fallbackSoftPauseReply(decision)),
        reason: `Soft pause overridden: ${decision.reason}`,
        tags: Array.from(new Set([...decision.tags, "soft-pause-overridden"]))
      };
    }
    return decision;
  }

  if (decision.confidence < minConfidence) {
    return pauseDecision(decision, `Paused for low confidence (${decision.confidence}).`);
  }

  return {
    ...decision,
    replyText: censorProfanity(decision.replyText)
  };
}

function pauseDecision(decision: ResponderDecision, reason: string): ResponderDecision {
  return {
    ...decision,
    action: "pause",
    reason,
    tags: Array.from(new Set([...decision.tags, "paused"]))
  };
}

function fallbackSoftPauseReply(decision: ResponderDecision): string {
  if (EMOTIONAL_SUPPORT_REASON_PATTERN.test(decision.reason)) {
    return "I'm here with you. Want to tell me what's been weighing on you?";
  }

  return "I can help, but let's keep it respectful. What do you need help with?";
}
