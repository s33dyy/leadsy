import Link from "next/link";
import { ArrowRight, Bot, CalendarDays, Inbox, ListChecks, MessageCircle, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listCalendarEvents } from "@/lib/calendar-store";
import { listCrmFollowUpTasks } from "@/lib/crm-store";
import {
  leadProductPipelineStatuses,
  listLeadKnowledgeRecords,
  productPipelineStatusForLead,
  productPipelineStatusLabel,
  type LeadKnowledgeRecord,
  type LeadProductPipelineStatus
} from "@/lib/lead-knowledge-store";
import { listTeamMembers } from "@/lib/teamspace-store";

export const dynamic = "force-dynamic";

type OperatorMetric = {
  label: string;
  value: number;
  context: string;
  href: string;
  icon: LucideIcon;
};

type ActionItem = {
  priority: "P0" | "P1" | "P2";
  kind: string;
  title: string;
  detail: string;
  time: string;
  href: string;
};

function contactLabel(lead: LeadKnowledgeRecord) {
  return lead.contact.displayName || lead.contact.phone || lead.contact.email || lead.contact.waId || "Unknown lead";
}

function latestDirection(lead: LeadKnowledgeRecord) {
  return lead.messages.at(-1)?.direction ?? "note";
}

function needsReply(lead: LeadKnowledgeRecord) {
  return lead.leadStatus === "lead" && (lead.crmStatus === "needs_reply" || latestDirection(lead) === "inbound");
}

function sourceLabelForLead(lead: LeadKnowledgeRecord) {
  if (lead.leadSource) return lead.leadSource;
  if (lead.channels.includes("whatsapp")) return "WhatsApp";
  if (lead.channels.includes("email")) return "Email";
  if (lead.channels.includes("call")) return "Call";
  return "Manual";
}

function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function countBy<T>(items: T[], labelForItem: (item: T) => string) {
  return items.reduce<Record<string, number>>((totals, item) => {
    const label = labelForItem(item);
    totals[label] = (totals[label] ?? 0) + 1;
    return totals;
  }, {});
}

function sourceRows(leads: LeadKnowledgeRecord[]) {
  const counts = countBy(leads, sourceLabelForLead);
  const total = Math.max(1, leads.length);
  return Object.entries(counts)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 5)
    .map(([label, value], index) => ({
      label,
      value,
      percent: percent(value, total),
      color: ["bg-sky-400", "bg-emerald-400", "bg-violet-400", "bg-amber-400", "bg-rose-400"][index] ?? "bg-[var(--teal)]"
    }));
}

function buildActionItems({ leads }: { leads: LeadKnowledgeRecord[] }) {
  const leadItems = leads
    .filter((lead) => lead.crmStatus === "human_review" || needsReply(lead))
    .slice(0, 5)
    .map<ActionItem>((lead) => ({
      priority: lead.crmStatus === "human_review" ? "P1" : "P2",
      kind: lead.crmStatus === "human_review" ? "Review" : "Reply",
      title: `${contactLabel(lead)} needs attention`,
      detail: lead.lastMessagePreview || lead.summary || "Lead context is ready for review.",
      time: relativeTime(lead.lastMessageAt ?? lead.updatedAt),
      href: lead.conversations[0] ? `/app/communications?conversation=${lead.conversations[0].id}` : `/app/leads?contact=${lead.id}`
    }));

  return leadItems;
}

export default async function WorkspaceIndexPage() {
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  const [crmFollowUps, leads, members, calendarEvents] = scope
    ? await Promise.all([
        listCrmFollowUpTasks(scope),
        listLeadKnowledgeRecords(scope),
        listTeamMembers(scope),
        listCalendarEvents(scope)
      ])
    : [[], [], [], []];

  const activeLeads = leads.filter((lead) => lead.leadStatus === "lead");
  const statusCounts = Object.fromEntries(
    leadProductPipelineStatuses.map((status) => [
      status.id,
      activeLeads.filter((lead) => productPipelineStatusForLead(lead) === status.id).length
    ])
  ) as Record<LeadProductPipelineStatus, number>;
  const dailyLeadVolume = activeLeads.filter((lead) => isToday(lead.lastMessageAt ?? lead.updatedAt)).length;
  const sourceBreakdown = sourceRows(activeLeads);
  const actionItems = buildActionItems({ leads });
  const aiAgents = members.filter((member) => member.type.startsWith("ai_agent"));
  const openTasks = crmFollowUps.filter((task) => task.status !== "done").length;

  const metrics: OperatorMetric[] = [
    { label: "New leads · 24h", value: dailyLeadVolume, context: `${statusCounts.new} in New`, href: "/app/leads?q=new", icon: UsersRound },
    { label: "Qualified", value: statusCounts.qualified, context: "AI-qualified pipeline", href: "/app/leads?q=qualified", icon: Sparkles },
    { label: "Interested", value: statusCounts.interested, context: "Ready for follow-up", href: "/app/leads?q=interested", icon: MessageCircle },
    { label: "Contacted", value: statusCounts.contacted, context: "Outbound or review state", href: "/app/leads?q=contacted", icon: ArrowRight },
    { label: "Open tasks", value: openTasks, context: "Native CRM tasks", href: "/app/tasks", icon: ListChecks },
    { label: "AI agents", value: aiAgents.length, context: "Teamspace members", href: "/app/team", icon: Bot }
  ];

  const funnelRows = leadProductPipelineStatuses.map((status) => ({
    label: productPipelineStatusLabel(status.id),
    value: statusCounts[status.id]
  }));
  const funnelMax = Math.max(1, ...funnelRows.map((row) => row.value));

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <section className="col-span-12 overflow-y-auto bg-background xl:col-span-9">
        <div className="p-5">
          <span className="sr-only">Operations dashboard</span>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="caption">Operator overview</div>
              <h1 className="mt-1 text-[22px] tracking-tight">Good morning, {session?.name?.split(" ")[0] || "operator"}.</h1>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {actionItems.length} items need attention · {activeLeads.length} active leads · {calendarEvents.length} calendar records.
              </p>
            </div>
            <Badge tone="teal">Live records</Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-3 lg:grid-cols-6">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Link key={metric.label} href={metric.href} className="bg-background p-4 hover:bg-surface-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="caption">{metric.label}</span>
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{metric.value}</div>
                  <div className="mt-1 text-[11.5px] text-muted-foreground">{metric.context}</div>
                </Link>
              );
            })}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <section className="rounded-[8px] border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-medium">Pipeline</h2>
                <Link href="/app/leads" className="font-mono text-[10.5px] text-primary">open leads</Link>
              </div>
              <div className="mt-4 space-y-3">
                {funnelRows.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span>{row.label}</span>
                      <span className="font-mono text-muted-foreground">{row.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(5, percent(row.value, funnelMax))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[8px] border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-medium">Lead sources</h2>
                <span className="caption">real records</span>
              </div>
              <div className="mt-4 space-y-3">
                {sourceBreakdown.length ? (
                  sourceBreakdown.map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${row.color}`} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{row.label}</span>
                      <span className="font-mono text-[10.5px] text-muted-foreground">{row.value} · {row.percent}%</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No source data yet.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>

      <aside className="col-span-12 overflow-y-auto bg-background xl:col-span-3">
        <section className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">Action queue</h2>
          </div>
          <div className="mt-3 space-y-2">
            {actionItems.length ? (
              actionItems.map((item) => (
                <Link key={`${item.kind}-${item.title}`} href={item.href} className="block rounded-[7px] border border-border bg-surface p-3 hover:bg-surface-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={item.priority === "P0" ? "rose" : item.priority === "P1" ? "amber" : "neutral"}>{item.priority}</Badge>
                    <span className="caption">{item.kind}</span>
                    <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{item.time}</span>
                  </div>
                  <div className="mt-2 text-[12.5px] font-medium">{item.title}</div>
                  <p className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground">{item.detail}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No pending actions.</p>
            )}
          </div>
        </section>

        <section className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">Calendar</h2>
          </div>
          <div className="mt-3 space-y-2">
            {calendarEvents.slice(0, 4).map((event) => (
              <Link key={event.id} href="/app/calendar" className="block rounded-[7px] border border-border bg-surface p-3 hover:bg-surface-2">
                <div className="text-[12.5px] font-medium">{event.title}</div>
                <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">{event.status} · {relativeTime(event.startAt)}</div>
              </Link>
            ))}
            {!calendarEvents.length ? <p className="text-sm text-muted-foreground">No calendar records yet.</p> : null}
          </div>
        </section>

        <section className="p-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">Teamspace</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="Humans" value={members.filter((member) => member.type === "human").length} />
            <MiniStat label="AI agents" value={aiAgents.length} />
            <MiniStat label="Auto-reply" value={members.filter((member) => member.autoReplyEnabled).length} />
            <MiniStat label="Tasks" value={crmFollowUps.length} />
          </div>
        </section>
      </aside>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[7px] border border-border bg-surface p-3">
      <div className="caption">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
