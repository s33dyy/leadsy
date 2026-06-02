"use client";

import { useState } from "react";
import { Camera, Loader2, Send, Sparkles, Webhook } from "lucide-react";
import { agencyClients, metaLeads } from "@leadsy/domain";
import { Badge, EmptyState } from "./ui";

type IngestResult = {
  lead: {
    id: string;
    fullName: string;
    clientId: string;
    platform: string;
    budget: string;
    preferredLocation: string;
  };
  firstResponseSlaSeconds: number;
  nextAction: string;
  workflowRun: { status: string; steps: Array<{ label: string; output: string }> };
};

type QualificationResult = {
  leadId: string;
  score: number;
  route: string;
  recommendation: string;
  reason: string;
};

export function MetaLeadLab() {
  const [leadId, setLeadId] = useState(metaLeads[0]?.id ?? "");
  const [ingest, setIngest] = useState<IngestResult | null>(null);
  const [qualification, setQualification] = useState<QualificationResult | null>(null);
  const [loading, setLoading] = useState<"ingest" | "score" | null>(null);
  const activeLead = metaLeads.find((lead) => lead.id === leadId) ?? metaLeads[0];
  const client = activeLead ? agencyClients.find((candidate) => candidate.id === activeLead.clientId) : undefined;

  if (!activeLead) {
    return (
      <EmptyState
        icon={Camera}
        title="No Meta leads yet"
        detail="The lead stream is empty. Connect Meta Lead Ads or POST a real webhook payload to /api/meta/leads to populate this workspace."
      />
    );
  }

  async function ingestLead() {
    setLoading("ingest");
    const response = await fetch("/api/meta/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: activeLead.clientId,
        platform: activeLead.platform,
        fullName: activeLead.fullName,
        phone: activeLead.phone,
        campaignName: activeLead.campaignName,
        budget: activeLead.budget,
        preferredLocation: activeLead.preferredLocation,
        timeline: activeLead.timeline
      })
    });
    setIngest(await response.json());
    setLoading(null);
  }

  async function scoreLead() {
    setLoading("score");
    const response = await fetch("/api/qualification/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId })
    });
    setQualification(await response.json());
    setLoading(null);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
      <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Camera size={17} className="text-[var(--rose)]" />
          Meta lead stream
        </div>
        <div className="space-y-2">
          {metaLeads.map((lead) => {
            const itemClient = agencyClients.find((candidate) => candidate.id === lead.clientId);
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => {
                  setLeadId(lead.id);
                  setIngest(null);
                  setQualification(null);
                }}
                className={`w-full rounded-[8px] border p-3 text-left ${
                  lead.id === activeLead.id
                    ? "border-teal-300/35 bg-teal-300/10"
                    : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-white">{lead.fullName}</span>
                  <Badge tone={lead.rawQuality === "high" ? "lime" : lead.rawQuality === "medium" ? "teal" : "amber"}>
                    {lead.rawQuality}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">{itemClient?.name} · {lead.campaignName}</div>
                <div className="mt-2 text-xs text-[var(--muted-2)]">{lead.budget} · {lead.preferredLocation} · {lead.timeline}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-white">{activeLead.fullName}</div>
            <div className="mt-1 text-sm text-[var(--muted-2)]">{client?.name} · {activeLead.platform} · {activeLead.phone}</div>
          </div>
          <Badge tone="sky">CPL Rs. {activeLead.costPerLead}</Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ["Budget", activeLead.budget],
            ["Location", activeLead.preferredLocation],
            ["Timeline", activeLead.timeline],
            ["Campaign", activeLead.campaignName]
          ].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
              <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
              <div className="mt-2 text-sm font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={ingestLead}
            className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
          >
            {loading === "ingest" ? <Loader2 size={16} className="animate-spin" /> : <Webhook size={16} />}
            Simulate webhook
          </button>
          <button
            type="button"
            onClick={scoreLead}
            className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-amber-300/30 bg-amber-300/10 px-4 text-sm font-medium text-amber-100 hover:bg-amber-300/15"
          >
            {loading === "score" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Score lead
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Send size={16} className="text-[var(--teal)]" />
              Ingestion result
            </div>
            {ingest ? (
              <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-2)]">
                <p>{ingest.nextAction} in {ingest.firstResponseSlaSeconds}s.</p>
                <p>Workflow: {ingest.workflowRun.status} · {ingest.workflowRun.steps.length} steps.</p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">Run the webhook simulation to see the Meta lead move into WhatsApp qualification.</p>
            )}
          </div>
          <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles size={16} className="text-[var(--amber)]" />
              Qualification result
            </div>
            {qualification ? (
              <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-2)]">
                <p className="text-white">Score {qualification.score} · route {qualification.route}</p>
                <p>{qualification.recommendation}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">Score the lead to extract intent, urgency, spam risk, language, and next action.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
