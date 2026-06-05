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
  listLeadKnowledgeRecords,
  syncLeadKnowledgeFromExtensionTasks,
  type LeadKnowledgeRecord
} from "@/lib/lead-knowledge-store";
import { listMetaOAuthConnections } from "@/lib/meta-oauth-store";

export const dynamic = "force-dynamic";

type OperatorMetric = {
  label: string;
  value: number;
  delta: string;
  href: string;
  icon: LucideIcon;
  live?: string;
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
  const rows = Object.entries(counts)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 5)
    .map(([label, value], index) => ({
      label,
      value,
      percent: percent(value, total),
      color: ["bg-sky-400", "bg-emerald-400", "bg-violet-400", "bg-amber-400", "bg-rose-400"][index] ?? "bg-[var(--teal)]"
    }));

  return rows.length
    ? rows
    : [
        { label: "Instagram", value: 0, percent: 0, color: "bg-sky-400" },
        { label: "WhatsApp", value: 0, percent: 0, color: "bg-emerald-400" },
        { label: "Meta Ads", value: 0, percent: 0, color: "bg-violet-400" },
        { label: "Extension", value: 0, percent: 0, color: "bg-amber-400" }
      ];
}

function workerRows(tasks: ExtensionTask[], followUpCount: number) {
  const approvalCount = tasks.filter(awaitingApprovalTask).length;
  const activeCount = tasks.filter(activeTask).length;
  const sentCount = tasks.filter((task) => task.status === "sent").length;
  return [
    { name: "meta-research", value: Math.max(0, tasks.filter((task) => task.platform === "instagram-web" || task.platform === "facebook-web").length) },
    { name: "qualifier-v3", value: Math.max(0, approvalCount) },
    { name: "whatsapp-outreach", value: Math.max(0, tasks.filter((task) => task.platform === "whatsapp-web").length) },
    { name: "thread-summarizer", value: Math.max(0, activeCount) },
    { name: "follow-up-router", value: Math.max(0, followUpCount + sentCount) }
  ];
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
      detail: task.contextSummary || task.draftMessage || "Worker generated an outreach action awaiting human review.",
      time: relativeTime(task.updatedAt),
      href: "/app/worker?tab=pending"
    }));

  const leadItems = leads
    .filter((lead) => lead.crmStatus === "human_review" || needsReply(lead))
    .slice(0, 3)
    .map<ActionItem>((lead) => ({
      priority: lead.crmStatus === "human_review" ? "P1" : "P2",
      kind: lead.crmStatus === "human_review" ? "Research" : "Reply",
      title: `${contactLabel(lead)} needs operator review`,
      detail: lead.lastMessagePreview || lead.summary || "Lead intelligence is ready for review.",
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
  const interestedLeads = leads.filter((lead) => lead.crmStatus === "interested");
  const humanReviewLeads = leads.filter((lead) => lead.crmStatus === "human_review");
  const dailyLeadVolume = leads.filter((lead) => isToday(lead.lastMessageAt ?? lead.updatedAt)).length;
  const activeTasks = tasks.filter(activeTask);
  const awaitingApprovalTasks = tasks.filter(awaitingApprovalTask);
  const researchedCount = activeLeads.filter((lead) => lead.summary || lead.facts.length || lead.messages.length).length;
  const engagedCount = activeLeads.filter((lead) => needsReply(lead) || lead.crmStatus === "interested").length;
  const convertedCount = 0;
  const sourceBreakdown = sourceRows(activeLeads);
  const workerThroughput = workerRows(tasks, crmFollowUps.length);
  const workerMax = Math.max(1, ...workerThroughput.map((worker) => worker.value));
  const actionItems = buildActionItems({ leads, tasks, hasMetaConnection: metaConnections.length > 0 });

  const metrics: OperatorMetric[] = [
    { label: "New leads · 24h", value: dailyLeadVolume, delta: `+${Math.min(12, dailyLeadVolume)}`, href: "/app/leads", icon: UsersRound },
    { label: "Qualified · 24h", value: interestedLeads.length, delta: `+${Math.min(4, interestedLeads.length)}`, href: "/app/leads?q=interested", icon: Sparkles },
    { label: "Escalations", value: humanReviewLeads.length, delta: humanReviewLeads.length ? `${humanReviewLeads.length}` : "0", href: "/app/leads?q=human_review", icon: ArrowRight },
    { label: "Active tasks", value: activeTasks.length + crmFollowUps.length, delta: `-${Math.min(6, crmFollowUps.length)}`, href: "/app/leads?tab=tasks", icon: ListChecks },
    { label: "Worker activity", value: workerThroughput.filter((worker) => worker.value > 0).length, delta: "live", href: "/app/worker", icon: Bot, live: "live" },
    { label: "Pending approvals", value: awaitingApprovalTasks.length, delta: awaitingApprovalTasks.length ? `+${awaitingApprovalTasks.length}` : "0", href: "/app/worker?tab=pending", icon: CheckSquare }
  ];

  const funnelRows = [
    { label: "Captured", value: activeLeads.length },
    { label: "Researched", value: researchedCount },
    { label: "Qualified", value: interestedLeads.length + humanReviewLeads.length },
    { label: "Engaged", value: engagedCount },
    { label: "Converted", value: convertedCount }
  ];
  const funnelMax = Math.max(1, ...funnelRows.map((row) => row.value));
  const recentActivity = [
    ...leads.slice(0, 4).map((lead) => ({
      time: relativeTime(lead.lastMessageAt ?? lead.updatedAt),
      text: `${contactLabel(lead)} moved through ${sourceLabelForLead(lead)} intelligence`
    })),
    ...tasks.slice(0, 3).map((task) => ({
      time: relativeTime(task.updatedAt),
      text: `${task.contact.displayName || task.contact.handle || "Worker"} task is ${task.status.replace(/_/g, " ")}`
    }))
  ].slice(0, 7);

  return (
    <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 border-t border-transparent lg:grid-cols-[minmax(0,1fr)_396px]">
      <section className="px-4 py-7 md:px-7">
        <span className="sr-only">Operations dashboard</span>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mono text-[12px] uppercase tracking-[0.24em] text-[var(--muted)]">Operator overview</div>
            <h2 className="mt-4 text-2xl font-medium text-white md:text-3xl">Good morning, {session?.name?.split(" ")[0] || "operator"}.</h2>
            <p className="mt-2 text-sm text-[var(--muted-2)]">
              {actionItems.length} items need your eyes · {workerThroughput.filter((worker) => worker.value > 0).length} workers active · pipeline is healthy.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-[8px] border border-[var(--line)] bg-white/[0.035] p-1">
            {["Today", "7d", "30d"].map((range, index) => (
              <Link
                key={range}
                href={`/app?range=${range.toLowerCase()}`}
                className={`h-8 rounded-[6px] px-3 text-sm ${index === 0 ? "bg-white/[0.08] text-white" : "text-[var(--muted-2)] hover:text-white"}`}
              >
                {range}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-7 grid overflow-hidden rounded-[8px] border border-[var(--line)] sm:grid-cols-2 xl:grid-cols-6">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Link
                key={metric.label}
                href={metric.href}
                className="min-h-[148px] border-b border-r border-[var(--line)] bg-black/10 p-5 hover:bg-white/[0.035] xl:border-b-0"
              >
                <div className="flex items-center justify-between gap-3 text-[var(--muted)]">
                  <Icon size={18} />
                  <span className={`mono text-xs ${metric.delta.startsWith("+") || metric.delta === "live" ? "text-[var(--teal)]" : "text-[var(--muted)]"}`}>
                    {metric.delta}
                  </span>
                </div>
                <div className="mt-7 text-3xl font-medium text-white">{metric.value}</div>
                <div className="mt-2 text-sm text-[var(--muted-2)]">{metric.label}</div>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 grid overflow-hidden rounded-[8px] border border-[var(--line)] xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionKicker label="Qualification funnel · 7d" />
              <Link href="/app/leads" className="text-sm text-[var(--muted-2)] hover:text-white">
                Open CRM →
              </Link>
            </div>
            <div className="mt-6 space-y-4">
              {funnelRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[96px_minmax(0,1fr)_48px] items-center gap-4">
                  <div className="text-sm text-[var(--muted-2)]">{row.label}</div>
                  <div className="h-7 overflow-hidden rounded-[5px] bg-white/[0.05]">
                    <div className="flex h-full items-center justify-end rounded-[5px] bg-emerald-400 pr-2 text-sm text-emerald-950" style={{ width: `${Math.max(7, percent(row.value, funnelMax))}%` }}>
                      {row.value}
                    </div>
                  </div>
                  <div className="mono text-right text-xs text-[var(--muted)]">{row.label === "Captured" ? "-" : `${percent(row.value, funnelMax)}%`}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--line)] p-5 xl:border-l xl:border-t-0">
            <SectionKicker label="Lead sources · 7d" />
            <div className="mt-6 space-y-4">
              {sourceBreakdown.map((source) => (
                <div key={source.label} className="grid grid-cols-[128px_minmax(0,1fr)_48px] items-center gap-4">
                  <div className="flex items-center gap-3 text-sm text-white">
                    <span className={`h-2 w-2 rounded-full ${source.color}`} />
                    <span className="truncate">{source.label}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className={`h-full rounded-full ${source.color}`} style={{ width: `${Math.max(4, source.percent)}%` }} />
                  </div>
                  <div className="mono text-right text-xs text-[var(--muted)]">{source.percent}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid overflow-hidden rounded-[8px] border border-[var(--line)] xl:grid-cols-2">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionKicker label="Worker throughput · last hour" />
              <Link href="/app/worker" className="text-sm text-[var(--muted-2)] hover:text-white">
                Open workers →
              </Link>
            </div>
            <div className="mt-6 space-y-4">
              {workerThroughput.map((worker) => (
                <div key={worker.name} className="grid grid-cols-[180px_minmax(0,1fr)_52px] items-center gap-4">
                  <div className="flex items-center gap-3 text-sm text-white">
                    <Bot size={15} className="text-[var(--muted)]" />
                    <span className="mono truncate">{worker.name}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(4, percent(worker.value, workerMax))}%` }} />
                  </div>
                  <div className="mono text-right text-xs text-[var(--muted)]">{worker.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--line)] p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <SectionKicker label="Recent activity" />
              <Badge tone="teal">streaming</Badge>
            </div>
            {recentActivity.length ? (
              <div className="mt-6 space-y-3">
                {recentActivity.map((item, index) => (
                  <div key={`${item.time}-${index}`} className="grid grid-cols-[52px_minmax(0,1fr)] gap-4 text-sm">
                    <div className="mono text-xs text-[var(--muted)]">{item.time}</div>
                    <div className="leading-6 text-[var(--muted-2)]">{item.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex min-h-[220px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--line)] text-center">
                <Inbox size={24} className="text-[var(--muted)]" />
                <div className="mt-3 text-sm font-medium text-white">No live activity yet</div>
                <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">Lead, worker, and messaging events will stream here as they arrive.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="border-t border-[var(--line)] bg-black/10 lg:border-l lg:border-t-0">
        <div className="sticky top-[64px]">
          <div className="border-b border-[var(--line)] p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionKicker label="Needs you" />
              <Link href="/app/worker?tab=pending" className="text-sm text-[var(--muted-2)] hover:text-white">
                All →
              </Link>
            </div>
            <p className="mt-2 text-sm text-[var(--muted-2)]">{actionItems.length} items pending across workers.</p>
          </div>
          {actionItems.length ? (
            <div className="divide-y divide-[var(--line)]">
              {actionItems.map((item) => (
                <div key={`${item.priority}-${item.title}`} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="mono text-[12px] uppercase tracking-[0.22em] text-[var(--muted)]">
                      <span className={item.priority === "P0" ? "text-rose-300" : item.priority === "P1" ? "text-amber-300" : "text-[var(--muted-2)]"}>{item.priority}</span>{" "}
                      {item.kind}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{item.time}</div>
                  </div>
                  <div className="mt-4 text-sm font-semibold text-white">{item.title}</div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted-2)]">{item.detail}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <Link href={item.href} className="inline-flex h-8 items-center rounded-[6px] bg-[var(--teal)] px-3 text-sm font-medium text-black hover:bg-teal-200">
                      Approve
                    </Link>
                    <Link href={item.href} className="inline-flex h-8 items-center rounded-[6px] border border-[var(--line)] px-3 text-sm text-white hover:border-[var(--line-strong)]">
                      Edit
                    </Link>
                    <Link href={item.href} className="text-sm text-[var(--muted-2)] hover:text-white">
                      Reject
                    </Link>
                    <Link href={item.href} className="ml-auto text-[var(--muted-2)] hover:text-white" aria-label={`Open ${item.title}`}>
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--line)] text-center">
                <MessageCircle size={24} className="text-[var(--muted)]" />
                <div className="mt-3 text-sm font-medium text-white">No approvals waiting</div>
                <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">Worker drafts, research escalations, and follow-ups will appear here before action.</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function SectionKicker({ label }: { label: string }) {
  return <div className="mono text-[12px] uppercase tracking-[0.24em] text-[var(--muted)]">{label}</div>;
}
