import { buildLeadBackedInboxItems, type StabilizedInboxItem } from "./inbox-stabilization";
import { listLeadKnowledgeRecords } from "./lead-knowledge-store";
import { getWorkspaceWhatsAppSender, type WorkspaceWhatsAppSender } from "./workspace-whatsapp-sender-store";

export type WorkspaceScope = {
  tenantId: string;
  ownerId: string;
};

export type RecentSimulatorEvent = {
  id: string;
  lead: string;
  phone?: string;
  direction: "inbound" | "outbound";
  body: string;
  deliveryStatus?: string;
  sentAt: string;
};

export type SimulatedConversation = {
  leadId: string;
  lead: string;
  phone?: string;
  to?: string;
  qualification: string;
  lastMessage?: string;
  lastActivity?: string;
  messages: Array<{
    id: string;
    from: "lead" | "us";
    body: string;
    sentAt: string;
    deliveryStatus?: string;
  }>;
};

export type SimulatorSnapshot = {
  sender?: WorkspaceWhatsAppSender;
  recentEvents: RecentSimulatorEvent[];
  simulatedConversations: SimulatedConversation[];
  version: string;
};

export type ConversationsSnapshot = {
  items: StabilizedInboxItem[];
  version: string;
};

function snapshotVersion(value: unknown) {
  const raw = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return `${raw.length}:${hash.toString(36)}`;
}

export async function buildSimulatorSnapshot(scope: WorkspaceScope): Promise<SimulatorSnapshot> {
  const [sender, leads] = await Promise.all([
    getWorkspaceWhatsAppSender(scope),
    listLeadKnowledgeRecords(scope)
  ]);
  const simulatedConversations = leads
    .map((lead) => {
      const messages = lead.messages
        .filter((message) => message.source === "twilio_simulator")
        .map((message) => ({
          id: message.id,
          from: message.direction === "outbound" ? "us" as const : "lead" as const,
          body: message.body,
          sentAt: message.sentAt,
          deliveryStatus: message.deliveryStatus
        }));
      const lastMessage = messages.at(-1);
      const digits = (lead.contact.waId || lead.contact.phone)?.replace(/\D/g, "");
      return {
        leadId: lead.id,
        lead: lead.contact.displayName || lead.contact.phone || "Simulated lead",
        phone: lead.contact.phone,
        to: digits ? `whatsapp:+${digits}` : undefined,
        qualification: lead.qualificationStage.replace(/_/g, " "),
        lastMessage: lastMessage?.body,
        lastActivity: lastMessage?.sentAt,
        messages
      };
    })
    .filter((conversation) => conversation.messages.length > 0)
    .sort((left, right) => (right.lastActivity ?? "").localeCompare(left.lastActivity ?? ""));
  const recentEvents = leads
    .flatMap((lead) =>
      lead.messages
        .filter((message) => message.source === "twilio_simulator")
        .map((message) => ({
          id: message.id,
          lead: lead.contact.displayName || lead.contact.phone || "Simulated lead",
          phone: lead.contact.phone,
          direction: message.direction === "outbound" ? "outbound" as const : "inbound" as const,
          body: message.body,
          deliveryStatus: message.deliveryStatus,
          sentAt: message.sentAt
        }))
    )
    .sort((left, right) => right.sentAt.localeCompare(left.sentAt))
    .slice(0, 12);
  const snapshot = { sender, recentEvents, simulatedConversations };
  return { ...snapshot, version: snapshotVersion(snapshot) };
}

export async function buildConversationsSnapshot(scope: WorkspaceScope): Promise<ConversationsSnapshot> {
  const leads = await listLeadKnowledgeRecords(scope);
  const items = buildLeadBackedInboxItems(leads);
  return { items, version: snapshotVersion(items) };
}
