import { appendTwilioOutboundMessage, editLeadKnowledgeRecord, listLeadKnowledgeRecords } from "./lead-knowledge-store";
import { findCalendarFreeSlots } from "./calendar-store";
import { listCrmAssignmentHistory, listCrmFollowUpTasks } from "./crm-store";
import {
  findPipelineOwner,
  findPrimaryQualificationAgent,
  getTeamMember,
  listTeamThreadMessages,
  postTeamThreadMessage,
  type TeamMember
} from "./teamspace-store";
import { getOperatorProfileSettings, getWorkspaceBusinessSettings } from "./user-settings-store";
import { sendAndStoreWhatsAppMessage, type WhatsAppSendResult } from "./whatsapp-transport";

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

export type InitialAiOutboundAction =
  | "sent"
  | "drafted_for_review"
  | "auto_reply_disabled"
  | "not_ai_member"
  | "lead_not_found"
  | "no_whatsapp_phone"
  | "skipped_duplicate";

export type InitialAiOutboundResult = {
  action: InitialAiOutboundAction;
  memberId?: string;
  leadId?: string;
  body?: string;
  reason?: string;
  transport?: WhatsAppSendResult;
};

type AgentRunInput = Scope & {
  leadId: string;
  conversationId: string;
  triggerMessageId: string;
  now?: string;
};

const coreQualificationFields = ["company", "need", "budget", "timeline", "authority"] as const;
const hardEscalationPattern = /\b(human|manager|refund|legal|complaint|angry|stop|unsubscribe)\b/i;

export type LeadAiContext = {
  lead: Awaited<ReturnType<typeof listLeadKnowledgeRecords>>[number];
  member?: TeamMember | null;
  workspace: Awaited<ReturnType<typeof getWorkspaceBusinessSettings>>;
  operator: Awaited<ReturnType<typeof getOperatorProfileSettings>>;
  qualificationFields: Record<string, string | undefined>;
  missingFields: string[];
  recentMessages: Array<{ direction: string; body: string; sentAt: string }>;
  internalNotes: string[];
  assignmentHistory: Awaited<ReturnType<typeof listCrmAssignmentHistory>>;
  openTasks: Awaited<ReturnType<typeof listCrmFollowUpTasks>>;
};

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

function valueFromFacts(facts: string[], label: string) {
  return facts
    .flatMap((fact) => fact.split(/\r?\n/))
    .map((fact) => fact.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "i"))?.[1]?.trim())
    .find(Boolean);
}

function compactSentence(value?: string) {
  return value?.trim().replace(/\s+/g, " ").replace(/[.?!]+$/, "");
}

function knownCompany(context: Pick<LeadAiContext, "qualificationFields" | "lead">) {
  return compactSentence(context.qualificationFields.company || valueFromFacts(context.lead.facts, "Company"));
}

function knownNeed(context: Pick<LeadAiContext, "qualificationFields" | "lead">) {
  return compactSentence(context.qualificationFields.need || valueFromFacts(context.lead.facts, "Need") || valueFromFacts(context.lead.facts, "Requirement"));
}

function contextLeadLabel(context: Pick<LeadAiContext, "lead">) {
  return context.lead.contact.displayName?.trim().split(/\s+/)[0] || "there";
}

function oneQuestionForMissingField(field: string, context: LeadAiContext) {
  const company = knownCompany(context);
  const need = knownNeed(context);
  if (field === "budget") return `What budget range should we plan around${company ? ` for ${company}` : ""}, and who will make the final decision?`;
  if (field === "company") return need ? "Which company or business is this for so I can map the right WhatsApp follow-up plan?" : "Which company or business is this for?";
  if (field === "need") return company ? `What should we improve first for ${company}: qualification, follow-up, assignment, or bookings?` : "What should we improve first: qualification, follow-up, assignment, or bookings?";
  if (field === "timeline") return `When would you like to start${need ? ` with ${need}` : ""}?`;
  if (field === "authority") return "Are you the decision maker for this, or should we include someone else before proposing the next step?";
  return "What is the next detail I should know before routing this to the right owner?";
}

function qualificationQuestion(context: LeadAiContext) {
  const missing = context.missingFields;
  const nextMissing = missing.includes("budget")
    ? "budget"
    : missing.includes("company")
      ? "company"
      : missing.includes("need")
        ? "need"
        : missing.includes("timeline")
          ? "timeline"
          : missing.includes("authority")
            ? "authority"
            : undefined;
  if (!nextMissing) return "Thanks. I have enough context to route this to the right owner for the next step.";
  return oneQuestionForMissingField(nextMissing, context);
}

function whatsappAddressForLead(lead: Awaited<ReturnType<typeof listLeadKnowledgeRecords>>[number]) {
  const phone = lead.contact.waId || lead.contact.phone;
  if (!phone?.trim()) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  return `whatsapp:+${digits}`;
}

export async function buildLeadAiContext(input: Scope & {
  leadId: string;
  conversationId?: string;
  memberId?: string;
}): Promise<LeadAiContext | null> {
  const lead = (await listLeadKnowledgeRecords(input)).find((record) => record.id === input.leadId);
  if (!lead) return null;
  const member = input.memberId ? await getTeamMember({ ...input, memberId: input.memberId }) : null;
  const [workspace, operator, assignmentHistory, openTasks, internalThread] = await Promise.all([
    getWorkspaceBusinessSettings(input),
    getOperatorProfileSettings(input),
    listCrmAssignmentHistory(input, { leadId: lead.id }),
    listCrmFollowUpTasks(input, { leadId: lead.id }),
    listTeamThreadMessages({ ...input, leadId: lead.id })
  ]);
  const recentMessages = lead.messages
    .filter((message) => !input.conversationId || message.conversationId === input.conversationId)
    .filter((message) => message.direction === "inbound" || message.direction === "outbound")
    .slice(-8)
    .map((message) => ({ direction: message.direction, body: message.body, sentAt: message.sentAt }));
  const qualificationFields = lead.qualificationFields as Record<string, string | undefined>;
  return {
    lead,
    member,
    workspace,
    operator,
    qualificationFields,
    missingFields: missingQualificationFields(qualificationFields),
    recentMessages,
    internalNotes: internalThread.slice(-6).map((message) => message.body),
    assignmentHistory,
    openTasks
  };
}

export function generateContextualAiReply(
  context: LeadAiContext,
  purpose: "initial_outbound" | "qualification_reply" | "qualified_handoff",
  options: { ownerName?: string; slotText?: string } = {}
) {
  const firstName = contextLeadLabel(context);
  const agentName = context.member?.name || "Leadsy";
  const company = knownCompany(context);
  const need = knownNeed(context);
  const style = compactSentence(context.operator.communicationStyle) || "concise and helpful";
  const contextLine = company && need
    ? `I saw ${company} is looking at ${need}.`
    : company
      ? `I saw this is for ${company}.`
      : need
        ? `I saw you are looking at ${need}.`
        : "Thanks for sharing the details.";

  if (purpose === "qualified_handoff") {
    if (options.slotText) return `You look ready for the next step. ${options.ownerName ?? "Our owner"} is available at ${options.slotText}. Which time works for you?`;
    return `You look ready for the next step. ${options.ownerName ?? "Our owner"} will share the next available meeting time shortly.`;
  }

  const question = qualificationQuestion(context);
  if (purpose === "initial_outbound") {
    return `Hi ${firstName}, I am ${agentName} from Leadsy. ${contextLine} To keep this ${style}, ${question}`;
  }

  return `${contextLine} ${question}`;
}

async function initialOutboundAlreadyHandled(input: Scope & { leadId: string; triggerId: string }) {
  const thread = await listTeamThreadMessages({ ...input, leadId: input.leadId });
  return thread.some((message) => message.triggerId === input.triggerId);
}

export async function sendInitialAiOutboundForLead(input: Scope & {
  leadId: string;
  memberId: string;
  trigger: string;
}): Promise<InitialAiOutboundResult> {
  const member = await getTeamMember({ ...input, memberId: input.memberId });
  if (!member || !member.type.startsWith("ai_agent")) {
    return { action: "not_ai_member", memberId: member?.id, leadId: input.leadId, reason: "Selected owner is not an AI team member." };
  }

  const triggerId = `initial-outbound:${input.leadId}:${member.id}:${input.trigger}`;
  if (await initialOutboundAlreadyHandled({ ...input, triggerId })) {
    return { action: "skipped_duplicate", memberId: member.id, leadId: input.leadId, reason: "Initial AI outbound was already handled for this trigger." };
  }

  const context = await buildLeadAiContext({ ...input, leadId: input.leadId, memberId: member.id });
  if (!context) {
    return { action: "lead_not_found", memberId: member.id, leadId: input.leadId, reason: "Lead was not found." };
  }
  const { lead } = context;

  const body = generateContextualAiReply(context, "initial_outbound");
  if (member.type === "ai_agent_assisted" || !member.autoReplyEnabled) {
    await postTeamThreadMessage({
      ...input,
      leadId: lead.id,
      authorMemberId: member.id,
      authorType: "ai_agent",
      body: `Initial outbound draft for review by ${member.name}: ${body}`,
      eventType: "handoff_summary",
      triggerId
    });
    await editLeadKnowledgeRecord({
      ...input,
      leadId: lead.id,
      contact: lead.contact,
      summary: lead.summary,
      nextAction: "AI drafted the first outbound message for human review.",
      facts: [...lead.facts, `AI note: ${member.name} drafted an initial outbound message for review.`],
      crmStatus: lead.crmStatus,
      productPipelineStatus: lead.productPipelineStatus,
      leadSource: lead.leadSource,
      campaignId: lead.campaignId,
      assigneeId: lead.assigneeId,
      assigneeName: lead.assigneeName,
      qualificationFields: lead.qualificationFields,
      qualificationStage: lead.qualificationStage
    });
    return {
      action: member.type === "ai_agent_assisted" ? "drafted_for_review" : "auto_reply_disabled",
      memberId: member.id,
      leadId: lead.id,
      body
    };
  }

  const to = whatsappAddressForLead(lead);
  if (!to) {
    await postTeamThreadMessage({
      ...input,
      leadId: lead.id,
      authorMemberId: member.id,
      authorType: "ai_agent",
      body: `${member.name} could not send the initial outbound message because the lead has no WhatsApp phone.`,
      eventType: "agent_guard",
      triggerId
    });
    return { action: "no_whatsapp_phone", memberId: member.id, leadId: lead.id, body };
  }

  const transport = await sendAndStoreWhatsAppMessage({
    ...input,
    leadId: lead.id,
    to,
    body,
    contact: lead.contact
  });

  await postTeamThreadMessage({
    ...input,
    leadId: lead.id,
    conversationId: transport.conversationId,
    authorMemberId: member.id,
    authorType: "ai_agent",
    body: `Initial outbound sent by ${member.name}: ${body}`,
    eventType: "handoff_summary",
    triggerId
  });
  await editLeadKnowledgeRecord({
    ...input,
    leadId: lead.id,
    contact: lead.contact,
    summary: lead.summary,
    nextAction: "Initial AI outbound sent. Wait for the lead response.",
    facts: [...lead.facts, `AI note: ${member.name} sent the initial outbound message.`],
    crmStatus: "needs_reply",
    productPipelineStatus: lead.productPipelineStatus,
    leadSource: lead.leadSource,
    campaignId: lead.campaignId,
    assigneeId: lead.assigneeId,
    assigneeName: lead.assigneeName,
    qualificationFields: lead.qualificationFields,
    qualificationStage: lead.qualificationStage
  });

  return { action: "sent", memberId: member.id, leadId: lead.id, body, transport };
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
  const context = await buildLeadAiContext({ ...input, memberId: agent.id });
  if (!context) return { action: "no_action", reason: "Lead context was not found." };

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

  const fields = context.qualificationFields;
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
    const replyBody = generateContextualAiReply(context, "qualified_handoff", { ownerName: owner?.name, slotText });
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

  const replyBody = generateContextualAiReply(context, "qualification_reply");
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
