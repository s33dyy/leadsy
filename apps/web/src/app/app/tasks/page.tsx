import { TasksConsole, type TaskConsoleRow } from "@/components/tasks-console";
import { getCurrentSession } from "@/lib/auth";
import { listCrmFollowUpTasks, type CrmFollowUpTask } from "@/lib/crm-store";

export const dynamic = "force-dynamic";

function initials(value?: string) {
  const parts = (value || "Leadsy Ops").split(/\s+/).filter(Boolean);
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "LO";
}

function dueLabel(value?: string) {
  if (!value) return "unscheduled";
  return new Date(value).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function priorityLabel(value: CrmFollowUpTask["priority"]): TaskConsoleRow["priority"] {
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

function rowFromCrmTask(task: CrmFollowUpTask): TaskConsoleRow {
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

export default async function TasksPage() {
  const session = await getCurrentSession();
  const crmTasks = session
    ? await listCrmFollowUpTasks({ tenantId: session.tenantId, ownerId: session.id }, { includeClosed: true, destination: "human_tasks" })
    : [];
  const rows = crmTasks.map(rowFromCrmTask);
  return <TasksConsole rows={rows} />;
}
