import "server-only";

import { automationWorkflowDefinitions, n8nProviderConfigGroups, n8nProviderConfigByWorkflowKey } from "./automation-workflows";
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

  return {
    configured,
    publicUrl,
    internalUrl,
    dashboardUrl: publicUrl,
    health: configured ? probe.health : "unknown",
    workflowCount: configured ? 1 : 0,
    failedExecutions: 0,
    queueStatus: configured ? (probe.health === "healthy" ? "healthy" : "unknown") : "not_configured",
    checkedAt: new Date().toISOString(),
    detail: configured
      ? `${probe.detail} One router workflow handles ${automationWorkflowDefinitions.length} Leadsy event types.`
      : "Add n8n as a separate Railway service to enable automation orchestration."
  };
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
        ? `${group.label} automation config is managed in n8n. ${group.leadsyBoundary}`
        : `Connect the n8n service before ${group.label} automation config can be managed there.`
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
  const n8nManagedProviders = automation.configured;
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
      status: n8nManagedProviders || process.env.META_APP_ID || process.env.META_EMBEDDED_SIGNUP_URL ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: n8nManagedProviders
        ? "Meta automation provider config is managed in n8n; Leadsy keeps OAuth and webhook intake."
        : process.env.META_APP_ID || process.env.META_EMBEDDED_SIGNUP_URL
          ? "Meta web configuration is present."
          : "Meta app configuration is pending."
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      status: n8nManagedProviders || process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: n8nManagedProviders
        ? `${leadKnowledge.metaSourced ?? 0} Meta-sourced leads; ${leadKnowledge.conversations ?? 0} conversations tracked. WhatsApp automation config is managed in n8n.`
        : `${leadKnowledge.metaSourced ?? 0} Meta-sourced leads; ${leadKnowledge.conversations ?? 0} conversations tracked.`
    },
    {
      key: "openrouter",
      label: "OpenRouter",
      status: n8nManagedProviders || sources.openrouter ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: n8nManagedProviders
        ? "OpenRouter automation config is managed in n8n; Leadsy keeps saved outputs and cost reporting."
        : sources.openrouter
          ? "OpenRouter web fallback configuration is present."
          : "OpenRouter key is not configured; deterministic/free paths remain available."
    },
    {
      key: "email",
      label: "Email",
      status: n8nManagedProviders || emailFallbackConfigured ? "healthy" : "warning",
      errors: 0,
      lastSync: now,
      detail: n8nManagedProviders
        ? "Email automation config is managed in n8n for notifications and approved outreach."
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
    detail: "OpenRouter cost events are computed by the AI package today. Durable per-workflow cost persistence should be added before n8n production rollout."
  };
}
