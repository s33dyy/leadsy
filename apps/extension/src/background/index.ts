import { loadConnectionSettings, saveConnectionSettings, type LeadsyConnectionSettings } from "../core/connection-settings";
import { LeadsyWorkerClient, type WorkerModelClient } from "../core/leadsy-client";
import { OpenRouterClient } from "../core/openrouter";
import { defaultAssistantSettings, getOpenRouterApiKey } from "../core/settings";
import type { AssistantSettings, ChatMessage, ConversationLog, ConversationSyncEventType, DomSnapshot, KnowledgeContext } from "../core/types";
import type { ExtensionTask, ExtensionTaskEventType } from "../core/tasks";
import { getOrCreateTaskTab } from "./task-tabs";

type RuntimeMessage =
  | { type: "leadsy:openSidePanel" }
  | { type: "leadsy:getSettings" }
  | { type: "leadsy:saveSettings"; settings: LeadsyConnectionSettings }
  | { type: "leadsy:getContext" }
  | { type: "leadsy:getTasks" }
  | { type: "leadsy:openTask"; taskId: string }
  | { type: "leadsy:runSelectedTasks"; taskIds: string[] }
  | { type: "leadsy:getActiveTask" }
  | { type: "leadsy:prepareTask"; taskId: string; draftMessage: string }
  | {
      type: "leadsy:logTaskEvent";
      taskId: string;
      eventType: ExtensionTaskEventType;
      summary: string;
      reason?: string;
      payload?: Record<string, unknown>;
    }
  | {
      type: "leadsy:completeTask";
      taskId: string;
      status: "sent" | "monitoring" | "postponed" | "blocked" | "failed";
      resultSummary: string;
      reason?: string;
      postponedUntil?: string;
      outboundMessage?: {
        externalId: string;
        body: string;
        sentAt: string;
      };
    }
  | { type: "leadsy:detectProfile"; snapshot: DomSnapshot; messages: ChatMessage[] }
  | {
      type: "leadsy:decideReply";
      chat: ConversationLog;
      messages: ChatMessage[];
      knowledge: KnowledgeContext;
      settings: AssistantSettings;
    }
  | {
      type: "leadsy:syncConversation";
      chat: ConversationLog;
      messages: ChatMessage[];
      event?: {
        type: ConversationSyncEventType;
        summary: string;
      };
    };

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
  void chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then((value) => sendResponse({ ok: true, value }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown Leadsy extension error" }));
  return true;
});

async function handleMessage(message: RuntimeMessage, sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case "leadsy:openSidePanel":
      if (sender.tab?.id) {
        await chrome.sidePanel?.open?.({ tabId: sender.tab.id });
      }
      return undefined;
    case "leadsy:getSettings":
      return loadConnectionSettings();
    case "leadsy:saveSettings":
      await saveConnectionSettings(message.settings);
      return loadConnectionSettings();
    case "leadsy:getContext":
      return fetchLeadsyJson("/api/extension/context");
    case "leadsy:getTasks": {
      const payload = await fetchLeadsyJson<{ tasks: ExtensionTask[] }>("/api/extension/tasks");
      return payload.tasks;
    }
    case "leadsy:openTask":
      return openTask(message.taskId);
    case "leadsy:runSelectedTasks":
      return runSelectedTasks(message.taskIds);
    case "leadsy:getActiveTask":
      return getActiveTask();
    case "leadsy:prepareTask":
      return prepareTask(message.taskId, message.draftMessage);
    case "leadsy:logTaskEvent":
      return logTaskEvent(message);
    case "leadsy:completeTask":
      return completeTask(message);
    case "leadsy:detectProfile":
      return fallbackClient().detectProfile(message.snapshot, message.messages);
    case "leadsy:decideReply": {
      const client = await workerClient();
      return client.decideReply(message.chat, message.messages, message.knowledge, message.settings);
    }
    case "leadsy:syncConversation": {
      const client = await workerClient();
      if ("syncConversation" in client && typeof client.syncConversation === "function") {
        await client.syncConversation({
          chat: message.chat,
          messages: message.messages,
          event: message.event
        });
      }
      return undefined;
    }
  }
}

const activeTaskKey = "leadsyActiveTask";
const activeTaskTabKey = "leadsyActiveTaskTabId";
let selectedBatchBusy = false;

async function workerClient(): Promise<WorkerModelClient & { syncConversation?: LeadsyWorkerClient["syncConversation"] }> {
  const settings = await loadConnectionSettings();
  const fallback = fallbackClient(settings.fallbackEnabled);
  if (!settings.token) return fallback;
  return new LeadsyWorkerClient({
    baseUrl: settings.baseUrl,
    token: settings.token,
    fallback
  });
}

function fallbackClient(enabled = true): WorkerModelClient {
  if (!enabled) {
    return {
      detectProfile: async () => {
        throw new Error("Leadsy fallback model is disabled.");
      },
      decideReply: async () => {
        throw new Error("Leadsy is not connected and fallback is disabled.");
      }
    };
  }

  return new OpenRouterClient({
    apiKey: getOpenRouterApiKey(),
    modelId: defaultAssistantSettings.modelId,
    fallbackModelIds: defaultAssistantSettings.fallbackModelIds,
    temperature: defaultAssistantSettings.temperature,
    maxTokens: defaultAssistantSettings.maxTokens
  });
}

async function fetchLeadsyJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const settings = await loadConnectionSettings();
  const response = await fetch(`${settings.baseUrl.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${settings.token}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`Leadsy request failed: ${response.status}`);
  }
  return response.json();
}

async function openTask(taskId: string) {
  return claimAndOpenTask(taskId, { execute: false });
}

async function runSelectedTasks(taskIds: string[]) {
  if (selectedBatchBusy) throw new Error("A selected task batch is already running.");
  const orderedTaskIds = [...new Set(taskIds.map((taskId) => taskId.trim()).filter(Boolean))];
  if (!orderedTaskIds.length) throw new Error("Select at least one task to run.");
  const queuedTasks = await fetchLeadsyJson<{ tasks: ExtensionTask[] }>("/api/extension/tasks").catch(() => undefined);
  const runnableTaskIds = queuedTasks ? uniqueBatchTaskIds(orderedTaskIds, queuedTasks.tasks) : orderedTaskIds;

  selectedBatchBusy = true;
  const batchRunId = `batch_${Date.now()}`;
  const result = {
    batchRunId,
    requested: orderedTaskIds.length,
    sent: 0,
    postponed: orderedTaskIds.length - runnableTaskIds.length,
    failed: 0
  };

  try {
    for (const taskId of runnableTaskIds) {
      try {
        await claimAndOpenTask(taskId, { execute: true, batchRunId });
        const activeTask = await getActiveTask().catch(() => undefined);
        if (!activeTask) {
          result.sent += 1;
        }
      } catch {
        await chrome.storage.local.remove(activeTaskKey).catch(() => undefined);
        await chrome.storage.local.remove(activeTaskTabKey).catch(() => undefined);
        result.failed += 1;
      }
    }
    return result;
  } finally {
    selectedBatchBusy = false;
  }
}

function uniqueBatchTaskIds(orderedTaskIds: string[], tasks: ExtensionTask[]) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const uniqueIds: string[] = [];
  for (const taskId of orderedTaskIds) {
    const task = byId.get(taskId);
    if (!task) continue;
    const key = taskConversationKey(task);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueIds.push(task.id);
  }
  return uniqueIds;
}

function taskConversationKey(task: ExtensionTask) {
  return (
    normalizeTaskUrl(task.targetUrl) ||
    [task.platform, cleanKey(task.contact?.phone), cleanKey(task.contact?.email), cleanKey(task.contact?.handle), cleanKey(task.contact?.profileUrl), cleanKey(task.contact?.displayName)]
      .filter(Boolean)
      .join(":") ||
    task.id
  );
}

function normalizeTaskUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.hostname === "web.whatsapp.com") {
      const phone = url.searchParams.get("phone")?.replace(/[^\d]/g, "");
      if (phone) return `whatsapp:${phone}`;
    }
    return url.toString().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function cleanKey(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ");
}

async function claimAndOpenTask(taskId: string, options: { execute: boolean; batchRunId?: string }) {
  const task = await fetchLeadsyJson<ExtensionTask>(`/api/extension/tasks/${encodeURIComponent(taskId)}/claim`, {
    method: "POST",
    body: JSON.stringify({
      runBatchId: options.batchRunId,
      runMode: options.execute ? "selected_batch" : "manual"
    })
  });
  if (!task.targetUrl) {
    await logTaskEvent({
      type: "leadsy:logTaskEvent",
      taskId: task.id,
      eventType: "worker_blocked",
      reason: "target_url_missing",
      summary: "Task is missing a target chat/profile."
    });
    await fetchLeadsyJson<ExtensionTask>(`/api/extension/tasks/${encodeURIComponent(task.id)}/complete`, {
      method: "POST",
      body: JSON.stringify({
        status: "blocked",
        reason: "target_url_missing",
        resultSummary: "Missing target chat/profile."
      })
    });
    throw new Error("Task is missing a target chat/profile.");
  }
  const activeTask = options.execute && options.batchRunId ? { ...task, runBatchId: options.batchRunId, runMode: "selected_batch" as const } : task;
  await chrome.storage.local.set({ [activeTaskKey]: activeTask });
  const tab = await getOrCreateTaskTab(task);
  if (tab.id) {
    await chrome.storage.local.set({ [activeTaskTabKey]: tab.id });
    if (options.execute && options.batchRunId) {
      await executeTaskInTab(tab.id, options.batchRunId);
    }
  }
  await logTaskEvent({
    type: "leadsy:logTaskEvent",
    taskId: task.id,
    eventType: "worker_opened",
    summary: `Worker opened ${task.targetUrl}.`
  }).catch(() => undefined);
  return activeTask;
}

async function executeTaskInTab(tabId: number, batchRunId: string) {
  await waitForTabComplete(tabId);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await chrome.tabs
      .sendMessage(tabId, { type: "leadsy:executeActiveTask", batchRunId })
      .catch(() => undefined);
    if (response?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Could not execute the active task in the chat tab.");
}

async function waitForTabComplete(tabId: number) {
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (tab?.status === "complete") return;
  await new Promise<void>((resolve) => {
    const timeout = globalThis.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 5000);
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      globalThis.clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function getActiveTask() {
  const stored = await chrome.storage.local.get(activeTaskKey);
  return stored[activeTaskKey] as ExtensionTask | undefined;
}

async function prepareTask(taskId: string, draftMessage: string) {
  const task = await fetchLeadsyJson<ExtensionTask>(`/api/extension/tasks/${encodeURIComponent(taskId)}/prepare`, {
    method: "POST",
    body: JSON.stringify({ draftMessage })
  });
  await chrome.storage.local.set({ [activeTaskKey]: task });
  return task;
}

async function logTaskEvent(input: {
  type: "leadsy:logTaskEvent";
  taskId: string;
  eventType: ExtensionTaskEventType;
  summary: string;
  reason?: string;
  payload?: Record<string, unknown>;
}) {
  return fetchLeadsyJson(`/api/extension/tasks/${encodeURIComponent(input.taskId)}/events`, {
    method: "POST",
    body: JSON.stringify({
      type: input.eventType,
      summary: input.summary,
      reason: input.reason,
      payload: input.payload
    })
  });
}

async function getActiveTaskTabId() {
  const stored = await chrome.storage.local.get(activeTaskTabKey);
  const tabId = stored[activeTaskTabKey];
  return typeof tabId === "number" ? tabId : undefined;
}

async function completeTask(input: {
  taskId: string;
  status: "sent" | "monitoring" | "postponed" | "blocked" | "failed";
  resultSummary: string;
  reason?: string;
  postponedUntil?: string;
  outboundMessage?: {
    externalId: string;
    body: string;
    sentAt: string;
  };
}) {
  const task = await fetchLeadsyJson<ExtensionTask>(`/api/extension/tasks/${encodeURIComponent(input.taskId)}/complete`, {
    method: "POST",
    body: JSON.stringify({
      status: input.status,
      resultSummary: input.resultSummary,
      reason: input.reason,
      postponedUntil: input.postponedUntil,
      outboundMessage: input.outboundMessage
    })
  });
  await chrome.storage.local.remove(activeTaskKey);
  await chrome.storage.local.remove(activeTaskTabKey);
  return task;
}
