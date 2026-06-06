import type { LeadKnowledgeMessage } from "./lead-knowledge-store";

// Railway watches /apps/web/**; deployment recovery commits may touch this file when production skipped a prior web change after failed CI.
function visibleMessages(messages: LeadKnowledgeMessage[]) {
  return messages
    .filter((message) => !message.hiddenAt)
    .sort((left, right) => left.sentAt.localeCompare(right.sentAt) || left.id.localeCompare(right.id));
}

export function conversationMessages(messages: LeadKnowledgeMessage[]) {
  return visibleMessages(messages).filter((message) => message.direction === "inbound" || message.direction === "outbound");
}

export function internalNotes(messages: LeadKnowledgeMessage[]) {
  return visibleMessages(messages).filter((message) => message.direction === "note");
}

export function systemEvents(messages: LeadKnowledgeMessage[]) {
  return visibleMessages(messages).filter((message) => message.direction === "system");
}

export function latestConversationMessage(messages: LeadKnowledgeMessage[]) {
  return conversationMessages(messages).at(-1);
}
