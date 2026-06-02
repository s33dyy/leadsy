import {
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Inbox,
  ListChecks,
  MessageCircle,
  Phone,
  RadioTower,
  Search,
  UserRound
} from "lucide-react";
import { Badge, EmptyState, Panel, PrimaryLink, SectionTitle } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import {
  listMetaWhatsAppConversations,
  type MetaWhatsAppConversation,
  type MetaWhatsAppInboundMessage
} from "@/lib/meta-whatsapp-webhook-store";

export const dynamic = "force-dynamic";

type LeadsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ViewFilter = "all" | "needs-reply" | "active" | "ads" | "excluded";

const whatsappWebBase = "https://web.whatsapp.com/send";
const viewFilters: Array<{ id: ViewFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs-reply", label: "Needs reply" },
  { id: "active", label: "Active leads" },
  { id: "ads", label: "Ad leads" },
  { id: "excluded", label: "Excluded" }
];

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function shortDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function latestMessage(conversation: MetaWhatsAppConversation) {
  return conversation.lastMessageText || `Received ${conversation.lastMessageType} message`;
}

function latestDirection(conversation: MetaWhatsAppConversation) {
  return conversation.messages.at(-1)?.direction ?? "inbound";
}

function needsReply(conversation: MetaWhatsAppConversation) {
  return conversation.leadStatus === "lead" && latestDirection(conversation) === "inbound";
}

function crmStage(conversation: MetaWhatsAppConversation) {
  if (conversation.leadStatus === "excluded") return "Not a lead";
  if (needsReply(conversation)) return "Needs reply";
  if (conversation.outboundCount > 0) return "Working";
  if (conversation.adOriginated) return "New ad lead";
  return "New lead";
}

function stageTone(stage: string): "teal" | "amber" | "lime" | "sky" | "neutral" {
  if (stage === "Needs reply") return "amber";
  if (stage === "Working") return "sky";
  if (stage === "New ad lead") return "lime";
  if (stage === "Not a lead") return "neutral";
  return "teal";
}

function nextAction(conversation: MetaWhatsAppConversation) {
  if (conversation.leadStatus === "excluded") return "Track only. No sales follow-up.";
  if (needsReply(conversation)) return "Reply in WhatsApp and qualify intent.";
  if (!conversation.outboundCount) return "Open WhatsApp and start qualification.";
  return "Wait for reply or log the next outcome.";
}

function noticeCopy(params: Record<string, string | string[] | undefined>) {
  const notice = paramValue(params, "notice");
  if (notice === "contact-excluded") return "Contact excluded from leads. The conversation is still tracked.";
  if (notice === "contact-restored") return "Contact restored as a lead.";
  return "";
}

function contactLabel(conversation: MetaWhatsAppConversation) {
  return conversation.profileName || conversation.waId || conversation.contactId;
}

function whatsappHref(conversation: MetaWhatsAppConversation) {
  return conversation.whatsappUrl || `${whatsappWebBase}?phone=${encodeURIComponent(conversation.contactId)}`;
}

function crmHref(input: {
  view?: ViewFilter;
  q?: string;
  contact?: string;
}) {
  const params = new URLSearchParams();
  if (input.view && input.view !== "all") params.set("view", input.view);
  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.contact) params.set("contact", input.contact);
  const query = params.toString();
  return query ? `/app/leads?${query}` : "/app/leads";
}

function matchesQuery(conversation: MetaWhatsAppConversation, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    contactLabel(conversation),
    conversation.contactId,
    conversation.waId,
    conversation.displayPhoneNumber,
    latestMessage(conversation),
    crmStage(conversation),
    nextAction(conversation)
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

function matchesView(conversation: MetaWhatsAppConversation, view: ViewFilter) {
  if (view === "needs-reply") return needsReply(conversation);
  if (view === "active") return conversation.leadStatus === "lead";
  if (view === "ads") return conversation.adOriginated;
  if (view === "excluded") return conversation.leadStatus === "excluded";
  return true;
}

function filterConversations(conversations: MetaWhatsAppConversation[], view: ViewFilter, query: string) {
  return conversations.filter((conversation) => matchesView(conversation, view) && matchesQuery(conversation, query));
}

function activityTitle(message: MetaWhatsAppInboundMessage) {
  if (message.direction === "outbound") return "Outbound WhatsApp";
  return "Inbound WhatsApp";
}

function activityText(message: MetaWhatsAppInboundMessage) {
  return message.messageText || `${message.messageType} message`;
}

function Metric({
  label,
  value,
  tone = "teal"
}: {
  label: string;
  value: string | number;
  tone?: "teal" | "amber" | "lime" | "sky";
}) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
      <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-2xl font-semibold text-white">{value}</div>
        <Badge tone={tone}>ops</Badge>
      </div>
    </div>
  );
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = searchParams ? await searchParams : {};
  const session = await getCurrentSession();
  const conversations = session
    ? await listMetaWhatsAppConversations({ tenantId: session.tenantId, ownerId: session.id })
    : [];
  const requestedView = paramValue(params, "view") as ViewFilter;
  const activeView = viewFilters.some((filter) => filter.id === requestedView) ? requestedView : "all";
  const query = paramValue(params, "q");
  const filteredConversations = filterConversations(conversations, activeView, query);
  const selectedContact = paramValue(params, "contact");
  const selectedConversation =
    filteredConversations.find((conversation) => conversation.contactId === selectedContact) ??
    conversations.find((conversation) => conversation.contactId === selectedContact) ??
    filteredConversations[0] ??
    conversations[0] ??
    null;
  const activeLeads = conversations.filter((conversation) => conversation.leadStatus === "lead");
  const replyQueue = conversations.filter(needsReply);
  const excludedContacts = conversations.filter((conversation) => conversation.leadStatus === "excluded");
  const notice = noticeCopy(params);

  return (
    <div className="space-y-5">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Lead Operations" title="CRM pipeline" />
          <div className="flex flex-wrap gap-2">
            <Badge tone="teal">All WhatsApp conversations</Badge>
            <Badge tone="amber">{replyQueue.length} Needs reply</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total records" value={conversations.length} />
          <Metric label="Active leads" value={activeLeads.length} tone="lime" />
          <Metric label="Needs reply" value={replyQueue.length} tone="amber" />
          <Metric label="Ad-sourced" value={conversations.filter((conversation) => conversation.adOriginated).length} tone="sky" />
          <Metric label="Excluded" value={excludedContacts.length} tone="amber" />
        </div>

        {notice ? (
          <div className="mt-4 rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] px-3 py-2 text-sm leading-6 text-teal-50">
            {notice}
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.34fr)_minmax(360px,0.66fr)]">
        <Panel className="min-w-0 p-4 md:p-5" data-testid="lead-crm-table">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ListChecks size={17} className="text-[var(--teal)]" />
              Pipeline records
            </div>
            <Badge tone="neutral">{filteredConversations.length} shown</Badge>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <form method="get" action="/app/leads" className="flex min-w-0 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-black/20 px-3">
              {activeView !== "all" ? <input type="hidden" name="view" value={activeView} /> : null}
              <Search size={15} className="shrink-0 text-[var(--muted)]" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search name, phone, status, message"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[var(--muted)]"
              />
            </form>
            <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
              <Filter size={15} className="shrink-0 text-[var(--muted)]" />
              {viewFilters.map((filter) => (
                <a
                  key={filter.id}
                  href={crmHref({ view: filter.id, q: query })}
                  className={`inline-flex h-9 shrink-0 items-center rounded-[6px] border px-3 text-xs font-medium ${
                    activeView === filter.id
                      ? "border-teal-300/40 bg-teal-300/[0.12] text-teal-100"
                      : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
                  }`}
                >
                  {filter.label}
                </a>
              ))}
            </div>
          </div>

          {filteredConversations.length ? (
            <div className="mt-4 overflow-x-auto rounded-[8px] border border-[var(--line)] bg-black/20">
              <table className="min-w-[1040px] w-full border-collapse text-left">
                <thead className="border-b border-[var(--line)] bg-white/[0.03]">
                  <tr className="mono text-[10px] uppercase text-[var(--muted)]">
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Last touch</th>
                    <th className="px-4 py-3 font-medium">Logged comms</th>
                    <th className="px-4 py-3 font-medium">Next action</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConversations.map((conversation) => {
                    const stage = crmStage(conversation);
                    const selected = selectedConversation?.contactId === conversation.contactId;
                    return (
                      <tr
                        key={conversation.contactId}
                        className={`border-b border-[var(--line)] last:border-b-0 ${
                          selected ? "bg-teal-300/[0.07]" : "hover:bg-white/[0.025]"
                        }`}
                      >
                        <td className="px-4 py-4 align-top">
                          <a
                            href={crmHref({ view: activeView, q: query, contact: conversation.contactId })}
                            className="inline-flex max-w-[230px] items-center gap-2 text-sm font-semibold text-white hover:text-teal-100"
                          >
                            <UserRound size={15} className="shrink-0 text-[var(--teal)]" />
                            <span className="truncate">{contactLabel(conversation)}</span>
                          </a>
                          <div className="mono mt-2 break-all text-xs text-[var(--muted)]">{conversation.contactId}</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={stageTone(stage)}>{stage}</Badge>
                            {conversation.adOriginated ? (
                              <Badge tone="lime">
                                <RadioTower size={12} />
                                ad
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="max-w-[260px] px-4 py-4 align-top">
                          <p className="line-clamp-2 text-sm leading-6 text-[var(--muted-2)]">{latestMessage(conversation)}</p>
                          <div className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                            <Clock size={13} />
                            {shortDate(conversation.lastMessageAt)}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone="teal">{conversation.inboundCount} in</Badge>
                            <Badge tone="sky">{conversation.outboundCount} out</Badge>
                          </div>
                        </td>
                        <td className="max-w-[260px] px-4 py-4 align-top text-sm leading-6 text-[var(--muted-2)]">
                          {nextAction(conversation)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex min-w-[240px] flex-wrap gap-2">
                            <a
                              href={whatsappHref(conversation)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-xs font-medium text-teal-100 hover:bg-teal-300/[0.18]"
                            >
                              <MessageCircle size={14} />
                              WhatsApp
                              <ExternalLink size={13} />
                            </a>
                            <form action="/api/meta/whatsapp/conversations/lead-status" method="post">
                              <input type="hidden" name="contactId" value={conversation.contactId} />
                              <input
                                type="hidden"
                                name="leadStatus"
                                value={conversation.leadStatus === "excluded" ? "lead" : "excluded"}
                              />
                              <button
                                type="submit"
                                className={`inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border px-3 text-xs font-medium ${
                                  conversation.leadStatus === "excluded"
                                    ? "border-lime-300/25 bg-lime-300/10 text-lime-100 hover:bg-lime-300/[0.16]"
                                    : "border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/[0.16]"
                                }`}
                              >
                                {conversation.leadStatus === "excluded" ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                                {conversation.leadStatus === "excluded" ? "Restore" : "Exclude contact"}
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                icon={Inbox}
                title="No records in this view"
                detail="Change the filter or wait for new WhatsApp messages. Every inbound or echo event will be logged here."
              />
            </div>
          )}
        </Panel>

        <Panel className="min-w-0 p-4 md:p-5" data-testid="lead-record-panel">
          {selectedConversation ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mono text-[11px] uppercase text-[var(--teal)]">Selected record</div>
                  <h3 className="mt-1 truncate text-2xl font-semibold text-white">{contactLabel(selectedConversation)}</h3>
                  <div className="mono mt-2 break-all text-xs text-[var(--muted)]">{selectedConversation.contactId}</div>
                </div>
                <Badge tone={stageTone(crmStage(selectedConversation))}>{crmStage(selectedConversation)}</Badge>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <a
                  href={whatsappHref(selectedConversation)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
                >
                  <Phone size={15} />
                  Open WhatsApp
                  <ExternalLink size={13} />
                </a>
                <form action="/api/meta/whatsapp/conversations/lead-status" method="post">
                  <input type="hidden" name="contactId" value={selectedConversation.contactId} />
                  <input
                    type="hidden"
                    name="leadStatus"
                    value={selectedConversation.leadStatus === "excluded" ? "lead" : "excluded"}
                  />
                  <button
                    type="submit"
                    className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border px-3 text-sm font-medium ${
                      selectedConversation.leadStatus === "excluded"
                        ? "border-lime-300/25 bg-lime-300/10 text-lime-100 hover:bg-lime-300/[0.16]"
                        : "border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/[0.16]"
                    }`}
                  >
                    {selectedConversation.leadStatus === "excluded" ? <CheckCircle2 size={15} /> : <Ban size={15} />}
                    {selectedConversation.leadStatus === "excluded" ? "Restore as lead" : "Exclude contact"}
                  </button>
                </form>
              </div>

              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ListChecks size={16} className="text-[var(--teal)]" />
                  Next action
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{nextAction(selectedConversation)}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Inbound", selectedConversation.inboundCount],
                  ["Outbound", selectedConversation.outboundCount],
                  ["Last touch", shortDate(selectedConversation.lastMessageAt)]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                    <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
                    <div className="mt-2 break-words text-sm font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <MessageCircle size={16} className="text-[var(--teal)]" />
                    Activity timeline
                  </div>
                  <Badge tone="neutral">{selectedConversation.messageCount} logged comms</Badge>
                </div>
                <div className="mt-3 grid max-h-[520px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
                  {[...selectedConversation.messages].reverse().map((message) => (
                    <div key={message.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <MessageCircle size={14} className={message.direction === "outbound" ? "text-sky-200" : "text-[var(--teal)]"} />
                          {activityTitle(message)}
                        </div>
                        <Badge tone={message.direction === "outbound" ? "sky" : "teal"}>{message.direction}</Badge>
                      </div>
                      <p className="mt-2 break-words text-sm leading-6 text-[var(--muted-2)]">{activityText(message)}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                        <span>{formatDate(message.sentAt)}</span>
                        {message.referral ? <Badge tone="lime">Meta ad referral</Badge> : null}
                        <span className="mono break-all">{message.messageId}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No lead selected"
              detail="When WhatsApp conversations arrive, select one from the CRM pipeline to see the communication log and next action."
              action={<PrimaryLink href="/app/connect">Open connection config</PrimaryLink>}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
