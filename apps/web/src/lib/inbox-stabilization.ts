import type { LeadKnowledgeChannel, LeadKnowledgeRecord } from "./lead-knowledge-store";
import { conversationMessages, latestConversationMessage } from "./conversation-contract";

export type StabilizedInboxItem = {
  id: string;
  leadId: string;
  contact: string;
  company: string;
  channel: "WhatsApp" | "Instagram" | "Messenger" | "Email" | "Extension";
  preview: string;
  time: string;
  sortAt: number;
  conversionUrgency: number;
  unread: number;
  important: boolean;
  href: string;
  messages: Array<{
    id: string;
    author: string;
    from: "lead" | "us";
    text: string;
    time: string;
  }>;
};

export function relativeTime(value?: string) {
  if (!value) return "now";
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs) || diffMs < 0) return "now";
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function timestampValue(value?: string) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function channelLabelForInbox(channels: LeadKnowledgeChannel[]): StabilizedInboxItem["channel"] {
  if (channels.includes("email")) return "Email";
  if (channels.includes("instagram") || channels.includes("instagram-web")) return "Instagram";
  if (channels.includes("facebook") || channels.includes("facebook-web")) return "Messenger";
  if (channels.some((channel) => channel.endsWith("-web") || channel === "generic-web-chat")) return "Extension";
  return "WhatsApp";
}

export function buildLeadBackedInboxItems(leads: LeadKnowledgeRecord[]): StabilizedInboxItem[] {
  const itemsByLead = new Map<string, StabilizedInboxItem>();

  for (const lead of leads) {
    const visibleMessages = conversationMessages(lead.messages);
    const lastMessage = latestConversationMessage(visibleMessages);
    if (!lastMessage) continue;

    const contact = lead.contact.displayName || lead.contact.handle || lead.contact.phone || lead.contact.email || "Unknown lead";
    const item: StabilizedInboxItem = {
      id: `lead_${lead.id}`,
      leadId: lead.id,
      contact,
      company: lead.leadSource || "Lead knowledge",
      channel: channelLabelForInbox(lead.channels),
      preview: lastMessage.body,
      time: relativeTime(lastMessage.sentAt),
      sortAt: timestampValue(lastMessage.sentAt),
      conversionUrgency: lead.crmStatus === "needs_reply" ? 100 : lead.crmStatus === "human_review" ? 90 : lead.leadStatus === "lead" ? 50 : 10,
      unread: lastMessage.direction === "inbound" ? 1 : 0,
      important: lead.crmStatus === "human_review" || lead.crmStatus === "needs_reply",
      href: `/app/leads?contact=${lead.id}&tab=conversation`,
      messages: visibleMessages.slice(-8).map((message) => ({
        id: message.id,
        author: message.direction === "outbound" ? "Leadsy" : contact,
        from: message.direction === "outbound" ? "us" : "lead",
        text: message.body,
        time: relativeTime(message.sentAt)
      }))
    };

    const existing = itemsByLead.get(lead.id);
    if (!existing || item.sortAt > existing.sortAt) {
      itemsByLead.set(lead.id, item);
    }
  }

  return [...itemsByLead.values()].sort((left, right) => right.conversionUrgency - left.conversionUrgency || right.sortAt - left.sortAt);
}
