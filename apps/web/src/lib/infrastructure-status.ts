import "server-only";

import { automationWorkflowDefinitions, type AutomationWorkflowKey } from "./automation-workflows";
import { summarizeLeadKnowledgeHealth } from "./lead-knowledge-store";
import { sourceHealth } from "./source-health";

export type HealthTone = "healthy" | "warning" | "critical" | "unknown";

export type InfrastructureServiceStatus = {
  key: string;
  label: string;
  status: HealthTone;
  latencyMs?: number;
  errors: number;
  lastSync?: string;
  detail: string;
};

export type AutomationStatus = {
  configured: boolean;
  health: HealthTone;
  workflowCount: number;
  lastExecution?: string;
  failedExecutions: number;
  queueStatus: "not_configured" | "unknown" | "healthy" | "warning";
  checkedAt: string;
  detail: string;
};

export type ProviderConfigHubStatus = {
  key: string;
  label: string;
  source: "leadsy";
  status: HealthTone;
  managedByLeadsy: boolean;
  fieldCount: number;
  secretFieldCount: number;
  workflowCount: number;
  detail: string;
};

export type BackendLogicHubStatus = {
  key: string;
  label: string;
  owner: "leadsy";
  editableFrom: string[];
  actionCount: number;
  guardrailCount: number;
  providerConfigCount: number;
  detail: string;
};

export type AiCostWorkflowSummary = {
  workflowKey: string;
  workflowName: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostInr: number;
  modelUsage: Record<string, number>;
  failures: number;
};

const emailProviderFields = [
  { key: "provider", label: "Email provider", env: "EMAIL_PROVIDER", secret: false },
  { key: "smtpHost", label: "SMTP host", env: "SMTP_HOST", secret: false },
  { key: "smtpUser", label: "SMTP user", env: "SMTP_USER", secret: false },
  { key: "smtpPassword", label: "SMTP password", env: "SMTP_PASSWORD", secret: true },
  { key: "resendApiKey", label: "Resend API key", env: "RESEND_API_KEY", secret: true },
  { key: "postmarkServerToken", label: "Postmark server token", env: "POSTMARK_SERVER_TOKEN", secret: true }
];

const workflowActionCounts: Record<AutomationWorkflowKey, number> = {
  "follow-up-scheduled": 2,
  "reminder-generated": 2,
  "task-created": 2,
  "escalation-triggered": 2
};

const workflowGuardrailCounts: Record<AutomationWorkflowKey, number> = {
  "follow-up-scheduled": 2,
  "reminder-generated": 2,
  "task-created": 3,
  "escalation-triggered": 2
};

export async function getAutomationStatus(): Promise<AutomationStatus> {
  return {
    configured: true,
    health: "healthy",
    workflowCount: automationWorkflowDefinitions.length,
    failedExecutions: 0,
    queueStatus: "healthy",
    checkedAt: new Date().toISOString(),
    detail: `Leadsy-native automation handles ${automationWorkflowDefinitions.length} operational routes for follow-ups, reminders, tasks, and escalations.`
  };
}

function getBackendLogicHubStatus(): BackendLogicHubStatus[] {
  return automationWorkflowDefinitions.map((workflow) => ({
    key: workflow.key,
    label: workflow.name,
    owner: "leadsy",
    editableFrom: ["leadsy-app", "codex"],
    actionCount: workflowActionCounts[workflow.key],
    guardrailCount: workflowGuardrailCounts[workflow.key],
    providerConfigCount: workflow.dependencies.length,
    detail: `${workflow.purpose} ${workflow.preserves}`
  }));
}

function getProviderConfigHubStatus(): ProviderConfigHubStatus[] {
  const configured = Boolean(
    process.env.SMTP_HOST || process.env.EMAIL_SERVER || process.env.RESEND_API_KEY || process.env.POSTMARK_SERVER_TOKEN
  );
  return [
    {
      key: "email",
      label: "Operator Email Notifications",
      source: "leadsy",
      status: configured ? "healthy" : "warning",
      managedByLeadsy: true,
      fieldCount: emailProviderFields.length,
      secretFieldCount: emailProviderFields.filter((field) => field.secret).length,
      workflowCount: automationWorkflowDefinitions.length,
      detail: configured
        ? "Leadsy app email configuration is present for operator reminders and escalation notices."
        : "Add SMTP, Resend, or Postmark configuration to the web service for operator notifications."
    }
  ];
}

export async function getInfrastructureStatus() {
  const [leadKnowledge, automation] = await Promise.all([
    summarizeLeadKnowledgeHealth(),
    getAutomationStatus()
  ]);
  const sources = sourceHealth();
  const now = new Date().toISOString();
  const providerConfigs = getProviderConfigHubStatus();
  const emailFallbackConfigured = Boolean(
    process.env.SMTP_HOST || process.env.EMAIL_SERVER || process.env.RESEND_API_KEY || process.env.POSTMARK_SERVER_TOKEN
  );

  const services: InfrastructureServiceStatus[] = [
    {
      key: "web",
      label: "Web Service",
      status: "healthy",
      errors: 0,
      lastSync: now,
      detail: "Next.js API and app shell are available."
    },
    {
      key: "database",
      label: "Database",
      status: process.env.DATABASE_URL ? "healthy" : "warning",
      errors: process.env.DATABASE_URL ? 0 : 1,
      lastSync: now,
      detail: process.env.DATABASE_URL ? "DATABASE_URL is configured." : "DATABASE_URL is missing."
    },
    {
      key: "automation",
      label: "Automation",
      status: automation.health,
      errors: automation.health === "critical" ? 1 : 0,
      lastSync: automation.checkedAt,
      detail: automation.detail
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      status: process.env.TWILIO_ACCOUNT_SID ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: `${leadKnowledge.whatsappSourced ?? 0} WhatsApp-sourced leads; ${leadKnowledge.conversations ?? 0} conversations tracked. Twilio transport config stays in Leadsy.`
    },
    {
      key: "openrouter",
      label: "OpenRouter",
      status: sources.openrouter ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: sources.openrouter
          ? "OpenRouter web fallback configuration is present."
          : "OpenRouter key is not configured; deterministic/free paths remain available."
    },
    {
      key: "email",
      label: "Email",
      status: emailFallbackConfigured ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: emailFallbackConfigured
        ? "Email configuration is present on the web service for operator notifications."
        : "Add SMTP, Resend, or Postmark configuration to the web service for operator notifications."
    }
  ];

  return {
    checkedAt: now,
    automation,
    backendLogic: getBackendLogicHubStatus(),
    providerConfigs,
    services
  };
}

export async function getAiCostDashboard() {
  return {
    checkedAt: new Date().toISOString(),
    totals: {
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostInr: 0,
      failures: 0
    },
    workflows: automationWorkflowDefinitions.map<AiCostWorkflowSummary>((workflow) => ({
      workflowKey: workflow.key,
      workflowName: workflow.name,
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostInr: 0,
      modelUsage: {},
      failures: 0
    })),
    detail: "OpenRouter cost events are computed by the AI package today. Leadsy owns research, qualification, drafting, conversations, leads, and CRM decisions."
  };
}
