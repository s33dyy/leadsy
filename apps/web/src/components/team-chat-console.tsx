"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bot, MessageSquare, Send, Users2 } from "lucide-react";
import { Badge } from "@/components/ui";
import type { LeadKnowledgeRecord } from "@/lib/lead-knowledge-store";
import type { TeamMember, TeamThreadMessage } from "@/lib/teamspace-store";

type TeamChatConsoleProps = {
  initialMessages: TeamThreadMessage[];
  members: TeamMember[];
  leads: LeadKnowledgeRecord[];
};

type TeamChatSnapshot = {
  messages: TeamThreadMessage[];
};

function leadName(lead: LeadKnowledgeRecord) {
  return lead.contact.displayName || lead.contact.phone || lead.contact.email || "Lead";
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function authorLabel(message: TeamThreadMessage, members: TeamMember[]) {
  if (message.authorType === "system") return "Leadsy";
  const member = message.authorMemberId ? members.find((candidate) => candidate.id === message.authorMemberId) : undefined;
  if (member) return member.name;
  return message.authorType === "ai_agent" ? "AI Agent" : "Human";
}

export function TeamChatConsole({ initialMessages, members, leads }: TeamChatConsoleProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [leadId, setLeadId] = useState("");
  const [pending, setPending] = useState(false);
  const [mentionState, setMentionState] = useState<{ start: number; end: number; query: string; activeIndex: number } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const aiMembers = useMemo(() => members.filter((member) => member.type.startsWith("ai_agent")), [members]);
  const mentionQuery = mentionState?.query ?? "";
  const suggestedMembers = useMemo(() => {
    if (!mentionState) return [];
    const query = mentionQuery.toLowerCase();
    return members
      .filter((member) => member.name.toLowerCase().includes(query))
      .sort((left, right) => {
        const leftAi = left.type.startsWith("ai_agent") ? 0 : 1;
        const rightAi = right.type.startsWith("ai_agent") ? 0 : 1;
        return leftAi - rightAi || left.name.localeCompare(right.name);
      })
      .slice(0, 6);
  }, [members, mentionQuery, mentionState]);

  useEffect(() => {
    const stream = new EventSource("/api/team-chat/stream");
    stream.addEventListener("snapshot", (event) => {
      const snapshot = JSON.parse((event as MessageEvent).data) as TeamChatSnapshot;
      setMessages(snapshot.messages);
    });
    return () => stream.close();
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    });
  }, [messages.length]);

  function updateMentionQuery(value: string, cursor: number) {
    const beforeCursor = value.slice(0, cursor);
    const match = /(^|\s)@([A-Za-z0-9 ._-]{0,40})$/.exec(beforeCursor);
    if (!match) {
      setMentionState(null);
      return;
    }
    const query = match[2] ?? "";
    const start = beforeCursor.lastIndexOf("@");
    setMentionState({ start, end: cursor, query, activeIndex: 0 });
  }

  function updateBody(value: string, cursor: number) {
    setBody(value);
    updateMentionQuery(value, cursor);
  }

  function insertMention(member: TeamMember) {
    if (!mentionState) return;
    const before = body.slice(0, mentionState.start);
    const after = body.slice(mentionState.end);
    const next = `${before}@${member.name} ${after}`;
    const cursor = before.length + member.name.length + 2;
    setBody(next);
    setMentionState(null);
    window.requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionState && suggestedMembers.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionState((current) => current ? { ...current, activeIndex: (current.activeIndex + 1) % suggestedMembers.length } : current);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionState((current) => current ? { ...current, activeIndex: (current.activeIndex - 1 + suggestedMembers.length) % suggestedMembers.length } : current);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        insertMention(suggestedMembers[mentionState.activeIndex] ?? suggestedMembers[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionState(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody || pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/team-chat/messages", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({ body: cleanBody, leadId: leadId || undefined })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: TeamThreadMessage;
        messages?: TeamThreadMessage[];
        aiResult?: { message?: TeamThreadMessage };
      };
      if (response.ok) {
        setBody("");
        setMessages((current) => {
          if (payload.messages?.length) return payload.messages;
          const next = [...current];
          for (const message of [payload.message, payload.aiResult?.message]) {
            if (message && !next.some((candidate) => candidate.id === message.id)) next.push(message);
          }
          return next.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <section className="col-span-12 flex min-h-0 flex-col bg-background xl:col-span-9">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight">Workspace group chat</h1>
            <p className="truncate text-xs text-muted-foreground">Mention AI agents with @ for one guarded response.</p>
          </div>
          <Badge tone="teal">live</Badge>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent)] p-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-3">
            {messages.length ? messages.map((message) => {
              const linkedLead = message.leadId ? leads.find((lead) => lead.id === message.leadId) : undefined;
              const isSystemEvent = message.authorType === "system" || message.eventType === "assignment_changed" || message.eventType === "task_generated";
              if (isSystemEvent) {
                return (
                  <div key={message.id} className="flex justify-center">
                    <div className="max-w-[82%] rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-center text-[12px] text-primary shadow-sm">
                      <span className="font-medium">{message.body}</span>
                      {linkedLead ? (
                        <Link href={`/app/leads?contact=${linkedLead.id}`} className="ml-2 inline-flex items-center gap-1 underline-offset-2 hover:underline">
                          <Users2 className="h-3 w-3" /> {leadName(linkedLead)}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              }
              const sentByHuman = message.authorType === "human";
              return (
                <article key={message.id} className={`flex ${sentByHuman ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`whatsapp-chat-bubble max-w-[min(720px,85%)] rounded-[10px] border px-3 py-2 shadow-sm ${
                      sentByHuman ? "border-primary/35 bg-primary/15" : message.authorType === "ai_agent" ? "border-violet-300/25 bg-violet-300/10" : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-medium">{authorLabel(message, members)}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{message.eventType.replace(/_/g, " ")}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{timeLabel(message.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                    {linkedLead ? (
                      <Link href={`/app/leads?contact=${linkedLead.id}`} className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-primary">
                        <Users2 className="h-3 w-3" /> {leadName(linkedLead)}
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            }) : (
              <div className="grid h-64 place-items-center rounded-[8px] border border-border bg-surface text-center text-sm text-muted-foreground">
                Workspace assignment events, task events, and human messages will appear here.
              </div>
            )}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        </div>

        <form onSubmit={submit} className="border-t border-border bg-background p-3">
          <div className="mx-auto flex max-w-5xl flex-col gap-2">
            <select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="h-9 rounded-[18px] border border-border bg-surface px-3 text-sm outline-none focus:border-primary md:w-72">
              <option value="">Workspace-wide</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {leadName(lead)}
                </option>
              ))}
            </select>
            <div className="relative flex items-end gap-2">
              {mentionState && suggestedMembers.length ? (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-border bg-surface shadow-2xl">
                  {suggestedMembers.map((member, index) => (
                    <button
                      key={member.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        insertMention(member);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${index === mentionState.activeIndex ? "bg-surface-3" : "hover:bg-surface-2"}`}
                    >
                      <span>{member.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {member.type === "human" ? "human" : member.type === "ai_agent_full" ? "full AI" : "assisted AI"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(event) => updateBody(event.target.value, event.target.selectionStart)}
                onKeyDown={handleComposerKeyDown}
                onClick={(event) => updateMentionQuery(event.currentTarget.value, event.currentTarget.selectionStart)}
                rows={2}
                placeholder="Message the team. Type @ to mention a teammate or AI agent."
                className="min-h-12 min-w-0 flex-1 resize-none rounded-[18px] border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <button type="submit" disabled={pending || !body.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" aria-label="Send team message">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </section>

      <aside className="hidden min-h-0 overflow-y-auto bg-background p-4 xl:col-span-3 xl:block">
        <section className="rounded-[8px] border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <div className="font-medium">Mentionable AI agents</div>
          </div>
          <div className="mt-3 space-y-2">
            {aiMembers.length ? aiMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setBody((current) => `${current}${current.endsWith(" ") || !current ? "" : " "}@${member.name} `)}
                className="flex w-full items-center justify-between rounded-[6px] border border-border bg-background px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span>{member.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{member.autoReplyEnabled ? "auto on" : "mention only"}</span>
              </button>
            )) : (
              <p className="text-sm text-muted-foreground">Create AI members in Teamspace to mention them here.</p>
            )}
          </div>
        </section>

        <section className="mt-3 rounded-[8px] border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div className="font-medium">Guardrails</div>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>AI ignores normal human chatter.</li>
            <li>AI ignores system assignment events.</li>
            <li>One AI turn is allowed per mention trigger.</li>
            <li>AI responses create internal context only.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
