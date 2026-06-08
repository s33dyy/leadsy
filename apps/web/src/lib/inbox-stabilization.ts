import type { LeadKnowledgeChannel, LeadKnowledgeRecord } from "./lead-knowledge-store";
import { conversationMessages, latestConversationMessage } from "./conversation-contract";

export type StabilizedInboxItem = {
  id: string;
  leadId: string;
  conversationId: string;
  lead: string;
  contact: string;
  company: string;
  channel: "WhatsApp" | "Email" | "Call" | "Manual";
  preview: string;
  lastMessage: string;
  time: string;
  lastActivity: string;
  sortAt: number;
  conversionUrgency: number;
  unread: number;
  needsReply: boolean;
  assignedToMe: boolean;
  owner: string;
  qualification: string;
  important: boolean;
  href: string;
  channelTabs: Array<{
    channel: Extract<LeadKnowledgeChannel, "whatsapp" | "email" | "call">;
    label: "WhatsApp" | "Email" | "Calls";
    conversationId?: string;
    messageCount: number;
    lastActivity?: string;
    preview?: string;
    messages: StabilizedInboxItem["messages"];
  }>;
  messages: Array<{
    id: string;
    author: string;
    from: "lead" | "us";
    text: string;
    time: string;
    deliveryStatus?: string;
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
  if (channels.includes("call")) return "Call";
  if (channels.includes("manual")) return "Manual";
  return "WhatsApp";
}

const orderedChannels: Array<Extract<LeadKnowledgeChannel, "whatsapp" | "email" | "call">> = ["whatsapp", "email", "call"];

function channelTabLabel(channel: Extract<LeadKnowledgeChannel, "whatsapp" | "email" | "call">): "WhatsApp" | "Email" | "Calls" {
  if (channel === "email") return "Email";
  if (channel === "call") return "Calls";
  return "WhatsApp";
}

function labelFromSlug(value?: string) {
  if (!value) return "Not Yet Collected";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildLeadBackedInboxItems(leads: LeadKnowledgeRecord[]): StabilizedInboxItem[] {
  const itemsByLead = new Map<string, StabilizedInboxItem>();

  for (const lead of leads) {
    const visibleMessages = conversationMessages(lead.messages);
    const lastMessage = latestConversationMessage(visibleMessages);
    if (!lastMessage) continue;
    const conversation = lead.conversations.find((candidate) => candidate.id === lastMessage.conversationId) ?? lead.conversations[0];
    if (!conversation) continue;

    const contact = lead.contact.displayName || lead.contact.handle || lead.contact.phone || lead.contact.email || "Unknown lead";
    const time = relativeTime(lastMessage.sentAt);
    const needsReply = lead.crmStatus === "needs_reply" || lastMessage.direction === "inbound";
    const channelTabs = orderedChannels
      .filter((channel) => lead.channels.includes(channel))
      .map((channel) => {
        const channelMessages = visibleMessages.filter((message) => message.channel === channel);
        const latestChannelMessage = latestConversationMessage(channelMessages);
        const channelConversation = lead.conversations.find((candidate) => candidate.channel === channel);
        return {
          channel,
          label: channelTabLabel(channel),
          conversationId: channelConversation?.id,
          messageCount: channelMessages.length,
          lastActivity: latestChannelMessage?.sentAt ? relativeTime(latestChannelMessage.sentAt) : undefined,
          preview: latestChannelMessage?.body,
          messages: channelMessages.slice(-8).map((message) => ({
            id: message.id,
            author: message.direction === "outbound" ? "Leadsy" : contact,
            from: message.direction === "outbound" ? ("us" as const) : ("lead" as const),
            text: message.body,
            time: relativeTime(message.sentAt),
            deliveryStatus: message.deliveryStatus
          }))
        };
      });
    const item: StabilizedInboxItem = {
      id: `lead_${lead.id}`,
      leadId: lead.id,
      conversationId: conversation.id,
      lead: contact,
      contact,
      company: lead.leadSource || "Lead knowledge",
      channel: channelLabelForInbox(lead.channels),
      preview: lastMessage.body,
      lastMessage: lastMessage.body,
      time,
      lastActivity: time,
      sortAt: timestampValue(lastMessage.sentAt),
      conversionUrgency: lead.crmStatus === "needs_reply" ? 100 : lead.crmStatus === "human_review" ? 90 : lead.leadStatus === "lead" ? 50 : 10,
      unread: lastMessage.direction === "inbound" ? 1 : 0,
      needsReply,
      assignedToMe: Boolean(lead.assigneeId && lead.assigneeId === lead.ownerId),
      owner: lead.assigneeName || "Unassigned",
      qualification: labelFromSlug(lead.qualificationStage),
      important: lead.crmStatus === "human_review" || lead.crmStatus === "needs_reply",
      href: `/app/communications?conversation=${conversation.id}`,
      channelTabs,
      messages: visibleMessages.slice(-8).map((message) => ({
        id: message.id,
        author: message.direction === "outbound" ? "Leadsy" : contact,
        from: message.direction === "outbound" ? "us" : "lead",
        text: message.body,
        time: relativeTime(message.sentAt),
        deliveryStatus: message.deliveryStatus
      }))
    };

    const existing = itemsByLead.get(lead.id);
    if (!existing || item.sortAt > existing.sortAt) {
      itemsByLead.set(lead.id, item);
    }
  }

  return [...itemsByLead.values()].sort((left, right) => right.conversionUrgency - left.conversionUrgency || right.sortAt - left.sortAt);
}
