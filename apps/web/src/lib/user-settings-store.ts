import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { selectLeadsyAiModel, type LeadsyAiTask } from "@leadsy/ai";
import { leadsyDataDir } from "./data-dir";

const settingsFile = join(leadsyDataDir, "user-settings.json");

export type SettingsScope = {
  tenantId: string;
  ownerId: string;
};

export type OperatorKnowledgeProfile = {
  roleTitle: string;
  seniority: string;
  languages: string[];
  timezone: string;
  workingHours: string;
  communicationStyle: string;
  expertise: string[];
  markets: string[];
  servicesHandled: string[];
  escalationPreferences: string;
  restrictedClaims: string[];
  knowledgeBase: string;
};

export type WorkspaceBusinessSettings = {
  leadMode: "b2b" | "b2c";
  businessName: string;
  industry: string;
  website: string;
  markets: string[];
  services: string[];
  leadSources: string[];
  pipelineStages: string[];
  qualificationFields: string[];
  assignmentDefaults: string;
  followUpRules: string[];
  timezone: string;
  currency: string;
  calendarDefaults: string;
};

export type AiWorkspaceTask =
  | LeadsyAiTask
  | "qualification-reply"
  | "calendar-reply";

export type AiTaskRoute = {
  enabled: boolean;
  model: string;
};

export type AiWorkspaceSettings = {
  providerMode: "deterministic" | "openrouter";
  remoteAiEnabled: boolean;
  costMode: "free" | "paid" | "premium";
  monthlyBudgetInr: number;
  temperature: number;
  maxTokens: number;
  responseStyle: string;
  humanReviewThreshold: number;
  escalationKeywords: string[];
  blockedTopics: string[];
  taskRouting: Record<AiWorkspaceTask, AiTaskRoute>;
  promptTemplates: Record<AiWorkspaceTask, string>;
};

export type NotificationEventKey =
  | "newInboundLead"
  | "needsReply"
  | "assignedToMe"
  | "aiEscalation"
  | "humanReviewNeeded"
  | "taskDue"
  | "taskOverdue"
  | "calendarMeeting"
  | "deliveryFailed"
  | "aiBudgetThreshold"
  | "systemHealthWarning";

export type NotificationPreferences = {
  channels: {
    inApp: boolean;
    toast: boolean;
    badge: boolean;
    email: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  digestFrequency: "off" | "daily" | "weekly";
  priorityThreshold: "all" | "medium" | "high";
  roleRouting: "all" | "owner" | "manager";
  notifyOnlyMyLeads: boolean;
  events: Record<NotificationEventKey, boolean>;
};

export type NotificationRecord = SettingsScope & {
  id: string;
  type: NotificationEventKey;
  title: string;
  detail: string;
  href?: string;
  targetUserId?: string;
  targetMemberId?: string;
  targetRole?: "owner" | "assignee" | "manager" | "approval_queue";
  priority: "low" | "medium" | "high";
  createdAt: string;
  readAt?: string;
};

type WorkspaceSettingsState = SettingsScope & {
  profile: OperatorKnowledgeProfile;
  workspace: WorkspaceBusinessSettings;
  ai: AiWorkspaceSettings;
  notifications: NotificationPreferences;
  notificationRecords: NotificationRecord[];
};

type UserSettingsState = {
  workspaces: WorkspaceSettingsState[];
};

const aiTasks: AiWorkspaceTask[] = [
  "qualification-reply",
  "message-draft",
  "calendar-reply",
  "lead-research-planner",
  "lead-dossier",
  "onboarding-options"
];

export const notificationEventLabels: Record<NotificationEventKey, string> = {
  newInboundLead: "New inbound lead",
  needsReply: "Needs reply",
  assignedToMe: "Assigned to me",
  aiEscalation: "AI escalation",
  humanReviewNeeded: "Human review needed",
  taskDue: "Task due",
  taskOverdue: "Task overdue",
  calendarMeeting: "Calendar meeting",
  deliveryFailed: "Delivery failed",
  aiBudgetThreshold: "AI budget threshold",
  systemHealthWarning: "System health warning"
};

export function defaultOperatorProfile(): OperatorKnowledgeProfile {
  return {
    roleTitle: "Owner operator",
    seniority: "Decision maker",
    languages: ["English"],
    timezone: "Asia/Kolkata",
    workingHours: "09:00-18:00",
    communicationStyle: "Concise, helpful, and consultative",
    expertise: ["Lead qualification", "Sales handoff"],
    markets: ["India"],
    servicesHandled: ["WhatsApp follow-up", "Appointment booking"],
    escalationPreferences: "Escalate pricing, legal, refund, and angry customer messages to a human.",
    restrictedClaims: ["Do not promise discounts", "Do not confirm medical or legal advice"],
    knowledgeBase: "Add operator-specific context, product knowledge, policies, and handoff preferences here."
  };
}

export function defaultWorkspaceSettings(): WorkspaceBusinessSettings {
  return {
    leadMode: "b2c",
    businessName: "StudentKhabri",
    industry: "Education",
    website: "https://studentkhabri.com",
    markets: ["India", "Tier 2 cities", "Tier 3 cities"],
    services: ["College Admission Counseling", "Career Guidance", "Exam Prep Info"],
    leadSources: ["WhatsApp", "Instagram", "Website", "YouTube"],
    pipelineStages: ["new", "collecting", "qualified", "counseling_scheduled", "enrolled", "lost"],
    qualificationFields: ["name", "phone", "email", "budget", "course_interest", "location"],
    assignmentDefaults: "New leads go to Qualification AI until qualified. Hot leads go to senior counselors.",
    followUpRules: ["Reply within 5 minutes", "Escalate hot leads", "Create task after missed reply", "Follow up after 2 days"],
    timezone: "Asia/Kolkata",
    currency: "INR",
    calendarDefaults: "Offer 30 minute counseling sessions during working hours."
  };
}

export function defaultAiSettings(): AiWorkspaceSettings {
  return {
    providerMode: "openrouter",
    remoteAiEnabled: true,
    costMode: "free",
    monthlyBudgetInr: 0,
    temperature: 0.2,
    maxTokens: 600,
    responseStyle: "Short, direct, and sales-assistive",
    humanReviewThreshold: 0.75,
    escalationKeywords: ["human", "manager", "refund", "legal", "stop"],
    blockedTopics: ["medical advice", "legal promises", "guaranteed discounts"],
    taskRouting: Object.fromEntries(aiTasks.map((task) => [task, { enabled: true, model: "google/gemini-2.5-flash" }])) as Record<AiWorkspaceTask, AiTaskRoute>,
    promptTemplates: {
      "qualification-reply": "Ask exactly one concise question that helps qualify the lead.",
      "message-draft": "Draft a helpful WhatsApp reply for human review.",
      "calendar-reply": "Offer only slots returned by the Leadsy calendar tool.",
      "lead-research-planner": "Plan low-cost research steps before any expensive model use.",
      "lead-dossier": "Summarize evidence-backed facts and next actions.",
      "onboarding-options": "Generate answer options, not questions, for onboarding chips."
    }
  };
}

export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    channels: { inApp: true, toast: true, badge: true, email: false },
    quietHours: { enabled: false, start: "21:00", end: "09:00", timezone: "Asia/Kolkata" },
    digestFrequency: "daily",
    priorityThreshold: "all",
    roleRouting: "all",
    notifyOnlyMyLeads: false,
    events: {
      newInboundLead: true,
      needsReply: true,
      assignedToMe: true,
      aiEscalation: true,
      humanReviewNeeded: true,
      taskDue: true,
      taskOverdue: true,
      calendarMeeting: true,
      deliveryFailed: true,
      aiBudgetThreshold: true,
      systemHealthWarning: true
    }
  };
}

function emptyState(): UserSettingsState {
  return { workspaces: [] };
}

function scopeKey(scope: SettingsScope) {
  return `${scope.tenantId}:${scope.ownerId}`;
}

function uniqueStrings(values: unknown, fallback: string[] = []) {
  if (!Array.isArray(values)) return fallback;
  return [...new Set(values.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function leadMode(value: unknown, fallback: WorkspaceBusinessSettings["leadMode"] = "b2b") {
  return value === "b2c" || value === "b2b" ? value : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeProfile(value?: Partial<OperatorKnowledgeProfile>): OperatorKnowledgeProfile {
  const defaults = defaultOperatorProfile();
  return {
    roleTitle: text(value?.roleTitle, defaults.roleTitle),
    seniority: text(value?.seniority, defaults.seniority),
    languages: uniqueStrings(value?.languages, defaults.languages),
    timezone: text(value?.timezone, defaults.timezone),
    workingHours: text(value?.workingHours, defaults.workingHours),
    communicationStyle: text(value?.communicationStyle, defaults.communicationStyle),
    expertise: uniqueStrings(value?.expertise, defaults.expertise),
    markets: uniqueStrings(value?.markets, defaults.markets),
    servicesHandled: uniqueStrings(value?.servicesHandled, defaults.servicesHandled),
    escalationPreferences: text(value?.escalationPreferences, defaults.escalationPreferences),
    restrictedClaims: uniqueStrings(value?.restrictedClaims, defaults.restrictedClaims),
    knowledgeBase: text(value?.knowledgeBase, defaults.knowledgeBase)
  };
}

function normalizeWorkspace(value?: Partial<WorkspaceBusinessSettings>): WorkspaceBusinessSettings {
  const defaults = defaultWorkspaceSettings();
  const mode = leadMode(value?.leadMode, defaults.leadMode);
  const defaultQualificationFields = mode === "b2c"
    ? ["name", "phone", "email", "budget"]
    : defaults.qualificationFields;
  return {
    leadMode: mode,
    businessName: text(value?.businessName, defaults.businessName),
    industry: text(value?.industry, defaults.industry),
    website: text(value?.website, defaults.website),
    markets: uniqueStrings(value?.markets, defaults.markets),
    services: uniqueStrings(value?.services, defaults.services),
    leadSources: uniqueStrings(value?.leadSources, defaults.leadSources),
    pipelineStages: uniqueStrings(value?.pipelineStages, defaults.pipelineStages),
    qualificationFields: uniqueStrings(value?.qualificationFields, defaultQualificationFields),
    assignmentDefaults: text(value?.assignmentDefaults, defaults.assignmentDefaults),
    followUpRules: uniqueStrings(value?.followUpRules, defaults.followUpRules),
    timezone: text(value?.timezone, defaults.timezone),
    currency: text(value?.currency, defaults.currency),
    calendarDefaults: text(value?.calendarDefaults, defaults.calendarDefaults)
  };
}

function normalizeAi(value?: Partial<AiWorkspaceSettings>): AiWorkspaceSettings {
  const defaults = defaultAiSettings();
  const taskRouting = { ...defaults.taskRouting };
  const incomingRoutes: Partial<Record<AiWorkspaceTask, Partial<AiTaskRoute>>> =
    value?.taskRouting && typeof value.taskRouting === "object" ? value.taskRouting : {};
  for (const task of aiTasks) {
    const incoming = incomingRoutes[task];
    taskRouting[task] = {
      enabled: bool(incoming?.enabled, taskRouting[task].enabled),
      model: text(incoming?.model, taskRouting[task].model)
    };
  }
  const promptTemplates = { ...defaults.promptTemplates };
  const incomingTemplates: Partial<Record<AiWorkspaceTask, string>> =
    value?.promptTemplates && typeof value.promptTemplates === "object" ? value.promptTemplates : {};
  for (const task of aiTasks) promptTemplates[task] = text(incomingTemplates[task], promptTemplates[task]);
  return {
    providerMode: value?.providerMode === "openrouter" ? "openrouter" : value?.providerMode === "deterministic" ? "deterministic" : defaults.providerMode,
    remoteAiEnabled: bool(value?.remoteAiEnabled, defaults.remoteAiEnabled),
    costMode: value?.costMode === "premium" || value?.costMode === "paid" || value?.costMode === "free" ? value.costMode : defaults.costMode,
    monthlyBudgetInr: finiteNumber(value?.monthlyBudgetInr, defaults.monthlyBudgetInr, 0, 10_000_000),
    temperature: finiteNumber(value?.temperature, defaults.temperature, 0, 2),
    maxTokens: Math.round(finiteNumber(value?.maxTokens, defaults.maxTokens, 64, 8000)),
    responseStyle: text(value?.responseStyle, defaults.responseStyle),
    humanReviewThreshold: finiteNumber(value?.humanReviewThreshold, defaults.humanReviewThreshold, 0, 1),
    escalationKeywords: uniqueStrings(value?.escalationKeywords, defaults.escalationKeywords),
    blockedTopics: uniqueStrings(value?.blockedTopics, defaults.blockedTopics),
    taskRouting,
    promptTemplates
  };
}

function normalizeNotifications(value?: Partial<NotificationPreferences>): NotificationPreferences {
  const defaults = defaultNotificationPreferences();
  const incomingEvents: Partial<Record<NotificationEventKey, boolean>> =
    value?.events && typeof value.events === "object" ? value.events : {};
  const events = { ...defaults.events };
  for (const key of Object.keys(defaults.events) as NotificationEventKey[]) {
    events[key] = bool(incomingEvents[key], events[key]);
  }
  return {
    channels: {
      inApp: bool(value?.channels?.inApp, defaults.channels.inApp),
      toast: bool(value?.channels?.toast, defaults.channels.toast),
      badge: bool(value?.channels?.badge, defaults.channels.badge),
      email: bool(value?.channels?.email, defaults.channels.email)
    },
    quietHours: {
      enabled: bool(value?.quietHours?.enabled, defaults.quietHours.enabled),
      start: text(value?.quietHours?.start, defaults.quietHours.start),
      end: text(value?.quietHours?.end, defaults.quietHours.end),
      timezone: text(value?.quietHours?.timezone, defaults.quietHours.timezone)
    },
    digestFrequency: value?.digestFrequency === "off" || value?.digestFrequency === "weekly" || value?.digestFrequency === "daily" ? value.digestFrequency : defaults.digestFrequency,
    priorityThreshold: value?.priorityThreshold === "medium" || value?.priorityThreshold === "high" || value?.priorityThreshold === "all" ? value.priorityThreshold : defaults.priorityThreshold,
    roleRouting: value?.roleRouting === "owner" || value?.roleRouting === "manager" || value?.roleRouting === "all" ? value.roleRouting : defaults.roleRouting,
    notifyOnlyMyLeads: bool(value?.notifyOnlyMyLeads, defaults.notifyOnlyMyLeads),
    events
  };
}

function normalizeWorkspaceState(scope: SettingsScope, value?: Partial<WorkspaceSettingsState>): WorkspaceSettingsState {
  return {
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    profile: normalizeProfile(value?.profile),
    workspace: normalizeWorkspace(value?.workspace),
    ai: normalizeAi(value?.ai),
    notifications: normalizeNotifications(value?.notifications),
    notificationRecords: Array.isArray(value?.notificationRecords) ? value.notificationRecords : []
  };
}

async function readState(): Promise<UserSettingsState> {
  try {
    const raw = await readFile(settingsFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<UserSettingsState>;
    return { workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return emptyState();
    throw error;
  }
}

async function writeState(state: UserSettingsState) {
  await mkdir(dirname(settingsFile), { recursive: true });
  const tempFile = `${settingsFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, settingsFile);
}

let settingsMutationQueue = Promise.resolve();

async function mutateState<T>(updater: (state: UserSettingsState) => { result: T; state?: UserSettingsState } | Promise<{ result: T; state?: UserSettingsState }>) {
  const operation = settingsMutationQueue.then(async () => {
    const state = await readState();
    const next = await updater(state);
    if (next.state) await writeState(next.state);
    return next.result;
  });
  settingsMutationQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

function getWorkspace(state: UserSettingsState, scope: SettingsScope) {
  const existing = state.workspaces.find((workspace) => scopeKey(workspace) === scopeKey(scope));
  return normalizeWorkspaceState(scope, existing);
}

function replaceWorkspace(state: UserSettingsState, workspace: WorkspaceSettingsState): UserSettingsState {
  const key = scopeKey(workspace);
  const others = state.workspaces.filter((candidate) => scopeKey(candidate) !== key);
  return { workspaces: [...others, workspace] };
}

export async function getOperatorProfileSettings(scope: SettingsScope) {
  return getWorkspace(await readState(), scope).profile;
}

export async function updateOperatorProfileSettings(input: SettingsScope & Partial<OperatorKnowledgeProfile>) {
  return mutateState((state) => {
    const workspace = getWorkspace(state, input);
    const next = { ...workspace, profile: normalizeProfile({ ...workspace.profile, ...input }) };
    return { state: replaceWorkspace(state, next), result: next.profile };
  });
}

export async function getWorkspaceBusinessSettings(scope: SettingsScope) {
  return getWorkspace(await readState(), scope).workspace;
}

export async function updateWorkspaceBusinessSettings(input: SettingsScope & Partial<WorkspaceBusinessSettings>) {
  return mutateState((state) => {
    const workspace = getWorkspace(state, input);
    const next = { ...workspace, workspace: normalizeWorkspace({ ...workspace.workspace, ...input }) };
    return { state: replaceWorkspace(state, next), result: next.workspace };
  });
}

export async function getAiWorkspaceSettings(scope: SettingsScope) {
  return getWorkspace(await readState(), scope).ai;
}

export async function updateAiWorkspaceSettings(input: SettingsScope & Partial<AiWorkspaceSettings>) {
  return mutateState((state) => {
    const workspace = getWorkspace(state, input);
    const next = { ...workspace, ai: normalizeAi({ ...workspace.ai, ...input }) };
    return { state: replaceWorkspace(state, next), result: next.ai };
  });
}

export async function runAiSettingsTest(input: SettingsScope & { task: AiWorkspaceTask; prompt: string }) {
  const settings = await getAiWorkspaceSettings(input);
  const task = aiTasks.includes(input.task) ? input.task : "message-draft";
  const route = settings.taskRouting[task];
  const env = {
    ...process.env,
    AI_PROVIDER: settings.providerMode,
    LEADSY_ENABLE_REMOTE_AI: settings.remoteAiEnabled ? "true" : "",
    LEADSY_ALLOW_PAID_AI_MODELS: settings.costMode === "paid" || settings.costMode === "premium" ? "true" : "",
    LEADSY_ALLOW_EXPENSIVE_AI_MODELS: settings.costMode === "premium" ? "true" : "",
    LEADSY_ROUTINE_MODEL: route?.model,
    LEADSY_PLANNER_MODEL: task === "lead-research-planner" ? route?.model : undefined,
    LEADSY_DOSSIER_MODEL: task === "lead-dossier" ? route?.model : undefined
  };
  const selection = selectLeadsyAiModel(task === "qualification-reply" || task === "calendar-reply" ? "message-draft" : task, env);
  return {
    task,
    provider: selection.provider,
    model: selection.model ?? "deterministic",
    costTier: selection.costTier,
    reason: selection.reason,
    output: `[${task}] ${settings.promptTemplates[task]} Sample input: ${input.prompt.trim() || "No sample prompt provided."}`
  };
}

export async function getNotificationPreferences(scope: SettingsScope) {
  return getWorkspace(await readState(), scope).notifications;
}

export async function updateNotificationPreferences(input: SettingsScope & Partial<NotificationPreferences>) {
  return mutateState((state) => {
    const workspace = getWorkspace(state, input);
    const next = { ...workspace, notifications: normalizeNotifications({ ...workspace.notifications, ...input }) };
    return { state: replaceWorkspace(state, next), result: next.notifications };
  });
}

export async function listNotificationRecords(scope: SettingsScope) {
  const workspace = getWorkspace(await readState(), scope);
  return workspace.notificationRecords
    .filter((record) => record.tenantId === scope.tenantId && record.ownerId === scope.ownerId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createNotificationRecord(input: SettingsScope & {
  type: NotificationEventKey;
  title: string;
  detail: string;
  href?: string;
  targetUserId?: string;
  targetMemberId?: string;
  targetRole?: NotificationRecord["targetRole"];
  priority?: "low" | "medium" | "high";
}) {
  return mutateState((state) => {
    const workspace = getWorkspace(state, input);
    const now = new Date().toISOString();
    const record: NotificationRecord = {
      id: `notif_${crypto.randomUUID().slice(0, 16)}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      type: input.type,
      title: input.title.trim(),
      detail: input.detail.trim(),
      href: input.href,
      targetUserId: input.targetUserId?.trim() || undefined,
      targetMemberId: input.targetMemberId?.trim() || undefined,
      targetRole: input.targetRole,
      priority: input.priority ?? "medium",
      createdAt: now
    };
    const next = { ...workspace, notificationRecords: [record, ...workspace.notificationRecords].slice(0, 100) };
    return { state: replaceWorkspace(state, next), result: record };
  });
}

export async function markNotificationRead(input: SettingsScope & { notificationId: string }) {
  return mutateState((state) => {
    const workspace = getWorkspace(state, input);
    const existing = workspace.notificationRecords.find((record) => record.id === input.notificationId);
    if (!existing) return { result: null };
    const readAt = new Date().toISOString();
    const updated = { ...existing, readAt };
    const next = {
      ...workspace,
      notificationRecords: workspace.notificationRecords.map((record) => (record.id === input.notificationId ? updated : record))
    };
    return { state: replaceWorkspace(state, next), result: updated };
  });
}

export async function markAllNotificationsRead(scope: SettingsScope) {
  return mutateState((state) => {
    const workspace = getWorkspace(state, scope);
    const readAt = new Date().toISOString();
    const next = {
      ...workspace,
      notificationRecords: workspace.notificationRecords.map((record) => ({ ...record, readAt: record.readAt ?? readAt }))
    };
    return { state: replaceWorkspace(state, next), result: next.notificationRecords };
  });
}
