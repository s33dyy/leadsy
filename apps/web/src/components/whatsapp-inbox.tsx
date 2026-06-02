"use client";

import { useState } from "react";
import { Bot, CheckCircle2, Loader2, MessageCircle, Mic, PhoneCall, Send, Sparkles } from "lucide-react";
import { agencyClients, whatsappConversations } from "@leadsy/domain";
import { Badge, EmptyState, ProgressBar } from "./ui";

type ReplyResult = {
  conversationId: string;
  reply: string;
  tone: string;
  shouldEscalate: boolean;
  nextAction: string;
};

type ExtensionConversationBundle = {
  conversation: {
    id: string;
    platform: string;
    sourceUrl: string;
    contact: { displayName?: string; phone?: string; handle?: string; email?: string };
    status: "active" | "paused" | "needs-human" | "closed";
    messageCount: number;
    summary?: string;
    qualification?: string;
    nextAction?: string;
    sentiment?: "positive" | "neutral" | "hesitant" | "negative";
    updatedAt: string;
  };
  messages: Array<{
    id: string;
    direction: "inbound" | "outbound" | "system";
    body: string;
    sentAt: string;
    generatedBy?: "leadsy" | "fallback" | "human";
  }>;
};

export function WhatsAppInbox({ extensionConversations = [] }: { extensionConversations?: ExtensionConversationBundle[] }) {
  const [activeId, setActiveId] = useState(whatsappConversations[0]?.id ?? "");
  const [reply, setReply] = useState<ReplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const activeExtension = extensionConversations.find((item) => item.conversation.id === activeId) ?? extensionConversations[0];
  const active = whatsappConversations.find((conversation) => conversation.id === activeId) ?? whatsappConversations[0];
  const client = active ? agencyClients.find((candidate) => candidate.id === active.clientId) : undefined;

  if (activeExtension) {
    return (
      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <aside className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageCircle size={17} className="text-[var(--teal)]" />
              Worker conversations
            </div>
            <Badge tone="teal">{extensionConversations.length} synced</Badge>
          </div>
          <div className="space-y-2">
            {extensionConversations.map((item) => (
              <button
                type="button"
                key={item.conversation.id}
                onClick={() => {
                  setActiveId(item.conversation.id);
                  setReply(null);
                }}
                className={`w-full rounded-[8px] border p-3 text-left ${
                  item.conversation.id === activeExtension.conversation.id
                    ? "border-teal-300/35 bg-teal-300/10"
                    : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-white">
                    {item.conversation.contact.displayName || item.conversation.contact.handle || item.conversation.sourceUrl}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-[var(--teal)]" />
                </div>
                <div className="mt-1 truncate text-xs text-[var(--muted)]">
                  {item.conversation.platform.replace(/-/g, " ")} · {item.conversation.status}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted-2)]">
                  {item.conversation.summary || item.messages.at(-1)?.body || "Conversation synced by worker."}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-[8px] border border-[var(--line)] bg-black/20">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] p-4">
            <div>
              <div className="text-lg font-semibold text-white">
                {activeExtension.conversation.contact.displayName || activeExtension.conversation.contact.handle || "Browser conversation"}
              </div>
              <div className="mt-1 text-sm text-[var(--muted-2)]">
                {activeExtension.conversation.contact.phone || activeExtension.conversation.contact.email || activeExtension.conversation.sourceUrl}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={activeExtension.conversation.status === "needs-human" ? "rose" : "teal"}>
                {activeExtension.conversation.status}
              </Badge>
              <Badge tone="sky">{activeExtension.conversation.platform.replace(/-/g, " ")}</Badge>
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_0.72fr]">
            <div className="space-y-3">
              {activeExtension.messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[84%] rounded-[8px] border p-3 text-sm leading-6 ${
                    message.direction === "inbound"
                      ? "border-[var(--line)] bg-white/[0.04] text-[var(--muted-2)]"
                      : "ml-auto border-teal-300/20 bg-teal-300/10 text-teal-50"
                  }`}
                >
                  <span>{message.body}</span>
                  <div className="mono mt-2 text-[10px] uppercase text-[var(--muted)]">
                    {message.generatedBy ?? message.direction} · {new Date(message.sentAt).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>

            <aside className="space-y-3">
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 size={16} className="text-[var(--teal)]" />
                  Worker report
                </div>
                <div className="mono text-[10px] uppercase text-[var(--muted)]">Summary</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
                  {activeExtension.conversation.summary || "The worker has synced this conversation."}
                </p>
                <div className="mono mt-4 text-[10px] uppercase text-[var(--muted)]">Qualification</div>
                <p className="mt-2 text-sm leading-6 text-white">{activeExtension.conversation.qualification || "Not classified yet"}</p>
                <div className="mono mt-4 text-[10px] uppercase text-[var(--muted)]">Next action</div>
                <p className="mt-2 text-sm leading-6 text-white">{activeExtension.conversation.nextAction || "Keep monitoring replies."}</p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    );
  }

  if (!active) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="No WhatsApp conversations"
        detail="The inbox has been cleared. Connect WhatsApp Cloud API or let Meta ingestion create the first real conversation."
      />
    );
  }

  async function generateReply() {
    setLoading(true);
    const response = await fetch("/api/whatsapp/reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: active.id })
    });
    setReply(await response.json());
    setLoading(false);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
      <aside className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageCircle size={17} className="text-[var(--teal)]" />
            WhatsApp inbox
          </div>
          <Badge tone="teal">{whatsappConversations.reduce((sum, item) => sum + item.unread, 0)} unread</Badge>
        </div>
        <div className="space-y-2">
          {whatsappConversations.map((conversation) => {
            const itemClient = agencyClients.find((candidate) => candidate.id === conversation.clientId);
            return (
              <button
                type="button"
                key={conversation.id}
                onClick={() => {
                  setActiveId(conversation.id);
                  setReply(null);
                }}
                className={`w-full rounded-[8px] border p-3 text-left ${
                  conversation.id === active.id
                    ? "border-teal-300/35 bg-teal-300/10"
                    : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-white">{conversation.contactName}</span>
                  {conversation.unread ? <span className="h-2 w-2 rounded-full bg-[var(--teal)]" /> : null}
                </div>
                <div className="mt-1 truncate text-xs text-[var(--muted)]">{itemClient?.name} · {conversation.status}</div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted-2)]">{conversation.aiSummary}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="rounded-[8px] border border-[var(--line)] bg-black/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] p-4">
          <div>
            <div className="text-lg font-semibold text-white">{active.contactName}</div>
            <div className="mt-1 text-sm text-[var(--muted-2)]">{client?.name} · {active.phone} · assigned to {active.assignedTo}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={active.qualification.escalate ? "rose" : "teal"}>
              {active.qualification.escalate ? "human now" : "AI nurture"}
            </Badge>
            <Badge tone="sky">{active.qualification.language}</Badge>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_0.72fr]">
          <div className="space-y-3">
            {active.messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[84%] rounded-[8px] border p-3 text-sm leading-6 ${
                  message.direction === "inbound"
                    ? "border-[var(--line)] bg-white/[0.04] text-[var(--muted-2)]"
                    : "ml-auto border-teal-300/20 bg-teal-300/10 text-teal-50"
                }`}
              >
                <div className="flex items-start gap-2">
                  {message.contentType === "voice" ? <Mic size={15} className="mt-1 text-[var(--amber)]" /> : null}
                  <span>{message.body}</span>
                </div>
                <div className="mono mt-2 text-[10px] uppercase text-[var(--muted)]">{message.deliveryStatus}</div>
              </div>
            ))}

            <div className="rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-50">
                <Bot size={16} />
                AI suggested reply
              </div>
              <p className="text-sm leading-6 text-teal-50">{reply?.reply ?? active.aiSuggestedReply}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateReply}
                  className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-xs font-medium text-teal-100 hover:bg-teal-300/[0.18]"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Regenerate
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-xs font-medium text-[var(--muted-2)] hover:text-white"
                  onClick={() => setReply({ conversationId: active.id, reply: active.aiSuggestedReply, tone: "warm", shouldEscalate: active.qualification.escalate, nextAction: active.qualification.nextBestAction })}
                >
                  <Send size={14} />
                  Queue send
                </button>
                <a
                  href={`tel:${active.phone}`}
                  className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-amber-300/30 bg-amber-300/10 px-3 text-xs font-medium text-amber-100 hover:bg-amber-300/15"
                >
                  <PhoneCall size={14} />
                  Human call
                </a>
              </div>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <CheckCircle2 size={16} className="text-[var(--teal)]" />
                Qualification
              </div>
              {[
                ["Budget", active.qualification.budgetScore],
                ["Location", active.qualification.locationScore],
                ["Urgency", active.qualification.urgencyScore],
                ["Intent", active.qualification.intentScore]
              ].map(([label, value]) => (
                <div key={label} className="mb-3">
                  <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                  <ProgressBar value={Number(value)} tone={Number(value) > 85 ? "lime" : "teal"} />
                </div>
              ))}
            </div>
            <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
              <div className="mono text-[10px] uppercase text-[var(--muted)]">Why valuable</div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">{active.qualification.summary}</p>
              <div className="mono mt-4 text-[10px] uppercase text-[var(--muted)]">Next action</div>
              <p className="mt-2 text-sm leading-6 text-white">{reply?.nextAction ?? active.qualification.nextBestAction}</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
