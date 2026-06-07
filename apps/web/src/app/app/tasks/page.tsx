import Link from "next/link";
import { Filter, MoreHorizontal, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listCrmFollowUpTasks, type CrmFollowUpTask } from "@/lib/crm-store";
import { listExtensionTasks, type ExtensionTask } from "@/lib/extension-store";

export const dynamic = "force-dynamic";

type TaskRow = {
  id: string;
  title: string;
  typeLabel: string;
  status: string;
  priority: "Urgent" | "High" | "Medium" | "Low";
  owner: string;
  ownerInitials: string;
  due: string;
  source: "AI" | "Human";
  approval: "Pending" | "Approved" | "None";
  href: string;
};

function initials(value?: string) {
  const parts = (value || "Leadsy Ops").split(/\s+/).filter(Boolean);
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "LO";
}

function dueLabel(value?: string) {
  if (!value) return "unscheduled";
  return new Date(value).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function priorityLabel(value: ExtensionTask["priority"] | CrmFollowUpTask["priority"]): TaskRow["priority"] {
  if (value === "urgent") return "Urgent";
  if (value === "high") return "High";
  if (value === "low") return "Low";
  return "Medium";
}

function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function taskTypeLabel(value: string) {
  const labels: Record<string, string> = {
    follow_up: "WhatsApp Follow-Up",
    call: "Call",
    whatsapp_follow_up: "WhatsApp Follow-Up",
    meeting: "Meeting",
    site_visit: "Site Visit",
    review_lead: "Review Lead",
    custom: "Custom"
  };
  return labels[value] ?? statusLabel(value);
}

function rowFromExtensionTask(task: ExtensionTask): TaskRow {
  const owner = task.platform === "whatsapp-web" ? "WhatsApp worker" : task.platform === "instagram-web" ? "Instagram worker" : "Extension worker";
  const needsApproval = ["awaiting_send_approval", "awaiting_approval", "draft"].includes(task.status);
  return {
    id: task.id,
    title: task.contextSummary || task.draftMessage || task.type.replace(/_/g, " "),
    typeLabel: taskTypeLabel(task.type),
    status: statusLabel(task.status),
    priority: priorityLabel(task.priority),
    owner,
    ownerInitials: initials(owner),
    due: dueLabel(task.dueAt),
    source: "AI",
    approval: needsApproval ? "Pending" : task.approvedAt ? "Approved" : "None",
    href: "/app/worker"
  };
}

function rowFromCrmTask(task: CrmFollowUpTask): TaskRow {
  const owner = task.assigneeName || "Leadsy operator";
  return {
    id: task.id,
    title: task.topic,
    typeLabel: taskTypeLabel(task.type),
    status: statusLabel(task.status),
    priority: priorityLabel(task.priority),
    owner,
    ownerInitials: initials(owner),
    due: dueLabel(task.dueAt),
    source: "Human",
    approval: "None",
    href: `/app/leads?contact=${task.leadId}`
  };
}

function priorityClass(priority: TaskRow["priority"]) {
  if (priority === "Urgent") return "bg-destructive";
  if (priority === "High") return "bg-warning";
  if (priority === "Medium") return "bg-info";
  return "bg-muted-foreground/50";
}

function groupedTasks(rows: TaskRow[]) {
  const order = ["In Progress", "Awaiting Send Approval", "Awaiting Approval", "Draft", "Queued", "Open", "Monitoring", "Done", "Sent", "Blocked", "Failed"];
  const groups = rows.reduce<Record<string, TaskRow[]>>((acc, row) => {
    (acc[row.status] ||= []).push(row);
    return acc;
  }, {});
  const ordered = order.filter((status) => groups[status]).map((status) => [status, groups[status]] as const);
  const remaining = Object.entries(groups).filter(([status]) => !order.includes(status));
  return [...ordered, ...remaining];
}

export default async function TasksPage() {
  const session = await getCurrentSession();
  const [extensionTasks, crmTasks] = session
    ? await Promise.all([
        listExtensionTasks(session.tenantId, session.id),
        listCrmFollowUpTasks({ tenantId: session.tenantId, ownerId: session.id }, { includeClosed: true })
      ])
    : [[], []];
  const rows = [...extensionTasks.map(rowFromExtensionTask), ...crmTasks.map(rowFromCrmTask)];
  const groups = groupedTasks(rows);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
        <div className="flex items-center gap-1.5">
          <span className="caption">Group by</span>
          {["Status", "Priority", "Owner"].map((group, index) => (
            <span key={group} className={`h-7 rounded-[5px] px-2 py-1.5 text-[12px] ${index === 0 ? "bg-surface-3 text-foreground" : "text-muted-foreground"}`}>
              {group}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <span className="w-40 text-[12px] text-muted-foreground">Filter...</span>
          </div>
          <span className="grid h-7 w-7 place-items-center rounded-[5px] border border-border bg-surface-2">
            <Filter className="h-3 w-3" />
          </span>
          <Link href="/app/leads?tab=tasks" className="h-7 rounded-[5px] bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
            + Task
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length ? (
          groups.map(([groupName, items]) => (
            <section key={groupName}>
              <div className="sticky top-0 z-10 flex h-8 items-center gap-2 border-y border-border bg-surface px-3">
                <span className="text-[12px] font-medium">{groupName}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">{items.length}</span>
                <MoreHorizontal className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <ul>
                {items.map((task) => (
                  <li key={task.id} className="grid grid-cols-12 items-center gap-3 border-b border-border/70 px-3 py-2 hover:bg-surface-2">
                    <div className="col-span-12 flex min-w-0 items-center gap-2 md:col-span-6">
                      <input type="checkbox" aria-label={`Complete ${task.title}`} className="h-3.5 w-3.5 accent-primary" defaultChecked={task.status === "Done" || task.status === "Sent"} />
                      <span className="font-mono text-[10.5px] text-muted-foreground">{task.id.slice(0, 10)}</span>
                      <span className={`dot ${priorityClass(task.priority)}`} title={task.priority} />
                      <span className="rounded-[3px] bg-surface-3 px-1.5 font-mono text-[10px] text-muted-foreground">{task.typeLabel}</span>
                      <Link href={task.href} className="truncate text-[12.5px] hover:text-primary">
                        {task.title}
                      </Link>
                      {task.source === "AI" ? (
                        <span className="inline-flex items-center gap-1 rounded-[3px] bg-primary/10 px-1.5 font-mono text-[10px] text-primary">
                          <Sparkles className="h-2.5 w-2.5" /> AI
                        </span>
                      ) : null}
                      {task.approval === "Pending" ? <Badge tone="amber">approval</Badge> : null}
                    </div>
                    <div className="col-span-4 text-[11.5px] text-muted-foreground md:col-span-2">{task.status}</div>
                    <div className="col-span-4 flex items-center gap-1.5 text-[11.5px] md:col-span-2">
                      <div className="grid h-5 w-5 place-items-center rounded-full bg-surface-3 font-mono text-[10px]">{task.ownerInitials}</div>
                      <span className="truncate text-muted-foreground">{task.owner}</span>
                    </div>
                    <div className="col-span-4 text-right font-mono text-[10.5px] text-muted-foreground md:col-span-2">{task.due}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-[12.5px] text-muted-foreground">
            <Sparkles className="h-5 w-5" />
            Tasks generated by operators, CRM follow-ups, and Leadsy automation will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
