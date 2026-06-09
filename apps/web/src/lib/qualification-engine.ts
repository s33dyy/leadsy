import type { LeadKnowledgeRecord, LeadQualificationFieldKey } from "./lead-knowledge-store";

export type QualificationFieldState = "collected" | "missing" | "uncertain";
export type QualificationIntentLabel = "Low Intent" | "Medium Intent" | "High Intent" | "Very High Intent";

export type QualificationFieldSummary = {
  key: LeadQualificationFieldKey;
  label: string;
  state: QualificationFieldState;
  displayValue: string;
};

export type QualificationMode = "b2b" | "b2c";

export type QualificationScoreSummary = {
  value: number;
  label: QualificationIntentLabel;
  explanation: {
    reasons: string[];
    missing: string[];
  };
};

export type QualificationRecommendedAction = {
  action: string;
  why: string;
};

export type QualificationSummary = {
  fields: Record<LeadQualificationFieldKey, QualificationFieldSummary>;
  score: QualificationScoreSummary;
  recommendedAction: QualificationRecommendedAction;
  missingFields: QualificationFieldSummary[];
};

export type QualificationHistoryEvent = {
  when: string;
  whatChanged: string;
  whyScoreChanged: string;
};

export const notYetCollectedLabel = "Not Yet Collected";

export const qualificationFieldLabels: ReadonlyArray<{ key: LeadQualificationFieldKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "need", label: "Need" },
  { key: "budget", label: "Budget" },
  { key: "timeline", label: "Timeline" },
  { key: "authority", label: "Authority" },
  { key: "location", label: "Location" },
  { key: "company", label: "Company" },
  { key: "serviceInterest", label: "Service Interest" },
  { key: "intent", label: "Intent" },
  { key: "risk", label: "Risk" },
  { key: "recommendedAction", label: "Recommended Action" }
];

const uncertainPattern = /\b(maybe|not sure|unsure|unknown|tbd|to be decided|later|depends|unclear)\b/i;

function cleanValue(value?: string) {
  const clean = value?.trim();
  return clean || undefined;
}

function latestInboundMessage(lead: LeadKnowledgeRecord) {
  return [...lead.messages].reverse().find((message) => !message.hiddenAt && message.direction === "inbound");
}

function hasActiveConversation(lead: LeadKnowledgeRecord) {
  return lead.messages.some((message) => !message.hiddenAt && (message.direction === "inbound" || message.direction === "outbound"));
}

function fieldValue(lead: LeadKnowledgeRecord, key: LeadQualificationFieldKey) {
  if (key === "intent") return inferIntentLabel(lead);
  if (key === "risk") return inferRisk(lead);
  if (key === "recommendedAction") return recommendedActionForLead(lead).action;
  if (key === "authority") return lead.qualificationFields.authority || lead.qualificationFields.name;
  if (key === "serviceInterest") return lead.qualificationFields.serviceInterest || lead.qualificationFields.need;
  return lead.qualificationFields[key];
}

function fieldState(value?: string): QualificationFieldState {
  const clean = cleanValue(value);
  if (!clean || clean === notYetCollectedLabel) return "missing";
  if (uncertainPattern.test(clean)) return "uncertain";
  return "collected";
}

function summarizeField(lead: LeadKnowledgeRecord, key: LeadQualificationFieldKey, label: string): QualificationFieldSummary {
  const value = fieldValue(lead, key);
  const state = fieldState(value);
  return {
    key,
    label,
    state,
    displayValue: state === "missing" ? notYetCollectedLabel : value?.trim() ?? notYetCollectedLabel
  };
}

export function getMissingQualificationFields(lead: LeadKnowledgeRecord) {
  return qualificationFieldLabels
    .map((field) => summarizeField(lead, field.key, field.label))
    .filter((field) => field.state !== "collected");
}

function scoreLabel(value: number): QualificationIntentLabel {
  if (value >= 85) return "Very High Intent";
  if (value >= 65) return "High Intent";
  if (value >= 40) return "Medium Intent";
  return "Low Intent";
}

function scoreQualification(lead: LeadKnowledgeRecord, mode: QualificationMode = "b2b"): QualificationScoreSummary {
  const reasons: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (mode === "b2c") {
    if (cleanValue(lead.qualificationFields.name)) {
      score += 20;
      reasons.push("Student name identified");
    } else {
      missing.push("Student name not confirmed");
    }

    if (cleanValue(lead.qualificationFields.phone)) {
      score += 30;
      reasons.push("Phone identified");
    } else {
      missing.push("Phone not confirmed");
    }

    if (cleanValue(lead.qualificationFields.email)) {
      score += 20;
      reasons.push("Email identified");
    } else {
      missing.push("Email not confirmed");
    }

    if (cleanValue(lead.qualificationFields.budget)) {
      score += 20;
      reasons.push("Budget identified");
    } else {
      missing.push("Budget not confirmed");
    }

    if (hasActiveConversation(lead)) {
      score += 10;
      reasons.push("Active conversation");
    } else {
      missing.push("Active conversation not started");
    }
  } else {
    if (cleanValue(lead.qualificationFields.need)) {
      score += 15;
      reasons.push("Need identified");
    } else {
      missing.push("Need not confirmed");
    }

    if (cleanValue(lead.qualificationFields.budget)) {
      score += 15;
      reasons.push("Budget identified");
    } else {
      missing.push("Budget not confirmed");
    }

    if (cleanValue(lead.qualificationFields.timeline)) {
      score += 15;
      reasons.push("Timeline identified");
    } else {
      missing.push("Timeline not confirmed");
    }

    if (cleanValue(lead.qualificationFields.authority) || cleanValue(lead.qualificationFields.name)) {
      score += 15;
      reasons.push("Decision maker present");
    } else {
      missing.push("Decision maker not confirmed");
    }

    if (cleanValue(lead.qualificationFields.company)) {
      score += 10;
      reasons.push("Company identified");
    } else {
      missing.push("Company not confirmed");
    }

    if (cleanValue(lead.qualificationFields.location)) {
      score += 10;
      reasons.push("Location confirmed");
    } else {
      missing.push("Location not confirmed");
    }

    if (cleanValue(lead.qualificationFields.serviceInterest) || cleanValue(lead.qualificationFields.need)) {
      score += 10;
      reasons.push("Service interest identified");
    } else {
      missing.push("Service scope unclear");
    }

    if (hasActiveConversation(lead)) {
      score += 10;
      reasons.push("Active conversation");
    } else {
      missing.push("Active conversation not started");
    }
  }

  if (reasons.length === 0) reasons.push("No qualification evidence collected yet");

  const value = Math.max(0, Math.min(100, score));
  return {
    value,
    label: scoreLabel(value),
    explanation: { reasons, missing }
  };
}

function inferRisk(lead: LeadKnowledgeRecord) {
  const latest = latestInboundMessage(lead)?.body ?? "";
  if (lead.qualificationStage === "human_review" || /\b(angry|refund|legal|lawyer|complaint|stop|unsubscribe)\b/i.test(latest)) {
    return "Human review required";
  }
  const missing = getMissingQualificationFieldsWithoutDerived(lead).map((field) => field.label);
  if (missing.includes("Budget")) return "Budget not confirmed";
  if (missing.includes("Timeline")) return "Timeline not confirmed";
  if (missing.includes("Authority")) return "Decision maker not confirmed";
  return "No major conversion risk recorded";
}

function getMissingQualificationFieldsWithoutDerived(lead: LeadKnowledgeRecord) {
  return qualificationFieldLabels
    .filter((field) => field.key !== "intent" && field.key !== "risk" && field.key !== "recommendedAction")
    .map((field) => summarizeField(lead, field.key, field.label))
    .filter((field) => field.state !== "collected");
}

function inferIntentLabel(lead: LeadKnowledgeRecord, mode: QualificationMode = "b2b") {
  return scoreLabel(scoreQualification(lead, mode).value);
}

function recommendedActionForLead(lead: LeadKnowledgeRecord): QualificationRecommendedAction {
  if (lead.qualificationStage === "human_review") {
    return { action: "Escalate to closer", why: "Human review risk is present, so a person should decide the next step." };
  }
  if (!cleanValue(lead.qualificationFields.budget)) {
    return { action: "Request budget clarification", why: "budget is missing, so pricing and fit cannot be qualified yet." };
  }
  if (!cleanValue(lead.qualificationFields.timeline)) {
    return { action: "Call within 2 hours", why: "Timeline is missing while the lead is active, so a quick call should clarify urgency." };
  }
  if (!(cleanValue(lead.qualificationFields.authority) || cleanValue(lead.qualificationFields.name))) {
    return { action: "Continue qualification", why: "Decision maker authority is not confirmed yet." };
  }
  const score = scoreQualification(lead);
  if (score.value >= 85) {
    return { action: "Schedule demo", why: "The lead has high-intent evidence and core qualification fields are collected." };
  }
  if (score.value >= 65) {
    return { action: "Send pricing", why: "Budget and timeline are identified enough to discuss pricing with a human in control." };
  }
  return { action: "Continue qualification", why: "Important fields are still missing or uncertain." };
}

export function buildQualificationSummary(lead: LeadKnowledgeRecord, mode: QualificationMode = "b2b"): QualificationSummary {
  const entries = qualificationFieldLabels.map((field) => [field.key, summarizeField(lead, field.key, field.label)] as const);
  const fields = Object.fromEntries(entries) as Record<LeadQualificationFieldKey, QualificationFieldSummary>;
  const score = scoreQualification(lead, mode);
  const recommendedAction = recommendedActionForLead(lead);
  fields.intent = { ...fields.intent, displayValue: score.label, state: "collected" };
  fields.risk = { ...fields.risk, displayValue: inferRisk(lead), state: "collected" };
  fields.recommendedAction = { ...fields.recommendedAction, displayValue: recommendedAction.action, state: "collected" };
  return {
    fields,
    score,
    recommendedAction,
    missingFields: getMissingQualificationFields(lead)
  };
}

export function buildQualificationHistory(current: LeadKnowledgeRecord, previous?: LeadKnowledgeRecord): QualificationHistoryEvent[] {
  const currentSummary = buildQualificationSummary(current);
  const events: QualificationHistoryEvent[] = [];
  const when = current.updatedAt || current.lastMessageAt || current.createdAt;
  if (previous) {
    const previousSummary = buildQualificationSummary(previous);
    for (const { key, label } of qualificationFieldLabels) {
      const before = previousSummary.fields[key].displayValue;
      const after = currentSummary.fields[key].displayValue;
      if (before !== after) {
        events.push({
          when,
          whatChanged: `${label}: ${before} → ${after}`,
          whyScoreChanged: currentSummary.score.explanation.reasons.join("; ")
        });
      }
    }
    if (previousSummary.score.value !== currentSummary.score.value) {
      events.push({
        when,
        whatChanged: `Qualification Score: ${previousSummary.score.value} → ${currentSummary.score.value}`,
        whyScoreChanged: [
          ...currentSummary.score.explanation.reasons,
          ...currentSummary.score.explanation.missing
        ].join("; ")
      });
    }
  }

  for (const fact of current.facts.filter((item) => /changed|unknown|not yet collected|qualification score/i.test(item)).slice(0, 4)) {
    events.push({
      when,
      whatChanged: fact,
      whyScoreChanged: currentSummary.score.explanation.reasons.join("; ") || "Qualification evidence changed"
    });
  }

  if (!events.length) {
    events.push({
      when,
      whatChanged: `Qualification Score: ${currentSummary.score.value}`,
      whyScoreChanged: currentSummary.score.explanation.reasons.join("; ") || "No qualification evidence collected yet"
    });
  }
  return events;
}
