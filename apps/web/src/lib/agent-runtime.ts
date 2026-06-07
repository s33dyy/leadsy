import { appendTwilioOutboundMessage, editLeadKnowledgeRecord, listLeadKnowledgeRecords } from "./lead-knowledge-store";
import { findCalendarFreeSlots } from "./calendar-store";
import {
  findPipelineOwner,
  findPrimaryQualificationAgent,
  listTeamThreadMessages,
  postTeamThreadMessage,
  type TeamMember
} from "./teamspace-store";

type Scope = {
  tenantId: string;
  ownerId: string;
};

export type AgentRunAction =
  | "auto_replied"
  | "assigned_to_pipeline_owner"
  | "escalated_to_human"
  | "skipped_loop_guard"
  | "no_agent_available"
  | "no_action";

export type AgentRunResult = {
  action: AgentRunAction;
  memberId?: string;
  assignedMemberId?: string;
  replyBody?: string;
  reason?: string;
};

type AgentRunInput = Scope & {
  leadId: string;
  conversationId: string;
  triggerMessageId: string;
  now?: string;
};

const coreQualificationFields = ["company", "need", "budget", "timeline", "authority"] as const;
const hardEscalationPattern = /\b(human|manager|refund|legal|complaint|angry|stop|unsubscribe)\b/i;

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

function addMinutes(iso: string, minutes: number) {
  return new Date(Date.parse(iso) + minutes * 60 * 1000).toISOString();
}

function missingQualificationFields(fields: Record<string, string | undefined>) {
  return coreQualificationFields.filter((field) => !fields[field]?.trim());
}

function isQualified(fields: Record<string, string | undefined>) {
  return Boolean(fields.company && fields.need && (fields.budget || fields.timeline) && fields.authority);
}

function escalationRequested(text: string, agent?: TeamMember | null) {
  if (hardEscalationPattern.test(text)) return true;
  return agent?.escalationKeywords.some((keyword) => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) ?? false;
}

function qualificationQuestion(fields: Record<string, string | undefined>) {
  const missing = missingQualificationFields(fields);
  if (missing.includes("budget")) return "What budget range should we plan around, and who makes the final decision?";
  if (missing.includes("company")) return "Thanks. Which company or business is this for, and what volume of WhatsApp leads do you handle today?";
  if (missing.includes("need")) return "Got it. What goal should Leadsy help you achieve: faster qualification, follow-up, assignment, or bookings?";
  if (missing.includes("timeline")) return "When would you like to start, and is there a specific launch date or campaign we should consider?";
  if (missing.includes("authority")) return "Are you the decision maker for this, or should we include someone else before proposing the next step?";
  return "Thanks. I have enough context to route this to the right owner for the next step.";
}

async function appendAgentReply(input: Scope & {
  leadId: string;
  to?: string;
  body: string;
  now: string;
}) {
  return appendTwilioOutboundMessage({
    ...input,
    messageSid: `SIMOUT_${crypto.randomUUID()}`,
    from: "whatsapp:leadsy-simulator",
    to: input.to?.startsWith("whatsapp:") ? input.to : `whatsapp:${input.to ?? "+0000000000"}`,
    source: "twilio_simulator",
    body: input.body,
    sentAt: input.now,
    receivedAt: input.now,
    deliveryStatus: "simulated_delivered"
  });
}

async function guardAlreadyHandled(input: AgentRunInput) {
  const existing = await listTeamThreadMessages({ ...input, leadId: input.leadId });
  return existing.some((message) => message.triggerId === input.triggerMessageId);
}

export async function runAgentForInboundLead(input: AgentRunInput): Promise<AgentRunResult> {
  const now = input.now ?? new Date().toISOString();
  if (await guardAlreadyHandled(input)) {
    return { action: "skipped_loop_guard", reason: "This inbound trigger was already handled." };
  }

  const lead = (await listLeadKnowledgeRecords(input)).find((record) => record.id === input.leadId);
  if (!lead) return { action: "no_action", reason: "Lead was not found." };
  const messages = lead.messages.filter((message) => message.conversationId === input.conversationId);
  const triggerMessage = messages.find((message) => message.id === input.triggerMessageId);
  const latestConversationMessage = messages.filter((message) => message.direction === "inbound" || message.direction === "outbound").at(-1);
  if (!triggerMessage || triggerMessage.direction !== "inbound") return { action: "no_action", reason: "Trigger is not an inbound message." };
  if (latestConversationMessage?.direction === "outbound") return { action: "skipped_loop_guard", reason: "Last external message is already from Leadsy." };

  const agent = await findPrimaryQualificationAgent(input);
  if (!agent) return { action: "no_agent_available", reason: "No active qualification AI agent is configured." };

  await postTeamThreadMessage({
    ...input,
    authorMemberId: agent.id,
    authorType: "ai_agent",
    body: `Qualification agent received inbound trigger ${input.triggerMessageId}.`,
    eventType: "agent_guard",
    triggerId: input.triggerMessageId
  });

  if (escalationRequested(triggerMessage.body, agent)) {
    await editLeadKnowledgeRecord({
      ...input,
      leadId: input.leadId,
      crmStatus: "human_review",
      qualificationStage: "human_review",
      nextAction: "Escalate to a human before any more automated replies."
    });
    await postTeamThreadMessage({
      ...input,
      authorMemberId: agent.id,
      authorType: "ai_agent",
      body: "Escalation keyword detected. Paused auto-reply and marked the lead for human review.",
      eventType: "handoff_summary",
      triggerId: `${input.triggerMessageId}:escalated`
    });
    return { action: "escalated_to_human", memberId: agent.id };
  }

  const fields = lead.qualificationFields as Record<string, string | undefined>;
  const contactPhone = lead.contact.phone || lead.contact.waId;
  if (isQualified(fields)) {
    const owner = await findPipelineOwner(input, "qualified");
    const windowStart = addMinutes(now, 19);
    const windowEnd = addMinutes(now, 180);
    const freeSlots = owner
      ? await findCalendarFreeSlots({
          ...input,
          memberId: owner.id,
          from: windowStart,
          to: windowEnd,
          slotMinutes: 30
        })
      : [];
    const slotText = freeSlots.slice(0, 3).map((slot) => formatTime(slot.startAt)).join(", ");
    const replyBody = slotText
      ? `You look qualified for the next step. ${owner?.name ?? "Our owner"} is available at ${slotText}. Which time works for you?`
      : `You look qualified for the next step. ${owner?.name ?? "Our owner"} will share the next available meeting time shortly.`;
    if (owner) {
      await editLeadKnowledgeRecord({
        ...input,
        leadId: input.leadId,
        crmStatus: "interested",
        qualificationStage: "qualified",
        productPipelineStatus: "qualified",
        assigneeId: owner.id,
        assigneeName: owner.name,
        nextAction: "Qualified lead assigned to pipeline owner."
      });
    }
    await appendAgentReply({ ...input, leadId: input.leadId, to: contactPhone, body: replyBody, now });
    await postTeamThreadMessage({
      ...input,
      authorMemberId: agent.id,
      authorType: "ai_agent",
      body: owner
        ? `Qualified lead assigned to ${owner.name}. Offered free slots: ${slotText || "none available"}.`
        : "Qualified lead, but no pipeline owner was configured.",
      eventType: "handoff_summary",
      triggerId: `${input.triggerMessageId}:qualified`
    });
    return {
      action: "assigned_to_pipeline_owner",
      memberId: agent.id,
      assignedMemberId: owner?.id,
      replyBody
    };
  }

  if (!agent.autoReplyEnabled) return { action: "no_action", memberId: agent.id, reason: "Agent auto-reply is disabled." };

  const replyBody = qualificationQuestion(fields);
  await appendAgentReply({ ...input, leadId: input.leadId, to: contactPhone, body: replyBody, now });
  await editLeadKnowledgeRecord({
    ...input,
    leadId: input.leadId,
    crmStatus: "needs_reply",
    qualificationStage: "collecting",
    nextAction: "AI qualification reply sent. Wait for the lead response."
  });
  await postTeamThreadMessage({
    ...input,
    authorMemberId: agent.id,
    authorType: "ai_agent",
    body: `Auto-replied with the next qualification question: ${replyBody}`,
    eventType: "handoff_summary",
    triggerId: `${input.triggerMessageId}:reply`
  });
  return { action: "auto_replied", memberId: agent.id, replyBody };
}
