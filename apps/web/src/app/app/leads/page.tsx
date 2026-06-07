import Link from "next/link";
import { Mail, MessageSquare, Phone, Search, Users2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import {
  buildQualificationInputAudit,
  conversationMessages,
  listLeadKnowledgeRecords,
  productPipelineStatusForLead,
  productPipelineStatusLabel,
  type LeadKnowledgeRecord
} from "@/lib/lead-knowledge-store";
import { listTeamMembers } from "@/lib/teamspace-store";

export const dynamic = "force-dynamic";

type LeadsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

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

function channelIcon(channel?: string) {
  if (channel === "email") return Mail;
  if (channel === "call") return Phone;
  return MessageSquare;
}

function matchesSearch(lead: LeadKnowledgeRecord, query: string) {
  if (!query) return true;
  const haystack = [
    leadName(lead),
    lead.contact.phone,
    lead.contact.email,
    lead.leadSource,
    lead.summary,
    lead.nextAction,
    ...Object.values(lead.qualificationFields),
    ...lead.facts
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedLeadId = paramValue(params, "contact");
  const query = paramValue(params, "q");
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  const [allLeads, members] = scope
    ? await Promise.all([listLeadKnowledgeRecords(scope), listTeamMembers(scope)])
    : [[], []];
  const leads = allLeads.filter((lead) => matchesSearch(lead, query));
  const active = leads.find((lead) => lead.id === selectedLeadId) ?? leads[0];
  const activeMessages = active ? conversationMessages(active.messages) : [];
  const activeConversation = active?.conversations.find((conversation) => conversation.id === activeMessages.at(-1)?.conversationId) ?? active?.conversations[0];
  const activeOwner = active?.assigneeId ? members.find((member) => member.id === active.assigneeId) : undefined;
  const audit = active ? buildQualificationInputAudit(active) : undefined;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <section className="col-span-12 flex min-h-0 flex-col bg-background md:col-span-4 xl:col-span-3">
        <div className="border-b border-border p-3">
          <form className="flex h-7 items-center gap-2 rounded-[5px] border border-border bg-surface-2 px-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input name="q" defaultValue={query} placeholder="Search leads..." className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground" />
          </form>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center">
            <Metric label="Leads" value={allLeads.length} />
            <Metric label="Needs reply" value={allLeads.filter((lead) => lead.crmStatus === "needs_reply").length} />
            <Metric label="Review" value={allLeads.filter((lead) => lead.crmStatus === "human_review").length} />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {leads.length ? (
            leads.map((lead) => {
              const latestConversation = lead.conversations[0];
              const Icon = channelIcon(latestConversation?.channel);
              const selected = active?.id === lead.id;
              const pipeline = productPipelineStatusForLead(lead);
              return (
                <li key={lead.id} className={`border-b border-border/70 px-3 py-2.5 hover:bg-surface-2 ${selected ? "bg-surface-2" : ""}`}>
                  <Link href={`/app/leads?contact=${lead.id}`} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1 truncate text-[12.5px] font-medium">{leadName(lead)}</span>
                      <span className="font-mono text-[10.5px] text-muted-foreground">{relativeTime(lead.lastMessageAt)}</span>
                    </div>
                    <div className="pl-5 text-[11.5px] text-muted-foreground">{lead.lastMessagePreview || lead.summary || "No message yet"}</div>
                    <div className="flex flex-wrap gap-1 pl-5">
                      <Badge tone={lead.crmStatus === "human_review" ? "amber" : lead.crmStatus === "needs_reply" ? "teal" : "neutral"}>{lead.crmStatus.replace(/_/g, " ")}</Badge>
                      <Badge tone="neutral">{productPipelineStatusLabel(pipeline)}</Badge>
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
      </section>

      <section className="col-span-12 min-h-0 overflow-y-auto bg-background md:col-span-8 xl:col-span-6">
        {active ? (
          <div className="space-y-5 p-5">
            <header className="border-b border-border pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-surface-3 font-mono text-[12px]">
                  {leadName(active).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-xl font-semibold">{leadName(active)}</h1>
                  <p className="text-sm text-muted-foreground">{active.contact.phone || active.contact.email || "No contact detail"} · {active.leadSource || "Leadsy"}</p>
                </div>
                {activeConversation ? (
                  <Link href={`/app/communications?conversation=${activeConversation.id}`} className="inline-flex h-8 items-center rounded-[5px] bg-primary px-3 text-sm font-medium text-primary-foreground">
                    Open conversation
                  </Link>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <InfoCell label="Owner" value={activeOwner?.name || active.assigneeName || "Unassigned"} />
                <InfoCell label="Qualification" value={active.qualificationStage.replace(/_/g, " ")} />
                <InfoCell label="Pipeline" value={productPipelineStatusLabel(productPipelineStatusForLead(active))} />
              </div>
            </header>

            <section className="rounded-[8px] border border-border bg-surface p-4">
              <div className="caption">Qualification inputs</div>
              <div className="mt-3 grid gap-px overflow-hidden rounded-[6px] border border-border bg-border md:grid-cols-2">
                {(audit?.fields ?? []).map((field) => (
                  <div key={field.field} className="bg-background p-3">
                    <div className="caption">{field.field}</div>
                    <div className="mt-1 text-sm">{field.value}</div>
                    <div className="mt-2 font-mono text-[10px] text-muted-foreground">{field.state} · {field.confidence}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[8px] border border-border bg-surface p-4">
              <div className="caption">Conversation messages</div>
              <div className="mt-3 space-y-2">
                {activeMessages.length ? (
                  activeMessages.slice(-8).map((message) => (
                    <div key={message.id} className={`rounded-[6px] border border-border p-3 ${message.direction === "outbound" ? "bg-primary/10" : "bg-background"}`}>
                      <div className="font-mono text-[10px] text-muted-foreground">{message.direction} · {relativeTime(message.sentAt)}</div>
                      <p className="mt-1 text-sm leading-6">{message.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No messages tracked yet.</p>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
            Add or receive a lead to begin.
          </div>
        )}
      </section>

      <aside className="hidden min-h-0 overflow-y-auto bg-background p-5 xl:col-span-3 xl:block">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users2 className="h-4 w-4 text-primary" />
          Lead context
        </div>
        {active ? (
          <div className="mt-4 space-y-3">
            <InfoCell label="Summary" value={active.summary || "No summary yet"} />
            <InfoCell label="Next action" value={active.nextAction || "Continue qualification"} />
            <InfoCell label="Messages" value={String(active.messageCount)} />
            <InfoCell label="Conversations" value={String(active.conversations.length)} />
            <div className="rounded-[8px] border border-border bg-surface p-3">
              <div className="caption">Facts</div>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {active.facts.slice(0, 6).map((fact, index) => (
                  <li key={`${active.id}-fact-${index}`}>{fact}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No active lead.</p>
        )}
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[5px] border border-border bg-background p-2">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface p-3">
      <div className="caption">{label}</div>
      <div className="mt-1 break-words text-sm text-foreground">{value}</div>
    </div>
  );
}
