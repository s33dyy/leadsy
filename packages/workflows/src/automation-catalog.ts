export type AutomationWorkflowKey =
  | "lead-added"
  | "lead-updated"
  | "research-requested"
  | "qualification-requested"
  | "task-generated"
  | "approval-requested"
  | "follow-up-due"
  | "meta-lead-received"
  | "whatsapp-message-received"
  | "worker-retry";

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
    key: "lead-added",
    name: "Lead Added",
    trigger: "Leadsy stores a new lead from manual intake, Meta, WhatsApp, or extension sync.",
    purpose: "Start qualification, summary, and task orchestration after Leadsy owns the lead record.",
    inputs: ["tenantId", "ownerId", "leadId", "source", "idempotencyKey"],
    outputs: ["qualification request", "optional task suggestion", "execution metadata"],
    dependencies: ["Leadsy lead read API", "Leadsy qualification API", "Leadsy task API"],
    retryPolicy: "Retry transient Leadsy API failures three times; skip duplicate idempotency keys.",
    preserves: "Lead CRUD and lead storage stay in Leadsy."
  },
  {
    key: "lead-updated",
    name: "Lead Updated",
    trigger: "Leadsy updates contact, status, task, knowledge, or communication fields.",
    purpose: "Refresh only the intelligence artifacts affected by the changed fields.",
    inputs: ["tenantId", "ownerId", "leadId", "changedFields", "idempotencyKey"],
    outputs: ["refresh decisions", "downstream workflow links", "execution metadata"],
    dependencies: ["Leadsy lead read API", "Leadsy automation execution API"],
    retryPolicy: "Retry conflict/transient failures; no-op when no actionable fields changed.",
    preserves: "Lead updates and tenant checks stay in Leadsy APIs."
  },
  {
    key: "research-requested",
    name: "Research Requested",
    trigger: "Operator or schedule asks Leadsy to research a lead or research request.",
    purpose: "Coordinate research while keeping evidence, spend, and saved records inside Leadsy.",
    inputs: ["tenantId", "ownerId", "leadId", "researchRequestId", "sourceTypes", "budgetCap", "idempotencyKey"],
    outputs: ["research summary", "evidence URLs", "cost metadata", "approval items"],
    dependencies: ["Leadsy research endpoint", "OpenRouter through Leadsy", "Leadsy audit endpoint"],
    retryPolicy: "Retry transient provider failures; stop when spend cap or validation blocks execution.",
    preserves: "OpenRouter calls stay behind the Leadsy provider abstraction."
  },
  {
    key: "qualification-requested",
    name: "Qualification Requested",
    trigger: "Lead added, lead updated, WhatsApp message received, or operator request.",
    purpose: "Score fit/urgency and decide whether task or approval routing is needed.",
    inputs: ["tenantId", "ownerId", "leadId", "conversationId", "qualificationProfileId", "idempotencyKey"],
    outputs: ["qualification stage", "scores", "recommended action", "optional task/approval trigger"],
    dependencies: ["Leadsy qualification profile API", "Leadsy AI provider abstraction"],
    retryPolicy: "Retry transient AI/API failures; route missing profile to setup or approval.",
    preserves: "Qualification result storage stays in Leadsy."
  },
  {
    key: "task-generated",
    name: "Task Generated",
    trigger: "Leadsy creates an extension, CRM, or follow-up task.",
    purpose: "Route approvals, due reminders, and retry schedules around Leadsy task state.",
    inputs: ["tenantId", "ownerId", "taskId", "leadId", "taskType", "requiresApproval", "idempotencyKey"],
    outputs: ["approval item", "schedule record", "execution metadata"],
    dependencies: ["Leadsy task APIs"],
    retryPolicy: "No-op deleted/cancelled tasks; fail without retry on tenant mismatch.",
    preserves: "Task CRUD and status transitions stay in Leadsy."
  },
  {
    key: "approval-requested",
    name: "Approval Requested",
    trigger: "Research, task, note, draft, outreach, or qualification output requires human review.",
    purpose: "Create a central approval item and pause downstream automation until reviewed.",
    inputs: ["tenantId", "ownerId", "approvalType", "resourceId", "leadId", "summary", "risk", "idempotencyKey"],
    outputs: ["approval item", "approval status", "downstream continuation link"],
    dependencies: ["Leadsy approval/task APIs", "Leadsy notification adapter"],
    retryPolicy: "Escalate when no owner exists; mark stale on review timeout.",
    preserves: "Leadsy remains the human approval gate before outbound sends."
  },
  {
    key: "follow-up-due",
    name: "Follow-up Due",
    trigger: "n8n scheduled due check or task due timestamp.",
    purpose: "Surface due follow-ups and create approved draft paths when useful.",
    inputs: ["tenantId", "ownerId", "followUpTaskId", "leadId", "dueAt", "idempotencyKey"],
    outputs: ["reminder item", "optional draft metadata", "execution metadata"],
    dependencies: ["Leadsy CRM follow-up API", "Leadsy AI provider abstraction"],
    retryPolicy: "No-op completed/excluded leads; create manual review task on draft failure.",
    preserves: "Follow-up task state stays in Leadsy."
  },
  {
    key: "meta-lead-received",
    name: "Meta Lead Received",
    trigger: "Existing Leadsy Meta route stores a Meta-derived lead or communication.",
    purpose: "Run post-storage qualification and approval routing for Meta-originated leads.",
    inputs: ["tenantId", "ownerId", "leadId", "metaObject", "assetIds", "campaignId", "idempotencyKey"],
    outputs: ["qualification execution", "optional task or approval item"],
    dependencies: ["Leadsy Meta webhook routes", "Leadsy qualification/task APIs"],
    retryPolicy: "Escalate ambiguous asset routing; webhook verification failures never reach n8n.",
    preserves: "Public Meta webhooks continue to terminate at Leadsy."
  },
  {
    key: "whatsapp-message-received",
    name: "WhatsApp Message Received",
    trigger: "Existing Leadsy WhatsApp/Meta route stores an inbound WhatsApp message.",
    purpose: "Generate reply suggestions, refresh qualification, and route approvals.",
    inputs: ["tenantId", "ownerId", "leadId", "conversationId", "messageId", "direction", "idempotencyKey"],
    outputs: ["suggested reply approval", "updated summary", "qualification refresh", "cost metadata"],
    dependencies: ["Leadsy WhatsApp webhook handling", "Leadsy reply/AI endpoints"],
    retryPolicy: "Skip duplicates and excluded leads; pause on approval-required states.",
    preserves: "WhatsApp message handling and storage stay in Leadsy."
  },
  {
    key: "worker-retry",
    name: "Worker Retry",
    trigger: "Worker task failed, blocked, postponed, or reached retry due time.",
    purpose: "Retry only safe worker actions and escalate exhausted/non-retryable failures.",
    inputs: ["tenantId", "ownerId", "taskId", "leadId", "failureReason", "retryCount", "retryAfter", "idempotencyKey"],
    outputs: ["rescheduled task", "escalation item", "execution record"],
    dependencies: ["Leadsy extension task APIs"],
    retryPolicy: "Retry three times for transient failures; escalate non-retryable or exhausted tasks.",
    preserves: "Leadsy keeps worker task state while the extension remains the capture/execution layer."
  }
];

export function workflowDefinitionForKey(key: string) {
  return automationWorkflowDefinitions.find((workflow) => workflow.key === key);
}
