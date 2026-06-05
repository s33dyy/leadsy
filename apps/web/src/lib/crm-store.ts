import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";
import { listLeadKnowledgeRecords, type LeadCrmStatus } from "./lead-knowledge-store";

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

export type CrmFollowUpTask = Scope & {
  id: string;
  leadId: string;
  type: "follow_up";
  topic: string;
  description?: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  assigneeId?: string;
  assigneeName?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type QualificationProfile = Scope & {
  id: string;
  businessGoal: string;
  introBehavior: "educate_then_qualify" | "qualify_first" | "human_first";
  requiredFields: string[];
  questionOrder: string[];
  updatedAt: string;
};

type CrmState = {
  assignmentRules: CrmAssignmentRule[];
  followUpTasks: CrmFollowUpTask[];
  qualificationProfiles: QualificationProfile[];
};

function emptyState(): CrmState {
  return { assignmentRules: [], followUpTasks: [], qualificationProfiles: [] };
}

async function readState(): Promise<CrmState> {
  try {
    const raw = await readFile(crmFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<CrmState>;
    return {
      assignmentRules: Array.isArray(parsed.assignmentRules) ? parsed.assignmentRules : [],
      followUpTasks: Array.isArray(parsed.followUpTasks) ? parsed.followUpTasks : [],
      qualificationProfiles: Array.isArray(parsed.qualificationProfiles) ? parsed.qualificationProfiles : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
      return emptyState();
    }
    throw error;
  }
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

function defaultAssignmentRules(scope: Scope): CrmAssignmentRule[] {
  const now = "default";
  return [
    {
      ...scope,
      id: "default-meta-ctwa",
      title: "Meta CTWA leads",
      sourceIncludes: "Meta CTWA",
      assigneeId: "meta-sales-owner",
      assigneeName: "Meta sales owner",
      createdAt: now,
      updatedAt: now
    },
    {
      ...scope,
      id: "default-google-website",
      title: "Website and Google leads",
      sourceIncludes: "Google",
      assigneeId: "website-sales-owner",
      assigneeName: "Website sales owner",
      createdAt: now,
      updatedAt: now
    }
  ];
}

export async function listCrmAssignmentRules(scope: Scope) {
  const state = await readState();
  return [
    ...defaultAssignmentRules(scope),
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
    updatedAt: "default"
  };
}

export async function updateQualificationProfile(input: Scope & {
  businessGoal?: string;
  introBehavior?: QualificationProfile["introBehavior"];
  requiredFields?: string[];
  questionOrder?: string[];
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
  topic: string;
  description?: string;
  priority?: CrmFollowUpTask["priority"];
  assigneeId?: string;
  assigneeName?: string;
  dueAt?: string;
}) {
  const state = await readState();
  const now = new Date().toISOString();
  const task: CrmFollowUpTask = {
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    id: `crmtask_${randomUUID()}`,
    leadId: input.leadId,
    type: "follow_up",
    topic: input.topic.trim(),
    description: input.description?.trim() || undefined,
    priority: input.priority ?? "normal",
    status: "open",
    assigneeId: input.assigneeId?.trim() || undefined,
    assigneeName: input.assigneeName?.trim() || undefined,
    dueAt: input.dueAt?.trim() || undefined,
    createdAt: now,
    updatedAt: now
  };
  state.followUpTasks.push(task);
  await writeState(state);
  return task;
}

export async function listCrmFollowUpTasks(scope: Scope, options: { leadId?: string; includeClosed?: boolean } = {}) {
  const state = await readState();
  return state.followUpTasks
    .filter((task) => scopeMatches(scope, task))
    .filter((task) => !options.leadId || task.leadId === options.leadId)
    .filter((task) => options.includeClosed || (task.status !== "done" && task.status !== "cancelled"))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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
    followUpTasks: scopedTasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length,
    statusPipeline,
    assigneeWorkload
  };
}
