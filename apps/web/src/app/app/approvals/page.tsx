import Link from "next/link";
import { ArrowUpRight, Check, Filter, Inbox, Pencil, Search, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listLeadKnowledgeRecords, type LeadKnowledgeRecord } from "@/lib/lead-knowledge-store";

export const dynamic = "force-dynamic";

type ApprovalItem = {
  id: string;
  kind: "Draft" | "Task" | "Research" | "Outreach" | "Note";
  priority: "P0" | "P1" | "P2";
  subject: string;
  preview: string;
  worker: string;
  leadName: string;
  createdAt: string;
  href: string;
};

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

function leadName(lead: LeadKnowledgeRecord) {
  return lead.contact.displayName || lead.contact.handle || lead.contact.phone || lead.contact.email || "Unknown lead";
}

function leadApproval(lead: LeadKnowledgeRecord): ApprovalItem {
  const name = leadName(lead);
  return {
    id: lead.id,
    kind: "Research",
    priority: lead.crmStatus === "human_review" ? "P1" : "P2",
    subject: `${name} qualification review`,
    preview: lead.summary || lead.lastMessagePreview || "Lead intelligence needs a human decision before automation continues.",
    worker: "qualifier-v3",
    leadName: name,
    createdAt: relativeTime(lead.updatedAt),
    href: `/app/leads?contact=${lead.id}`
  };
}

export default async function ApprovalsPage() {
  const session = await getCurrentSession();
  const leads = session ? await listLeadKnowledgeRecords({ tenantId: session.tenantId, ownerId: session.id }) : [];

  const reviewLeads = leads.filter((lead) => lead.crmStatus === "human_review").slice(0, 6);
  const approvals = reviewLeads.map(leadApproval);
  const active = approvals[0];

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <section className="col-span-12 flex min-h-0 flex-col bg-background xl:col-span-7">
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
          {["All", "Research", "Tasks", "Notes", "Drafts", "Outreach"].map((kind) => (
            <span key={kind} className={`h-7 rounded-[5px] px-2.5 py-1.5 text-[12px] ${kind === "All" ? "bg-surface-3 text-foreground" : "text-muted-foreground"}`}>
              {kind}
            </span>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2">
              <Search className="h-3 w-3 text-muted-foreground" />
              <span className="w-44 text-[12px] text-muted-foreground">Search approvals...</span>
            </div>
            <span className="grid h-7 w-7 place-items-center rounded-[5px] border border-border bg-surface-2">
              <Filter className="h-3 w-3" />
            </span>
          </div>
        </div>

        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-3 text-[12px]">
          <input type="checkbox" aria-label="Select all approvals" className="h-3.5 w-3.5 accent-primary" />
          <span className="text-muted-foreground">{approvals.length} pending - select to act in bulk</span>
          <Link href="/app/worker?tab=pending" className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-[5px] bg-primary px-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
            <Check className="h-3 w-3" /> Review queue
          </Link>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {approvals.length ? (
            approvals.map((item, index) => (
              <li key={item.id} className={`flex items-start gap-3 px-3 py-3 hover:bg-surface-2 ${index === 0 ? "bg-surface-2" : ""}`}>
                <input type="checkbox" aria-label={`Select ${item.subject}`} className="mt-1 h-3.5 w-3.5 accent-primary" />
                <Link href={item.href} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[10.5px] ${item.priority === "P0" ? "text-destructive" : item.priority === "P1" ? "text-warning" : "text-muted-foreground"}`}>
                      {item.priority}
                    </span>
                    <span className="caption">{item.kind}</span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">- {item.worker}</span>
                    <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{item.createdAt}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] font-medium">{item.subject}</div>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">{item.preview}</p>
                </Link>
              </li>
            ))
          ) : (
            <li className="flex h-48 flex-col items-center justify-center gap-2 text-center text-[12.5px] text-muted-foreground">
              <Inbox className="h-5 w-5" />
              No approvals waiting. Worker drafts and research reviews will land here.
            </li>
          )}
        </ul>
      </section>

      <aside className="col-span-12 min-h-0 overflow-y-auto bg-background xl:col-span-5">
        {active ? (
          <>
            <div className="border-b border-border p-5">
              <div className="flex items-center gap-2">
                <Badge tone={active.priority === "P0" ? "rose" : active.priority === "P1" ? "amber" : "neutral"}>{active.priority}</Badge>
                <span className="caption">{active.kind}</span>
                <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10.5px] text-primary">
                  <Sparkles className="h-3 w-3" /> {active.worker}
                </span>
              </div>
              <h1 className="mt-2 text-[16px] font-medium tracking-tight">{active.subject}</h1>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                For <span className="text-foreground">{active.leadName}</span> - {active.createdAt} ago
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <Link href={active.href} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] bg-primary px-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
                  <Check className="h-3 w-3" /> Open review
                </Link>
                <Link href={active.href} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2.5 text-[12px] hover:bg-surface-3">
                  <Pencil className="h-3 w-3" /> Edit
                </Link>
                <Link href="/app/worker" className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2.5 text-[12px] hover:bg-surface-3">
                  <ArrowUpRight className="h-3 w-3" /> Escalate
                </Link>
                <span className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12px] text-muted-foreground">
                  <X className="h-3 w-3" /> Reject
                </span>
              </div>
            </div>

            <div className="p-5">
              <div className="caption">Proposed content</div>
              <div className="mt-2 rounded-[6px] border border-border bg-surface-2 p-4 text-[13px] leading-relaxed">
                {active.preview}
              </div>
              <div className="mt-5 caption">AI rationale</div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                Leadsy keeps the business state in Postgres and records approved operator actions inside the app.
              </p>
              <div className="mt-5 caption">Audit</div>
              <ul className="mt-2 space-y-1.5 font-mono text-[10.5px] text-muted-foreground">
                <li>queued - {active.worker}</li>
                <li>pending - human approval required</li>
                <li>route - Next.js API to Leadsy-native automation after approval</li>
              </ul>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
