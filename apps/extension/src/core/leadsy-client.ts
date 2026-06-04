import type {
  AssistantSettings,
  ChatMessage,
  ChatSiteProfile,
  ConversationSyncEventType,
  ConversationLog,
  DomSnapshot,
  KnowledgeContext,
  ResponderDecision
} from "./types";

export interface WorkerModelClient {
  detectProfile(snapshot: DomSnapshot, messages: ChatMessage[]): Promise<ChatSiteProfile>;
  decideReply(
    chat: ConversationLog,
    messages: ChatMessage[],
    knowledge: KnowledgeContext,
    settings: AssistantSettings
  ): Promise<ResponderDecision>;
}

export interface LeadsyWorkerClientOptions {
  baseUrl: string;
  token: string;
  fetchFn?: typeof fetch;
  fallback: WorkerModelClient;
}

type LeadsyReplyResponse = {
  decision?: ResponderDecision;
};

export class LeadsyWorkerClient implements WorkerModelClient {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: LeadsyWorkerClientOptions) {
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  detectProfile(snapshot: DomSnapshot, messages: ChatMessage[]): Promise<ChatSiteProfile> {
    return this.options.fallback.detectProfile(snapshot, messages);
  }

  async decideReply(
    chat: ConversationLog,
    messages: ChatMessage[],
    knowledge: KnowledgeContext,
    settings: AssistantSettings
  ): Promise<ResponderDecision> {
    if (!this.options.baseUrl || !this.options.token) {
      return this.options.fallback.decideReply(chat, messages, knowledge, settings);
    }

    try {
      const response = await this.fetchFn(`${this.options.baseUrl.replace(/\/+$/, "")}/api/extension/reply`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          platform: platformFromUrl(messages.at(-1)?.sourceUrl || chat.chatFingerprint),
          sourceUrl: messages.at(-1)?.sourceUrl || chat.chatFingerprint,
          chatFingerprint: chat.chatFingerprint,
          messages: messages.slice(-40).map((message) => ({
            id: message.id,
            externalId: message.id,
            direction: message.direction,
            text: message.text,
            timestamp: message.timestamp,
            sourceUrl: message.sourceUrl
          })),
          existingSummary: knowledge.supportNotes.join("\n").slice(0, 1000)
        })
      });

      if (!response.ok) {
        throw new Error(`Leadsy reply failed: ${response.status}`);
      }

      const payload = (await response.json()) as LeadsyReplyResponse;
      if (!payload.decision) {
        throw new Error("Leadsy reply response did not include a decision.");
      }
      return payload.decision;
    } catch {
      return this.options.fallback.decideReply(chat, messages, knowledge, settings);
    }
  }

  async syncConversation(input: {
    chat: ConversationLog;
    messages: ChatMessage[];
    event?: {
      type: ConversationSyncEventType;
      summary: string;
    };
  }): Promise<void> {
    if (!this.options.baseUrl || !this.options.token) return;
    const lastMessage = input.messages.at(-1);
    await this.fetchFn(`${this.options.baseUrl.replace(/\/+$/, "")}/api/extension/conversations/sync`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        platform: platformFromUrl(lastMessage?.sourceUrl || input.chat.chatFingerprint),
        sourceUrl: lastMessage?.sourceUrl || input.chat.chatFingerprint,
        chatFingerprint: input.chat.chatFingerprint,
        captureSource: "browser-extension",
        tabUrl: lastMessage?.sourceUrl || input.chat.chatFingerprint,
        observedAt: new Date().toISOString(),
        profileId: input.chat.profileId,
        messages: input.messages.map((message) => ({
          externalId: message.id,
          direction: message.direction === "incoming" ? "inbound" : message.direction === "outgoing" ? "outbound" : "system",
          body: message.text,
          sentAt: new Date(message.timestamp).toISOString(),
          generatedBy: message.direction === "outgoing" ? "leadsy" : undefined
        })),
        events: input.event
          ? [
              {
                type: input.event.type,
                summary: input.event.summary,
                occurredAt: new Date().toISOString()
              }
            ]
          : []
      })
    }).catch(() => undefined);
  }
}

function platformFromUrl(value: string) {
  if (/web\.whatsapp\.com/i.test(value)) return "whatsapp-web";
  if (/instagram\.com/i.test(value)) return "instagram-web";
  if (/facebook\.com|messenger\.com/i.test(value)) return "facebook-web";
  return "generic-web-chat";
}
