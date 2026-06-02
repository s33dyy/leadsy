"use client";

import { useMemo, useState } from "react";
import { Activity as ActivityIcon, AlertTriangle, CheckCircle2, Clock3, Loader2, Play, RefreshCw, Send } from "lucide-react";
import { Badge, EmptyState } from "./ui";

type ExtensionTask = {
  id: string;
  type: "initiate_conversation" | "follow_up" | "reply_to_inbound" | "manual_review" | "report_update";
  status:
    | "queued"
    | "in_progress"
    | "awaiting_send_approval"
    | "sent"
    | "monitoring"
    | "blocked"
    | "failed"
    | "cancelled"
    | "draft"
    | "awaiting_approval"
    | "approved";
  priority: "low" | "normal" | "high" | "urgent";
  platform: string;
  targetUrl?: string;
  contact: { displayName?: string; phone?: string; email?: string; handle?: string };
  draftMessage: string;
  contextSummary: string;
  resultSummary?: string;
  preparedAt?: string;
  sendApprovedAt?: string;
  blockedReason?: string;
  updatedAt: string;
};

type ExtensionTaskEvent = {
  id: string;
  taskId: string;
  type: string;
  summary: string;
  reason?: string;
  occurredAt: string;
};

const columns = [
  { key: "ready", title: "Ready queue", statuses: ["queued", "approved"] },
  { key: "preparing", title: "Preparing", statuses: ["in_progress"] },
  { key: "approval", title: "Needs send approval", statuses: ["awaiting_send_approval", "draft", "awaiting_approval"] },
  { key: "blocked", title: "Blocked", statuses: ["blocked", "failed"] },
  { key: "completed", title: "Done", statuses: ["sent", "monitoring", "cancelled"] }
] as const;

export function ExtensionTaskBoard({
  initialTasks,
  initialEvents = []
}: {
  initialTasks: ExtensionTask[];
  initialEvents?: ExtensionTaskEvent[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, setLoading] = useState("");
  const counts = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        count: tasks.filter((task) => (column.statuses as readonly string[]).includes(task.status)).length
      })),
    [tasks]
  );

  async function generateTasks() {
    setLoading("generate");
    const response = await fetch("/api/extension/tasks/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "initiate_conversation" })
    });
    const payload = await response.json();
    setLoading("");
    if (!response.ok) return;
    const nextTasks = payload.tasks as ExtensionTask[];
    setTasks((current) => mergeTasks(nextTasks, current));
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {counts.map((column) => (
            <Badge key={column.key} tone={column.key === "blocked" ? "amber" : column.key === "completed" ? "lime" : "teal"}>
              {column.title}: {column.count}
            </Badge>
          ))}
        </div>
        <button
          type="button"
          onClick={generateTasks}
          className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
        >
          {loading === "generate" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Queue lead tasks
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => (column.statuses as readonly string[]).includes(task.status));
          return (
            <section key={column.key} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">{column.title}</div>
                <span className="mono text-xs text-[var(--muted)]">{columnTasks.length}</span>
              </div>
              {columnTasks.length ? (
                <div className="grid gap-3">
                  {columnTasks.map((task) => (
                    <article key={task.id} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-semibold text-white">{contactLabel(task)}</div>
                        <Badge tone={task.status === "blocked" || task.status === "failed" ? "amber" : "teal"}>{task.priority}</Badge>
                      </div>
                      <div className="mono mt-2 text-[10px] uppercase text-[var(--muted)]">
                        {task.type.replace(/_/g, " ")} · {task.platform.replace(/-/g, " ")}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-[var(--muted-2)]">{task.contextSummary}</p>
                      <p className="mt-3 rounded-[6px] bg-black/20 p-2 text-xs leading-5 text-white">{task.draftMessage}</p>
                      {task.resultSummary ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{task.resultSummary}</p> : null}
                      <TaskMeta task={task} />
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState icon={emptyIcon(column.key)} title="Nothing here" detail="Tasks move here as the worker prepares, waits for send approval, sends, or blocks." />
              )}
            </section>
          );
        })}
      </div>

      <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Worker activity</div>
          <span className="mono text-xs text-[var(--muted)]">{initialEvents.length}</span>
        </div>
        {initialEvents.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {initialEvents.slice(0, 9).map((event) => (
              <div key={event.id} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={event.type.includes("blocked") || event.type.includes("failed") ? "amber" : "teal"}>
                    {event.type.replace(/_/g, " ")}
                  </Badge>
                  <span className="mono text-[10px] text-[var(--muted)]">{new Date(event.occurredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-2)]">{event.summary}</p>
                {event.reason ? <p className="mono mt-2 text-[10px] uppercase text-amber-100">{event.reason.replace(/_/g, " ")}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={ActivityIcon} title="No worker events yet" detail="Prepared drafts, sends, blocked targets, and monitoring signals will appear here." />
        )}
      </div>
    </div>
  );
}

function TaskMeta({ task }: { task: ExtensionTask }) {
  if (task.status === "awaiting_send_approval") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-amber-100">
        <Clock3 size={13} />
        Send approval is waiting in the extension worker.
      </div>
    );
  }
  if (task.status === "blocked" || task.status === "failed") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-amber-100">
        <AlertTriangle size={13} />
        {task.blockedReason ? task.blockedReason.replace(/_/g, " ") : "Worker needs attention"}
      </div>
    );
  }
  if (task.status === "sent" || task.status === "monitoring") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-lime-100">
        <CheckCircle2 size={13} />
        Worker reported this outreach back to Leadsy.
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-teal-100">
      <Play size={13} />
      Available in the extension queue.
    </div>
  );
}

function emptyIcon(columnKey: string) {
  if (columnKey === "approval") return Clock3;
  if (columnKey === "blocked") return AlertTriangle;
  if (columnKey === "completed") return Send;
  return Play;
}

function contactLabel(task: ExtensionTask) {
  return task.contact.displayName || task.contact.handle || task.contact.phone || task.contact.email || "Unknown lead";
}

function mergeTasks(incoming: ExtensionTask[], current: ExtensionTask[]) {
  const byId = new Map(current.map((task) => [task.id, task]));
  for (const task of incoming) {
    byId.set(task.id, task);
  }
  return [...byId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
