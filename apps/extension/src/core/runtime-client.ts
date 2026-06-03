import type {
  AssistantSettings,
  ChatMessage,
  ChatSiteProfile,
  ConversationLog,
  DomSnapshot,
  KnowledgeContext,
  ResponderDecision
} from "./types";
import type { WorkerModelClient } from "./leadsy-client";
import type { LeadsyConnectionSettings } from "./connection-settings";
import type { ExtensionTask, ExtensionTaskEventType } from "./tasks";

type RuntimeResponse<T> = { ok: true; value: T } | { ok: false; error: string };

export class RuntimeWorkerClient implements WorkerModelClient {
  async getSettings(): Promise<LeadsyConnectionSettings> {
    return sendRuntimeMessage<LeadsyConnectionSettings>({
      type: "leadsy:getSettings"
    });
  }

  async detectProfile(snapshot: DomSnapshot, messages: ChatMessage[]): Promise<ChatSiteProfile> {
    const response = await sendRuntimeMessage<ChatSiteProfile>({
      type: "leadsy:detectProfile",
      snapshot,
      messages
    });
    return response;
  }

  async decideReply(
    chat: ConversationLog,
    messages: ChatMessage[],
    knowledge: KnowledgeContext,
    settings: AssistantSettings
  ): Promise<ResponderDecision> {
    return sendRuntimeMessage<ResponderDecision>({
      type: "leadsy:decideReply",
      chat,
      messages,
      knowledge,
      settings
    });
  }

  async syncConversation(input: {
    chat: ConversationLog;
    messages: ChatMessage[];
    event?: {
      type: "detected" | "inbound-synced" | "reply-generated" | "reply-sent" | "reply-paused" | "fallback-used" | "error";
      summary: string;
    };
  }): Promise<void> {
    await sendRuntimeMessage<void>({
      type: "leadsy:syncConversation",
      ...input
    });
  }

  async getActiveTask(): Promise<ExtensionTask | undefined> {
    return sendRuntimeMessage<ExtensionTask | undefined>({
      type: "leadsy:getActiveTask"
    });
  }

  async prepareTask(input: { taskId: string; draftMessage: string }): Promise<ExtensionTask> {
    return sendRuntimeMessage<ExtensionTask>({
      type: "leadsy:prepareTask",
      ...input
    });
  }

  async logTaskEvent(input: {
    taskId: string;
    eventType: ExtensionTaskEventType;
    summary: string;
    reason?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await sendRuntimeMessage<void>({
      type: "leadsy:logTaskEvent",
      ...input
    });
  }

  async completeTask(input: {
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
  }): Promise<ExtensionTask> {
    return sendRuntimeMessage<ExtensionTask>({
      type: "leadsy:completeTask",
      ...input
    });
  }
}

export function openLeadsySidePanel() {
  void chrome.runtime.sendMessage({ type: "leadsy:openSidePanel" });
}

async function sendRuntimeMessage<T>(message: Record<string, unknown>): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T> | undefined;
  if (!response) {
    throw new Error("Leadsy background worker did not respond.");
  }
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.value;
}
