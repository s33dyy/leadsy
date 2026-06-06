import Link from "next/link";
import { AtSign, Hash, Mail, MessageSquare, Pin, Search, Sparkles, Star } from "lucide-react";
import { InboxReplyComposer } from "@/components/inbox-reply-composer";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionConversations } from "@/lib/extension-store";
import { buildLeadBackedInboxItems } from "@/lib/inbox-stabilization";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { listMetaOAuthConnections } from "@/lib/meta-oauth-store";
import { listMetaWhatsAppConversations } from "@/lib/meta-whatsapp-webhook-store";
import { getWorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export const dynamic = "force-dynamic";

type CommunicationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type InboxItem = {
  id: string;
  leadId?: string;
  lead: string;
  contact: string;
  company: string;
  channel: "WhatsApp" | "Instagram" | "Messenger" | "Email" | "Extension";
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
  messages: Array<{
    id: string;
    author: string;
    from: "lead" | "us";
    text: string;
    time: string;
    deliveryStatus?: string;
  }>;
};

const inboxTabs = [
  { id: "unread", label: "Unread" },
  { id: "needs-reply", label: "Needs Reply" },
  { id: "assigned-to-me", label: "Assigned To Me" },
  { id: "all", label: "All Conversations" }
] as const;

type InboxTabId = (typeof inboxTabs)[number]["id"];

function relativeTime(value?: string) {
  if (!value) return "now";
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs) || diffMs < 0) return "now";
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function extensionChannel(platform: string): InboxItem["channel"] {
  if (platform === "whatsapp-web") return "WhatsApp";
  if (platform === "instagram-web") return "Instagram";
  if (platform === "facebook-web") return "Messenger";
  return "Extension";
}

function timestampValue(value?: string) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function leadIdentityKeys(input: {
  id?: string;
  contactId?: string;
  waId?: string;
  contact?: { phone?: string; waId?: string; email?: string; handle?: string };
}) {
  return [input.id, input.contactId, input.waId, input.contact?.phone, input.contact?.waId, input.contact?.email, input.contact?.handle]
    .map((value) => value?.trim().toLowerCase())
    .filter(Boolean) as string[];
}

function channelIcon(channel: InboxItem["channel"]) {
  if (channel === "Instagram") return AtSign;
  if (channel === "Messenger") return Hash;
  if (channel === "Email") return Mail;
  return MessageSquare;
}

function inboxTabFromParams(params: Record<string, string | string[] | undefined>): InboxTabId {
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  return inboxTabs.some((tab) => tab.id === raw) ? (raw as InboxTabId) : "all";
}

function itemMatchesTab(item: InboxItem, tab: InboxTabId) {
  if (tab === "unread") return item.unread > 0;
  if (tab === "needs-reply") return item.needsReply;
  if (tab === "assigned-to-me") return item.assignedToMe;
  return true;
}

function whatsappToForLead(lead?: { contact?: { phone?: string; waId?: string } }) {
  const raw = lead?.contact?.waId || lead?.contact?.phone;
  const digits = raw?.replace(/\D/g, "");
  return digits ? `whatsapp:+${digits}` : undefined;
}

export default async function CommunicationsPage({ searchParams }: CommunicationsPageProps) {
  const params = searchParams ? await searchParams : {};
  const activeTab = inboxTabFromParams(params);
  const session = await getCurrentSession();
  const [extensionBundles, metaConnections, leads] = session
    ? await Promise.all([
        listExtensionConversations(session.tenantId, session.id),
        listMetaOAuthConnections(session.tenantId, session.id),
        listLeadKnowledgeRecords({ tenantId: session.tenantId, ownerId: session.id })
      ])
    : [[], [], []];

  const whatsappScopes = metaConnections
    .filter((connection) => connection.whatsappBusinessAccountId || connection.phoneNumberId)
    .map((connection) =>
      session
        ? listMetaWhatsAppConversations({
            tenantId: session.tenantId,
            ownerId: session.id,
            whatsappBusinessAccountId: connection.whatsappBusinessAccountId,
            phoneNumberId: connection.phoneNumberId
          })
        : Promise.resolve([])
    );
  const whatsappConversations = (await Promise.all(whatsappScopes)).flat();

  const leadBackedIds = new Set(leads.map((lead) => lead.id));
  const leadBackedKeys = new Set(leads.flatMap((lead) => leadIdentityKeys({ id: lead.id, contact: lead.contact })));

  const extensionItems: InboxItem[] = extensionBundles
    .filter((bundle) => !bundle.conversation.leadId || !leadBackedIds.has(bundle.conversation.leadId))
    .map((bundle) => {
      const contact = bundle.conversation.contact.displayName || bundle.conversation.contact.handle || bundle.conversation.contact.phone || bundle.conversation.contact.email || "Unknown contact";
      const lastAt = bundle.conversation.lastMessageAt ?? bundle.conversation.updatedAt;
      const preview = bundle.conversation.lastMessagePreview || bundle.conversation.summary || "No preview yet.";
      const time = relativeTime(lastAt);
      const needsReply = bundle.conversation.status === "needs-human";
      return {
        id: bundle.conversation.id,
        leadId: bundle.conversation.leadId,
        lead: contact,
        contact,
        company: bundle.conversation.leadSource || "Captured by extension",
        channel: extensionChannel(bundle.conversation.platform),
        preview,
        lastMessage: preview,
        time,
        lastActivity: time,
        sortAt: timestampValue(lastAt),
        conversionUrgency: bundle.conversation.status === "needs-human" ? 70 : 20,
        unread: bundle.conversation.status === "needs-human" ? 1 : 0,
        needsReply,
        assignedToMe: false,
        owner: "Unassigned",
        qualification: "Not Yet Collected",
        important: bundle.conversation.status === "needs-human",
        href: bundle.conversation.leadId ? `/app/leads?contact=${bundle.conversation.leadId}&tab=comms` : "/app/worker",
        messages: bundle.messages.slice(-8).map((message) => ({
          id: message.id,
          author: message.direction === "outbound" ? "Leadsy" : contact,
          from: message.direction === "outbound" ? "us" : "lead",
          text: message.body,
          time: relativeTime(message.sentAt)
        }))
      };
    });

  const whatsappItems: InboxItem[] = whatsappConversations
    .filter((conversation) => !leadIdentityKeys({ contactId: conversation.contactId, waId: conversation.waId }).some((key) => leadBackedKeys.has(key)))
    .map((conversation) => {
      const contact = conversation.profileName || conversation.waId || conversation.contactId;
      const preview = conversation.lastMessageText || conversation.lastMessageType;
      const time = relativeTime(conversation.lastMessageAt);
      return {
        id: `wa_${conversation.contactId}`,
        lead: contact,
        contact,
        company: conversation.adOriginated ? "Meta Lead Ad" : "WhatsApp Business",
        channel: "WhatsApp" as const,
        preview,
        lastMessage: preview,
        time,
        lastActivity: time,
        sortAt: timestampValue(conversation.lastMessageAt),
        conversionUrgency: conversation.leadStatus === "lead" && conversation.adOriginated ? 60 : 30,
        unread: conversation.inboundCount,
        needsReply: conversation.inboundCount > 0,
        assignedToMe: false,
        owner: "Unassigned",
        qualification: "Not Yet Collected",
        important: conversation.leadStatus === "lead" && conversation.adOriginated,
        href: conversation.whatsappUrl,
        messages: conversation.messages.slice(-8).map((message) => ({
          id: message.id,
          author: message.direction === "outbound" ? "Leadsy" : message.profileName || message.from,
          from: message.direction === "outbound" ? "us" : "lead",
          text: message.messageText || message.messageType,
          time: relativeTime(message.sentAt)
        }))
      };
    });

  const leadItems: InboxItem[] = buildLeadBackedInboxItems(leads);

  const items = [...leadItems, ...whatsappItems, ...extensionItems]
    .sort((left, right) => right.conversionUrgency - left.conversionUrgency || right.sortAt - left.sortAt)
    .slice(0, 40);
  const visibleItems = items.filter((item) => itemMatchesTab(item, activeTab));
  const active = visibleItems[0];
  const contextLead = active ? leads.find((lead) => active.leadId === lead.id || active.href.includes(lead.id)) : undefined;
  const sender = session ? await getWorkspaceWhatsAppSender({ tenantId: session.tenantId, ownerId: session.id }) : undefined;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <section className="col-span-12 flex min-h-0 flex-col bg-background md:col-span-4 xl:col-span-3">
        <div className="border-b border-border p-3">
          <div className="flex h-7 items-center gap-2 rounded-[5px] border border-border bg-surface-2 px-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <span className="flex-1 text-[12px] text-muted-foreground">Search conversations...</span>
            <span className="kbd">/</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {inboxTabs.map((tab) => (
              <Link
                key={tab.id}
                href={`/app/communications?tab=${tab.id}`}
                className={`h-6 rounded-[4px] px-1.5 py-1 font-mono text-[10.5px] ${activeTab === tab.id ? "bg-surface-3 text-foreground" : "text-muted-foreground"}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">Inbox is a conversion workspace for reply, qualification, owner, and next action.</p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visibleItems.length ? (
            visibleItems.map((item, index) => {
              const Icon = channelIcon(item.channel);
              return (
                <li key={item.id} className={`border-b border-border/70 px-3 py-2.5 hover:bg-surface-2 ${index === 0 ? "bg-surface-2" : ""}`}>
                  <Link href={item.href} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1 truncate text-[12.5px] font-medium">{item.contact}</span>
                      {item.important ? <Star className="h-3 w-3 text-warning" /> : null}
                      <span className="font-mono text-[10.5px] text-muted-foreground">{item.time}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-5 text-[11.5px] text-muted-foreground">
                      <span className="flex-1 truncate">{item.preview}</span>
                      {item.unread > 0 ? <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">{item.unread}</span> : null}
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pl-5 font-mono text-[10px] text-muted-foreground">
                      <span className="truncate">Lead {item.lead}</span>
                      <span className="truncate">Last Message {item.lastMessage}</span>
                      <span className="truncate">Owner {item.owner}</span>
                      <span className="truncate">Qualification {item.qualification}</span>
                      <span className="truncate">Last Activity {item.lastActivity}</span>
                    </div>
                  </Link>
                </li>
              );
            })
          ) : (
            <li className="flex h-48 items-center justify-center px-8 text-center text-[12.5px] text-muted-foreground">
              Conversations matching this inbox view will appear after capture or webhook sync.
            </li>
          )}
        </ul>
      </section>

      <section className="col-span-12 flex min-h-0 flex-col bg-background md:col-span-8 xl:col-span-6">
        {active ? (
          <>
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 font-mono text-[11px]">
                  {active.contact.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-medium">{active.contact}</span>
                    <span className="text-muted-foreground">- {active.company}</span>
                  </div>
                  <div className="font-mono text-[10.5px] text-muted-foreground">{active.channel} - last activity {active.lastActivity} ago</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="grid h-7 w-7 place-items-center rounded-[5px] border border-border bg-surface-2"><Pin className="h-3 w-3" /></span>
                <span className="grid h-7 w-7 place-items-center rounded-[5px] border border-border bg-surface-2"><Star className="h-3 w-3" /></span>
                <span className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 text-[12px]">
                  <Sparkles className="h-3 w-3 text-primary" /> Summarize
                </span>
              </div>
            </header>

            <div className="border-b border-border bg-primary/5 px-4 py-2.5 text-[12px]">
              <div className="flex items-center gap-2">
                <Pin className="h-3 w-3 text-primary" />
                <span className="caption">Pinned - AI summary</span>
                <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{active.time}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-foreground/90">{contextLead?.summary || active.preview}</p>
              {contextLead ? (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-[5px] border border-border/80 bg-background/60 p-2">
                    <div className="caption">Qualification</div>
                    <div className="mt-1 text-[12px] text-foreground/90">{active.qualification}</div>
                  </div>
                  <div className="rounded-[5px] border border-border/80 bg-background/60 p-2">
                    <div className="caption">Owner</div>
                    <div className="mt-1 text-[12px] text-foreground/90">{active.owner}</div>
                  </div>
                  <div className="rounded-[5px] border border-border/80 bg-background/60 p-2">
                    <div className="caption">Suggested next action</div>
                    <div className="mt-1 text-[12px] text-foreground/90">{contextLead.nextAction || (contextLead.crmStatus === "needs_reply" ? "Reply and qualify intent." : "Open lead workspace and continue qualification.")}</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {(active.messages.length ? active.messages : [{ id: "preview", author: active.contact, from: "lead" as const, text: active.preview, time: active.time }]).map((message) => (
                  <div
                    key={message.id}
                    className={`flex max-w-[78%] flex-col gap-1 rounded-[6px] border border-border p-3 ${
                      message.from === "us" ? "ml-auto border-transparent bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    <div className={`flex items-center gap-2 font-mono text-[10.5px] ${message.from === "us" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      <span>{message.author}</span>
                      <span className="opacity-60">-</span>
                      <span>{message.time}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed">{message.text}</p>
                    {message.from === "us" && message.deliveryStatus ? (
                      <div className={`font-mono text-[10px] ${message.from === "us" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {message.deliveryStatus}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border p-3">
              <InboxReplyComposer
                leadId={contextLead?.id}
                to={whatsappToForLead(contextLead)}
                channel={active.channel}
                transportMode={sender?.transportMode}
                senderStatus={sender?.status}
                senderStatusReason={sender?.statusReason}
                senderNumber={sender?.assignedPhoneNumber}
              />
            </div>
          </>
        ) : null}
      </section>

      <aside className="hidden min-h-0 flex-col overflow-y-auto bg-background xl:col-span-3 xl:flex">
        <div className="border-b border-border p-4">
          <div className="caption">Lead context</div>
          <div className="mt-1 text-[13px] font-medium">{active?.contact || "No conversation selected"}</div>
          <div className="text-[12px] text-muted-foreground">{active?.company || "Connect channels to begin."}</div>
        </div>
        <ul className="divide-y divide-border">
          {(contextLead?.facts.slice(0, 4) || []).map((fact, index) => (
            <li key={`${contextLead?.id}-fact-${index}`} className="p-4">
              <div className="caption">Finding</div>
              <div className="mt-1 text-[12.5px] font-medium">{fact}</div>
            </li>
          ))}
          {contextLead ? null : (
            <li className="p-4 text-[12px] text-muted-foreground">
              Lead intelligence, tasks, and notes appear here when the conversation is linked to a Leadsy lead.
            </li>
          )}
        </ul>
      </aside>
    </div>
  );
}
