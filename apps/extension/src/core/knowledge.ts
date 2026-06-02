import type { ChatMessage, ConversationLog, KnowledgeContext, KnowledgeProvider } from "./types";

export class FallbackKnowledgeProvider implements KnowledgeProvider {
  constructor(private readonly businessPrompt: string) {}

  async getContext(_chat: ConversationLog, _messages: ChatMessage[]): Promise<KnowledgeContext> {
    return {
      businessPrompt: this.businessPrompt,
      supportNotes: [
        "For casual or personal chats, reply like a friendly chatbot: short, natural, warm, and not salesy.",
        "Do not pause just because there is no business, sales, or support intent.",
        "If a support answer requires facts not present in the chat or settings, ask a brief clarification instead of inventing details."
      ],
      leadQualificationHints: [
        "Only qualify intent, timeline, budget, and contact details when the user shows business or buying intent.",
        "Ask one clear question at a time.",
        "Move qualified leads toward a call, demo, or next operational step."
      ]
    };
  }
}

export class LeadsyKnowledgeProvider implements KnowledgeProvider {
  async getContext(chat: ConversationLog, messages: ChatMessage[]): Promise<KnowledgeContext> {
    const fallback = new FallbackKnowledgeProvider(
      "Leadsy database integration is not connected yet. Use general friendly chat behavior, and switch to lead qualification or support only when the conversation clearly calls for it."
    );
    return fallback.getContext(chat, messages);
  }
}
