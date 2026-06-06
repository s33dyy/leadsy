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

type TwilioSimulatorConsoleProps = {
  sender?: WorkspaceWhatsAppSender;
  recentEvents: RecentSimulatorEvent[];
};

const defaultPricing: WhatsAppPricingEstimateInput = {
  workspaceCount: 10,
  inboundMessages: 1000,
  outboundFreeformMessages: 800,
  utilityTemplates: 250,
  marketingTemplates: 100,
  authenticationTemplates: 50,
  phoneNumberMonthlyUsd: 1.15,
  metaUtilityTemplateFeeUsd: 0,
  metaMarketingTemplateFeeUsd: 0,
  metaAuthenticationTemplateFeeUsd: 0,
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

export function TwilioSimulatorConsole({ sender, recentEvents }: TwilioSimulatorConsoleProps) {
  const router = useRouter();
  const [leadName, setLeadName] = useState("Asha Buyer");
  const [phone, setPhone] = useState("+919000000001");
  const [body, setBody] = useState("Company: LensMart\nNeed: WhatsApp CRM follow-up\nTimeline: today");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [pricing, setPricing] = useState(defaultPricing);
  const estimate = useMemo(() => calculateTwilioPricingEstimate(pricing), [pricing]);

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
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Pricing estimator</h2>
          </div>
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
                ["metaUtilityTemplateFeeUsd", "Meta utility fee USD"],
                ["metaMarketingTemplateFeeUsd", "Meta marketing fee USD"],
                ["metaAuthenticationTemplateFeeUsd", "Meta auth fee USD"],
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
              <div className="caption">Monthly estimate</div>
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
                  <span className="text-muted-foreground">Meta template fees</span>
                  <span className="font-mono">{money(estimate.metaTemplateFeesUsd, "USD")}</span>
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
                Simulator mode costs {money(estimate.simulatorMonthlyUsd, "USD")} because it does not deliver externally. Twilio’s WhatsApp fee basis here is {money(twilioWhatsAppMessageFeeUsd, "USD")} per inbound or outbound message plus editable Meta pass-through template fees and country-specific phone-number rent.
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
