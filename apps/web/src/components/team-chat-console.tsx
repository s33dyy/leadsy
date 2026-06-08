"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const aiMembers = useMemo(() => members.filter((member) => member.type.startsWith("ai_agent")), [members]);

  useEffect(() => {
    const stream = new EventSource("/api/team-chat/stream");
    stream.addEventListener("snapshot", (event) => {
      const snapshot = JSON.parse((event as MessageEvent).data) as TeamChatSnapshot;
      setMessages(snapshot.messages);
    });
    return () => stream.close();
  }, []);

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
      const payload = (await response.json().catch(() => ({}))) as { message?: TeamThreadMessage; aiResult?: { message?: TeamThreadMessage } };
      if (response.ok) {
        setBody("");
        setMessages((current) => {
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
        <header className="border-b border-border p-5">
          <div className="caption">Leadsy / Team Chat</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Workspace group chat</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Humans coordinate here. AI agents answer only when mentioned with @ and never chain replies to other AI agents or system events.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {messages.length ? messages.map((message) => {
              const linkedLead = message.leadId ? leads.find((lead) => lead.id === message.leadId) : undefined;
              return (
                <article key={message.id} className="rounded-[8px] border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={message.authorType === "ai_agent" ? "violet" : message.authorType === "system" ? "teal" : "neutral"}>
                      {message.authorType.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-sm font-medium">{authorLabel(message, members)}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{message.eventType}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{timeLabel(message.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6">{message.body}</p>
                  {linkedLead ? (
                    <Link href={`/app/leads?contact=${linkedLead.id}`} className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-primary">
                      <Users2 className="h-3 w-3" /> {leadName(linkedLead)}
                    </Link>
                  ) : null}
                </article>
              );
            }) : (
              <div className="grid h-64 place-items-center rounded-[8px] border border-border bg-surface text-center text-sm text-muted-foreground">
                Workspace assignment events, task events, and human messages will appear here.
              </div>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="border-t border-border bg-background p-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="h-10 rounded-[6px] border border-border bg-surface px-3 text-sm outline-none focus:border-primary md:w-64">
              <option value="">Workspace-wide</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {leadName(lead)}
                </option>
              ))}
            </select>
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Message the team, or mention @Qualification AI for one AI response"
              className="h-10 min-w-0 flex-1 rounded-[6px] border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
            <button type="submit" disabled={pending || !body.trim()} className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" /> Send
            </button>
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
