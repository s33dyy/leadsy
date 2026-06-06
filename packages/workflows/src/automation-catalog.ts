export type AutomationWorkflowKey =
  | "follow-up-scheduled"
  | "reminder-generated"
  | "task-created"
  | "escalation-triggered";

export type AutomationWorkflowDefinition = {
  key: AutomationWorkflowKey;
  name: string;
  trigger: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  retryPolicy: string;
  preserves: string;
};

export const automationWorkflowDefinitions: AutomationWorkflowDefinition[] = [
  {
    key: "follow-up-scheduled",
    name: "Follow-Up Scheduling",
    trigger: "n8n schedule or Leadsy event asks for due follow-up evaluation.",
    purpose: "Find due follow-up windows and ask Leadsy to create or refresh accountable follow-up tasks.",
    inputs: ["tenantId", "ownerId", "leadId", "followUpTaskId", "dueWindowMinutes", "idempotencyKey"],
    outputs: ["follow-up scheduling command", "execution metadata"],
    dependencies: ["Leadsy automation gateway", "Leadsy task API"],
    retryPolicy: "Retry transient Leadsy API failures three times; no-op completed or cancelled follow-ups.",
    preserves: "Leadsy keeps leads, conversations, assignments, CRM state, and task records."
  },
  {
    key: "reminder-generated",
    name: "Reminder Generation",
    trigger: "n8n schedule finds a task, follow-up, approval, or escalation approaching its reminder window.",
    purpose: "Generate operator reminders without changing lead, conversation, assignment, or qualification state.",
    inputs: ["tenantId", "ownerId", "taskId", "leadId", "reminderAt", "idempotencyKey"],
    outputs: ["reminder command", "execution metadata"],
    dependencies: ["Leadsy automation gateway", "Leadsy task API"],
    retryPolicy: "Retry transient Leadsy API failures; skip duplicate reminder idempotency keys.",
    preserves: "Leadsy stores reminder/task state and remains the operator accountability system."
  },
  {
    key: "task-created",
    name: "Task Creation",
    trigger: "A Leadsy-approved workflow or schedule requests a CRM task for a human owner.",
    purpose: "Create accountable human tasks through Leadsy APIs for calls, WhatsApp follow-ups, meetings, site visits, reviews, or custom work.",
    inputs: ["tenantId", "ownerId", "leadId", "taskType", "assigneeId", "dueAt", "idempotencyKey"],
    outputs: ["task creation command", "execution metadata"],
    dependencies: ["Leadsy automation gateway", "Leadsy task API"],
    retryPolicy: "Retry transient Leadsy API failures; never complete, reassign, or message a lead from n8n.",
    preserves: "Leadsy owns task records, owners, statuses, notes, and lead links."
  },
  {
    key: "escalation-triggered",
    name: "Escalation Rules",
    trigger: "n8n schedule or Leadsy event detects a stale task, missed reply SLA, failed reminder, or unresolved approval.",
    purpose: "Apply escalation timing rules and ask Leadsy to create a manager-visible escalation task or reminder.",
    inputs: ["tenantId", "ownerId", "leadId", "taskId", "escalationReason", "ageMinutes", "idempotencyKey"],
    outputs: ["escalation command", "execution metadata"],
    dependencies: ["Leadsy automation gateway", "Leadsy task API"],
    retryPolicy: "Retry transient Leadsy API failures; keep escalation state in Leadsy.",
    preserves: "Leadsy keeps CRM ownership, assignments, approvals, tasks, and audit history."
  }
];

export function workflowDefinitionForKey(key: string) {
  return automationWorkflowDefinitions.find((workflow) => workflow.key === key);
}
