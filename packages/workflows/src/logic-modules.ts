import type { AutomationWorkflowKey } from "./automation-catalog";
import type { N8nProviderConfigKey } from "./provider-config";

export type N8nLogicEditSurface = "n8n_canvas" | "github_json" | "codex";

export type N8nLogicAction =
  | "schedule-follow-up"
  | "generate-reminder"
  | "create-task"
  | "create-escalation"
  | "write-audit-event";

export type N8nBackendLogicModule = {
  key: AutomationWorkflowKey;
  label: string;
  owner: "n8n";
  editableFrom: N8nLogicEditSurface[];
  providerConfigs: N8nProviderConfigKey[];
  leadsyOwns: string[];
  n8nOwns: string[];
  guardrails: string[];
  decisionInputs: string[];
  actionPlan: Array<{
    action: N8nLogicAction;
    when: string;
    writesTo: "leadsy-api" | "n8n-execution";
    approvalRequired: boolean;
  }>;
  failurePolicy: string;
};

export const n8nBackendLogicModules: N8nBackendLogicModule[] = [
  {
    key: "follow-up-scheduled",
    label: "Follow-up scheduling rules",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: [],
    leadsyOwns: ["lead records", "conversation records", "assignment state", "follow-up task records"],
    n8nOwns: ["due-window cadence", "schedule interval", "idempotency policy"],
    guardrails: ["Do not read or write provider conversations from n8n", "Do not change lead owners from n8n"],
    decisionInputs: ["dueWindowMinutes", "followUpTaskId", "leadId", "ownerId"],
    actionPlan: [
      {
        action: "schedule-follow-up",
        when: "follow-up task is due or approaching due",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Retry transient Leadsy API failures; skip completed, cancelled, or duplicate follow-up windows."
  },
  {
    key: "reminder-generated",
    label: "Reminder generation rules",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: [],
    leadsyOwns: ["task record", "lead link", "owner accountability", "reminder persistence"],
    n8nOwns: ["reminder cadence", "quiet hours", "duplicate reminder suppression"],
    guardrails: ["Generate reminders only; do not send outreach", "Write reminders through Leadsy APIs"],
    decisionInputs: ["taskId", "leadId", "reminderAt", "ownerId", "priority"],
    actionPlan: [
      {
        action: "generate-reminder",
        when: "task or follow-up is inside its reminder window",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Retry Leadsy API failures; no-op duplicate reminder keys."
  },
  {
    key: "task-created",
    label: "Task creation rules",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: [],
    leadsyOwns: ["CRM task record", "task owner", "task status", "lead relationship"],
    n8nOwns: ["task creation trigger policy", "default due-date offsets", "task type mapping"],
    guardrails: ["Do not complete tasks from n8n", "Do not assign leads from n8n", "Do not send external messages from n8n"],
    decisionInputs: ["taskType", "assigneeId", "dueAt", "leadId", "priority"],
    actionPlan: [
      {
        action: "create-task",
        when: "a configured schedule or Leadsy-approved automation requests a human task",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Retry transient Leadsy API failures; reject missing owner or lead context."
  },
  {
    key: "escalation-triggered",
    label: "Escalation rules",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: [],
    leadsyOwns: ["manager visibility", "task state", "approval state", "assignment history"],
    n8nOwns: ["staleness thresholds", "escalation timing", "duplicate escalation suppression"],
    guardrails: ["Create escalation tasks only through Leadsy", "Do not bypass managers or auto-resolve work"],
    decisionInputs: ["escalationReason", "ageMinutes", "taskId", "leadId", "ownerId"],
    actionPlan: [
      {
        action: "create-escalation",
        when: "task, approval, or follow-up exceeds configured threshold",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Retry transient Leadsy API failures; suppress duplicate escalations for the same stale window."
  }
];

export const n8nBackendLogicByWorkflowKey: Record<AutomationWorkflowKey, N8nBackendLogicModule> =
  Object.fromEntries(n8nBackendLogicModules.map((module) => [module.key, module])) as Record<
    AutomationWorkflowKey,
    N8nBackendLogicModule
  >;

export function logicModuleForWorkflow(key: AutomationWorkflowKey) {
  return n8nBackendLogicByWorkflowKey[key];
}
