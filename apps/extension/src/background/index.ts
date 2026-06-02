import { loadConnectionSettings, saveConnectionSettings, type LeadsyConnectionSettings } from "../core/connection-settings";
import { LeadsyWorkerClient, type WorkerModelClient } from "../core/leadsy-client";
import { OpenRouterClient } from "../core/openrouter";
import { defaultAssistantSettings, getOpenRouterApiKey } from "../core/settings";
import type { AssistantSettings, ChatMessage, ConversationLog, DomSnapshot, KnowledgeContext } from "../core/types";

type RuntimeMessage =
  | { type: "leadsy:openSidePanel" }
  | { type: "leadsy:getSettings" }
  | { type: "leadsy:saveSettings"; settings: LeadsyConnectionSettings }
  | { type: "leadsy:getContext" }
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

async function fetchLeadsyJson(path: string) {
  const settings = await loadConnectionSettings();
  const response = await fetch(`${settings.baseUrl.replace(/\/+$/, "")}${path}`, {
    headers: {
      authorization: `Bearer ${settings.token}`
    }
  });
  if (!response.ok) {
    throw new Error(`Leadsy request failed: ${response.status}`);
  }
  return response.json();
}
