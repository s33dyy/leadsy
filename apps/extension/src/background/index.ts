import { loadConnectionSettings, saveConnectionSettings, type LeadsyConnectionSettings } from "../core/connection-settings";
import { LeadsyWorkerClient, type WorkerModelClient } from "../core/leadsy-client";
import { OpenRouterClient } from "../core/openrouter";
import { defaultAssistantSettings, getOpenRouterApiKey } from "../core/settings";
import type { AssistantSettings, ChatMessage, ConversationLog, DomSnapshot, KnowledgeContext } from "../core/types";
import type { ExtensionTask, ExtensionTaskEventType } from "../core/tasks";

type RuntimeMessage =
  | { type: "leadsy:openSidePanel" }
  | { type: "leadsy:getSettings" }
  | { type: "leadsy:saveSettings"; settings: LeadsyConnectionSettings }
  | { type: "leadsy:getContext" }
  | { type: "leadsy:getTasks" }
  | { type: "leadsy:openTask"; taskId: string }
  | { type: "leadsy:getActiveTask" }
  | { type: "leadsy:prepareTask"; taskId: string; draftMessage: string }
  | { type: "leadsy:approveTaskSend"; taskId: string }
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
      status: "sent" | "monitoring" | "blocked" | "failed";
      resultSummary: string;
      reason?: string;
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
        type: "detected" | "inbound-synced" | "reply-generated" | "reply-sent" | "reply-paused" | "fallback-used" | "error";
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
    case "leadsy:getActiveTask":
      return getActiveTask();
    case "leadsy:prepareTask":
      return prepareTask(message.taskId, message.draftMessage);
    case "leadsy:approveTaskSend":
      return approveTaskSend(message.taskId);
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
  const task = await fetchLeadsyJson<ExtensionTask>(`/api/extension/tasks/${encodeURIComponent(taskId)}/claim`, {
    method: "POST"
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
  await chrome.storage.local.set({ [activeTaskKey]: task });
  const tab = await chrome.tabs.create({ url: task.targetUrl });
  if (tab.id) {
    await chrome.storage.local.set({ [activeTaskTabKey]: tab.id });
  }
  await logTaskEvent({
    type: "leadsy:logTaskEvent",
    taskId: task.id,
    eventType: "worker_opened",
    summary: `Worker opened ${task.targetUrl}.`
  }).catch(() => undefined);
  return task;
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

async function approveTaskSend(taskId: string) {
  const task = await fetchLeadsyJson<ExtensionTask>(`/api/extension/tasks/${encodeURIComponent(taskId)}/approve-send`, {
    method: "POST",
    body: JSON.stringify({ action: "approve" })
  });
  await chrome.storage.local.set({ [activeTaskKey]: task });
  const tabId = await getActiveTaskTabId();
  if (tabId) {
    await chrome.tabs.sendMessage(tabId, { type: "leadsy:sendPreparedTask", task }).catch(() => undefined);
  }
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
  status: "sent" | "monitoring" | "blocked" | "failed";
  resultSummary: string;
  reason?: string;
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
      outboundMessage: input.outboundMessage
    })
  });
  await chrome.storage.local.remove(activeTaskKey);
  await chrome.storage.local.remove(activeTaskTabKey);
  return task;
}
