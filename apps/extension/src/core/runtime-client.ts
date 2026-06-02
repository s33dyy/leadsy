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

type RuntimeResponse<T> = { ok: true; value: T } | { ok: false; error: string };

export class RuntimeWorkerClient implements WorkerModelClient {
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
