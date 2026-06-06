import "server-only";

import {
  automationWorkflowDefinitions,
  n8nBackendLogicModules,
  n8nProviderConfigByWorkflowKey,
  n8nProviderConfigGroups
} from "./automation-workflows";
import { summarizeCrmHealth } from "./crm-store";
import { summarizeExtensionHealth } from "./extension-store";
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
  publicUrl?: string;
  internalUrl?: string;
  dashboardUrl?: string;
  backendAgentWorkflowId?: string;
  backendAgentWorkflowUrl?: string;
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
  source: "n8n";
  status: HealthTone;
  managedByN8n: boolean;
  fieldCount: number;
  secretFieldCount: number;
  workflowCount: number;
  detail: string;
};

export type BackendLogicHubStatus = {
  key: string;
  label: string;
  owner: "n8n";
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

function cleanUrl(value?: string) {
  const clean = value?.trim().replace(/\/$/, "");
  return clean || undefined;
}

function timeoutMs() {
  const parsed = Number(process.env.N8N_HEALTH_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2500;
}

function backendAgentWorkflowId() {
  return process.env.N8N_BACKEND_AGENT_WORKFLOW_ID?.trim() || "urS7zJDAyavE5PSJ";
}

async function probeN8nHealth(baseUrl?: string): Promise<{ health: HealthTone; latencyMs?: number; detail: string }> {
  if (!baseUrl) {
    return { health: "unknown", detail: "n8n URL is not configured." };
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs())
    });
    return {
      health: response.ok ? "healthy" : "warning",
      latencyMs: Date.now() - startedAt,
      detail: response.ok ? "n8n health endpoint responded." : `n8n health returned HTTP ${response.status}.`
    };
  } catch (error) {
    return {
      health: "critical",
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : "n8n health check failed."
    };
  }
}

export async function getAutomationStatus(): Promise<AutomationStatus> {
  const publicUrl = cleanUrl(process.env.N8N_PUBLIC_URL);
  const internalUrl = cleanUrl(process.env.N8N_INTERNAL_URL) ?? publicUrl;
  const configured = Boolean(internalUrl || publicUrl);
  const probe = await probeN8nHealth(internalUrl);
  const workflowId = backendAgentWorkflowId();

  return {
    configured,
    publicUrl,
    internalUrl,
    dashboardUrl: publicUrl,
    backendAgentWorkflowId: workflowId,
    backendAgentWorkflowUrl: publicUrl ? `${publicUrl}/workflow/${workflowId}` : undefined,
    health: configured ? probe.health : "unknown",
    workflowCount: configured ? 1 : 0,
    failedExecutions: 0,
    queueStatus: configured ? (probe.health === "healthy" ? "healthy" : "unknown") : "not_configured",
    checkedAt: new Date().toISOString(),
    detail: configured
      ? `${probe.detail} One backend-agent workflow handles ${automationWorkflowDefinitions.length} operational automation routes.`
      : "Add n8n as a separate Railway service to enable follow-up scheduling, reminders, task creation, and escalation rules."
  };
}

function getBackendLogicHubStatus(): BackendLogicHubStatus[] {
  return n8nBackendLogicModules.map((module) => ({
    key: module.key,
    label: module.label,
    owner: module.owner,
    editableFrom: module.editableFrom,
    actionCount: module.actionPlan.length,
    guardrailCount: module.guardrails.length,
    providerConfigCount: module.providerConfigs.length,
    detail: `${module.n8nOwns.join(", ")}. Leadsy keeps ${module.leadsyOwns.join(", ")}.`
  }));
}

function getProviderConfigHubStatus(automation: AutomationStatus): ProviderConfigHubStatus[] {
  return n8nProviderConfigGroups.map((group) => {
    const workflowCount = Object.values(n8nProviderConfigByWorkflowKey).filter((requirements) =>
      requirements.includes(group.key)
    ).length;
    return {
      key: group.key,
      label: group.label,
      source: "n8n",
      status: automation.configured ? automation.health : "warning",
      managedByN8n: automation.configured,
      fieldCount: group.fields.length,
      secretFieldCount: group.fields.filter((field) => field.secret).length,
      workflowCount,
      detail: automation.configured
        ? `${group.label} config is available in n8n for operator reminders and escalations. ${group.leadsyBoundary}`
        : `Connect the n8n service before ${group.label} notification config can be managed there.`
    };
  });
}

export async function getInfrastructureStatus() {
  const [leadKnowledge, extension, crm, automation] = await Promise.all([
    summarizeLeadKnowledgeHealth(),
    summarizeExtensionHealth(),
    summarizeCrmHealth(),
    getAutomationStatus()
  ]);
  const sources = sourceHealth();
  const now = new Date().toISOString();
  const providerConfigs = getProviderConfigHubStatus(automation);
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
      key: "n8n",
      label: "n8n",
      status: automation.health,
      errors: automation.health === "critical" ? 1 : 0,
      lastSync: automation.checkedAt,
      detail: automation.detail
    },
    {
      key: "meta",
      label: "Meta",
      status: process.env.META_APP_ID || process.env.META_EMBEDDED_SIGNUP_URL ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: process.env.META_APP_ID || process.env.META_EMBEDDED_SIGNUP_URL
          ? "Meta web configuration is present."
          : "Meta app configuration is pending."
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      status: process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.TWILIO_ACCOUNT_SID ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: `${leadKnowledge.metaSourced ?? 0} Meta-sourced leads; ${leadKnowledge.conversations ?? 0} conversations tracked. Twilio/WhatsApp transport config stays in Leadsy.`
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
      status: automation.configured || emailFallbackConfigured ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: automation.configured
        ? "Optional operator reminder and escalation notification config can be managed in n8n."
        : emailFallbackConfigured
          ? "Email fallback configuration is present on the web service."
          : "Email automation config should be added to n8n."
    },
    {
      key: "extension",
      label: "Extension",
      status: sources.browserWorker ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: `${extension.tokens ?? 0} tokens, ${extension.visibleTasks ?? 0} visible tasks, ${crm.followUpTasks ?? 0} CRM follow-ups.`
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
    detail: "OpenRouter cost events are computed by the AI package today. n8n does not own research, qualification, drafting, conversations, leads, or CRM decisions."
  };
}
