"use client";

import { useMemo, useState } from "react";
import { Activity as ActivityIcon, AlertTriangle, CheckCircle2, Clock3, Loader2, Pencil, Play, RefreshCw, Send, Trash2 } from "lucide-react";
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
    | "postponed"
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
  postponedUntil?: string;
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
  { key: "blocked", title: "Blocked / postponed", statuses: ["postponed", "blocked", "failed"] },
  { key: "completed", title: "Done", statuses: ["sent", "monitoring", "cancelled"] }
] as const;

type TaskColumnKey = (typeof columns)[number]["key"];

export function ExtensionTaskBoard({
  initialTasks,
  initialEvents = [],
  focusColumn
}: {
  initialTasks: ExtensionTask[];
  initialEvents?: ExtensionTaskEvent[];
  focusColumn?: TaskColumnKey;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, setLoading] = useState("");
  const orderedColumns = useMemo(() => {
    if (!focusColumn) return columns;
    const focused = columns.find((column) => column.key === focusColumn);
    return focused ? [focused, ...columns.filter((column) => column.key !== focusColumn)] : columns;
  }, [focusColumn]);
  const counts = useMemo(
    () =>
      orderedColumns.map((column) => ({
        ...column,
        count: tasks.filter((task) => (column.statuses as readonly string[]).includes(task.status)).length
      })),
    [orderedColumns, tasks]
  );

  async function generateTasks() {
    setLoading("generate");
    const response = await fetch("/api/extension/tasks/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "auto_detect" })
    });
    const payload = await response.json();
    setLoading("");
    if (!response.ok) return;
    const nextTasks = payload.tasks as ExtensionTask[];
    setTasks((current) => mergeTasks(nextTasks, current));
  }

  async function approvePreparedSend(task: ExtensionTask, action: "approve" | "reject") {
    setLoading(`${action}:${task.id}`);
    const response = await fetch(`/api/extension/tasks/${encodeURIComponent(task.id)}/approve-send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await response.json();
    setLoading("");
    if (!response.ok) return;
    setTasks((current) => mergeTasks([payload as ExtensionTask], current));
  }

  async function editTask(task: ExtensionTask, formData: FormData) {
    setLoading(`edit:${task.id}`);
    const response = await fetch(`/api/extension/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draftMessage: String(formData.get("draftMessage") ?? ""),
        contextSummary: String(formData.get("contextSummary") ?? ""),
        targetUrl: String(formData.get("targetUrl") ?? ""),
        priority: formData.get("priority")
      })
    });
    const payload = await response.json();
    setLoading("");
    if (!response.ok) return;
    setTasks((current) => mergeTasks([payload as ExtensionTask], current));
  }

  async function deleteTask(task: ExtensionTask) {
    setLoading(`delete:${task.id}`);
    const response = await fetch(`/api/extension/tasks/${encodeURIComponent(task.id)}`, {
      method: "DELETE"
    });
    const payload = await response.json();
    setLoading("");
    if (!response.ok) return;
    setTasks((current) => current.filter((candidate) => candidate.id !== (payload as ExtensionTask).id));
  }

  return (
    <div className="grid min-w-0 gap-4">
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

      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-5">
        {orderedColumns.map((column) => {
          const columnTasks = tasks.filter((task) => (column.statuses as readonly string[]).includes(task.status));
          const focused = column.key === focusColumn;
          return (
            <section
              key={column.key}
              data-task-column={column.key}
              data-focused={focused ? "true" : undefined}
              className={`min-w-0 overflow-hidden rounded-[8px] border bg-black/20 p-3 ${
                focused ? "border-amber-300/35 ring-1 ring-amber-300/20" : "border-[var(--line)]"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-sm font-semibold text-white">{column.title}</div>
                <span className="mono shrink-0 text-xs text-[var(--muted)]">{columnTasks.length}</span>
              </div>
              {columnTasks.length ? (
                <div className="grid gap-3">
                  {columnTasks.map((task) => (
                    <article
                      key={task.id}
                      data-task-card={task.id}
                      className="min-w-0 overflow-hidden rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 break-words text-sm font-semibold leading-5 text-white">{contactLabel(task)}</div>
                        <Badge tone={task.status === "blocked" || task.status === "failed" ? "amber" : "teal"}>{task.priority}</Badge>
                      </div>
                      <div className="mono mt-2 truncate text-[10px] uppercase text-[var(--muted)]">
                        {task.type.replace(/_/g, " ")} · {task.platform.replace(/-/g, " ")}
                      </div>
                      <p className="mt-3 line-clamp-3 break-words text-xs leading-5 text-[var(--muted-2)]">{task.contextSummary}</p>
	                      <p className="mt-3 line-clamp-4 break-words rounded-[6px] bg-black/20 p-2 text-xs leading-5 text-white">{task.draftMessage}</p>
	                      {task.resultSummary ? <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-[var(--muted)]">{task.resultSummary}</p> : null}
	                      <TaskMeta task={task} />
	                      <TaskActions task={task} loading={loading} onSendDecision={approvePreparedSend} onEditTask={editTask} onDeleteTask={deleteTask} />
	                    </article>
	                  ))}
                </div>
              ) : (
                <CompactEmptyState icon={emptyIcon(column.key)} title="Nothing here" detail="Worker updates will move tasks into this lane." />
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
          <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {initialEvents.slice(0, 9).map((event) => (
              <div key={event.id} className="min-w-0 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <Badge tone={event.type.includes("blocked") || event.type.includes("failed") ? "amber" : "teal"}>
                    {event.type.replace(/_/g, " ")}
                  </Badge>
                  <span className="mono shrink-0 text-[10px] text-[var(--muted)]">{new Date(event.occurredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-2 break-words text-xs leading-5 text-[var(--muted-2)]">{event.summary}</p>
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

function CompactEmptyState({
  icon: Icon,
  title,
  detail
}: {
  icon: typeof Play;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-[8px] border border-dashed border-[var(--line)] bg-black/20 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-teal-300/20 bg-teal-300/10 text-teal-100">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{title}</div>
        <p className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">{detail}</p>
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
  if (task.status === "postponed") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-amber-100">
        <Clock3 size={13} />
        Postponed{task.postponedUntil ? ` until ${new Date(task.postponedUntil).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}.
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

function TaskActions({
  task,
  loading,
  onSendDecision,
  onEditTask,
  onDeleteTask
}: {
  task: ExtensionTask;
  loading: string;
  onSendDecision: (task: ExtensionTask, action: "approve" | "reject") => void;
  onEditTask: (task: ExtensionTask, formData: FormData) => void;
  onDeleteTask: (task: ExtensionTask) => void;
}) {
  const editing = loading === `edit:${task.id}`;
  const deleting = loading === `delete:${task.id}`;
  const approving = loading === `approve:${task.id}`;
  const rejecting = loading === `reject:${task.id}`;
  return (
    <div className="mt-3 grid gap-2">
      {task.status === "awaiting_send_approval" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSendDecision(task, "approve")}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-lime-300/25 bg-lime-300/10 px-3 text-xs font-medium text-lime-100 hover:bg-lime-300/[0.16]"
          >
            {approving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Approve send
          </button>
          <button
            type="button"
            onClick={() => onSendDecision(task, "reject")}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-amber-300/25 bg-amber-300/10 px-3 text-xs font-medium text-amber-100 hover:bg-amber-300/[0.16]"
          >
            {rejecting ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            Reject
          </button>
        </div>
      ) : null}
      <details className="rounded-[6px] border border-[var(--line)] bg-black/20 p-2">
        <summary className="cursor-pointer text-xs font-medium text-white">Edit task</summary>
        <form
          className="mt-2 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onEditTask(task, new FormData(event.currentTarget));
          }}
        >
          <select name="priority" defaultValue={task.priority} className="h-9 rounded-[6px] border border-[var(--line)] bg-black/30 px-2 text-xs text-white">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <input name="targetUrl" defaultValue={task.targetUrl || ""} className="h-9 rounded-[6px] border border-[var(--line)] bg-black/30 px-2 text-xs text-white" />
          <textarea name="contextSummary" defaultValue={task.contextSummary} rows={2} className="rounded-[6px] border border-[var(--line)] bg-black/30 px-2 py-2 text-xs text-white" />
          <textarea name="draftMessage" defaultValue={task.draftMessage} rows={3} className="rounded-[6px] border border-[var(--line)] bg-black/30 px-2 py-2 text-xs text-white" />
          <button type="submit" className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-3 text-xs font-medium text-teal-100 hover:bg-teal-300/[0.16]">
            {editing ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
            Save task
          </button>
        </form>
      </details>
      <button
        type="button"
        onClick={() => onDeleteTask(task)}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-amber-300/25 bg-amber-300/10 px-3 text-xs font-medium text-amber-100 hover:bg-amber-300/[0.16]"
      >
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        Delete task
      </button>
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
