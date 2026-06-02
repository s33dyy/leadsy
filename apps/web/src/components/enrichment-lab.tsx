"use client";

import { useState } from "react";
import { DatabaseZap, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { leads } from "@leadsy/domain";
import { Badge, EmptyState, ProgressBar } from "./ui";

type Result = {
  leadId: string;
  account: string;
  contact: string;
  confidence: number;
  summary: string;
  recommendedRoute: string;
  verification: {
    email: string;
    phone: string;
    duplicateRisk: string;
  };
  signals: string[];
};

export function EnrichmentLab() {
  const [leadId, setLeadId] = useState(leads[0]?.id ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!leadId) return;
    setLoading(true);
    const response = await fetch("/api/intelligence/enrich", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId })
    });
    setResult(await response.json());
    setLoading(false);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <DatabaseZap size={17} className="text-[var(--teal)]" />
          Enrichment pipeline
        </div>
        <div className="mt-4 grid gap-2">
          {leads.length ? leads.map((lead) => (
            <button
              type="button"
              key={lead.id}
              onClick={() => setLeadId(lead.id)}
              className={`rounded-[8px] border p-3 text-left ${
                leadId === lead.id
                  ? "border-teal-300/40 bg-teal-300/10"
                  : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">{lead.id}</span>
                <Badge tone={lead.score > 90 ? "lime" : lead.score > 75 ? "teal" : "amber"}>{lead.score}</Badge>
              </div>
              <div className="mt-2 text-xs leading-5 text-[var(--muted-2)]">{lead.reason}</div>
            </button>
          )) : (
            <div className="rounded-[8px] border border-dashed border-[var(--line)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--muted-2)]">
              No detected leads yet.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={run}
          disabled={!leadId}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Run enrichment
        </button>
      </div>

      <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        {result ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-white">{result.account}</div>
                <div className="mt-1 text-sm text-[var(--muted-2)]">{result.contact}</div>
              </div>
              <Badge tone="teal">confidence {result.confidence}</Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted-2)]">{result.summary}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <ShieldCheck size={16} className="text-[var(--teal)]" />
                <div className="mt-2 text-sm font-semibold text-white">Email</div>
                <div className="mono mt-1 text-xs text-[var(--muted)]">{result.verification.email}</div>
              </div>
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <ShieldCheck size={16} className="text-[var(--amber)]" />
                <div className="mt-2 text-sm font-semibold text-white">Phone</div>
                <div className="mono mt-1 text-xs text-[var(--muted)]">{result.verification.phone}</div>
              </div>
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <ShieldCheck size={16} className="text-[var(--sky)]" />
                <div className="mt-2 text-sm font-semibold text-white">Duplicates</div>
                <div className="mono mt-1 text-xs text-[var(--muted)]">{result.verification.duplicateRisk}</div>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                <span>Route</span>
                <span>{result.recommendedRoute}</span>
              </div>
              <ProgressBar value={result.confidence} tone="teal" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {result.signals.map((signal) => (
                <Badge key={signal} tone="sky">
                  {signal}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title={leads.length ? "Ready to enrich" : "No leads to enrich"}
            detail={
              leads.length
                ? "Select a detected lead and run the account, contact, verification, dedupe, and routing pipeline."
                : "The enrichment queue is empty. Connect CRM, Meta, WhatsApp, or Lead Magnet sources to create real records."
            }
          />
        )}
      </div>
    </div>
  );
}
