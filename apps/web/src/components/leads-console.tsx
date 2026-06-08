"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Mail, MessageSquare, Phone, Search } from "lucide-react";
import { Badge } from "@/components/ui";
import type { LeadKnowledgeChannel, LeadKnowledgeRecord, LeadProductPipelineStatus } from "@/lib/lead-knowledge-store";

type LeadWorkspaceTab = "details" | "comms" | "tasks";

type LeadsConsoleProps = {
  allLeads: LeadKnowledgeRecord[];
  activeLeadId?: string;
  activeTab: LeadWorkspaceTab;
  initialQuery?: string;
};

const pipelineLabels: Record<LeadProductPipelineStatus, string> = {
  new: "New",
  qualified: "Qualified",
  interested: "Interested",
  contacted: "Contacted",
  won: "Won",
  lost: "Lost"
};

function leadName(lead: LeadKnowledgeRecord) {
  return lead.contact.displayName || lead.contact.phone || lead.contact.waId || lead.contact.email || "Unknown lead";
}

function relativeTime(value?: string) {
  if (!value) return "now";
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs) || diffMs < 0) return "now";
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function channelIcon(channel?: LeadKnowledgeChannel) {
  if (channel === "email") return Mail;
  if (channel === "call") return Phone;
  return MessageSquare;
}

function pipelineForLead(lead: LeadKnowledgeRecord): LeadProductPipelineStatus {
  if (lead.productPipelineStatus && lead.productPipelineStatus in pipelineLabels) return lead.productPipelineStatus;
  if (lead.qualificationStage === "qualified") return "qualified";
  if (lead.crmStatus === "interested") return "interested";
  if (lead.crmStatus === "needs_reply" || lead.crmStatus === "human_review") return "contacted";
  if (lead.outboundCount > 0 || lead.messages.some((message) => message.direction === "outbound")) return "contacted";
  return "new";
}

function leadHref(leadId: string, tab: LeadWorkspaceTab = "details") {
  const params = new URLSearchParams({ contact: leadId });
  if (tab !== "details") params.set("tab", tab);
  return `/app/leads?${params.toString()}`;
}

function matchesLead(lead: LeadKnowledgeRecord, query: string) {
  if (!query.trim()) return true;
  const haystack = [
    leadName(lead),
    lead.contact.phone,
    lead.contact.email,
    lead.leadSource,
    lead.summary,
    lead.nextAction,
    lead.assigneeName,
    lead.crmStatus,
    lead.qualificationStage,
    ...Object.values(lead.qualificationFields),
    ...lead.facts,
    ...lead.messages.map((message) => message.body)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[5px] border border-border bg-background p-2">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export function LeadsConsole({ allLeads, activeLeadId, activeTab, initialQuery = "" }: LeadsConsoleProps) {
  const leadSearchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    function handleLeadsShortcut(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) return;
      }
      event.preventDefault();
      leadSearchRef.current?.focus();
    }

    window.addEventListener("keydown", handleLeadsShortcut);
    return () => window.removeEventListener("keydown", handleLeadsShortcut);
  }, []);

  const filteredLeads = useMemo(() => allLeads.filter((lead) => matchesLead(lead, query)), [allLeads, query]);

  return (
    <>
      <div className="border-b border-border p-3">
        <div className="flex h-8 items-center gap-2 rounded-[5px] border border-border bg-surface-2 px-2">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            ref={leadSearchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search leads..."
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 text-center">
          <Metric label="Leads" value={allLeads.length} />
          <Metric label="Needs reply" value={allLeads.filter((lead) => lead.crmStatus === "needs_reply").length} />
          <Metric label="Review" value={allLeads.filter((lead) => lead.crmStatus === "human_review").length} />
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {filteredLeads.length ? (
          filteredLeads.map((lead) => {
            const latestConversation = lead.conversations[0];
            const Icon = channelIcon(latestConversation?.channel);
            const selected = activeLeadId === lead.id;
            const pipeline = pipelineForLead(lead);
            return (
              <li key={lead.id} className={`border-b border-border/70 px-3 py-2.5 hover:bg-surface-2 ${selected ? "bg-surface-2" : ""}`}>
                <Link href={leadHref(lead.id, activeTab)} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1 truncate text-[12.5px] font-medium">{leadName(lead)}</span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">{relativeTime(lead.lastMessageAt)}</span>
                  </div>
                  <div className="pl-5 text-[11.5px] text-muted-foreground">{lead.lastMessagePreview || lead.summary || "No message yet"}</div>
                  <div className="flex flex-wrap gap-1 pl-5">
                    <Badge tone={lead.crmStatus === "human_review" ? "amber" : lead.crmStatus === "needs_reply" ? "teal" : "neutral"}>{lead.crmStatus.replace(/_/g, " ")}</Badge>
                    <Badge tone="neutral">{pipelineLabels[pipeline]}</Badge>
                  </div>
                </Link>
              </li>
            );
          })
        ) : (
          <li className="flex h-48 items-center justify-center px-8 text-center text-[12.5px] text-muted-foreground">
            No leads match this view.
          </li>
        )}
      </ul>
    </>
  );
}
