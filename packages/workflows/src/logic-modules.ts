import type { AutomationWorkflowKey } from "./automation-catalog";
import type { N8nProviderConfigKey } from "./provider-config";

export type N8nLogicEditSurface = "n8n_canvas" | "github_json" | "codex";

export type N8nLogicAction =
  | "fetch-lead-context"
  | "refresh-lead-intelligence"
  | "run-research"
  | "run-qualification"
  | "generate-task"
  | "create-approval"
  | "draft-follow-up"
  | "send-notification"
  | "retry-worker"
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
    writesTo: "leadsy-api" | "provider" | "n8n-execution";
    approvalRequired: boolean;
  }>;
  failurePolicy: string;
};

export const n8nBackendLogicModules: N8nBackendLogicModule[] = [
  {
    key: "lead-added",
    label: "Lead added intelligence plan",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["openrouter"],
    leadsyOwns: ["lead record", "tenant checks", "dedupe state", "CRM source of truth"],
    n8nOwns: ["qualification trigger policy", "summary refresh policy", "initial task suggestion policy"],
    guardrails: ["Never create a lead directly in n8n", "No outbound send without Leadsy approval state"],
    decisionInputs: ["source", "leadId", "campaignId", "messageCount", "existingQualification"],
    actionPlan: [
      {
        action: "fetch-lead-context",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "run-qualification",
        when: "lead has new contact or intent evidence",
        writesTo: "provider",
        approvalRequired: false
      },
      {
        action: "generate-task",
        when: "score is hot, urgent, or reply-ready",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Skip duplicate idempotency keys; retry transient Leadsy/provider failures; escalate provider config gaps."
  },
  {
    key: "lead-updated",
    label: "Lead update refresh plan",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["openrouter"],
    leadsyOwns: ["lead mutation", "field-level validation", "tenant checks"],
    n8nOwns: ["changed-field routing", "refresh scope", "follow-up rescheduling policy"],
    guardrails: ["No direct field writes from n8n", "No refresh when changed fields are operational-only"],
    decisionInputs: ["changedFields", "previousStatus", "newStatus", "lastActivityAt"],
    actionPlan: [
      {
        action: "fetch-lead-context",
        when: "changed fields include contact, status, knowledge, task, or communication",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "refresh-lead-intelligence",
        when: "knowledge or communication changed",
        writesTo: "provider",
        approvalRequired: false
      },
      {
        action: "generate-task",
        when: "status or intent change creates a next action",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "No-op on non-actionable fields; retry conflicts/transient failures; preserve latest Leadsy state."
  },
  {
    key: "research-requested",
    label: "Research pipeline",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["openrouter"],
    leadsyOwns: ["research request", "saved evidence", "cost ledger", "approval records"],
    n8nOwns: ["research source order", "model choice", "confidence thresholds", "approval routing"],
    guardrails: ["Respect Leadsy budget cap", "Store evidence only through Leadsy API", "Route uncertain claims to approval"],
    decisionInputs: ["budgetCap", "sourceTypes", "leadFacts", "existingEvidence", "confidenceThreshold"],
    actionPlan: [
      {
        action: "fetch-lead-context",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "run-research",
        when: "provider config and budget cap allow",
        writesTo: "provider",
        approvalRequired: false
      },
      {
        action: "create-approval",
        when: "confidence is low or outreach-impacting findings changed",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Stop on spend cap; retry transient provider failures; save low-confidence no-op metadata."
  },
  {
    key: "qualification-requested",
    label: "Qualification scoring plan",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["openrouter"],
    leadsyOwns: ["qualification profile", "stored scores", "CRM stage"],
    n8nOwns: ["scoring rubric", "urgency thresholds", "recommended-action rules"],
    guardrails: ["Never overwrite Leadsy qualification without tenant-approved API", "Approval required before outbound draft send"],
    decisionInputs: ["qualificationProfileId", "leadFacts", "conversationSummary", "source", "urgencySignals"],
    actionPlan: [
      {
        action: "fetch-lead-context",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "run-qualification",
        when: "profile exists and lead has enough evidence",
        writesTo: "provider",
        approvalRequired: false
      },
      {
        action: "create-approval",
        when: "score is hot or rationale affects outreach",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Route missing profile to setup; retry transient model failures; preserve previous score on failure."
  },
  {
    key: "task-generated",
    label: "Task routing plan",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["email"],
    leadsyOwns: ["task record", "task status", "owner assignment"],
    n8nOwns: ["approval routing", "reminder cadence", "notification channel choice"],
    guardrails: ["Do not mark tasks complete from n8n", "Do not send external messages without approval"],
    decisionInputs: ["taskType", "requiresApproval", "dueAt", "ownerId", "leadId"],
    actionPlan: [
      {
        action: "create-approval",
        when: "task requires approval",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "send-notification",
        when: "owner needs attention or due time is close",
        writesTo: "provider",
        approvalRequired: false
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "No-op deleted tasks; retry notification failures; keep Leadsy task state authoritative."
  },
  {
    key: "approval-requested",
    label: "Approval routing plan",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["email"],
    leadsyOwns: ["approval item", "review state", "resource ownership"],
    n8nOwns: ["routing rules", "escalation timing", "notification policy"],
    guardrails: ["Never auto-approve", "Never send rejected drafts"],
    decisionInputs: ["approvalType", "risk", "ownerId", "resourceId", "ageMinutes"],
    actionPlan: [
      {
        action: "create-approval",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "send-notification",
        when: "risk is medium or high, or item is stale",
        writesTo: "provider",
        approvalRequired: false
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Escalate missing owner; retry notifications; preserve pending review state."
  },
  {
    key: "follow-up-due",
    label: "Follow-up automation plan",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["whatsapp", "email", "openrouter"],
    leadsyOwns: ["follow-up task", "lead status", "conversation history", "approval state"],
    n8nOwns: ["due-window scan", "drafting policy", "channel preference", "reminder cadence"],
    guardrails: ["Approval required before external send", "Skip excluded or converted leads", "Write outbound records through Leadsy only"],
    decisionInputs: ["dueWindowMinutes", "leadStatus", "lastInboundAt", "preferredChannel", "approvalMode"],
    actionPlan: [
      {
        action: "fetch-lead-context",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "draft-follow-up",
        when: "lead is active and due",
        writesTo: "provider",
        approvalRequired: true
      },
      {
        action: "create-approval",
        when: "draft created or human review is required",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "No-op completed/excluded leads; retry provider failures; create manual review task on draft failure."
  },
  {
    key: "meta-lead-received",
    label: "Meta lead automation plan",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["meta", "openrouter"],
    leadsyOwns: ["Meta webhook verification", "lead storage", "asset-to-owner routing"],
    n8nOwns: ["post-storage enrichment", "qualification trigger", "campaign-specific follow-up policy"],
    guardrails: ["Public Meta webhooks never terminate at n8n", "No direct lead table writes"],
    decisionInputs: ["metaObject", "assetIds", "campaignId", "leadId", "source"],
    actionPlan: [
      {
        action: "fetch-lead-context",
        when: "Leadsy has stored the Meta lead",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "run-qualification",
        when: "campaign or form indicates sales intent",
        writesTo: "provider",
        approvalRequired: false
      },
      {
        action: "generate-task",
        when: "hot lead or missing owner follow-up",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Escalate ambiguous asset routing; retry provider calls; webhook verification failures never reach n8n."
  },
  {
    key: "whatsapp-message-received",
    label: "WhatsApp reply intelligence plan",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["whatsapp", "openrouter"],
    leadsyOwns: ["inbound message storage", "conversation state", "lead exclusion", "approval records"],
    n8nOwns: ["reply suggestion policy", "qualification refresh policy", "follow-up task generation"],
    guardrails: ["Approval required before sending a WhatsApp reply", "Skip duplicates and excluded leads"],
    decisionInputs: ["messageId", "direction", "conversationId", "leadStatus", "latestInboundText"],
    actionPlan: [
      {
        action: "fetch-lead-context",
        when: "message is inbound and not duplicate",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "draft-follow-up",
        when: "message needs reply",
        writesTo: "provider",
        approvalRequired: true
      },
      {
        action: "run-qualification",
        when: "message changes urgency or fit",
        writesTo: "provider",
        approvalRequired: false
      },
      {
        action: "create-approval",
        when: "reply draft exists",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Skip duplicates; retry transient provider failures; pause on approval-required states."
  },
  {
    key: "worker-retry",
    label: "Worker retry plan",
    owner: "n8n",
    editableFrom: ["n8n_canvas", "github_json", "codex"],
    providerConfigs: ["email"],
    leadsyOwns: ["worker task", "extension pairing", "task status", "retry count"],
    n8nOwns: ["retry schedule", "safe retry policy", "exhaustion escalation"],
    guardrails: ["Do not retry non-idempotent sends", "Do not change extension authentication"],
    decisionInputs: ["failureReason", "retryCount", "retryAfter", "taskType", "lastError"],
    actionPlan: [
      {
        action: "retry-worker",
        when: "failure is transient and retry count is below policy",
        writesTo: "leadsy-api",
        approvalRequired: false
      },
      {
        action: "create-approval",
        when: "failure is exhausted, ambiguous, or unsafe",
        writesTo: "leadsy-api",
        approvalRequired: true
      },
      {
        action: "send-notification",
        when: "operator attention is needed",
        writesTo: "provider",
        approvalRequired: false
      },
      {
        action: "write-audit-event",
        when: "always",
        writesTo: "leadsy-api",
        approvalRequired: false
      }
    ],
    failurePolicy: "Retry safe transient failures three times; escalate non-retryable or exhausted tasks."
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
