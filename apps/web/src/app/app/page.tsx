import Link from "next/link";
import { Clock, Inbox, ListChecks, MessageCircle, RadioTower, UsersRound, Workflow, type LucideIcon } from "lucide-react";
import { Badge, EmptyState, Panel, ProgressBar, SectionTitle } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionTasks, type ExtensionTask } from "@/lib/extension-store";
import {
  listLeadKnowledgeRecords,
  syncLeadKnowledgeFromExtensionTasks,
  type LeadKnowledgeRecord
} from "@/lib/lead-knowledge-store";

export const dynamic = "force-dynamic";

type DashboardMetric = {
  label: string;
  value: number;
  detail: string;
  href: string;
  tone: "teal" | "amber" | "lime" | "sky" | "violet";
};

function contactLabel(lead: LeadKnowledgeRecord) {
  return lead.contact.displayName || lead.contact.handle || lead.contact.phone || lead.contact.email || lead.contact.waId || "Unknown lead";
}

function latestDirection(lead: LeadKnowledgeRecord) {
  return lead.messages.at(-1)?.direction ?? "note";
}

function needsReply(lead: LeadKnowledgeRecord) {
  return lead.leadStatus === "lead" && latestDirection(lead) === "inbound";
}

function isMetaLead(lead: LeadKnowledgeRecord) {
  return lead.channels.some((channel) => channel === "whatsapp" || channel === "instagram" || channel === "facebook");
}

function isExtensionLead(lead: LeadKnowledgeRecord) {
  return lead.channels.some((channel) => channel.endsWith("-web") || channel === "generic-web-chat");
}

function isManualLead(lead: LeadKnowledgeRecord) {
  return lead.channels.includes("manual") || (!isMetaLead(lead) && !isExtensionLead(lead));
}

function activeTask(task: ExtensionTask) {
  return !["sent", "cancelled", "blocked", "failed"].includes(task.status);
}

function formatDate(value?: string) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function maxOrOne(values: number[]) {
  return Math.max(1, ...values);
}

export default async function WorkspaceIndexPage() {
  const session = await getCurrentSession();
  const tasks = session ? await listExtensionTasks(session.tenantId, session.id) : [];
  if (session) {
    await syncLeadKnowledgeFromExtensionTasks({ tenantId: session.tenantId, ownerId: session.id }, tasks);
  }
  const leads = session ? await listLeadKnowledgeRecords({ tenantId: session.tenantId, ownerId: session.id }) : [];

  const activeLeads = leads.filter((lead) => lead.leadStatus === "lead");
  const manualLeads = leads.filter(isManualLead);
  const automatedLeads = leads.filter((lead) => isMetaLead(lead) || isExtensionLead(lead));
  const replyQueue = leads.filter(needsReply);
  const excludedLeads = leads.filter((lead) => lead.leadStatus === "excluded");
  const activeTasks = tasks.filter(activeTask);
  const awaitingApprovalTasks = tasks.filter((task) => task.status === "awaiting_send_approval" || task.status === "awaiting_approval");

  const metrics: DashboardMetric[] = [
    {
      label: "Automated leads",
      value: automatedLeads.length,
      detail: "Meta and extension sourced",
      href: "/app/leads?view=meta",
      tone: "sky"
    },
    {
      label: "Manual leads",
      value: manualLeads.length,
      detail: "Added by operators",
      href: "/app/leads?q=manual",
      tone: "amber"
    },
    {
      label: "Active leads",
      value: activeLeads.length,
      detail: "Open lead records",
      href: "/app/leads?view=active",
      tone: "lime"
    },
    {
      label: "Needs reply",
      value: replyQueue.length,
      detail: "Inbound waiting on a human",
      href: "/app/leads?view=needs-reply",
      tone: "teal"
    },
    {
      label: "Active tasks",
      value: activeTasks.length,
      detail: "Worker tasks in motion",
      href: "/app/worker",
      tone: "violet"
    }
  ];

  const sourceBreakdown = [
    { label: "Automated", value: automatedLeads.length, tone: "sky" as const },
    { label: "Manual", value: manualLeads.length, tone: "amber" as const },
    { label: "Excluded", value: excludedLeads.length, tone: "violet" as const }
  ];
  const statusBreakdown = [
    { label: "Active", value: activeLeads.length, tone: "lime" as const },
    { label: "Needs reply", value: replyQueue.length, tone: "teal" as const },
    { label: "Excluded", value: excludedLeads.length, tone: "amber" as const }
  ];
  const taskBreakdown = [
    { label: "Active", value: activeTasks.length, tone: "violet" as const },
    { label: "Needs approval", value: awaitingApprovalTasks.length, tone: "amber" as const },
    { label: "Completed", value: tasks.filter((task) => task.status === "sent").length, tone: "teal" as const }
  ];
  const barMax = maxOrOne([...sourceBreakdown, ...statusBreakdown, ...taskBreakdown].map((item) => item.value));
  const recentLeads = [...leads]
    .sort((left, right) => Date.parse(right.lastMessageAt ?? right.updatedAt) - Date.parse(left.lastMessageAt ?? left.updatedAt))
    .slice(0, 6);
  const recentTasks = [...tasks]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Lead Intelligence" title="Operations dashboard" />
          <div className="flex flex-wrap gap-2">
            <Badge tone="teal">{leads.length} total records</Badge>
            <Badge tone={replyQueue.length ? "amber" : "lime"}>{replyQueue.length} needs reply</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => (
            <Link
              key={metric.label}
              href={metric.href}
              className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4 hover:border-[var(--line-strong)] hover:bg-white/[0.05]"
            >
              <div className="mono text-[11px] uppercase text-[var(--muted)]">{metric.label}</div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-3xl font-semibold text-white">{metric.value}</div>
                <Badge tone={metric.tone}>{metric.detail}</Badge>
              </div>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Panel className="p-5">
          <SectionTitle eyebrow="Pipeline health" title="Lead and task breakdown" />
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <BreakdownPanel icon={RadioTower} title="Source mix" items={sourceBreakdown} max={barMax} />
            <BreakdownPanel icon={UsersRound} title="Lead status" items={statusBreakdown} max={barMax} />
            <BreakdownPanel icon={Workflow} title="Worker tasks" items={taskBreakdown} max={barMax} />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="Approvals" title="Operator queue" />
          <div className="mt-5 rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ListChecks size={17} className="text-[var(--teal)]" />
                Send approvals
              </div>
              <Badge tone={awaitingApprovalTasks.length ? "amber" : "lime"}>{awaitingApprovalTasks.length} pending</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">
              Worker drafts stay here until a human reviews and approves send. No outreach is sent automatically.
            </p>
            <Link
              href="/app/worker?tab=pending"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:border-teal-200 hover:bg-teal-300/[0.18]"
            >
              Review worker queue
            </Link>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle eyebrow="Recent lead activity" title="Latest lead movement" />
          {recentLeads.length ? (
            <div className="mt-5 grid gap-2">
              {recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/app/leads?contact=${lead.id}`}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-[8px] border border-[var(--line)] bg-black/20 p-3 hover:border-[var(--line-strong)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{contactLabel(lead)}</span>
                    <span className="mt-1 block truncate text-xs text-[var(--muted-2)]">{lead.lastMessagePreview || lead.summary || "No summary yet"}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Badge tone={needsReply(lead) ? "amber" : "teal"}>{needsReply(lead) ? "Needs reply" : lead.leadStatus}</Badge>
                    <span className="mt-2 flex items-center justify-end gap-1 text-xs text-[var(--muted)]">
                      <Clock size={12} />
                      {formatDate(lead.lastMessageAt ?? lead.updatedAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No lead activity yet"
              detail="Meta webhooks, extension sync, and manual lead intake will appear here once records exist."
              action={<Link href="/app/leads" className="text-sm font-medium text-teal-100 hover:text-teal-50">Open CRM</Link>}
            />
          )}
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="Worker activity" title="Recent task movement" />
          {recentTasks.length ? (
            <div className="mt-5 grid gap-2">
              {recentTasks.map((task) => (
                <Link
                  key={task.id}
                  href="/app/worker"
                  className="flex min-w-0 items-center justify-between gap-3 rounded-[8px] border border-[var(--line)] bg-black/20 p-3 hover:border-[var(--line-strong)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{task.contact.displayName || task.contact.handle || task.contact.phone || "Worker task"}</span>
                    <span className="mt-1 block truncate text-xs text-[var(--muted-2)]">{task.contextSummary || task.draftMessage}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Badge tone={task.status.includes("approval") ? "amber" : "violet"}>{task.status.replace(/_/g, " ")}</Badge>
                    <span className="mt-2 flex items-center justify-end gap-1 text-xs text-[var(--muted)]">
                      <Clock size={12} />
                      {formatDate(task.updatedAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="No worker tasks yet"
              detail="Generate selected-lead tasks from CRM or review queued extension work from Worker Center."
              action={<Link href="/app/worker" className="text-sm font-medium text-teal-100 hover:text-teal-50">Open Worker Center</Link>}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function BreakdownPanel({
  icon: Icon,
  title,
  items,
  max
}: {
  icon: LucideIcon;
  title: string;
  items: Array<{ label: string; value: number; tone: "teal" | "amber" | "lime" | "sky" | "violet" }>;
  max: number;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon size={17} className="text-[var(--teal)]" />
        {title}
      </div>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--muted-2)]">{item.label}</span>
              <Badge tone={item.tone}>{item.value}</Badge>
            </div>
            <ProgressBar value={percent(item.value, max)} tone={item.tone} />
          </div>
        ))}
      </div>
    </div>
  );
}
