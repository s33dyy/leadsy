export type ExtensionTaskStatus =
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

export type ExtensionTask = {
  id: string;
  type: "initiate_conversation" | "follow_up" | "reply_to_inbound" | "manual_review" | "report_update";
  status: ExtensionTaskStatus;
  priority: "low" | "normal" | "high" | "urgent";
  leadId?: string;
  conversationId?: string;
  platform: "whatsapp-web" | "instagram-web" | "facebook-web" | "generic-web-chat";
  targetUrl?: string;
  contact: {
    displayName?: string;
    phone?: string;
    email?: string;
    handle?: string;
    profileUrl?: string;
  };
  draftMessage: string;
  contextSummary: string;
  resultSummary?: string;
  preparedAt?: string;
  sendApprovedAt?: string;
  sendRejectedAt?: string;
  postponedUntil?: string;
  postponedReason?: string;
  runBatchId?: string;
  runMode?: "manual" | "selected_batch";
  deletedAt?: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
};

export type ExtensionTaskEventType =
  | "batch_run_started"
  | "batch_run_finished"
  | "worker_opened"
  | "worker_prepared"
  | "send_approved"
  | "send_rejected"
  | "worker_sent"
  | "worker_postponed"
  | "worker_blocked"
  | "worker_failed"
  | "task_edited"
  | "task_deleted"
  | "monitoring_event"
  | "inbound_issue";

export function taskContactLabel(task: ExtensionTask) {
  return task.contact?.displayName || task.contact?.handle || task.contact?.phone || task.contact?.email || "Unknown lead";
}

export function taskActionLabel(task: ExtensionTask) {
  return task.type.replace(/_/g, " ");
}
