"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Pencil, Send, Sparkles, Trash2, Workflow } from "lucide-react";
import { Badge, EmptyState } from "./ui";

type SelectedLeadTask = {
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
  draftMessage: string;
  contextSummary: string;
  resultSummary?: string;
  blockedReason?: string;
  postponedUntil?: string;
  updatedAt: string;
  dueAt?: string;
};

type SelectedLeadTaskEvent = {
  id: string;
  taskId: string;
  type: string;
  summary: string;
  reason?: string;
  occurredAt: string;
};

export function LeadTaskGenerateMenu({
  leadId,
  onTasksGenerated,
  className = "",
  label = "AI Generate tasks"
}: {
  leadId: string;
  onTasksGenerated?: (tasks: SelectedLeadTask[]) => void;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function queueExtensionTask() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/extension/tasks/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "auto_detect", leadIds: [leadId] })
    });
    const payload = (await response.json().catch(() => ({}))) as { tasks?: SelectedLeadTask[]; error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(payload.error === "rate_limited" ? "Task generation is rate limited. Try again shortly." : "Task was not generated. Check the lead contact details and try again.");
      return;
    }
    onTasksGenerated?.(payload.tasks ?? []);
    router.refresh();
  }

  return (
    <div className={`grid gap-2 ${className}`}>
      <button
        type="button"
        disabled={loading}
        onClick={queueExtensionTask}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-teal-300/35 bg-teal-300/[0.12] px-3 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {label}
      </button>
      <div className="text-xs leading-5 text-[var(--muted-2)]">
        Auto-detect best task from lead context. Generate an extension task for this lead; human approval is still required before any send.
      </div>
      {error ? <div className="rounded-[6px] border border-amber-300/25 bg-amber-300/10 px-2 py-2 text-xs leading-5 text-amber-100">{error}</div> : null}
    </div>
  );
}

export function SelectedLeadTasks({
  leadId,
  initialTasks,
  initialEvents
}: {
  leadId: string;
  initialTasks: SelectedLeadTask[];
  initialEvents: SelectedLeadTaskEvent[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, setLoading] = useState("");
  const taskIds = new Set(tasks.map((task) => task.id));
  const events = initialEvents.filter((event) => taskIds.has(event.taskId));

  async function approvePreparedSend(task: SelectedLeadTask, action: "approve" | "reject") {
    setLoading(`${action}:${task.id}`);
    const response = await fetch(`/api/extension/tasks/${encodeURIComponent(task.id)}/approve-send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await response.json();
    setLoading("");
    if (!response.ok) return;
    setTasks((current) => current.map((candidate) => (candidate.id === task.id ? (payload as SelectedLeadTask) : candidate)));
    router.refresh();
  }

  async function editTask(task: SelectedLeadTask, formData: FormData) {
    setLoading(`edit:${task.id}`);
    const response = await fetch(`/api/extension/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draftMessage: String(formData.get("draftMessage") ?? ""),
        contextSummary: String(formData.get("contextSummary") ?? ""),
        priority: formData.get("priority")
      })
    });
    const payload = await response.json();
    setLoading("");
    if (!response.ok) return;
    setTasks((current) => current.map((candidate) => (candidate.id === task.id ? (payload as SelectedLeadTask) : candidate)));
    router.refresh();
  }

  async function deleteTask(task: SelectedLeadTask) {
    setLoading(`delete:${task.id}`);
    const response = await fetch(`/api/extension/tasks/${encodeURIComponent(task.id)}`, {
      method: "DELETE"
    });
    setLoading("");
    if (!response.ok) return;
    setTasks((current) => current.filter((candidate) => candidate.id !== task.id));
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Workflow size={16} className="text-[var(--teal)]" />
              Reply execution mode
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
              No extension = log manually. With the extension, queue a human-approved browser task for this lead only.
            </p>
          </div>
          <LeadTaskGenerateMenu leadId={leadId} onTasksGenerated={(nextTasks) => setTasks((current) => mergeGeneratedTasks(nextTasks, current))} />
        </div>
      </div>

      {tasks.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {tasks.map((task) => (
            <article key={task.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{task.type.replace(/_/g, " ")}</div>
                  <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">{task.platform.replace(/-/g, " ")}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={task.status === "blocked" || task.status === "failed" ? "amber" : task.status === "sent" ? "lime" : "teal"}>
                    {task.status.replace(/_/g, " ")}
                  </Badge>
                  <Badge tone={task.priority === "urgent" || task.priority === "high" ? "amber" : "neutral"}>{task.priority}</Badge>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">{task.contextSummary}</p>
              <p className="mt-3 rounded-[6px] bg-white/[0.04] p-3 text-sm leading-6 text-white">{task.draftMessage}</p>
              {task.resultSummary ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{task.resultSummary}</p> : null}
              <TaskState task={task} />
              {task.status === "awaiting_send_approval" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => approvePreparedSend(task, "approve")}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-lime-300/25 bg-lime-300/10 px-3 text-xs font-medium text-lime-100 hover:bg-lime-300/[0.16]"
                  >
                    {loading === `approve:${task.id}` ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Approve send
                  </button>
                  <button
                    type="button"
                    onClick={() => approvePreparedSend(task, "reject")}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-amber-300/25 bg-amber-300/10 px-3 text-xs font-medium text-amber-100 hover:bg-amber-300/[0.16]"
                  >
                    {loading === `reject:${task.id}` ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                    Reject
                  </button>
                </div>
              ) : null}
              <details className="mt-3 rounded-[6px] border border-[var(--line)] bg-white/[0.03] p-3">
                <summary className="cursor-pointer text-xs font-medium text-white">Edit task</summary>
                <form
                  className="mt-3 grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    editTask(task, new FormData(event.currentTarget));
                  }}
                >
                  <select name="priority" defaultValue={task.priority} className="h-9 rounded-[6px] border border-[var(--line)] bg-black/30 px-2 text-xs text-white">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <textarea name="contextSummary" defaultValue={task.contextSummary} rows={2} className="rounded-[6px] border border-[var(--line)] bg-black/30 px-2 py-2 text-xs text-white" />
                  <textarea name="draftMessage" defaultValue={task.draftMessage} rows={3} className="rounded-[6px] border border-[var(--line)] bg-black/30 px-2 py-2 text-xs text-white" />
                  <button type="submit" className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-3 text-xs font-medium text-teal-100 hover:bg-teal-300/[0.16]">
                    {loading === `edit:${task.id}` ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                    Save task
                  </button>
                </form>
              </details>
              <button
                type="button"
                onClick={() => deleteTask(task)}
                className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-amber-300/25 bg-amber-300/10 px-3 text-xs font-medium text-amber-100 hover:bg-amber-300/[0.16]"
              >
                {loading === `delete:${task.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete task
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={Workflow} title="No tasks for this lead" detail="Use AI Generate tasks above, or keep tracking replies by logging manual comms." />
      )}

      <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Worker reports for this lead</div>
          <Badge tone="neutral">{events.length}</Badge>
        </div>
        {events.length ? (
          <div className="mt-3 grid gap-2">
            {events.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={event.type.includes("blocked") || event.type.includes("failed") ? "amber" : "teal"}>{event.type.replace(/_/g, " ")}</Badge>
                  <span className="mono text-[10px] text-[var(--muted)]">
                    {new Date(event.occurredAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-2)]">{event.summary}</p>
                {event.reason ? <p className="mono mt-2 text-[10px] uppercase text-amber-100">{event.reason.replace(/_/g, " ")}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">No worker reports have been attached to this lead yet.</p>
        )}
      </div>
    </div>
  );
}

function mergeGeneratedTasks(nextTasks: SelectedLeadTask[], currentTasks: SelectedLeadTask[]) {
  const nextTaskIds = new Set(nextTasks.map((task) => task.id));
  return [...nextTasks, ...currentTasks.filter((task) => !nextTaskIds.has(task.id))];
}

function TaskState({ task }: { task: SelectedLeadTask }) {
  if (task.status === "awaiting_send_approval") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-amber-100">
        <Clock3 size={13} />
        Draft prepared. Waiting for Leadsy app approval.
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
  if (task.status === "postponed") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-amber-100">
        <Clock3 size={13} />
        Postponed{task.postponedUntil ? ` until ${new Date(task.postponedUntil).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}.
      </div>
    );
  }
  if (task.status === "sent" || task.status === "monitoring") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-lime-100">
        <CheckCircle2 size={13} />
        Worker reported completion back to Leadsy.
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-teal-100">
      <Workflow size={13} />
      Available in the selected lead worker queue.
    </div>
  );
}
