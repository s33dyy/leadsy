import { CommunicationsConsole, type InboxTabId } from "@/components/communications-console";
import { getCurrentSession } from "@/lib/auth";
import { listCalendarEvents } from "@/lib/calendar-store";
import { buildLeadBackedInboxItems, type StabilizedInboxItem } from "@/lib/inbox-stabilization";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { listTeamMembers, listTeamThreadMessages } from "@/lib/teamspace-store";
import { getWorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export const dynamic = "force-dynamic";

type CommunicationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const inboxTabs = ["unread", "needs-reply", "assigned-to-me", "all"] as const;

function inboxTabFromParams(params: Record<string, string | string[] | undefined>): InboxTabId {
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  return inboxTabs.some((tab) => tab === raw) ? (raw as InboxTabId) : "all";
}

function selectedConversationFromParams(params: Record<string, string | string[] | undefined>) {
  const raw = Array.isArray(params.conversation) ? params.conversation[0] : params.conversation;
  return raw?.trim();
}

function itemMatchesTab(item: StabilizedInboxItem, tab: InboxTabId) {
  if (tab === "unread") return item.unread > 0;
  if (tab === "needs-reply") return item.needsReply;
  if (tab === "assigned-to-me") return item.assignedToMe;
  return true;
}

export default async function CommunicationsPage({ searchParams }: CommunicationsPageProps) {
  const params = searchParams ? await searchParams : {};
  const activeTab = inboxTabFromParams(params);
  const selectedConversationId = selectedConversationFromParams(params);
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  const [leads, sender, teamMembers, calendarEvents] = scope
    ? await Promise.all([
        listLeadKnowledgeRecords(scope),
        getWorkspaceWhatsAppSender(scope),
        listTeamMembers(scope),
        listCalendarEvents(scope)
      ])
    : [[], undefined, [], []];

  const items = buildLeadBackedInboxItems(leads);
  const visibleItems = items.filter((item) => itemMatchesTab(item, activeTab));
  const active =
    visibleItems.find((item) => item.conversationId === selectedConversationId) ??
    items.find((item) => item.conversationId === selectedConversationId) ??
    visibleItems[0];
  const contextLead = active ? leads.find((lead) => lead.id === active.leadId) : undefined;
  const assignedMember = contextLead?.assigneeId ? teamMembers.find((member) => member.id === contextLead.assigneeId) : undefined;
  const autoReplyOwner = teamMembers.find(
    (member) => member.autoReplyEnabled && contextLead?.qualificationStage && member.pipelineStages.includes(contextLead.qualificationStage)
  );
  const internalThread = scope && contextLead
    ? await listTeamThreadMessages({ ...scope, leadId: contextLead.id, conversationId: active?.conversationId })
    : [];
  const leadCalendarEvents = contextLead ? calendarEvents.filter((event) => event.leadId === contextLead.id).slice(0, 4) : [];

  return (
    <CommunicationsConsole
      activeTab={activeTab}
      selectedConversationId={selectedConversationId}
      initialItems={items}
      contextLead={contextLead}
      sender={sender}
      assignedMember={assignedMember}
      autoReplyOwner={autoReplyOwner}
      internalThread={internalThread}
      leadCalendarEvents={leadCalendarEvents}
    />
  );
}
