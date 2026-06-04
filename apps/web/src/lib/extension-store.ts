import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";
import { appendManualLeadMessage } from "./lead-knowledge-store";

const extensionFile = join(leadsyDataDir, "extension.json");
const tokenTtlMs = 1000 * 60 * 60 * 24 * 365;

export type ExtensionTokenRecord = {
  id: string;
  tenantId: string;
  ownerId: string;
  label: string;
  tokenHash: string;
  tokenPreview: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type ExtensionPlatform =
  | "whatsapp-web"
  | "instagram-web"
  | "facebook-web"
  | "generic-web-chat";

export type ExtensionConversationContact = {
  displayName?: string;
  phone?: string;
  email?: string;
  handle?: string;
  profileUrl?: string;
};

export type ExtensionMessageDirection = "inbound" | "outbound" | "system";
export type ExtensionMessageGeneratedBy = "leadsy" | "fallback" | "human";
export type ExtensionCaptureSource = "official-webhook" | "browser-extension";

export type ExtensionConversationMessage = {
  id: string;
  externalId: string;
  direction: ExtensionMessageDirection;
  body: string;
  sentAt: string;
  generatedBy?: ExtensionMessageGeneratedBy;
};

export type ExtensionConversationEvent = {
  id: string;
  type:
    | "detected"
    | "inbound-synced"
    | "reply-generated"
    | "reply-sent"
    | "reply-paused"
    | "fallback-used"
    | "error"
    | "monitor_started"
    | "monitor_synced"
    | "monitor_stale"
    | "monitor_blocked"
    | "monitor_error";
  summary: string;
  occurredAt: string;
};

export type ExtensionTaskEventType =
  | "batch_run_started"
  | "batch_run_finished"
  | "worker_opened"
  | "worker_prepared"
  | "send_approved"
  | "send_rejected"
  | "worker_sent"
  | "worker_postponed"
  | "worker_blocked"
  | "worker_failed"
  | "task_edited"
  | "task_deleted"
  | "monitoring_event"
  | "inbound_issue"
  | "monitor_started"
  | "monitor_synced"
  | "monitor_stale"
  | "monitor_blocked"
  | "monitor_error";

export type ExtensionTaskEvent = {
  id: string;
  tenantId: string;
  ownerId: string;
  taskId: string;
  type: ExtensionTaskEventType;
  summary: string;
  reason?: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
};

export type ExtensionTaskType =
  | "initiate_conversation"
  | "follow_up"
  | "reply_to_inbound"
  | "manual_review"
  | "report_update";

export type ExtensionTaskStatus =
  | "queued"
  | "in_progress"
  | "awaiting_send_approval"
  | "sent"
  | "monitoring"
  | "postponed"
  | "blocked"
  | "failed"
  | "cancelled"
  | "draft"
  | "awaiting_approval"
  | "approved";

export type ExtensionTaskPriority = "low" | "normal" | "high" | "urgent";

export type ExtensionTask = {
  id: string;
  tenantId: string;
  ownerId: string;
  type: ExtensionTaskType;
  status: ExtensionTaskStatus;
  priority: ExtensionTaskPriority;
  leadId?: string;
  conversationId?: string;
  platform: ExtensionPlatform;
  targetUrl?: string;
  contact: ExtensionConversationContact;
  draftMessage: string;
  contextSummary: string;
  resultSummary?: string;
  approvedAt?: string;
  preparedAt?: string;
  sendApprovedAt?: string;
  sendRejectedAt?: string;
  claimedAt?: string;
  completedAt?: string;
  postponedUntil?: string;
  postponedReason?: string;
  runBatchId?: string;
  runMode?: "manual" | "selected_batch";
  deletedAt?: string;
  blockedReason?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtensionConversationInsight = {
  summary: string;
  qualification?: string;
  nextAction?: string;
  sentiment?: "positive" | "neutral" | "hesitant" | "negative";
};

export type ExtensionConversation = {
  id: string;
  tenantId: string;
  ownerId: string;
  platform: ExtensionPlatform;
  sourceUrl: string;
  chatFingerprint: string;
  contact: ExtensionConversationContact;
  leadId?: string;
  leadSource?: "lead-magnet" | "manual-import" | "unknown";
  status: "active" | "paused" | "needs-human" | "closed";
  messageCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  summary?: string;
  qualification?: string;
  nextAction?: string;
  sentiment?: ExtensionConversationInsight["sentiment"];
  captureSource?: ExtensionCaptureSource;
  captureConfidence?: number;
  tabUrl?: string;
  observedAt?: string;
  profileId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtensionChannelMonitorHealth = {
  platform: ExtensionPlatform;
  status: "active" | "idle" | "stale" | "blocked" | "error";
  conversationCount: number;
  captureSource?: ExtensionCaptureSource;
  captureConfidence?: number;
  tabUrl?: string;
  profileId?: string;
  lastSyncedAt?: string;
  lastEventType?: ExtensionConversationEvent["type"];
  lastError?: string;
};

export type ExtensionConversationBundle = {
  conversation: ExtensionConversation;
  messages: ExtensionConversationMessage[];
  events: ExtensionConversationEvent[];
};

export type SyncExtensionConversationInput = {
  tenantId: string;
  ownerId: string;
  platform: ExtensionPlatform;
  sourceUrl: string;
  chatFingerprint: string;
  captureSource?: ExtensionCaptureSource;
  captureConfidence?: number;
  tabUrl?: string;
  observedAt?: string;
  profileId?: string;
  contact?: ExtensionConversationContact;
  leadId?: string;
  leadSource?: ExtensionConversation["leadSource"];
  status?: ExtensionConversation["status"];
  messages?: Array<{
    externalId: string;
    direction: ExtensionMessageDirection;
    body: string;
    sentAt: string;
    generatedBy?: ExtensionMessageGeneratedBy;
  }>;
  events?: Array<{
    type: ExtensionConversationEvent["type"];
    summary: string;
    occurredAt: string;
  }>;
  insight?: ExtensionConversationInsight;
};

type ExtensionState = {
  tokens: ExtensionTokenRecord[];
  conversations: ExtensionConversation[];
  messages: ExtensionConversationMessage[];
  events: ExtensionConversationEvent[];
  tasks: ExtensionTask[];
  taskEvents: ExtensionTaskEvent[];
};

function emptyState(): ExtensionState {
  return {
    tokens: [],
    conversations: [],
    messages: [],
    events: [],
    tasks: [],
    taskEvents: []
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function readState(): Promise<ExtensionState> {
  try {
    const raw = await readFile(extensionFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ExtensionState>;
    return {
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      taskEvents: Array.isArray(parsed.taskEvents) ? parsed.taskEvents : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
      return emptyState();
    }
    throw error;
  }
}

async function writeState(state: ExtensionState) {
  await mkdir(dirname(extensionFile), { recursive: true });
  const tempFile = `${extensionFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, extensionFile);
}

function scopeKey(tenantId: string, ownerId: string) {
  return `${tenantId}:${ownerId}`;
}

function conversationKey(input: Pick<ExtensionConversation, "tenantId" | "ownerId" | "platform" | "chatFingerprint">) {
  return `${scopeKey(input.tenantId, input.ownerId)}:${input.platform}:${input.chatFingerprint}`;
}

function taskIdentity(input: {
  tenantId: string;
  ownerId: string;
  type: ExtensionTaskType;
  platform: ExtensionPlatform;
  leadId?: string;
  conversationId?: string;
  contact?: ExtensionConversationContact;
}) {
  const contactKey =
    input.contact?.phone ||
    input.contact?.email ||
    input.contact?.handle ||
    input.contact?.profileUrl ||
    input.contact?.displayName ||
    "unknown-contact";
  return [
    scopeKey(input.tenantId, input.ownerId),
    input.type,
    input.platform,
    input.leadId || input.conversationId || contactKey
  ].join(":");
}

function taskIsTerminal(status: ExtensionTaskStatus) {
  return status === "sent" || status === "blocked" || status === "failed" || status === "cancelled";
}

function taskCanBeClaimed(status: ExtensionTaskStatus) {
  return status === "queued" || status === "in_progress" || status === "approved" || status === "postponed";
}

function cleanPreview(body: string) {
  return body.trim().replace(/\s+/g, " ").slice(0, 180);
}

function tokenFromBearer(authorization: string) {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function createExtensionToken(input: {
  tenantId: string;
  ownerId: string;
  label?: string;
}) {
  const state = await readState();
  const secret = randomBytes(32).toString("base64url");
  const token = `lext_${secret}`;
  const now = new Date();
  const record: ExtensionTokenRecord = {
    id: `exttok_${crypto.randomUUID()}`,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    label: input.label?.trim() || "Leadsy browser extension",
    tokenHash: sha256(token),
    tokenPreview: `...${token.slice(-4)}`,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + tokenTtlMs).toISOString()
  };

  state.tokens = [record, ...state.tokens].slice(0, 20);
  await writeState(state);
  return { token, record };
}

export async function resolveExtensionBearerToken(authorization: string) {
  const token = tokenFromBearer(authorization);
  if (!token) return null;

  const state = await readState();
  const tokenHash = sha256(token);
  const now = Date.now();
  const record = state.tokens.find(
    (candidate) =>
      !candidate.revokedAt &&
      Date.parse(candidate.expiresAt) > now &&
      safeEqual(candidate.tokenHash, tokenHash)
  );
  if (!record) return null;

  record.lastUsedAt = new Date().toISOString();
  await writeState(state);
  return {
    tenantId: record.tenantId,
    ownerId: record.ownerId,
    tokenId: record.id,
    label: record.label
  };
}

export async function listExtensionTokens(tenantId: string, ownerId: string) {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  return state.tokens
    .filter((token) => scopeKey(token.tenantId, token.ownerId) === scoped && !token.revokedAt)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((token) => ({
      id: token.id,
      tenantId: token.tenantId,
      ownerId: token.ownerId,
      label: token.label,
      tokenPreview: token.tokenPreview,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      revokedAt: token.revokedAt
    }));
}

export async function deleteExtensionToken(input: {
  tenantId: string;
  ownerId: string;
  tokenId: string;
}) {
  const state = await readState();
  const token = state.tokens.find(
    (candidate) =>
      candidate.id === input.tokenId &&
      scopeKey(candidate.tenantId, candidate.ownerId) === scopeKey(input.tenantId, input.ownerId) &&
      !candidate.revokedAt
  );
  if (!token) return null;

  token.revokedAt = new Date().toISOString();
  await writeState(state);
  return {
    id: token.id,
    tenantId: token.tenantId,
    ownerId: token.ownerId,
    label: token.label,
    tokenPreview: token.tokenPreview,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
    revokedAt: token.revokedAt
  };
}

export async function createExtensionTask(input: {
  tenantId: string;
  ownerId: string;
  type: ExtensionTaskType;
  status?: ExtensionTaskStatus;
  priority?: ExtensionTaskPriority;
  leadId?: string;
  conversationId?: string;
  platform: ExtensionPlatform;
  targetUrl?: string;
  contact?: ExtensionConversationContact;
  draftMessage: string;
  contextSummary: string;
  dueAt?: string;
}): Promise<ExtensionTask> {
  const state = await readState();
  const now = new Date().toISOString();
  const identity = taskIdentity(input);
  const existingIndex = state.tasks.findIndex((task) => taskIdentity(task) === identity && !task.deletedAt && !taskIsTerminal(task.status));
  const existing = existingIndex >= 0 ? state.tasks[existingIndex] : null;
  const nextTask: ExtensionTask = {
    id: existing?.id ?? `exttask_${crypto.randomUUID()}`,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    type: input.type,
    status: input.status ?? existing?.status ?? "queued",
    priority: input.priority ?? existing?.priority ?? "normal",
    leadId: input.leadId ?? existing?.leadId,
    conversationId: input.conversationId ?? existing?.conversationId,
    platform: input.platform,
    targetUrl: input.targetUrl ?? existing?.targetUrl,
    contact: { ...(existing?.contact ?? {}), ...(input.contact ?? {}) },
    draftMessage: input.draftMessage,
    contextSummary: input.contextSummary,
    resultSummary: existing?.resultSummary,
    approvedAt: existing?.approvedAt,
    preparedAt: existing?.preparedAt,
    sendApprovedAt: existing?.sendApprovedAt,
    sendRejectedAt: existing?.sendRejectedAt,
    claimedAt: existing?.claimedAt,
    completedAt: existing?.completedAt,
    postponedUntil: existing?.postponedUntil,
    postponedReason: existing?.postponedReason,
    runBatchId: existing?.runBatchId,
    runMode: existing?.runMode,
    deletedAt: existing?.deletedAt,
    blockedReason: existing?.blockedReason,
    dueAt: input.dueAt ?? existing?.dueAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    state.tasks[existingIndex] = nextTask;
  } else {
    state.tasks.push(nextTask);
  }
  await writeState(state);
  return nextTask;
}

export async function listExtensionTasks(tenantId: string, ownerId: string, options: { statuses?: ExtensionTaskStatus[]; includeDeleted?: boolean } = {}) {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  const statusSet = options.statuses ? new Set(options.statuses) : null;
  return state.tasks
    .filter((task) => scopeKey(task.tenantId, task.ownerId) === scoped)
    .filter((task) => options.includeDeleted || !task.deletedAt)
    .filter((task) => !statusSet || statusSet.has(task.status))
    .sort((left, right) => {
      const priorityRank: Record<ExtensionTaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityRank[left.priority] - priorityRank[right.priority] || right.updatedAt.localeCompare(left.updatedAt);
    });
}

async function updateTask(
  tenantId: string,
  ownerId: string,
  taskId: string,
  updater: (task: ExtensionTask, state: ExtensionState) => ExtensionTask
) {
  const state = await readState();
  const index = state.tasks.findIndex((task) => task.id === taskId && task.tenantId === tenantId && task.ownerId === ownerId);
  if (index < 0) {
    throw new Error("Extension task was not found.");
  }
  const nextTask = updater(state.tasks[index], state);
  state.tasks[index] = nextTask;
  await writeState(state);
  return nextTask;
}

export async function approveExtensionTask(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
  draftMessage?: string;
}) {
  return updateTask(input.tenantId, input.ownerId, input.taskId, (task) => ({
    ...task,
    status: "approved",
    draftMessage: input.draftMessage?.trim() || task.draftMessage,
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

export async function editExtensionTask(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
  draftMessage?: string;
  contextSummary?: string;
  targetUrl?: string;
  leadId?: string;
  conversationId?: string;
  priority?: ExtensionTaskPriority;
  dueAt?: string;
  contact?: ExtensionConversationContact;
}) {
  return updateTask(input.tenantId, input.ownerId, input.taskId, (task, state) => {
    const now = new Date().toISOString();
    const nextTask = {
      ...task,
      draftMessage: input.draftMessage?.trim() || task.draftMessage,
      contextSummary: input.contextSummary?.trim() || task.contextSummary,
      targetUrl: input.targetUrl?.trim() || task.targetUrl,
      leadId: input.leadId?.trim() || task.leadId,
      conversationId: input.conversationId?.trim() || task.conversationId,
      priority: input.priority ?? task.priority,
      dueAt: input.dueAt?.trim() || task.dueAt,
      contact: { ...task.contact, ...(input.contact ?? {}) },
      updatedAt: now
    };
    state.taskEvents.push({
      id: `taskevt_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      taskId: input.taskId,
      type: "task_edited",
      summary: "Task details were edited in Leadsy.",
      occurredAt: now
    });
    state.taskEvents = state.taskEvents.slice(-1000);
    return nextTask;
  });
}

export async function claimExtensionTask(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
  runBatchId?: string;
  runMode?: ExtensionTask["runMode"];
}) {
  return updateTask(input.tenantId, input.ownerId, input.taskId, (task) => {
    if (!taskCanBeClaimed(task.status)) {
      throw new Error("Only queued tasks can be claimed by the worker.");
    }
    const now = new Date().toISOString();
    return {
      ...task,
      status: "in_progress",
      claimedAt: task.claimedAt ?? now,
      runBatchId: input.runBatchId ?? task.runBatchId,
      runMode: input.runMode ?? task.runMode,
      updatedAt: now
    };
  });
}

export async function prepareExtensionTask(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
  draftMessage?: string;
}) {
  return updateTask(input.tenantId, input.ownerId, input.taskId, (task, state) => {
    if (task.status !== "in_progress" && task.status !== "awaiting_send_approval") {
      throw new Error("Only in-progress worker tasks can be prepared for send approval.");
    }
    const now = new Date().toISOString();
    const nextTask = {
      ...task,
      status: "awaiting_send_approval" as const,
      draftMessage: input.draftMessage?.trim() || task.draftMessage,
      preparedAt: now,
      updatedAt: now
    };
    state.taskEvents.push({
      id: `taskevt_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      taskId: input.taskId,
      type: "worker_prepared",
      summary: "Worker prepared the outbound message and is waiting for send approval.",
      occurredAt: now
    });
    state.taskEvents = state.taskEvents.slice(-1000);
    return nextTask;
  });
}

export async function approveExtensionTaskSend(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
}) {
  return updateTask(input.tenantId, input.ownerId, input.taskId, (task, state) => {
    if (task.status !== "awaiting_send_approval") {
      throw new Error("Only prepared tasks can receive send approval.");
    }
    const now = new Date().toISOString();
    state.taskEvents.push({
      id: `taskevt_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      taskId: input.taskId,
      type: "send_approved",
      summary: "Owner approved the prepared outbound message.",
      occurredAt: now
    });
    state.taskEvents = state.taskEvents.slice(-1000);
    return {
      ...task,
      status: "in_progress",
      sendApprovedAt: now,
      updatedAt: now
    };
  });
}

export async function rejectExtensionTaskSend(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
  resultSummary?: string;
}) {
  return updateTask(input.tenantId, input.ownerId, input.taskId, (task, state) => {
    if (task.status !== "awaiting_send_approval") {
      throw new Error("Only prepared tasks can have send approval rejected.");
    }
    const now = new Date().toISOString();
    state.taskEvents.push({
      id: `taskevt_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      taskId: input.taskId,
      type: "send_rejected",
      reason: "send_rejected",
      summary: input.resultSummary || "Owner rejected the prepared outbound message.",
      occurredAt: now
    });
    state.taskEvents = state.taskEvents.slice(-1000);
    return {
      ...task,
      status: "blocked",
      resultSummary: input.resultSummary || "Owner rejected the prepared outbound message.",
      blockedReason: "send_rejected",
      sendRejectedAt: now,
      completedAt: now,
      updatedAt: now
    };
  });
}

export async function completeExtensionTask(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
  status: Extract<ExtensionTaskStatus, "sent" | "postponed" | "blocked" | "failed" | "monitoring">;
  resultSummary: string;
  reason?: string;
  postponedUntil?: string;
  outboundMessage?: {
    externalId: string;
    body: string;
    sentAt: string;
  };
}) {
  const completedTask = await updateTask(input.tenantId, input.ownerId, input.taskId, (task, state) => {
    const completedAt = input.outboundMessage?.sentAt ?? new Date().toISOString();
    if (input.outboundMessage && task.conversationId) {
      const current = state.messages.find(
        (message) => message.id.startsWith(`${task.conversationId}:`) && message.externalId === input.outboundMessage?.externalId
      );
      if (!current) {
        state.messages.push({
          id: `${task.conversationId}:msg_${crypto.randomUUID()}`,
          externalId: input.outboundMessage.externalId,
          direction: "outbound",
          body: input.outboundMessage.body,
          sentAt: input.outboundMessage.sentAt,
          generatedBy: "leadsy"
        });
      }
      state.events.push({
        id: `${task.conversationId}:evt_${crypto.randomUUID()}`,
        type: input.status === "sent" ? "reply-sent" : "error",
        summary: input.resultSummary,
        occurredAt: completedAt
      });
    }
    state.taskEvents.push({
      id: `taskevt_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      taskId: input.taskId,
      type:
        input.status === "sent" || input.status === "monitoring"
          ? "worker_sent"
          : input.status === "postponed"
          ? "worker_postponed"
          : input.status === "blocked"
          ? "worker_blocked"
          : "worker_failed",
      reason: input.reason,
      summary: input.resultSummary,
      occurredAt: completedAt
    });
    state.taskEvents = state.taskEvents.slice(-1000);
    return {
      ...task,
      status: input.status,
      resultSummary: input.resultSummary,
      postponedUntil: input.status === "postponed" ? input.postponedUntil : task.postponedUntil,
      postponedReason: input.status === "postponed" ? input.reason ?? task.postponedReason : task.postponedReason,
      blockedReason: input.status === "blocked" || input.status === "failed" ? input.reason ?? task.blockedReason : task.blockedReason,
      completedAt,
      updatedAt: completedAt
    };
  });
  if ((input.status === "postponed" || input.status === "blocked" || input.status === "failed") && taskLeadNoteShouldBeLogged(input.reason)) {
    if (completedTask.leadId) {
      await appendManualLeadMessage({
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        leadId: completedTask.leadId,
        direction: "note",
        channel: "manual",
        body: input.status === "postponed" && input.postponedUntil
          ? `${input.resultSummary} Postponed until ${input.postponedUntil}.`
          : input.resultSummary,
        occurredAt: new Date().toISOString()
      }).catch(() => undefined);
    }
  }
  return completedTask;
}

function taskLeadNoteShouldBeLogged(reason?: string) {
  return reason === "target_not_on_whatsapp" || reason === "composer_missing" || reason === "target_url_missing";
}

export async function logExtensionTaskEvent(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
  type: ExtensionTaskEventType;
  summary: string;
  reason?: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}) {
  const state = await readState();
  const task = state.tasks.find((candidate) => candidate.id === input.taskId && candidate.tenantId === input.tenantId && candidate.ownerId === input.ownerId);
  if (!task) {
    throw new Error("Extension task was not found.");
  }
  const event: ExtensionTaskEvent = {
    id: `taskevt_${crypto.randomUUID()}`,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    taskId: input.taskId,
    type: input.type,
    summary: input.summary,
    reason: input.reason,
    payload: input.payload,
    occurredAt: input.occurredAt ?? new Date().toISOString()
  };
  state.taskEvents = [...state.taskEvents, event].slice(-1000);
  await writeState(state);
  return event;
}

export async function listExtensionTaskEvents(tenantId: string, ownerId: string, taskId?: string) {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  return state.taskEvents
    .filter((event) => scopeKey(event.tenantId, event.ownerId) === scoped)
    .filter((event) => !taskId || event.taskId === taskId)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export async function cancelExtensionTask(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
  resultSummary?: string;
}) {
  return updateTask(input.tenantId, input.ownerId, input.taskId, (task) => {
    const now = new Date().toISOString();
    return {
      ...task,
      status: "cancelled",
      resultSummary: input.resultSummary ?? task.resultSummary,
      completedAt: now,
      updatedAt: now
    };
  });
}

export async function softDeleteExtensionTask(input: {
  tenantId: string;
  ownerId: string;
  taskId: string;
  resultSummary?: string;
}) {
  return updateTask(input.tenantId, input.ownerId, input.taskId, (task, state) => {
    const now = new Date().toISOString();
    const nextTask = {
      ...task,
      status: "cancelled" as const,
      resultSummary: input.resultSummary ?? task.resultSummary ?? "Task deleted in Leadsy.",
      completedAt: task.completedAt ?? now,
      deletedAt: task.deletedAt ?? now,
      updatedAt: now
    };
    state.taskEvents.push({
      id: `taskevt_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      taskId: input.taskId,
      type: "task_deleted",
      summary: nextTask.resultSummary,
      occurredAt: now
    });
    state.taskEvents = state.taskEvents.slice(-1000);
    return nextTask;
  });
}

export async function syncExtensionConversation(input: SyncExtensionConversationInput): Promise<ExtensionConversationBundle> {
  const state = await readState();
  const now = new Date().toISOString();
  const key = conversationKey(input);
  const existingIndex = state.conversations.findIndex((conversation) => conversationKey(conversation) === key);
  const existing = existingIndex >= 0 ? state.conversations[existingIndex] : null;
  const conversationId = existing?.id ?? `extconv_${crypto.randomUUID()}`;
  const existingMessages = state.messages.filter((message) => message.id.startsWith(`${conversationId}:`));
  const messagesByExternalId = new Map(existingMessages.map((message) => [message.externalId, message]));

  for (const message of input.messages ?? []) {
    const current = messagesByExternalId.get(message.externalId);
    const nextMessage: ExtensionConversationMessage = {
      id: current?.id ?? `${conversationId}:msg_${crypto.randomUUID()}`,
      externalId: message.externalId,
      direction: message.direction,
      body: message.body,
      sentAt: message.sentAt,
      generatedBy: message.generatedBy
    };
    messagesByExternalId.set(message.externalId, nextMessage);
  }

  const messages = [...messagesByExternalId.values()].sort((left, right) => left.sentAt.localeCompare(right.sentAt));
  const lastMessage = messages.at(-1);
  const conversation: ExtensionConversation = {
    id: conversationId,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    platform: input.platform,
    sourceUrl: input.sourceUrl,
    chatFingerprint: input.chatFingerprint,
    contact: { ...(existing?.contact ?? {}), ...(input.contact ?? {}) },
    leadId: input.leadId ?? existing?.leadId,
    leadSource: input.leadSource ?? existing?.leadSource,
    status: input.status ?? existing?.status ?? "active",
    messageCount: messages.length,
    lastMessageAt: lastMessage?.sentAt ?? existing?.lastMessageAt,
    lastMessagePreview: lastMessage ? cleanPreview(lastMessage.body) : existing?.lastMessagePreview,
    summary: input.insight?.summary ?? existing?.summary,
    qualification: input.insight?.qualification ?? existing?.qualification,
    nextAction: input.insight?.nextAction ?? existing?.nextAction,
    sentiment: input.insight?.sentiment ?? existing?.sentiment,
    captureSource: input.captureSource ?? existing?.captureSource,
    captureConfidence: input.captureConfidence ?? existing?.captureConfidence,
    tabUrl: input.tabUrl ?? existing?.tabUrl,
    observedAt: input.observedAt ?? existing?.observedAt,
    profileId: input.profileId ?? existing?.profileId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    state.conversations[existingIndex] = conversation;
  } else {
    state.conversations.push(conversation);
  }

  const outsideConversationMessages = state.messages.filter((message) => !message.id.startsWith(`${conversationId}:`));
  state.messages = [...outsideConversationMessages, ...messages];

  const newEvents = (input.events ?? []).map((event): ExtensionConversationEvent => ({
    id: `${conversationId}:evt_${crypto.randomUUID()}`,
    type: event.type,
    summary: event.summary,
    occurredAt: event.occurredAt
  }));
  state.events = [...state.events, ...newEvents].slice(-1000);

  await writeState(state);
  return {
    conversation,
    messages,
    events: state.events.filter((event) => event.id.startsWith(`${conversationId}:`))
  };
}

export async function listExtensionConversations(tenantId: string, ownerId: string): Promise<ExtensionConversationBundle[]> {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  return state.conversations
    .filter((conversation) => scopeKey(conversation.tenantId, conversation.ownerId) === scoped)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((conversation) => ({
      conversation,
      messages: state.messages
        .filter((message) => message.id.startsWith(`${conversation.id}:`))
        .sort((left, right) => left.sentAt.localeCompare(right.sentAt)),
      events: state.events
        .filter((event) => event.id.startsWith(`${conversation.id}:`))
        .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    }));
}

export async function listExtensionChannelMonitorHealth(tenantId: string, ownerId: string): Promise<ExtensionChannelMonitorHealth[]> {
  const bundles = await listExtensionConversations(tenantId, ownerId);
  const platforms: ExtensionPlatform[] = ["whatsapp-web", "instagram-web", "facebook-web", "generic-web-chat"];

  return platforms.map((platform) => {
    const platformBundles = bundles.filter((bundle) => bundle.conversation.platform === platform);
    const latestBundle = [...platformBundles].sort((left, right) => {
      const leftAt = left.conversation.lastMessageAt ?? left.conversation.observedAt ?? left.conversation.updatedAt;
      const rightAt = right.conversation.lastMessageAt ?? right.conversation.observedAt ?? right.conversation.updatedAt;
      return rightAt.localeCompare(leftAt);
    })[0];
    const latestEvent = latestBundle?.events.at(-1);
    const lastSyncedAt = latestBundle?.conversation.lastMessageAt ?? latestBundle?.conversation.observedAt ?? latestBundle?.conversation.updatedAt;

    return {
      platform,
      status: monitorStatus(latestEvent?.type, lastSyncedAt),
      conversationCount: platformBundles.length,
      captureSource: latestBundle?.conversation.captureSource,
      captureConfidence: latestBundle?.conversation.captureConfidence,
      tabUrl: latestBundle?.conversation.tabUrl,
      profileId: latestBundle?.conversation.profileId,
      lastSyncedAt,
      lastEventType: latestEvent?.type,
      lastError: latestEvent?.type === "monitor_error" || latestEvent?.type === "error" ? latestEvent.summary : undefined
    };
  });
}

function monitorStatus(type?: ExtensionConversationEvent["type"], lastSyncedAt?: string): ExtensionChannelMonitorHealth["status"] {
  if (type === "monitor_error" || type === "error") return "error";
  if (type === "monitor_blocked") return "blocked";
  if (type === "monitor_stale") return "stale";
  if (lastSyncedAt) return "active";
  return "idle";
}
