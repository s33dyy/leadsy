import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";
import { editLeadKnowledgeRecord, listLeadKnowledgeRecords, type LeadCrmStatus, type LeadKnowledgeRecord } from "./lead-knowledge-store";
import { ensureDefaultQualificationAgent, getTeamMember, postTeamThreadMessage, postWorkspaceTeamEvent } from "./teamspace-store";
import { createNotificationRecord } from "./user-settings-store";
import { sendAndStoreWhatsAppMessage } from "./whatsapp-transport";

const crmFile = join(leadsyDataDir, "lead-crm.json");

type Scope = {
  tenantId: string;
  ownerId: string;
};

export type CrmAssignmentRule = Scope & {
  id: string;
  title: string;
  sourceIncludes?: string;
  campaignIncludes?: string;
  statusEquals?: LeadCrmStatus;
  assigneeId: string;
  assigneeName: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmAssignmentMethod = "manual" | "round_robin" | "source_based";

export type CrmAssignmentHistoryRecord = Scope & {
  id: string;
  leadId: string;
  method: CrmAssignmentMethod;
  fromAssigneeId?: string;
  fromAssigneeName?: string;
  toAssigneeId?: string;
  toAssigneeName?: string;
  ruleId?: string;
  ruleTitle?: string;
  assignedById?: string;
  assignedByName?: string;
  reason?: string;
  createdAt: string;
};

export type CrmTaskType = "follow_up" | "call" | "whatsapp_follow_up" | "meeting" | "site_visit" | "review_lead" | "custom";
export type CrmUserRole = "admin" | "manager" | "agent";
export type CrmTaskDestination = "human_tasks" | "ai_approvals";
export type CrmTaskEventType =
  | "inbound_message"
  | "assignment_changed"
  | "qualification_completed"
  | "escalation"
  | "human_review_needed"
  | "meeting_created"
  | "meeting_rescheduled"
  | "meeting_cancelled"
  | "delivery_failed"
  | "stale_needs_reply"
  | "follow_up_due";

export type CrmTaskNote = {
  id: string;
  authorId?: string;
  authorName?: string;
  note: string;
  createdAt: string;
};

export type CrmFollowUpTask = Scope & {
  id: string;
  leadId: string;
  type: CrmTaskType;
  topic: string;
  description?: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  assigneeId?: string;
  assigneeName?: string;
  dueAt?: string;
  destination: CrmTaskDestination;
  eventType?: CrmTaskEventType;
  dedupeKey?: string;
  source?: string;
  createdByRole?: CrmUserRole;
  createdById?: string;
  createdByName?: string;
  notes?: CrmTaskNote[];
  createdAt: string;
  updatedAt: string;
};

export type QualificationProfile = Scope & {
  id: string;
  businessGoal: string;
  introBehavior: "educate_then_qualify" | "qualify_first" | "human_first";
  requiredFields: string[];
  questionOrder: string[];
  scoreThreshold: number;
  updatedAt: string;
};

type CrmState = {
  assignmentRules: CrmAssignmentRule[];
  assignmentHistory: CrmAssignmentHistoryRecord[];
  followUpTasks: CrmFollowUpTask[];
  qualificationProfiles: QualificationProfile[];
};

function emptyState(): CrmState {
  return { assignmentRules: [], assignmentHistory: [], followUpTasks: [], qualificationProfiles: [] };
}

async function readState(): Promise<CrmState> {
  try {
    const raw = await readFile(crmFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<CrmState>;
    return {
      assignmentRules: Array.isArray(parsed.assignmentRules) ? parsed.assignmentRules : [],
      assignmentHistory: Array.isArray(parsed.assignmentHistory) ? parsed.assignmentHistory : [],
      followUpTasks: Array.isArray(parsed.followUpTasks) ? parsed.followUpTasks.map(normalizeTask) : [],
      qualificationProfiles: Array.isArray(parsed.qualificationProfiles) ? parsed.qualificationProfiles : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
      return emptyState();
    }
    throw error;
  }
}

function normalizeTask(task: CrmFollowUpTask): CrmFollowUpTask {
  return {
    ...task,
    destination: task.destination ?? "human_tasks"
  };
}

async function writeState(state: CrmState) {
  await mkdir(dirname(crmFile), { recursive: true });
  const tempFile = `${crmFile}.${randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, crmFile);
}

function scopeMatches(scope: Scope, item: Scope) {
  return item.tenantId === scope.tenantId && item.ownerId === scope.ownerId;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function defaultAssignmentRules(): CrmAssignmentRule[] {
  return [];
}

export async function listCrmAssignmentRules(scope: Scope) {
  const state = await readState();
  return [
    ...defaultAssignmentRules(),
    ...state.assignmentRules.filter((rule) => scopeMatches(scope, rule))
  ];
}

export async function upsertCrmAssignmentRule(input: Scope & {
  id?: string;
  title: string;
  sourceIncludes?: string;
  campaignIncludes?: string;
  statusEquals?: LeadCrmStatus;
  assigneeId: string;
  assigneeName: string;
}) {
  const state = await readState();
  const now = new Date().toISOString();
  const id = input.id || `crmrule_${randomUUID()}`;
  const index = state.assignmentRules.findIndex((rule) => rule.id === id && scopeMatches(input, rule));
  const next: CrmAssignmentRule = {
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    id,
    title: input.title.trim(),
    sourceIncludes: input.sourceIncludes?.trim() || undefined,
    campaignIncludes: input.campaignIncludes?.trim() || undefined,
    statusEquals: input.statusEquals,
    assigneeId: input.assigneeId.trim(),
    assigneeName: input.assigneeName.trim(),
    createdAt: index >= 0 ? state.assignmentRules[index].createdAt : now,
    updatedAt: now
  };
  if (index >= 0) {
    state.assignmentRules[index] = next;
  } else {
    state.assignmentRules.push(next);
  }
  await writeState(state);
  return next;
}

function leadForAssignment(scope: Scope, leadId: string, leads: LeadKnowledgeRecord[]) {
  const lead = leads.find((candidate) => candidate.id === leadId);
  if (!lead) throw new Error("Lead knowledge record was not found.");
  return lead;
}

function matchesText(value: string | undefined, pattern: string | undefined) {
  if (!pattern?.trim()) return true;
  return Boolean(value?.toLowerCase().includes(pattern.trim().toLowerCase()));
}

function ruleMatchesLead(rule: Pick<CrmAssignmentRule, "sourceIncludes" | "campaignIncludes" | "statusEquals">, lead: LeadKnowledgeRecord) {
  const hasCriteria = Boolean(rule.sourceIncludes || rule.campaignIncludes || rule.statusEquals);
  if (!hasCriteria) return false;
  if (!matchesText(lead.leadSource, rule.sourceIncludes)) return false;
  if (!matchesText(lead.campaignId, rule.campaignIncludes)) return false;
  if (rule.statusEquals && lead.crmStatus !== rule.statusEquals) return false;
  return true;
}

async function recordAssignment(input: Scope & {
  lead: LeadKnowledgeRecord;
  method: CrmAssignmentMethod;
  assigneeId?: string;
  assigneeName?: string;
  ruleId?: string;
  ruleTitle?: string;
  assignedById?: string;
  assignedByName?: string;
  reason?: string;
}) {
  const state = await readState();
  const now = new Date().toISOString();
  const history: CrmAssignmentHistoryRecord = {
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    id: `crmassign_${randomUUID()}`,
    leadId: input.lead.id,
    method: input.method,
    fromAssigneeId: input.lead.assigneeId,
    fromAssigneeName: input.lead.assigneeName,
    toAssigneeId: input.assigneeId?.trim() || undefined,
    toAssigneeName: input.assigneeName?.trim() || undefined,
    ruleId: input.ruleId,
    ruleTitle: input.ruleTitle,
    assignedById: input.assignedById?.trim() || undefined,
    assignedByName: input.assignedByName?.trim() || undefined,
    reason: input.reason?.trim() || undefined,
    createdAt: now
  };
  state.assignmentHistory.push(history);
  await writeState(state);
  return history;
}

export async function createAssignmentNotifications(input: Scope & {
  lead: LeadKnowledgeRecord;
  toAssigneeId: string;
  toAssigneeName: string;
  fromAssigneeName?: string;
  method: CrmAssignmentMethod;
  reason?: string;
}) {
  const leadName = input.lead.contact.displayName || input.lead.contact.phone || "Lead";
  const fromName = input.fromAssigneeName || "Unassigned";
  const reason = input.reason?.trim();
  const detail = `${leadName} assigned from ${fromName} to ${input.toAssigneeName}. Method: ${input.method}${reason ? `. Reason: ${reason}` : ""}.`;
  const href = `/app/leads?contact=${input.lead.id}`;
  const assignee = await getTeamMember({ tenantId: input.tenantId, ownerId: input.ownerId, memberId: input.toAssigneeId });
  const ownerNotification = await createNotificationRecord({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    type: "assignedToMe",
    title: `Lead assigned to ${input.toAssigneeName}`,
    detail,
    href,
    targetUserId: input.ownerId,
    targetRole: "owner",
    priority: "medium"
  });
  const assigneeNotification = await createNotificationRecord({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    type: assignee?.type?.startsWith("ai_agent") ? "humanReviewNeeded" : "assignedToMe",
    title: assignee?.type?.startsWith("ai_agent") ? `AI queue assignment: ${leadName}` : `Lead assigned: ${leadName}`,
    detail,
    href,
    targetUserId: assignee?.authUserId,
    targetMemberId: input.toAssigneeId,
    targetRole: assignee?.type?.startsWith("ai_agent") ? "approval_queue" : "assignee",
    priority: assignee?.type?.startsWith("ai_agent") ? "high" : "medium"
  });
  return [ownerNotification, assigneeNotification];
}

export async function recordLeadAssignmentKnowledge(input: Scope & {
  leadId: string;
  toAssigneeId: string;
  toAssigneeName: string;
  fromAssigneeName?: string;
  method: CrmAssignmentMethod;
  assignedByName?: string;
  reason?: string;
  historyId?: string;
  createdAt?: string;
}) {
  const leads = await listLeadKnowledgeRecords(input);
  const lead = leadForAssignment(input, input.leadId, leads);
  const assignedAt = input.createdAt ?? new Date().toISOString();
  const actor = input.assignedByName?.trim() || "Leadsy";
  const reason = input.reason?.trim();
  const assignmentFact = `Assignment: assigned to ${input.toAssigneeName} by ${actor} using ${input.method}${reason ? ` because ${reason}` : ""}.`;
  const updated = await editLeadKnowledgeRecord({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: lead.id,
    contact: lead.contact,
    summary: lead.summary,
    nextAction: lead.nextAction,
    facts: uniqueStrings([...(lead.facts ?? []), assignmentFact]),
    crmStatus: lead.crmStatus,
    productPipelineStatus: lead.productPipelineStatus,
    assigneeId: input.toAssigneeId,
    assigneeName: input.toAssigneeName,
    leadSource: lead.leadSource,
    campaignId: lead.campaignId,
    qualificationFields: lead.qualificationFields,
    qualificationStage: lead.qualificationStage
  });

  await postTeamThreadMessage({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    threadScope: "lead",
    leadId: lead.id,
    authorType: "system",
    body: `${assignmentFact}${input.fromAssigneeName ? ` Previous owner: ${input.fromAssigneeName}.` : ""}`,
    eventType: "handoff_summary",
    triggerId: `assignment:${input.historyId ?? lead.id}:${input.toAssigneeId}:${assignedAt}`
  });

  await postWorkspaceTeamEvent({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: lead.id,
    body: `Lead ${lead.contact.displayName || lead.contact.phone || lead.id} assigned from ${input.fromAssigneeName || "Unassigned"} to ${input.toAssigneeName}. Method: ${input.method}${reason ? `. Reason: ${reason}` : ""}.`,
    eventType: "assignment_changed",
    triggerId: `workspace-assignment:${input.historyId ?? lead.id}:${input.toAssigneeId}:${assignedAt}`
  });

  await createAssignmentNotifications({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    lead,
    toAssigneeId: input.toAssigneeId,
    toAssigneeName: input.toAssigneeName,
    fromAssigneeName: input.fromAssigneeName,
    method: input.method,
    reason
  });

  return updated;
}

export async function assignLeadOwner(input: Scope & {
  leadId: string;
  assigneeId: string;
  assigneeName: string;
  method?: CrmAssignmentMethod;
  ruleId?: string;
  ruleTitle?: string;
  assignedById?: string;
  assignedByName?: string;
  reason?: string;
  now?: string;
}) {
  const leads = await listLeadKnowledgeRecords(input);
  const lead = leadForAssignment(input, input.leadId, leads);
  const assigneeId = input.assigneeId.trim();
  const assigneeName = input.assigneeName.trim();
  if (!assigneeId || !assigneeName) throw new Error("Assignee id and name are required.");
  await editLeadKnowledgeRecord({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: input.leadId,
    contact: lead.contact,
    summary: lead.summary,
    nextAction: lead.nextAction,
    facts: lead.facts,
    crmStatus: lead.crmStatus,
    productPipelineStatus: lead.productPipelineStatus,
    assigneeId,
    assigneeName,
    leadSource: lead.leadSource,
    campaignId: lead.campaignId,
    qualificationFields: lead.qualificationFields,
    qualificationStage: lead.qualificationStage
  });
  const history = await recordAssignment({
    ...input,
    lead,
    method: input.method ?? "manual",
    assigneeId,
    assigneeName
  });
  const updated = await recordLeadAssignmentKnowledge({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: input.leadId,
    toAssigneeId: assigneeId,
    toAssigneeName: assigneeName,
    fromAssigneeName: lead.assigneeName,
    method: input.method ?? "manual",
    assignedByName: input.assignedByName,
    reason: input.reason,
    historyId: history.id,
    createdAt: history.createdAt
  });

  if (lead.contact.phone && lead.assigneeId !== assigneeId && lead.outboundCount > 0) {
    try {
      const assignee = await getTeamMember({ tenantId: input.tenantId, ownerId: input.ownerId, memberId: assigneeId });
      if (assignee?.type !== "ai_agent_assisted") {
        await sendAndStoreWhatsAppMessage({
          tenantId: input.tenantId,
          ownerId: input.ownerId,
          to: lead.contact.phone,
          leadId: lead.id,
          contact: lead.contact,
          body: `Hi, I'm ${assigneeName}, taking over this conversation.`,
          sentAt: input.now,
          receivedAt: input.now
        });
      }
    } catch (e) {
      console.error("Failed to send handover message", e);
    }
  }
  
  const now = input.now ? new Date(input.now) : new Date();
  const tmrw = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  await createCrmFollowUpTask({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: input.leadId,
    topic: "24h check-in",
    dueAt: tmrw.toISOString(),
    assigneeId,
    assigneeName
  });

  await createCrmFollowUpTask({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: input.leadId,
    topic: "48h check-in",
    dueAt: dayAfter.toISOString(),
    assigneeId,
    assigneeName
  });
  await routeCrmEventToTasks({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    eventType: "assignment_changed",
    leadId: input.leadId,
    assigneeId,
    source: "assignment",
    reason: input.reason || "Lead owner changed."
  });
  return updated;
}

export async function assignLeadToDefaultQualificationAgent(input: Scope & {
  leadId: string;
  assignedById?: string;
  assignedByName?: string;
  reason?: string;
}) {
  const agent = await ensureDefaultQualificationAgent(input);
  return assignLeadOwner({
    ...input,
    assigneeId: agent.id,
    assigneeName: agent.name,
    method: "manual",
    reason: input.reason ?? "Assigned to default Qualification AI."
  });
}

export async function assignLeadByRoundRobin(input: Scope & {
  leadId: string;
  candidates: Array<{ assigneeId: string; assigneeName: string }>;
  assignedById?: string;
  assignedByName?: string;
  reason?: string;
}) {
  const candidates = input.candidates
    .map((candidate, index) => ({
      assigneeId: candidate.assigneeId.trim(),
      assigneeName: candidate.assigneeName.trim(),
      index
    }))
    .filter((candidate) => candidate.assigneeId && candidate.assigneeName);
  if (!candidates.length) throw new Error("Round robin assignment requires at least one candidate.");

  const leads = await listLeadKnowledgeRecords(input);
  leadForAssignment(input, input.leadId, leads);
  const selected = candidates
    .map((candidate) => ({
      ...candidate,
      workload: leads.filter((lead) => lead.assigneeId === candidate.assigneeId && lead.id !== input.leadId).length
    }))
    .sort((left, right) => left.workload - right.workload || left.index - right.index)[0];

  return assignLeadOwner({
    ...input,
    assigneeId: selected.assigneeId,
    assigneeName: selected.assigneeName,
    method: "round_robin"
  });
}

export async function assignLeadBySource(input: Scope & {
  leadId: string;
  routes?: Array<{
    id?: string;
    title?: string;
    sourceIncludes?: string;
    campaignIncludes?: string;
    statusEquals?: LeadCrmStatus;
    assigneeId: string;
    assigneeName: string;
  }>;
  assignedById?: string;
  assignedByName?: string;
  reason?: string;
}) {
  const leads = await listLeadKnowledgeRecords(input);
  const lead = leadForAssignment(input, input.leadId, leads);
  const routes = input.routes ?? (await listCrmAssignmentRules(input));
  const matched = routes.find((route) => ruleMatchesLead(route, lead));
  if (!matched) throw new Error("No source-based assignment route matched this lead.");
  return assignLeadOwner({
    ...input,
    assigneeId: matched.assigneeId,
    assigneeName: matched.assigneeName,
    method: "source_based",
    ruleId: matched.id,
    ruleTitle: matched.title,
    reason: input.reason ?? `Matched source route for ${lead.leadSource || "unknown source"}`
  });
}

export async function listCrmAssignmentHistory(scope: Scope, options: { leadId?: string } = {}) {
  const state = await readState();
  return state.assignmentHistory
    .filter((entry) => scopeMatches(scope, entry))
    .filter((entry) => !options.leadId || entry.leadId === options.leadId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getQualificationProfile(scope: Scope) {
  const state = await readState();
  const existing = state.qualificationProfiles.find((profile) => scopeMatches(scope, profile));
  if (existing) return existing;
  return {
    ...scope,
    id: "default-qualification-profile",
    businessGoal: "Qualify WhatsApp and web leads, educate them briefly, and collect enough context for a sales follow-up.",
    introBehavior: "educate_then_qualify" as const,
    requiredFields: ["name", "phone", "company", "need"],
    questionOrder: ["name", "phone", "company", "need", "teamOrQueryVolume", "budget", "timeline"],
    scoreThreshold: 60,
    updatedAt: "default"
  };
}

export async function updateQualificationProfile(input: Scope & {
  businessGoal?: string;
  introBehavior?: QualificationProfile["introBehavior"];
  requiredFields?: string[];
  questionOrder?: string[];
  scoreThreshold?: number;
}) {
  const state = await readState();
  const now = new Date().toISOString();
  const current = await getQualificationProfile(input);
  const next: QualificationProfile = {
    ...current,
    id: current.id === "default-qualification-profile" ? `qual_${randomUUID()}` : current.id,
    businessGoal: input.businessGoal?.trim() || current.businessGoal,
    introBehavior: input.introBehavior ?? current.introBehavior,
    requiredFields: input.requiredFields?.map((item) => item.trim()).filter(Boolean) ?? current.requiredFields,
    questionOrder: input.questionOrder?.map((item) => item.trim()).filter(Boolean) ?? current.questionOrder,
    scoreThreshold: input.scoreThreshold ?? current.scoreThreshold,
    updatedAt: now
  };
  const index = state.qualificationProfiles.findIndex((profile) => scopeMatches(input, profile));
  if (index >= 0) {
    state.qualificationProfiles[index] = next;
  } else {
    state.qualificationProfiles.push(next);
  }
  await writeState(state);
  return next;
}

export async function createCrmFollowUpTask(input: Scope & {
  leadId: string;
  type?: CrmTaskType;
  topic: string;
  description?: string;
  priority?: CrmFollowUpTask["priority"];
  destination?: CrmTaskDestination;
  eventType?: CrmTaskEventType;
  dedupeKey?: string;
  source?: string;
  assigneeId?: string;
  assigneeName?: string;
  dueAt?: string;
  createdByRole?: CrmUserRole;
  createdById?: string;
  createdByName?: string;
}) {
  const state = await readState();
  const now = new Date().toISOString();
  const dedupeKey = input.dedupeKey?.trim();
  if (dedupeKey) {
    const existing = state.followUpTasks.find(
      (task) =>
        scopeMatches(input, task) &&
        task.dedupeKey === dedupeKey &&
        task.status !== "done" &&
        task.status !== "cancelled"
    );
    if (existing) return existing;
  }
  const task: CrmFollowUpTask = {
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    id: `crmtask_${randomUUID()}`,
    leadId: input.leadId,
    type: input.type ?? "follow_up",
    topic: input.topic.trim(),
    description: input.description?.trim() || undefined,
    priority: input.priority ?? "normal",
    status: "open",
    assigneeId: input.assigneeId?.trim() || undefined,
    assigneeName: input.assigneeName?.trim() || undefined,
    dueAt: input.dueAt?.trim() || undefined,
    destination: input.destination ?? "human_tasks",
    eventType: input.eventType,
    dedupeKey,
    source: input.source?.trim() || undefined,
    createdByRole: input.createdByRole,
    createdById: input.createdById?.trim() || undefined,
    createdByName: input.createdByName?.trim() || undefined,
    notes: [],
    createdAt: now,
    updatedAt: now
  };
  state.followUpTasks.push(task);
  await writeState(state);
  return task;
}

export async function listCrmFollowUpTasks(scope: Scope, options: { leadId?: string; includeClosed?: boolean; destination?: CrmTaskDestination } = {}) {
  const state = await readState();
  return state.followUpTasks
    .filter((task) => scopeMatches(scope, task))
    .filter((task) => !options.leadId || task.leadId === options.leadId)
    .filter((task) => !options.destination || task.destination === options.destination)
    .filter((task) => options.includeClosed || (task.status !== "done" && task.status !== "cancelled"))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function taskTypeForEvent(eventType: CrmTaskEventType): CrmTaskType {
  if (eventType === "meeting_created" || eventType === "meeting_rescheduled" || eventType === "meeting_cancelled") return "meeting";
  if (eventType === "inbound_message" || eventType === "stale_needs_reply" || eventType === "follow_up_due") return "whatsapp_follow_up";
  if (eventType === "human_review_needed" || eventType === "escalation" || eventType === "qualification_completed") return "review_lead";
  return "follow_up";
}

function taskTopicForEvent(eventType: CrmTaskEventType) {
  const labels: Record<CrmTaskEventType, string> = {
    inbound_message: "Review new inbound message",
    assignment_changed: "Take over assigned lead",
    qualification_completed: "Review qualified lead",
    escalation: "Handle escalated lead",
    human_review_needed: "Review AI handoff",
    meeting_created: "Prepare for meeting",
    meeting_rescheduled: "Confirm rescheduled meeting",
    meeting_cancelled: "Follow up after cancelled meeting",
    delivery_failed: "Fix failed message delivery",
    stale_needs_reply: "Reply to stale lead",
    follow_up_due: "Complete scheduled follow-up"
  };
  return labels[eventType];
}

export async function routeCrmEventToTasks(input: Scope & {
  eventType: CrmTaskEventType;
  leadId: string;
  assigneeId?: string;
  source?: string;
  reason?: string;
}) {
  const assignee = input.assigneeId
    ? await getTeamMember({
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        memberId: input.assigneeId
      })
    : null;
  const destination: CrmTaskDestination = assignee?.type?.startsWith("ai_agent") ? "ai_approvals" : "human_tasks";
  const assigneeName = assignee?.name;
  const dedupeKey = `${input.eventType}:${input.leadId}:${input.assigneeId || "unassigned"}:${taskTypeForEvent(input.eventType)}`;
  const task = await createCrmFollowUpTask({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: input.leadId,
    type: taskTypeForEvent(input.eventType),
    topic: taskTopicForEvent(input.eventType),
    description: input.reason,
    priority: input.eventType === "escalation" || input.eventType === "delivery_failed" ? "high" : "normal",
    assigneeId: input.assigneeId,
    assigneeName,
    destination,
    eventType: input.eventType,
    source: input.source,
    dedupeKey,
    createdByRole: "agent",
    createdByName: "Leadsy event router"
  });

  await postWorkspaceTeamEvent({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: input.leadId,
    body: `Task generated for ${assigneeName || "Unassigned"}: ${task.topic}. Queue: ${destination === "ai_approvals" ? "Approval Queue" : "Tasks"}.`,
    eventType: "task_generated",
    triggerId: `task-generated:${task.dedupeKey}`
  });

  return { destination, task };
}

export async function updateCrmFollowUpTask(input: Scope & {
  taskId: string;
  status?: CrmFollowUpTask["status"];
  priority?: CrmFollowUpTask["priority"];
  topic?: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  dueAt?: string;
  destination?: CrmTaskDestination;
}) {
  const state = await readState();
  const index = state.followUpTasks.findIndex((task) => task.id === input.taskId && scopeMatches(input, task));
  if (index < 0) throw new Error("CRM follow-up task was not found.");
  const current = state.followUpTasks[index];
  const next: CrmFollowUpTask = {
    ...current,
    status: input.status ?? current.status,
    priority: input.priority ?? current.priority,
    topic: input.topic?.trim() || current.topic,
    description: input.description?.trim() || current.description,
    assigneeId: input.assigneeId?.trim() || current.assigneeId,
    assigneeName: input.assigneeName?.trim() || current.assigneeName,
    dueAt: input.dueAt?.trim() || current.dueAt,
    destination: input.destination ?? current.destination,
    updatedAt: new Date().toISOString()
  };
  state.followUpTasks[index] = next;
  await writeState(state);
  return next;
}

export async function addCrmTaskNote(input: Scope & {
  taskId: string;
  authorId?: string;
  authorName?: string;
  note: string;
}) {
  const state = await readState();
  const index = state.followUpTasks.findIndex((task) => task.id === input.taskId && scopeMatches(input, task));
  if (index < 0) throw new Error("CRM follow-up task was not found.");
  const current = state.followUpTasks[index];
  const note = input.note.trim();
  if (!note) throw new Error("Task note cannot be empty.");
  const next: CrmFollowUpTask = {
    ...current,
    notes: [
      ...(current.notes ?? []),
      {
        id: `crmnote_${randomUUID()}`,
        authorId: input.authorId?.trim() || undefined,
        authorName: input.authorName?.trim() || undefined,
        note,
        createdAt: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  };
  state.followUpTasks[index] = next;
  await writeState(state);
  return next;
}

export async function summarizeCrmHealth(scope?: Scope) {
  const state = await readState();
  const allLeads = scope
    ? await listLeadKnowledgeRecords(scope)
    : [];
  const scopedTasks = state.followUpTasks.filter((task) => !scope || scopeMatches(scope, task));
  const statusPipeline = {
    new_lead: allLeads.filter((lead) => lead.crmStatus === "new_lead").length,
    interested: allLeads.filter((lead) => lead.crmStatus === "interested").length,
    needs_reply: allLeads.filter((lead) => lead.crmStatus === "needs_reply").length,
    human_review: allLeads.filter((lead) => lead.crmStatus === "human_review").length
  };
  const assigneeWorkload = scopedTasks.reduce<Record<string, number>>((totals, task) => {
    const assignee = task.assigneeName || "Unassigned";
    totals[assignee] = (totals[assignee] ?? 0) + 1;
    return totals;
  }, {});
  return {
    assignmentRules: scope ? (await listCrmAssignmentRules(scope)).length : state.assignmentRules.length,
    assignmentHistory: state.assignmentHistory.filter((entry) => !scope || scopeMatches(scope, entry)).length,
    followUpTasks: scopedTasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length,
    statusPipeline,
    assigneeWorkload
  };
}
