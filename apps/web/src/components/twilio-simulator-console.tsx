"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calculator, Inbox, Loader2, MessageSquarePlus, SendHorizonal, ShieldAlert } from "lucide-react";
import {
  calculateTwilioPricingEstimate,
  twilioWhatsAppMessageFeeUsd,
  type WhatsAppPricingEstimateInput
} from "@/lib/whatsapp-pricing-estimator";
import type { WorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

type RecentSimulatorEvent = {
  id: string;
  lead: string;
  phone?: string;
  direction: "inbound" | "outbound";
  body: string;
  deliveryStatus?: string;
  sentAt: string;
};

type SimulatedConversation = {
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

type TwilioSimulatorConsoleProps = {
  sender?: WorkspaceWhatsAppSender;
  recentEvents: RecentSimulatorEvent[];
  simulatedConversations: SimulatedConversation[];
};

const defaultPricing: WhatsAppPricingEstimateInput = {
  workspaceCount: 1,
  inboundMessages: 100,
  outboundFreeformMessages: 100,
  utilityTemplates: 0,
  marketingTemplates: 0,
  authenticationTemplates: 0,
  phoneNumberMonthlyUsd: 1.15,
  providerUtilityTemplateFeeUsd: 0,
  providerMarketingTemplateFeeUsd: 0,
  providerAuthenticationTemplateFeeUsd: 0,
  fxRateInr: 83
};

function money(value: number, currency: "USD" | "INR") {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 3 : 0
  }).format(value);
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function shortTime(value?: string) {
  if (!value) return "now";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function TwilioSimulatorConsole({ sender, recentEvents, simulatedConversations }: TwilioSimulatorConsoleProps) {
  const router = useRouter();
  const [leadName, setLeadName] = useState("Asha Buyer");
  const [phone, setPhone] = useState("+919000000001");
  const [body, setBody] = useState("Company: LensMart\nNeed: WhatsApp CRM follow-up\nTimeline: today");
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [notice, setNotice] = useState("");
  const [inboxNotice, setInboxNotice] = useState("");
  const [replyBody, setReplyBody] = useState("Thanks, we can help with this. Can you share your preferred demo time?");
  const [selectedConversationId, setSelectedConversationId] = useState(simulatedConversations[0]?.leadId ?? "");
  const [pricing, setPricing] = useState(defaultPricing);
  const estimate = useMemo(() => calculateTwilioPricingEstimate(pricing), [pricing]);
  const selectedConversation = useMemo(
    () => simulatedConversations.find((conversation) => conversation.leadId === selectedConversationId) ?? simulatedConversations[0],
    [selectedConversationId, simulatedConversations]
  );

  async function submitInbound() {
    if (submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/simulate-twilio/inbound", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadName,
          phone,
          body
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setNotice(payload.error || "Could not create the simulated inbound message.");
        return;
      }
      setNotice("Simulated WhatsApp lead message created in Leadsy.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function updatePricing(key: keyof WhatsAppPricingEstimateInput, value: string) {
    setPricing((current) => ({ ...current, [key]: numberValue(value) }));
  }

  async function sendSimulatedInboxReply() {
    if (!selectedConversation?.to || !replyBody.trim() || replying) return;
    setReplying(true);
    setInboxNotice("");
    try {
      const response = await fetch("/api/whatsapp/messages", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId: selectedConversation.leadId,
          to: selectedConversation.to,
          body: replyBody.trim()
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; deliveryStatus?: string };
      if (!response.ok) {
        setInboxNotice(payload.error || "Could not save the simulated reply.");
        return;
      }
      setReplyBody("");
      setInboxNotice(`Simulated reply saved with status ${payload.deliveryStatus || "simulated_delivered"}.`);
      router.refresh();
    } finally {
      setReplying(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="caption">Internal fallback</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">Twilio simulator</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Simulation mode: no external WhatsApp delivery. Messages are stored in Leadsy as WhatsApp CRM activity for demos, QA, and pricing planning.
            </p>
          </div>
          <Link href="/app/communications" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Inbox className="h-4 w-4" />
            Open Inbox
          </Link>
        </header>

        <section className="rounded-[8px] border border-warning/50 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <div className="text-sm font-semibold">Simulator transport is {sender?.status ?? "pending"}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {sender?.transportMode === "simulator"
                  ? sender.statusReason || "Leadsy will save simulated WhatsApp messages without contacting Twilio."
                  : "Submit one inbound message to activate the workspace simulator transport."}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">
          <section className="rounded-[8px] border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Create inbound lead message</h2>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="caption">Lead name</span>
                <input value={leadName} onChange={(event) => setLeadName(event.target.value)} className="h-10 rounded-[6px] border border-border bg-background px-3 outline-none focus:border-primary" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="caption">WhatsApp phone</span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className="h-10 rounded-[6px] border border-border bg-background px-3 font-mono outline-none focus:border-primary" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="caption">Message body</span>
                <textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-32 resize-y rounded-[6px] border border-border bg-background px-3 py-2 outline-none focus:border-primary" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submitInbound}
                  disabled={submitting || !phone.trim() || !body.trim()}
                  className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                  Create message
                </button>
                {notice ? <span className="text-sm text-muted-foreground">{notice}</span> : null}
              </div>
            </div>
          </section>

          <section className="rounded-[8px] border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Recent simulated events</h2>
            </div>
            <div className="mt-4 overflow-hidden rounded-[6px] border border-border">
              {recentEvents.length ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Lead</th>
                      <th className="px-3 py-2 font-medium">Direction</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{event.lead}</div>
                          <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{event.body}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{event.direction}</td>
                        <td className="px-3 py-2 font-mono text-xs">{event.deliveryStatus ?? "received"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">Simulated WhatsApp events will appear after the first inbound message.</div>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-[8px] border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">Simulation Inbox</h2>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Read and reply to simulated WhatsApp conversations without leaving this page.</p>
            </div>
            <Link href="/app/communications" className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-border bg-surface-2 px-3 text-sm hover:bg-surface-3">
              Open full Inbox
            </Link>
          </div>

          <div className="mt-4 grid min-h-[360px] overflow-hidden rounded-[8px] border border-border lg:grid-cols-[320px_1fr]">
            <div className="border-b border-border bg-background lg:border-b-0 lg:border-r">
              {simulatedConversations.length ? (
                <div className="divide-y divide-border">
                  {simulatedConversations.map((conversation) => (
                    <button
                      key={conversation.leadId}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.leadId)}
                      className={`block w-full px-3 py-3 text-left hover:bg-surface-2 ${selectedConversation?.leadId === conversation.leadId ? "bg-surface-2" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{conversation.lead}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{conversation.messages.length} msg</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{conversation.lastMessage || "No messages yet"}</div>
                      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] text-muted-foreground">
                        <span>{conversation.qualification}</span>
                        {conversation.phone ? <span>{conversation.phone}</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-5 text-sm leading-6 text-muted-foreground">Create an inbound lead message to open a simulated Inbox thread.</div>
              )}
            </div>

            <div className="flex min-h-0 flex-col bg-background">
              {selectedConversation ? (
                <>
                  <div className="border-b border-border p-4">
                    <div className="text-sm font-semibold">{selectedConversation.lead}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{selectedConversation.phone || "No phone"} · {selectedConversation.qualification}</div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                    {selectedConversation.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[82%] rounded-[7px] border border-border p-3 text-sm ${message.from === "us" ? "ml-auto border-primary/40 bg-primary/15" : "bg-surface"}`}
                      >
                        <div className="mb-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                          <span>{message.from === "us" ? "Leadsy" : selectedConversation.lead}</span>
                          <span>{shortTime(message.sentAt)}</span>
                        </div>
                        <div className="whitespace-pre-wrap leading-6">{message.body}</div>
                        {message.from === "us" ? <div className="mt-2 font-mono text-[10px] text-muted-foreground">{message.deliveryStatus || "simulated_delivered"}</div> : null}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border p-3">
                    <textarea
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      disabled={!selectedConversation.to || replying}
                      placeholder={selectedConversation.to ? "Reply in simulation..." : "This simulated lead needs a WhatsApp phone before replying."}
                      className="h-20 w-full resize-none rounded-[6px] border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10.5px] text-muted-foreground">Simulation mode: no external WhatsApp delivery</span>
                      <button
                        type="button"
                        disabled={!selectedConversation.to || !replyBody.trim() || replying}
                        onClick={sendSimulatedInboxReply}
                        className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                        Send simulated reply
                      </button>
                    </div>
                    {inboxNotice ? <div className="mt-2 text-sm text-muted-foreground">{inboxNotice}</div> : null}
                  </div>
                </>
              ) : (
                <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground">No simulated conversation selected.</div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[8px] border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Pricing estimator</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The default below is a one-workspace starter estimate for real WhatsApp delivery. Simulator mode stays free because it only stores messages inside Leadsy.
          </p>
          <div className="mt-4 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {([
                ["workspaceCount", "Workspaces / senders"],
                ["inboundMessages", "Inbound messages / month"],
                ["outboundFreeformMessages", "Outbound replies / month"],
                ["utilityTemplates", "Utility templates / month"],
                ["marketingTemplates", "Marketing templates / month"],
                ["authenticationTemplates", "Authentication templates / month"],
                ["phoneNumberMonthlyUsd", "Phone number monthly USD"],
                ["providerUtilityTemplateFeeUsd", "Provider utility fee USD"],
                ["providerMarketingTemplateFeeUsd", "Provider marketing fee USD"],
                ["providerAuthenticationTemplateFeeUsd", "Provider auth fee USD"],
                ["fxRateInr", "USD to INR"]
              ] as Array<[keyof WhatsAppPricingEstimateInput, string]>).map(([key, label]) => (
                <label key={key} className="grid gap-1.5 text-sm">
                  <span className="caption">{label}</span>
                  <input
                    type="number"
                    min="0"
                    step={key === "fxRateInr" ? "0.1" : "1"}
                    value={pricing[key]}
                    onChange={(event) => updatePricing(key, event.target.value)}
                    className="h-9 rounded-[6px] border border-border bg-background px-3 font-mono outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>
            <div className="rounded-[8px] border border-border bg-background p-4">
              <div className="rounded-[6px] border border-primary/30 bg-primary/10 p-3">
                <div className="caption">Current simulator mode</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-sm text-muted-foreground">No external WhatsApp delivery</span>
                  <span className="font-mono text-xl font-semibold">{money(estimate.simulatorMonthlyUsd, "USD")} / {money(0, "INR")}</span>
                </div>
              </div>
              <div className="caption mt-4">Real Twilio starter estimate</div>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Twilio message fee</span>
                  <span className="font-mono">{money(estimate.twilioMessageFeesUsd, "USD")}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Phone numbers</span>
                  <span className="font-mono">{money(estimate.phoneNumberFeesUsd, "USD")}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Provider template fees</span>
                  <span className="font-mono">{money(estimate.providerTemplateFeesUsd, "USD")}</span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between gap-3 text-base font-semibold">
                    <span>Total USD</span>
                    <span className="font-mono">{money(estimate.totalUsd, "USD")}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Total INR</span>
                    <span className="font-mono">{money(estimate.totalInr, "INR")}</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Simulator mode costs {money(estimate.simulatorMonthlyUsd, "USD")} because it does not deliver externally. Twilio’s WhatsApp fee basis here is {money(twilioWhatsAppMessageFeeUsd, "USD")} per inbound or outbound message plus editable pass-through template fees and country-specific phone-number rent.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <a href="https://www.twilio.com/docs/whatsapp/pricing" className="text-primary hover:underline" target="_blank" rel="noreferrer">Twilio WhatsApp pricing</a>
                <a href="https://www.twilio.com/docs/phone-numbers/global-catalog/api/pricing-phone-numbers" className="text-primary hover:underline" target="_blank" rel="noreferrer">Phone number pricing API</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
