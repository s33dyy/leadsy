"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, CalendarDays, Mail, MessageSquare, Phone, Search, Star, Users2 } from "lucide-react";
import { InboxReplyComposer } from "@/components/inbox-reply-composer";
import { LeadSummaryModal, type LeadSummaryMessage } from "@/components/lead-summary-modal";
import { Badge } from "@/components/ui";
import type { CalendarEvent } from "@/lib/calendar-store";
import type { StabilizedInboxItem } from "@/lib/inbox-stabilization";
import type { LeadKnowledgeRecord } from "@/lib/lead-knowledge-store";
import type { ConversationsSnapshot } from "@/lib/live-conversation-snapshots";
import type { TeamMember, TeamThreadMessage } from "@/lib/teamspace-store";
import type { WorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

const inboxTabs = [
  { id: "unread", label: "Unread" },
  { id: "needs-reply", label: "Needs Reply" },
  { id: "assigned-to-me", label: "Assigned To Me" },
  { id: "all", label: "All Conversations" }
] as const;

export type InboxTabId = (typeof inboxTabs)[number]["id"];

type CommunicationsConsoleProps = {
  activeTab: InboxTabId;
  selectedConversationId?: string;
  initialItems: StabilizedInboxItem[];
  contextLead?: LeadKnowledgeRecord;
  sender?: WorkspaceWhatsAppSender;
  assignedMember?: TeamMember;
  autoReplyOwner?: TeamMember;
  internalThread: TeamThreadMessage[];
  leadCalendarEvents: CalendarEvent[];
};

type ConversationChannel = "whatsapp" | "email" | "call";

function itemMatchesTab(item: StabilizedInboxItem, tab: InboxTabId) {
  if (tab === "unread") return item.unread > 0;
  if (tab === "needs-reply") return item.needsReply;
  if (tab === "assigned-to-me") return item.assignedToMe;
  return true;
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function itemMatchesSearch(item: StabilizedInboxItem, query: string) {
  const clean = query.trim().toLowerCase();
  if (!clean) return true;
  const messageText = item.channelTabs
    .flatMap((tab) => tab.messages.map((message) => message.text))
    .join(" ");
  const haystack = [
    item.lead,
    item.contact,
    item.company,
    item.channel,
    item.preview,
    item.lastMessage,
    item.owner,
    item.qualification,
    item.lastActivity,
    ...item.channelTabs.map((tab) => `${tab.label} ${tab.preview ?? ""}`),
    messageText
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(clean);
}

function channelIcon(channel: StabilizedInboxItem["channel"]) {
  if (channel === "Email") return Mail;
  if (channel === "Call") return Phone;
  return MessageSquare;
}

function channelLabel(channel: ConversationChannel) {
  if (channel === "email") return "Email";
  if (channel === "call") return "Calls";
  return "WhatsApp";
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "L"
  );
}

function whatsappToForLead(lead?: { contact?: { phone?: string; waId?: string } }) {
  const raw = lead?.contact?.waId || lead?.contact?.phone;
  const digits = raw?.replace(/\D/g, "");
  return digits ? `whatsapp:+${digits}` : undefined;
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function CommunicationsConsole({
  activeTab,
  selectedConversationId,
  initialItems,
  contextLead,
  sender,
  assignedMember,
  autoReplyOwner,
  internalThread,
  leadCalendarEvents
}: CommunicationsConsoleProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [conversationQuery, setConversationQuery] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const conversationSearchRef = useRef<HTMLInputElement>(null);
  const tabItems = useMemo(() => items.filter((item) => itemMatchesTab(item, activeTab)), [activeTab, items]);
  const visibleItems = useMemo(
    () => tabItems.filter((item) => itemMatchesSearch(item, conversationQuery)),
    [conversationQuery, tabItems]
  );
  const active =
    visibleItems.find((item) => item.conversationId === selectedConversationId) ??
    items.find((item) => item.conversationId === selectedConversationId) ??
    visibleItems[0];
  const requestedChannel = searchParams.get("channel");
  const activeChannel: ConversationChannel =
    requestedChannel === "email" || requestedChannel === "call" ? requestedChannel : "whatsapp";
  const activeChannelTab =
    active?.channelTabs.find((tab) => tab.channel === activeChannel) ??
    active?.channelTabs.find((tab) => tab.channel === "whatsapp") ??
    active?.channelTabs[0];
  const activeMessages = activeChannelTab?.messages ?? [];
  const activeLeadHref = active ? `/app/leads?contact=${active.leadId}&tab=comms&channel=${activeChannelTab?.channel ?? "whatsapp"}` : "/app/leads";

  useEffect(() => {
    const stream = new EventSource("/api/conversations/stream");
    stream.addEventListener("snapshot", (event) => {
      const snapshot = JSON.parse((event as MessageEvent).data) as ConversationsSnapshot;
      setItems(snapshot.items);
    });
    return () => stream.close();
  }, []);

  useEffect(() => {
    function pushInboxTab(tab: InboxTabId) {
      const params = new URLSearchParams({ tab });
      if (active?.conversationId) params.set("conversation", active.conversationId);
      params.set("channel", activeChannelTab?.channel ?? "whatsapp");
      router.push(`/app/communications?${params.toString()}`);
    }

    function handleCommunicationsShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() !== "s") return;
        event.preventDefault();
        if (active) setSummaryOpen(true);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isEditableShortcutTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "/") {
        event.preventDefault();
        conversationSearchRef.current?.focus();
        return;
      }
      if (key === "u") {
        event.preventDefault();
        pushInboxTab("unread");
      }
      if (key === "r") {
        event.preventDefault();
        pushInboxTab("needs-reply");
      }
      if (key === "m") {
        event.preventDefault();
        pushInboxTab("assigned-to-me");
      }
      if (key === "a") {
        event.preventDefault();
        pushInboxTab("all");
      }
      if (key === "o" && active) {
        event.preventDefault();
        router.push(activeLeadHref);
      }
      if (key === "t" && active) {
        event.preventDefault();
        router.push(`/app/leads?contact=${active.leadId}&tab=tasks`);
      }
      if (key === "q") {
        event.preventDefault();
        router.push("/app/approvals");
      }
    }

    window.addEventListener("keydown", handleCommunicationsShortcut);
    return () => window.removeEventListener("keydown", handleCommunicationsShortcut);
  }, [active, activeChannelTab?.channel, activeLeadHref, router]);

  const summaryMessages: LeadSummaryMessage[] = activeMessages.slice(-8).map((message) => ({
    id: message.id,
    label: `${message.from === "us" ? "Leadsy" : "Lead"} - ${message.time}`,
    body: message.text,
    meta: message.deliveryStatus
  }));
  const summaryInternalNotes: LeadSummaryMessage[] = internalThread.slice(-5).map((message) => ({
    id: message.id,
    label: `${message.authorType} - ${message.eventType}`,
    body: message.body
  }));
  const summaryCalendarEvents: LeadSummaryMessage[] = leadCalendarEvents.map((event) => ({
    id: event.id,
    label: event.status,
    body: event.title,
    meta: formatEventTime(event.startAt)
  }));
  const missingFields = contextLead
    ? Object.entries(contextLead.qualificationFields)
        .filter(([, value]) => !String(value ?? "").trim())
        .map(([field]) => field)
    : [];

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <section className="col-span-12 flex min-h-0 flex-col bg-background md:col-span-4 xl:col-span-3">
        <div className="border-b border-border p-3">
          <div className="flex h-7 items-center gap-2 rounded-[5px] border border-border bg-surface-2 px-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              ref={conversationSearchRef}
              value={conversationQuery}
              onChange={(event) => setConversationQuery(event.target.value)}
              placeholder="Search conversations..."
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
            />
            <span className="kbd">/</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {inboxTabs.map((tab) => (
              <Link
                key={tab.id}
                href={`/app/communications?tab=${tab.id}${selectedConversationId ? `&conversation=${selectedConversationId}` : ""}`}
                className={`h-6 rounded-[4px] px-1.5 py-1 font-mono text-[10.5px] ${activeTab === tab.id ? "bg-surface-3 text-foreground" : "text-muted-foreground"}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">
            Inbox is the primary workspace for WhatsApp qualification, owner handoff, and human or AI replies.
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visibleItems.length ? (
            <>
              <li className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>Lead / Last Message</span>
                <span>Owner / Qualification</span>
              </li>
              {visibleItems.map((item) => {
                const Icon = channelIcon(item.channel);
                const selected = active?.conversationId === item.conversationId;
                return (
                  <li key={item.conversationId} className={`border-b border-border/70 px-3 py-2.5 hover:bg-surface-2 ${selected ? "bg-surface-2" : ""}`}>
                    <Link href={`/app/communications?conversation=${item.conversationId}&channel=${item.channelTabs[0]?.channel ?? "whatsapp"}`} className="flex flex-col gap-1">
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
                        <span className="truncate">Owner {item.owner}</span>
                        <span className="truncate">Qualification {item.qualification}</span>
                        <span className="truncate">Last Activity {item.lastActivity}</span>
                        <span className="truncate">{item.channel}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </>
          ) : (
            <li className="flex h-48 items-center justify-center px-8 text-center text-[12.5px] text-muted-foreground">
              Real lead-backed conversations will appear here after inbound capture or simulator sync.
            </li>
          )}
        </ul>
      </section>

      <section className="col-span-12 flex min-h-0 flex-col bg-background md:col-span-8 xl:col-span-6">
        {active ? (
          <>
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-3 font-mono text-[11px]">
                  {initials(active.contact)}
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2 text-[13px]">
                    <span className="truncate font-medium">{active.contact}</span>
                    <span className="truncate text-muted-foreground">- {active.company}</span>
                  </div>
                  <div className="font-mono text-[10.5px] text-muted-foreground">{active.channel} - last activity {active.lastActivity} ago</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Link href={activeLeadHref} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 text-[12px]">
                  <Users2 className="h-3 w-3" /> Open lead
                </Link>
                <LeadSummaryModal
                  open={summaryOpen}
                  onOpenChange={setSummaryOpen}
                  title={`${active.contact} summary`}
                  subtitle={active.company}
                  summary={contextLead?.summary || active.preview}
                  nextAction={contextLead?.nextAction}
                  owner={assignedMember?.name || active.owner}
                  qualification={active.qualification}
                  messages={summaryMessages}
                  internalNotes={summaryInternalNotes}
                  calendarEvents={summaryCalendarEvents}
                  missingFields={missingFields}
                  facts={contextLead?.facts}
                />
              </div>
            </header>

            <div className="border-b border-border bg-primary/5 px-4 py-2.5 text-[12px]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="teal">Stage {active.qualification}</Badge>
                <Badge tone={assignedMember?.type?.startsWith("ai_agent") ? "violet" : "neutral"}>
                  Owner {assignedMember?.name || active.owner}
                </Badge>
                <Badge tone={autoReplyOwner ? "teal" : "neutral"}>Auto-reply {autoReplyOwner ? "on" : "off"}</Badge>
              </div>
              <p className="mt-2 text-[12.5px] text-foreground/90">{contextLead?.summary || active.preview}</p>
              {contextLead ? (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-[5px] border border-border/80 bg-background/60 p-2">
                    <div className="caption">Qualification</div>
                    <div className="mt-1 text-[12px] text-foreground/90">{active.qualification}</div>
                  </div>
                  <div className="rounded-[5px] border border-border/80 bg-background/60 p-2">
                    <div className="caption">Owner</div>
                    <div className="mt-1 text-[12px] text-foreground/90">{assignedMember?.name || active.owner}</div>
                  </div>
                  <div className="rounded-[5px] border border-border/80 bg-background/60 p-2">
                    <div className="caption">Suggested next action</div>
                    <div className="mt-1 text-[12px] text-foreground/90">{contextLead.nextAction || "Continue qualification."}</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-4">
              {(["whatsapp", "email", "call"] as ConversationChannel[]).map((channel) => {
                const tab = active.channelTabs.find((candidate) => candidate.channel === channel);
                const selected = activeChannelTab?.channel === channel;
                return (
                  <Link
                    key={channel}
                    href={`/app/communications?conversation=${active.conversationId}&channel=${channel}`}
                    className={`rounded-[5px] px-2.5 py-1.5 text-[12px] ${selected ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:bg-surface-2"}`}
                  >
                    {channelLabel(channel)} <span className="font-mono text-[10px] text-muted-foreground">{tab?.messageCount ?? 0}</span>
                  </Link>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {activeMessages.length ? activeMessages.map((message) => (
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
                      <div className="font-mono text-[10px] text-primary-foreground/70">{message.deliveryStatus}</div>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-[6px] border border-border bg-surface p-4 text-[13px] text-muted-foreground">
                    No {activeChannelTab ? channelLabel(activeChannelTab.channel).toLowerCase() : "channel"} activity tracked for this lead yet.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border p-3">
              {activeChannelTab?.channel === "whatsapp" ? (
                <InboxReplyComposer
                  leadId={contextLead?.id}
                  to={whatsappToForLead(contextLead)}
                  channel={active.channel}
                  transportMode={sender?.transportMode}
                  senderStatus={sender?.status}
                  senderStatusReason={sender?.statusReason}
                  senderNumber={sender?.assignedPhoneNumber}
                />
              ) : (
                <div className="rounded-[6px] border border-border bg-surface p-3 text-[12.5px] text-muted-foreground">
                  {channelLabel(activeChannelTab?.channel ?? "email")} is tracked here for context. Log new email or call activity from the lead CRM Comms tab.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
            No lead-backed conversation selected.
          </div>
        )}
      </section>

      <aside className="hidden min-h-0 flex-col overflow-y-auto bg-background xl:col-span-3 xl:flex">
        <div className="border-b border-border p-4">
          <div className="caption">Lead context</div>
          <div className="mt-1 text-[13px] font-medium">{active?.contact || "No conversation selected"}</div>
          <div className="text-[12px] text-muted-foreground">{contextLead?.leadSource || "WhatsApp-first CRM"}</div>
        </div>

        <section className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-primary" />
            <div className="caption">Internal team thread</div>
          </div>
          {internalThread.length ? (
            <div className="mt-3 space-y-2">
              {internalThread.slice(-5).map((message) => (
                <div key={message.id} className="rounded-[6px] border border-border bg-surface p-2">
                  <div className="font-mono text-[10px] text-muted-foreground">{message.authorType} - {message.eventType}</div>
                  <p className="mt-1 text-[12px] leading-5">{message.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[12px] leading-5 text-muted-foreground">Internal AI/human notes, task assignments, and handoff summaries stay separate from external WhatsApp messages.</p>
          )}
        </section>

        <section className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <div className="caption">Calendar proposals</div>
          </div>
          {leadCalendarEvents.length ? (
            <div className="mt-3 space-y-2">
              {leadCalendarEvents.map((event) => (
                <div key={event.id} className="rounded-[6px] border border-border bg-surface p-2">
                  <div className="text-[12px] font-medium">{event.title}</div>
                  <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">{formatEventTime(event.startAt)} - {event.status}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[12px] leading-5 text-muted-foreground">Meetings and held slots linked to this lead will appear here.</p>
          )}
        </section>

        <ul className="divide-y divide-border">
          {(contextLead?.facts.slice(0, 4) || []).map((fact, index) => (
            <li key={`${contextLead?.id}-fact-${index}`} className="p-4">
              <div className="caption">Finding</div>
              <div className="mt-1 text-[12.5px] font-medium">{fact}</div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
