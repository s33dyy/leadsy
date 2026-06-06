import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckSquare,
  Inbox,
  ListChecks,
  MessageCircle,
  Sparkles,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listCrmFollowUpTasks } from "@/lib/crm-store";
import { awaitingApprovalTaskStatuses, listExtensionTasks, type ExtensionTask } from "@/lib/extension-store";
import {
  leadProductPipelineStatuses,
  listLeadKnowledgeRecords,
  productPipelineStatusForLead,
  productPipelineStatusLabel,
  syncLeadKnowledgeFromExtensionTasks,
  type LeadProductPipelineStatus,
  type LeadKnowledgeRecord
} from "@/lib/lead-knowledge-store";
import { listMetaOAuthConnections } from "@/lib/meta-oauth-store";

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
  return lead.contact.displayName || lead.contact.handle || lead.contact.phone || lead.contact.email || lead.contact.waId || "Unknown lead";
}

function latestDirection(lead: LeadKnowledgeRecord) {
  return lead.messages.at(-1)?.direction ?? "note";
}

function needsReply(lead: LeadKnowledgeRecord) {
  return lead.leadStatus === "lead" && (lead.crmStatus === "needs_reply" || latestDirection(lead) === "inbound");
}

function isMetaLead(lead: LeadKnowledgeRecord) {
  return lead.channels.some((channel) => channel === "whatsapp" || channel === "instagram" || channel === "facebook");
}

function isExtensionLead(lead: LeadKnowledgeRecord) {
  return lead.channels.some((channel) => channel.endsWith("-web") || channel === "generic-web-chat");
}

function sourceLabelForLead(lead: LeadKnowledgeRecord) {
  if (lead.leadSource) return lead.leadSource;
  if (lead.channels.includes("instagram")) return "Instagram";
  if (lead.channels.includes("whatsapp")) return "WhatsApp";
  if (lead.channels.includes("facebook")) return "Meta Ads";
  if (isExtensionLead(lead)) return "Extension";
  if (isMetaLead(lead)) return "Meta";
  return "Referral";
}

function activeTask(task: ExtensionTask) {
  return !["sent", "cancelled", "blocked", "failed"].includes(task.status);
}

function awaitingApprovalTask(task: ExtensionTask) {
  return (awaitingApprovalTaskStatuses as readonly string[]).includes(task.status);
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

function automationRows(tasks: ExtensionTask[], followUpCount: number) {
  const approvalCount = tasks.filter(awaitingApprovalTask).length;
  const activeCount = tasks.filter(activeTask).length;
  const sentCount = tasks.filter((task) => task.status === "sent").length;
  return [
    { name: "Awaiting approval", value: approvalCount },
    { name: "Active extension tasks", value: activeCount },
    { name: "WhatsApp tasks", value: tasks.filter((task) => task.platform === "whatsapp-web").length },
    { name: "Completed sends", value: sentCount },
    { name: "CRM follow-ups", value: followUpCount }
  ].filter((row) => row.value > 0);
}

function buildActionItems({
  leads,
  tasks,
  hasMetaConnection
}: {
  leads: LeadKnowledgeRecord[];
  tasks: ExtensionTask[];
  hasMetaConnection: boolean;
}) {
  const taskItems = tasks
    .filter(awaitingApprovalTask)
    .slice(0, 3)
    .map<ActionItem>((task) => ({
      priority: "P0",
      kind: task.platform === "whatsapp-web" ? "Draft" : "Outreach",
      title: `${task.contact.displayName || task.contact.handle || "Lead"} needs approval`,
      detail: task.contextSummary || task.draftMessage || "Automation generated an outreach action awaiting human review.",
      time: relativeTime(task.updatedAt),
      href: "/app/approvals"
    }));

  const leadItems = leads
    .filter((lead) => lead.crmStatus === "human_review" || needsReply(lead))
    .slice(0, 3)
    .map<ActionItem>((lead) => ({
      priority: lead.crmStatus === "human_review" ? "P1" : "P2",
      kind: lead.crmStatus === "human_review" ? "Review" : "Reply",
      title: `${contactLabel(lead)} needs operator review`,
      detail: lead.lastMessagePreview || lead.summary || "Lead context is ready for review.",
      time: relativeTime(lead.lastMessageAt ?? lead.updatedAt),
      href: `/app/leads?contact=${lead.id}`
    }));

  const setupItems: ActionItem[] = hasMetaConnection
    ? []
    : [
        {
          priority: "P0",
          kind: "Integration",
          title: "Connect Meta and WhatsApp ingestion",
          detail: "Meta OAuth, Lead Ads, Instagram, Messenger, and WhatsApp stay in Leadsy; workflows consume the events.",
          time: "now",
          href: "/app/connect"
        }
      ];

  return [...taskItems, ...leadItems, ...setupItems].slice(0, 5);
}

export default async function WorkspaceIndexPage() {
  const session = await getCurrentSession();
  const [tasks, crmFollowUps, metaConnections] = session
    ? await Promise.all([
        listExtensionTasks(session.tenantId, session.id),
        listCrmFollowUpTasks({ tenantId: session.tenantId, ownerId: session.id }),
        listMetaOAuthConnections(session.tenantId, session.id)
      ])
    : [[], [], []];
  if (session) {
    await syncLeadKnowledgeFromExtensionTasks({ tenantId: session.tenantId, ownerId: session.id }, tasks);
  }
  const leads = session ? await listLeadKnowledgeRecords({ tenantId: session.tenantId, ownerId: session.id }) : [];

  const activeLeads = leads.filter((lead) => lead.leadStatus === "lead");
  const statusCounts = Object.fromEntries(
    leadProductPipelineStatuses.map((status) => [
      status.id,
      activeLeads.filter((lead) => productPipelineStatusForLead(lead) === status.id).length
    ])
  ) as Record<LeadProductPipelineStatus, number>;
  const dailyLeadVolume = activeLeads.filter((lead) => isToday(lead.lastMessageAt ?? lead.updatedAt)).length;
  const sourceBreakdown = sourceRows(activeLeads);
  const automationActivity = automationRows(tasks, crmFollowUps.length);
  const automationMax = Math.max(1, ...automationActivity.map((row) => row.value));
  const actionItems = buildActionItems({ leads, tasks, hasMetaConnection: metaConnections.length > 0 });

  const metrics: OperatorMetric[] = [
    { label: "New leads · 24h", value: dailyLeadVolume, context: `${statusCounts.new} in New`, href: "/app/leads?q=new", icon: UsersRound },
    { label: "Qualified", value: statusCounts.qualified, context: "AI-qualified pipeline", href: "/app/leads?q=qualified", icon: Sparkles },
    { label: "Interested", value: statusCounts.interested, context: "Ready for follow-up", href: "/app/leads?q=interested", icon: MessageCircle },
    { label: "Contacted", value: statusCounts.contacted, context: "Outbound or review state", href: "/app/leads?q=contacted", icon: ArrowRight },
    { label: "Won", value: statusCounts.won, context: "Closed conversions", href: "/app/leads?q=won", icon: CheckSquare },
    { label: "Lost", value: statusCounts.lost, context: "Closed lost leads", href: "/app/leads?q=lost", icon: ListChecks }
  ];

  const funnelRows = leadProductPipelineStatuses.map((status) => ({
    label: productPipelineStatusLabel(status.id),
    value: statusCounts[status.id]
  }));
  const funnelMax = Math.max(1, ...funnelRows.map((row) => row.value));
  const recentActivity = [
    ...leads.slice(0, 4).map((lead) => ({
      time: relativeTime(lead.lastMessageAt ?? lead.updatedAt),
      text: `${contactLabel(lead)} is ${productPipelineStatusLabel(productPipelineStatusForLead(lead))} from ${sourceLabelForLead(lead)}`
    })),
    ...tasks.slice(0, 3).map((task) => ({
      time: relativeTime(task.updatedAt),
      text: `${task.contact.displayName || task.contact.handle || "Automation"} task is ${task.status.replace(/_/g, " ")}`
    }))
  ].slice(0, 7);

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
              {actionItems.length} items need your eyes · {automationActivity.length} automation signals · {activeLeads.length} active leads.
            </p>
          </div>
          <Badge tone="teal">Live records</Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-3 lg:grid-cols-6">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Link
                key={metric.label}
                href={metric.href}
                className="group bg-background p-3.5 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                  <span className="ml-2 truncate text-right font-mono text-[10.5px] text-muted-foreground">{metric.context}</span>
                </div>
                <div className="mt-2 font-mono text-[24px] tracking-tight">{metric.value}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">{metric.label}</div>
              </Link>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-border bg-border lg:grid-cols-5">
          <div className="bg-background p-4 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <SectionKicker label="Qualification funnel" />
              <Link href="/app/leads" className="text-[11.5px] text-muted-foreground hover:text-foreground">
                Open Leads →
              </Link>
            </div>
            <div className="mt-4 space-y-2.5">
              {funnelRows.map((row) => (
                <div key={row.label} className="grid grid-cols-12 items-center gap-3">
                  <div className="col-span-2 text-[12px] text-muted-foreground">{row.label}</div>
                  <div className="relative col-span-8 h-5 overflow-hidden rounded-[4px] bg-surface-2">
                    <div className="absolute inset-y-0 left-0 bg-primary/80" style={{ width: `${row.value ? Math.max(7, percent(row.value, funnelMax)) : 0}%` }} />
                    <div className="relative flex h-full items-center justify-end pr-2 font-mono text-[10.5px] text-foreground/80">
                      {row.value}
                    </div>
                  </div>
                  <div className="col-span-2 text-right font-mono text-[10.5px] text-muted-foreground">{percent(row.value, activeLeads.length)}%</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-background p-4 lg:col-span-2">
            <SectionKicker label="Lead sources" />
            {sourceBreakdown.length ? (
              <div className="mt-4 space-y-2.5">
                {sourceBreakdown.map((source) => (
                  <div key={source.label} className="flex items-center gap-3">
                    <div className="flex flex-1 items-center gap-3 text-[12.5px]">
                      <span className={`dot ${source.color}`} />
                      <span className="truncate">{source.label}</span>
                    </div>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${source.color}`} style={{ width: `${Math.max(4, source.percent)}%` }} />
                    </div>
                    <div className="w-8 text-right font-mono text-[10.5px] text-muted-foreground">{source.percent}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex min-h-[160px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border text-center">
                <Inbox size={24} className="text-muted-foreground" />
                <div className="mt-3 text-sm font-medium text-foreground">No lead sources yet</div>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Meta, WhatsApp, extension, and manual leads will populate this split from real records.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-border bg-border lg:grid-cols-2">
          <div className="bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <SectionKicker label="Follow-up and automation activity" />
              <Link href="/app/worker" className="text-[11.5px] text-muted-foreground hover:text-foreground">
                Open Automations →
              </Link>
            </div>
            {automationActivity.length ? (
              <div className="mt-4 space-y-2">
                {automationActivity.map((row) => (
                  <div key={row.name} className="flex items-center gap-3">
                    <div className="flex w-44 items-center gap-3">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate font-mono text-[12px]">{row.name}</span>
                    </div>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="absolute inset-y-0 left-0 bg-primary/80" style={{ width: `${Math.max(4, percent(row.value, automationMax))}%` }} />
                    </div>
                    <div className="w-10 text-right font-mono text-[10.5px] text-muted-foreground">{row.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex min-h-[180px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border text-center">
                <ListChecks size={24} className="text-muted-foreground" />
                <div className="mt-3 text-sm font-medium text-foreground">No automation activity yet</div>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Approval tasks, extension sends, and CRM follow-ups will appear here from real records.</p>
              </div>
            )}
          </div>
          <div className="bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <SectionKicker label="Recent activity" />
              <Badge tone="teal">streaming</Badge>
            </div>
            {recentActivity.length ? (
              <div className="mt-3 space-y-2">
                {recentActivity.map((item, index) => (
                  <div key={`${item.time}-${index}`} className="grid grid-cols-[52px_minmax(0,1fr)] gap-4 text-[12.5px]">
                    <div className="font-mono text-[10.5px] text-muted-foreground">{item.time}</div>
                    <div className="leading-6 text-muted-foreground">{item.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex min-h-[220px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border text-center">
                <Inbox size={24} className="text-muted-foreground" />
                <div className="mt-3 text-sm font-medium text-foreground">No live activity yet</div>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Lead, automation, and messaging events will stream here as they arrive.</p>
              </div>
            )}
          </div>
        </div>
        </div>
      </section>

      <aside className="col-span-12 overflow-y-auto bg-background xl:col-span-3">
        <div>
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <SectionKicker label="Needs you" />
              <Link href="/app/worker?tab=pending" className="text-[11.5px] text-muted-foreground hover:text-foreground">
                All →
              </Link>
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{actionItems.length} items pending across leads and automations.</p>
          </div>
          {actionItems.length ? (
            <div className="divide-y divide-border">
              {actionItems.map((item) => (
                <div key={`${item.priority}-${item.title}`} className="p-4 hover:bg-surface-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="caption">
                      <span className={item.priority === "P0" ? "text-destructive" : item.priority === "P1" ? "text-warning" : "text-muted-foreground"}>{item.priority}</span>{" "}
                      {item.kind}
                    </div>
                    <div className="font-mono text-[10.5px] text-muted-foreground">{item.time}</div>
                  </div>
                  <div className="mt-1.5 text-[12.5px] font-medium">{item.title}</div>
                  <p className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground">{item.detail}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Link href={item.href} className="inline-flex h-6 items-center rounded-[4px] bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90">
                      Approve
                    </Link>
                    <Link href={item.href} className="inline-flex h-6 items-center rounded-[4px] border border-border px-2 text-[11px] hover:bg-surface-3">
                      Edit
                    </Link>
                    <Link href={item.href} className="h-6 rounded-[4px] px-2 text-[11px] text-muted-foreground hover:bg-surface-3">
                      Reject
                    </Link>
                    <Link href={item.href} className="ml-auto text-muted-foreground hover:text-foreground" aria-label={`Open ${item.title}`}>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[8px] border border-dashed border-border text-center">
                <MessageCircle size={24} className="text-muted-foreground" />
                <div className="mt-3 text-sm font-medium text-foreground">No approvals waiting</div>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">Drafts, qualification reviews, and follow-ups will appear here before action.</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function SectionKicker({ label }: { label: string }) {
  return <div className="caption">{label}</div>;
}
