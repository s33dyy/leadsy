import { appendTwilioOutboundMessage, editLeadKnowledgeRecord, listLeadKnowledgeRecords } from "./lead-knowledge-store";
import { findCalendarFreeSlots } from "./calendar-store";
import { assignLeadOwner, listCrmAssignmentHistory, listCrmFollowUpTasks, routeCrmEventToTasks } from "./crm-store";
import {
  findPipelineOwner,
  findPrimaryQualificationAgent,
  getTeamMember,
  listTeamThreadMessages,
  postTeamThreadMessage,
  type TeamMember
} from "./teamspace-store";
import { generateLeadAiReply, type LeadAiReplyResult } from "./lead-ai-engine";
import { ensureWorkspaceTwilioSimulator } from "./twilio-simulator";
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
  responderMemberId?: string;
  responderType?: TeamMember["type"] | "none";
  responderName?: string;
  skippedReason?: string;
};

export type InitialAiOutboundAction =
  | "sent"
  | "drafted_for_review"
  | "auto_reply_disabled"
  | "not_ai_member"
  | "lead_not_found"
  | "no_whatsapp_phone"
  | "skipped_duplicate"
  | "blocked_transport";

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

function mergedQualificationFields(context: LeadAiContext, ai: LeadAiReplyResult) {
  return {
    ...context.qualificationFields,
    ...Object.fromEntries(Object.entries(ai.extractedFields).filter(([, value]) => value?.trim()))
  };
}

async function applyAiResultToLead(input: Scope & { leadId: string }, context: LeadAiContext, ai: LeadAiReplyResult, nextAction?: string) {
  const hasFields = Object.keys(ai.extractedFields).some((key) => ai.extractedFields[key]?.trim());
  const hasNote = Boolean(ai.crmNote?.trim());
  if (!hasFields && !hasNote && !nextAction) return context.lead;
  const facts = [
    ...context.lead.facts,
    hasNote ? `AI note: ${ai.crmNote}` : undefined
  ].filter(Boolean) as string[];
  return editLeadKnowledgeRecord({
    ...input,
    contact: context.lead.contact,
    summary: context.lead.summary,
    nextAction: nextAction || context.lead.nextAction,
    facts,
    crmStatus: context.lead.crmStatus,
    productPipelineStatus: context.lead.productPipelineStatus,
    leadSource: context.lead.leadSource,
    campaignId: context.lead.campaignId,
    assigneeId: context.lead.assigneeId,
    assigneeName: context.lead.assigneeName,
    qualificationFields: mergedQualificationFields(context, ai),
    qualificationStage: context.lead.qualificationStage
  });
}

async function sendWithSimulatorFallback(input: Scope & {
  leadId: string;
  to: string;
  body: string;
  contact: LeadAiContext["lead"]["contact"];
  businessName?: string;
}) {
  try {
    return await sendAndStoreWhatsAppMessage(input);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "workspace_whatsapp_sender_required" && code !== "workspace_whatsapp_sender_not_approved") throw error;
    await ensureWorkspaceTwilioSimulator({
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      businessName: input.businessName
    });
    return sendAndStoreWhatsAppMessage(input);
  }
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
  const ai = await generateLeadAiReply({
    ...input,
    context,
    purpose: "initial_outbound"
  });
  const body = ai.reply;
  const lead = await applyAiResultToLead(input, context, ai, "Initial AI outreach prepared.");
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

  let transport: WhatsAppSendResult;
  try {
    transport = await sendWithSimulatorFallback({
      ...input,
      leadId: lead.id,
      to,
      body,
      contact: lead.contact,
      businessName: context.workspace.businessName
    });
  } catch (error) {
    return {
      action: "blocked_transport",
      memberId: member.id,
      leadId: lead.id,
      body,
      reason: (error as Error).message
    };
  }

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

export async function resolveInboundResponderForLead(input: Scope & {
  leadId: string;
  lead?: Awaited<ReturnType<typeof listLeadKnowledgeRecords>>[number];
  allowHumanReviewResponder?: boolean;
}) {
  const lead = input.lead ?? (await listLeadKnowledgeRecords(input)).find((record) => record.id === input.leadId);
  if (!lead) return { mode: "none" as const, reason: "Lead was not found." };
  if (!input.allowHumanReviewResponder && (lead.crmStatus === "human_review" || lead.qualificationStage === "human_review")) {
    return { mode: "none" as const, reason: "Lead is in human review." };
  }
  if (lead.assigneeId) {
    const assigned = await getTeamMember({ ...input, memberId: lead.assigneeId });
    if (assigned?.status === "active") {
      if (assigned.type === "ai_agent_full") {
        return assigned.autoReplyEnabled
          ? { mode: "full_ai" as const, member: assigned }
          : { mode: "ai_disabled" as const, member: assigned, reason: "Assigned AI auto-reply is disabled." };
      }
      if (assigned.type === "ai_agent_assisted") {
        return { mode: "assisted_ai" as const, member: assigned, reason: "Assisted AI requires approval before external replies." };
      }
      return { mode: "human" as const, member: assigned, reason: "Lead is assigned to a human team member." };
    }
  }
  if (lead.qualificationStage === "qualified" || lead.crmStatus === "interested") {
    return { mode: "none" as const, reason: "Qualified lead has no active AI responder." };
  }
  const fallback = await findPrimaryQualificationAgent(input);
  if (!fallback) return { mode: "none" as const, reason: "No active qualification AI agent is configured." };
  return fallback.autoReplyEnabled
    ? { mode: "full_ai" as const, member: fallback }
    : { mode: "ai_disabled" as const, member: fallback, reason: "Default qualification AI auto-reply is disabled." };
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

  const responder = await resolveInboundResponderForLead({
    ...input,
    lead,
    allowHumanReviewResponder: escalationRequested(triggerMessage.body)
  });
  if (!responder.member) {
    return { action: responder.mode === "none" ? "no_action" : "no_agent_available", reason: responder.reason, skippedReason: responder.reason, responderType: "none" };
  }
  const agent = responder.member;
  if (responder.mode === "human" || responder.mode === "assisted_ai" || responder.mode === "ai_disabled") {
    await routeCrmEventToTasks({
      ...input,
      eventType: "inbound_message",
      leadId: input.leadId,
      assigneeId: agent.id,
      source: "agent_runtime",
      reason: responder.reason ?? "New inbound message needs assigned owner handling."
    });
    return {
      action: "no_action",
      memberId: agent.id,
      responderMemberId: agent.id,
      responderType: agent.type,
      responderName: agent.name,
      reason: responder.reason,
      skippedReason: responder.reason
    };
  }
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
    await routeCrmEventToTasks({
      ...input,
      eventType: "escalation",
      leadId: input.leadId,
      assigneeId: lead.assigneeId,
      source: "agent_runtime",
      reason: "Escalation keyword detected during AI qualification."
    });
    return { action: "escalated_to_human", memberId: agent.id, responderMemberId: agent.id, responderType: agent.type, responderName: agent.name };
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
    const ai = await generateLeadAiReply({
      ...input,
      context,
      purpose: "qualified_handoff",
      ownerName: owner?.name,
      slotText
    });
    const replyBody = ai.reply;
    await applyAiResultToLead(input, context, ai, "Qualified lead ready for handoff.");
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
      await assignLeadOwner({
        ...input,
        leadId: input.leadId,
        assigneeId: owner.id,
        assigneeName: owner.name,
        method: "source_based",
        assignedById: agent.id,
        assignedByName: agent.name,
        reason: "Qualification threshold reached."
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
    await routeCrmEventToTasks({
      ...input,
      eventType: "qualification_completed",
      leadId: input.leadId,
      assigneeId: owner?.id,
      source: "agent_runtime",
      reason: owner ? `Qualified lead assigned to ${owner.name}.` : "Qualified lead has no configured pipeline owner."
    });
    return {
      action: "assigned_to_pipeline_owner",
      memberId: agent.id,
      responderMemberId: agent.id,
      responderType: agent.type,
      responderName: agent.name,
      assignedMemberId: owner?.id,
      replyBody
    };
  }

  if (!agent.autoReplyEnabled) {
    return {
      action: "no_action",
      memberId: agent.id,
      responderMemberId: agent.id,
      responderType: agent.type,
      responderName: agent.name,
      reason: "Agent auto-reply is disabled.",
      skippedReason: "Agent auto-reply is disabled."
    };
  }

  const ai = await generateLeadAiReply({
    ...input,
    context,
    purpose: "qualification_reply"
  });
  await applyAiResultToLead(input, context, ai, "AI qualification reply sent. Wait for the lead response.");
  const updatedContext = await buildLeadAiContext({ ...input, memberId: agent.id });
  const effectiveFields = updatedContext?.qualificationFields ?? mergedQualificationFields(context, ai);
  const replyBody = ai.reply;
  if (isQualified(effectiveFields)) {
    const owner = await findPipelineOwner(input, "qualified");
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
      await assignLeadOwner({
        ...input,
        leadId: input.leadId,
        assigneeId: owner.id,
        assigneeName: owner.name,
        method: "source_based",
        assignedById: agent.id,
        assignedByName: agent.name,
        reason: "Qualification threshold reached."
      });
    }
    await appendAgentReply({ ...input, leadId: input.leadId, to: contactPhone, body: replyBody, now });
    await postTeamThreadMessage({
      ...input,
      authorMemberId: agent.id,
      authorType: "ai_agent",
      body: owner ? `Qualified lead assigned to ${owner.name}.` : "Qualified lead, but no pipeline owner was configured.",
      eventType: "handoff_summary",
      triggerId: `${input.triggerMessageId}:qualified`
    });
    await routeCrmEventToTasks({
      ...input,
      eventType: "qualification_completed",
      leadId: input.leadId,
      assigneeId: owner?.id,
      source: "agent_runtime",
      reason: owner ? `Qualified lead assigned to ${owner.name}.` : "Qualified lead has no configured pipeline owner."
    });
    return {
      action: "assigned_to_pipeline_owner",
      memberId: agent.id,
      responderMemberId: agent.id,
      responderType: agent.type,
      responderName: agent.name,
      assignedMemberId: owner?.id,
      replyBody
    };
  }
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
  return { action: "auto_replied", memberId: agent.id, responderMemberId: agent.id, responderType: agent.type, responderName: agent.name, replyBody };
}
