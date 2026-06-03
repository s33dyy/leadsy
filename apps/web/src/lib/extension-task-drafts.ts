import type { ExtensionTaskType } from "./extension-store";
import type { LeadKnowledgeRecord } from "./lead-knowledge-store";

type OutreachTaskType = Extract<ExtensionTaskType, "initiate_conversation" | "follow_up">;
type DraftableLead = Pick<LeadKnowledgeRecord, "contact" | "summary" | "nextAction" | "channels">;

export function draftExtensionTaskMessage(lead: DraftableLead, type: OutreachTaskType) {
  const name = cleanLeadName(lead.contact.displayName || lead.contact.handle || lead.contact.phone || lead.contact.email);
  const segment = leadSegment(lead);

  if (type === "follow_up") {
    return `Hi ${name}, just following up to see if improving ${segment.followUpFocus} is worth a quick conversation this week?`;
  }

  return `Hi ${name}, I help ${segment.audience} ${segment.outcome}. Would it make sense to discuss this this week?`;
}

function cleanLeadName(name?: string) {
  return name?.replace(/\s+/g, " ").trim() || "there";
}

function leadSegment(lead: DraftableLead) {
  const text = [lead.summary, lead.nextAction, ...lead.channels].filter(Boolean).join(" ").toLowerCase();

  if (/\b(school|academy|college|education|student|course|admission|training|nursing|paramedical|allied health)\b/.test(text)) {
    return {
      audience: "education teams",
      outcome: "turn more student enquiries into qualified admissions conversations",
      followUpFocus: "student enquiry quality"
    };
  }

  if (/\b(real estate|realty|property|broker|builder|developer)\b/.test(text)) {
    return {
      audience: "property teams",
      outcome: "improve enquiry quality and follow-up",
      followUpFocus: "property enquiry quality"
    };
  }

  if (/\b(event|venue|hotel|hospitality|wedding)\b/.test(text)) {
    return {
      audience: "event and hospitality teams",
      outcome: "turn more enquiries into booked conversations",
      followUpFocus: "event enquiry conversion"
    };
  }

  if (/\b(clinic|hospital|healthcare|doctor|dental|wellness)\b/.test(text)) {
    return {
      audience: "healthcare teams",
      outcome: "turn more patient enquiries into qualified appointments",
      followUpFocus: "patient enquiry quality"
    };
  }

  return {
    audience: "local teams",
    outcome: "turn more enquiries into qualified conversations",
    followUpFocus: "lead quality and follow-up"
  };
}
