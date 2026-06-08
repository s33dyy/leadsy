"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, CalendarDays, Mail, MessageSquare, Phone, Search, Sparkles, Star, Users2 } from "lucide-react";
import { InboxReplyComposer } from "@/components/inbox-reply-composer";
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

function itemMatchesTab(item: StabilizedInboxItem, tab: InboxTabId) {
  if (tab === "unread") return item.unread > 0;
  if (tab === "needs-reply") return item.needsReply;
  if (tab === "assigned-to-me") return item.assignedToMe;
  return true;
}

function channelIcon(channel: StabilizedInboxItem["channel"]) {
  if (channel === "Email") return Mail;
  if (channel === "Call") return Phone;
  return MessageSquare;
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
  const [items, setItems] = useState(initialItems);
  const visibleItems = useMemo(() => items.filter((item) => itemMatchesTab(item, activeTab)), [activeTab, items]);
  const active =
    visibleItems.find((item) => item.conversationId === selectedConversationId) ??
    items.find((item) => item.conversationId === selectedConversationId) ??
    visibleItems[0];

  useEffect(() => {
    const stream = new EventSource("/api/conversations/stream");
    stream.addEventListener("snapshot", (event) => {
      const snapshot = JSON.parse((event as MessageEvent).data) as ConversationsSnapshot;
      setItems(snapshot.items);
    });
    return () => stream.close();
  }, []);

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
                    <Link href={`/app/communications?conversation=${item.conversationId}`} className="flex flex-col gap-1">
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
                <Link href={`/app/leads?contact=${active.leadId}&tab=conversation`} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 text-[12px]">
                  <Users2 className="h-3 w-3" /> Open lead
                </Link>
                <span className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 text-[12px]">
                  <Sparkles className="h-3 w-3 text-primary" /> Summarize
                </span>
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

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {active.messages.map((message) => (
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
