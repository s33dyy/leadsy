import { automationWorkflowDefinitions, type AutomationWorkflowDefinition } from "./automation-catalog";
import { n8nBackendLogicByWorkflowKey, n8nBackendLogicModules, type N8nBackendLogicModule } from "./logic-modules";
import {
  n8nProviderConfigByWorkflowKey,
  n8nProviderConfigGroups,
  type N8nProviderConfigGroup,
  type N8nProviderConfigKey
} from "./provider-config";

type N8nConnectionTarget = {
  node: string;
  type: "main";
  index: number;
};

type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  notes?: string;
  notesInFlow?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
};

export type N8nWorkflowBlueprint = {
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, { main: N8nConnectionTarget[][] }>;
  settings: {
    executionOrder: "v1";
    saveExecutionProgress: boolean;
    saveManualExecutions: boolean;
    saveDataErrorExecution: "all";
    saveDataSuccessExecution: "all";
    timezone: "Asia/Kolkata";
  };
  pinData: Record<string, never>;
  meta: {
    leadsyWorkflowKey: "automation-router";
    providerConfigs: N8nProviderConfigGroup[];
    routeProviderRequirements: Record<AutomationWorkflowDefinition["key"], N8nProviderConfigKey[]>;
    backendLogicModules: N8nBackendLogicModule[];
    routes: Array<{
      key: AutomationWorkflowDefinition["key"];
      name: string;
      purpose: string;
      trigger: string;
      preserves: string;
    }>;
    purpose: string;
    preserves: string;
  };
};

const workflowActionPath: Record<AutomationWorkflowDefinition["key"], string> = {
  "lead-added": "/api/automation/events/lead-added",
  "lead-updated": "/api/automation/events/lead-updated",
  "research-requested": "/api/automation/events/research-requested",
  "qualification-requested": "/api/automation/events/qualification-requested",
  "task-generated": "/api/automation/events/task-generated",
  "approval-requested": "/api/automation/events/approval-requested",
  "follow-up-due": "/api/automation/events/follow-up-due",
  "meta-lead-received": "/api/automation/events/meta-lead-received",
  "whatsapp-message-received": "/api/automation/events/whatsapp-message-received",
  "worker-retry": "/api/automation/events/worker-retry"
};

function nodeId(suffix: string) {
  return `leadsy-router-${suffix}`;
}

function connection(to: string): N8nConnectionTarget {
  return { node: to, type: "main", index: 0 };
}

function httpNode(
  suffix: string,
  name: string,
  pathExpression: string,
  body: Record<string, unknown>,
  position: [number, number],
  options: { continueOnFail?: boolean; retryOnFail?: boolean } = {}
): N8nNode {
  return {
    id: nodeId(suffix),
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position,
    retryOnFail: options.retryOnFail ?? true,
    maxTries: 3,
    waitBetweenTries: 60000,
    continueOnFail: options.continueOnFail ?? false,
    parameters: {
      method: "POST",
      url: pathExpression,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          {
            name: "Authorization",
            value: "={{'Bearer ' + $env.LEADSY_N8N_WEBHOOK_SECRET}}"
          },
          {
            name: "X-Leadsy-Workflow",
            value: "={{$json.workflowKey}}"
          },
          {
            name: "X-Leadsy-Config-Source",
            value: "n8n"
          }
        ]
      },
      sendBody: true,
      contentType: "json",
      jsonBody: JSON.stringify(body),
      options: {
        timeout: 30000
      }
    }
  };
}

function webhookTrigger(): N8nNode {
  return {
    id: nodeId("webhook-trigger"),
    name: "Leadsy Event Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    parameters: {
      httpMethod: "POST",
      path: "leadsy/automation-router",
      responseMode: "onReceived",
      options: {
        responseCode: 202,
        responseData: "firstEntryJson"
      }
    },
    notes: "Single Leadsy entrypoint. Send { workflowKey, tenantId, ownerId, idempotencyKey, payload } to route automation events.",
    notesInFlow: true
  };
}

function scheduleTrigger(name: string, suffix: string, minutesInterval: number, position: [number, number]): N8nNode {
  return {
    id: nodeId(suffix),
    name,
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.2,
    position,
    parameters: {
      rule: {
        interval: [{ field: "minutes", minutesInterval }]
      }
    },
    notes: `${name} feeds the same router canvas as external Leadsy events.`,
    notesInFlow: true
  };
}

function normalizeWebhook(): N8nNode {
  return {
    id: nodeId("normalize-webhook"),
    name: "Normalize Webhook Event",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [300, 0],
    parameters: {
      jsCode: [
        "const body = $json.body ?? $json;",
        "const workflowKey = body.workflowKey ?? body.leadsyWorkflowKey ?? body.eventType ?? body.type;",
        "return [{",
        "  json: {",
        "    workflowKey,",
        "    workflowName: workflowKey,",
        "    triggerId: body.triggerId ?? body.idempotencyKey ?? $execution.id,",
        "    idempotencyKey: body.idempotencyKey ?? $execution.id,",
        "    tenantId: body.tenantId,",
        "    ownerId: body.ownerId,",
        "    leadId: body.leadId,",
        "    taskId: body.taskId,",
        "    conversationId: body.conversationId,",
        "    startedAt: new Date().toISOString(),",
        "    payload: body.payload ?? body",
        "  }",
        "}];"
      ].join("\n")
    },
    notes: "Normalizes event payloads emitted by Leadsy APIs.",
    notesInFlow: true
  };
}

function normalizeSchedule(
  name: string,
  suffix: string,
  workflow: AutomationWorkflowDefinition,
  position: [number, number],
  dueWindowMinutes: number
): N8nNode {
  return {
    id: nodeId(suffix),
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: {
      jsCode: [
        "return [{",
        "  json: {",
        `    workflowKey: ${JSON.stringify(workflow.key)},`,
        `    workflowName: ${JSON.stringify(workflow.name)},`,
        "    triggerId: $execution.id,",
        "    idempotencyKey: $execution.id,",
        "    startedAt: new Date().toISOString(),",
        "    payload: {",
        "      scheduled: true,",
        `      dueWindowMinutes: ${dueWindowMinutes},`,
        "      triggeredAt: new Date().toISOString()",
        "    }",
        "  }",
        "}];"
      ].join("\n")
    },
    notes: workflow.trigger,
    notesInFlow: true
  };
}

function providerConfigStatusNode(): N8nNode {
  const providerGroups = n8nProviderConfigGroups.map((group) => ({
    key: group.key,
    label: group.label,
    purpose: group.purpose,
    leadsyBoundary: group.leadsyBoundary,
    fields: group.fields.map((field) => ({
      key: field.key,
      label: field.label,
      env: field.env,
      secret: field.secret,
      required: field.required
    }))
  }));

  return {
    id: nodeId("provider-config-check"),
    name: "Provider Config Check",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [840, 0],
    parameters: {
      jsCode: [
        `const providerGroups = ${JSON.stringify(providerGroups, null, 2)};`,
        `const routeProviderRequirements = ${JSON.stringify(n8nProviderConfigByWorkflowKey, null, 2)};`,
        "const env = typeof $env === 'object' && $env ? $env : process.env;",
        "function hasValue(name) {",
        "  return Boolean(String(env[name] ?? '').trim());",
        "}",
        "function configured(group) {",
        "  if (group.key === 'email') {",
        "    return hasValue('SMTP_HOST') || hasValue('RESEND_API_KEY') || hasValue('POSTMARK_SERVER_TOKEN');",
        "  }",
        "  const required = group.fields.filter((field) => field.required);",
        "  return required.length ? required.every((field) => hasValue(field.env)) : group.fields.some((field) => hasValue(field.env));",
        "}",
        "const providerConfig = Object.fromEntries(providerGroups.map((group) => [group.key, {",
        "  label: group.label,",
        "  source: 'n8n',",
        "  configured: configured(group),",
        "  purpose: group.purpose,",
        "  leadsyBoundary: group.leadsyBoundary,",
        "  fields: group.fields.map((field) => ({",
        "    key: field.key,",
        "    label: field.label,",
        "    env: field.env,",
        "    secret: field.secret,",
        "    required: field.required,",
        "    configured: hasValue(field.env),",
        "    value: field.secret ? undefined : (String(env[field.env] ?? '').trim() || undefined)",
        "  }))",
        "}]));",
        "const requiredProviderConfig = routeProviderRequirements[$json.workflowKey] ?? [];",
        "const providerConfigMissing = requiredProviderConfig.filter((key) => !providerConfig[key]?.configured);",
        "return [{",
        "  json: {",
        "    ...$json,",
        "    providerConfigSource: 'n8n',",
        "    providerConfig,",
        "    requiredProviderConfig,",
        "    providerConfigMissing",
        "  }",
        "}];"
      ].join("\n")
    },
    notes: "Reads Meta, WhatsApp, Email, and OpenRouter provider configuration from the n8n service environment. It reports only configured/missing status to Leadsy, never secret values.",
    notesInFlow: true
  };
}

function backendLogicModulesNode(): N8nNode {
  return {
    id: nodeId("backend-logic-modules"),
    name: "Backend Logic Modules",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [1040, 0],
    parameters: {
      jsCode: [
        `const modules = ${JSON.stringify(n8nBackendLogicByWorkflowKey, null, 2)};`,
        "const module = modules[$json.workflowKey];",
        "if (!module) {",
        "  throw new Error(`No n8n backend logic module for workflowKey: ${$json.workflowKey}`);",
        "}",
        "const providerConfigMissing = Array.isArray($json.providerConfigMissing) ? $json.providerConfigMissing : [];",
        "const actionQueue = module.actionPlan.map((step, index) => ({",
        "  index: index + 1,",
        "  ...step,",
        "  source: 'n8n',",
        "  status: providerConfigMissing.length ? 'blocked_provider_config' : 'planned'",
        "}));",
        "const n8nLogicPlan = {",
        "  moduleKey: module.key,",
        "  moduleLabel: module.label,",
        "  owner: module.owner,",
        "  editableFrom: module.editableFrom,",
        "  providerConfigs: module.providerConfigs,",
        "  providerConfigMissing,",
        "  guardrails: module.guardrails,",
        "  leadsyOwns: module.leadsyOwns,",
        "  n8nOwns: module.n8nOwns,",
        "  decisionInputs: module.decisionInputs,",
        "  actionQueue,",
        "  failurePolicy: module.failurePolicy,",
        "  generatedAt: new Date().toISOString()",
        "};",
        "return [{",
        "  json: {",
        "    ...$json,",
        "    backendLogicSource: 'n8n',",
        "    n8nLogicPlan",
        "  }",
        "}];"
      ].join("\n")
    },
    notes: "This is where mutable backend workflow logic lives for automation: decision inputs, action plans, guardrails, approval requirements, and failure policy. Edit it in n8n, or edit the typed source and re-export from GitHub/Codex.",
    notesInFlow: true
  };
}

function validateEventNode(): N8nNode {
  const workflowNames = Object.fromEntries(
    automationWorkflowDefinitions.map((workflow) => [workflow.key, workflow.name])
  );

  return {
    id: nodeId("validate-event"),
    name: "Validate Event",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [660, 0],
    parameters: {
      jsCode: [
        `const routePaths = ${JSON.stringify(workflowActionPath, null, 2)};`,
        `const workflowNames = ${JSON.stringify(workflowNames, null, 2)};`,
        "const workflowKey = $json.workflowKey;",
        "if (typeof workflowKey !== 'string' || !routePaths[workflowKey]) {",
        "  const supported = Object.keys(routePaths).join(', ');",
        "  throw new Error(`Unsupported Leadsy workflowKey: ${workflowKey ?? 'missing'}. Supported: ${supported}`);",
        "}",
        "return [{",
        "  json: {",
        "    ...$json,",
        "    workflowName: workflowNames[workflowKey],",
        "    actionPath: routePaths[workflowKey],",
        "    validatedAt: new Date().toISOString()",
        "  }",
        "}];"
      ].join("\n")
    },
    notes: "Validates the workflowKey and computes the Leadsy API path. No visual branch per event type.",
    notesInFlow: true
  };
}

function dispatchAutomationNode(): N8nNode {
  return httpNode(
    "dispatch-automation",
    "Dispatch Automation",
    "={{$env.LEADSY_API_BASE_URL + $json.actionPath}}",
    {
      workflowKey: "={{$json.workflowKey}}",
      workflowName: "={{$json.workflowName}}",
      n8nExecutionId: "={{$execution.id}}",
      idempotencyKey: "={{$json.idempotencyKey}}",
      tenantId: "={{$json.tenantId}}",
      ownerId: "={{$json.ownerId}}",
      leadId: "={{$json.leadId}}",
      taskId: "={{$json.taskId}}",
      conversationId: "={{$json.conversationId}}",
      providerConfigSource: "={{$json.providerConfigSource}}",
      requiredProviderConfig: "={{$json.requiredProviderConfig}}",
      providerConfigMissing: "={{$json.providerConfigMissing}}",
      providerConfig: "={{$json.providerConfig}}",
      backendLogicSource: "={{$json.backendLogicSource}}",
      n8nLogicPlan: "={{$json.n8nLogicPlan}}",
      payload: "={{$json.payload}}"
    },
    [1360, 0],
    { retryOnFail: true }
  );
}

export function n8nAutomationRouterBlueprint(): N8nWorkflowBlueprint {
  const followUpWorkflow = automationWorkflowDefinitions.find((workflow) => workflow.key === "follow-up-due")!;
  const workerRetryWorkflow = automationWorkflowDefinitions.find((workflow) => workflow.key === "worker-retry")!;
  const startedPath = "={{$env.LEADSY_API_BASE_URL + '/api/automation/executions'}}";

  const logStarted = httpNode(
    "log-started",
    "Log Started",
    startedPath,
    {
      workflowKey: "={{$json.workflowKey}}",
      n8nExecutionId: "={{$execution.id}}",
      status: "started",
      metadata: "={{$json}}"
    },
    [660, -260],
    { continueOnFail: true, retryOnFail: true }
  );

  const logSucceeded = httpNode(
    "log-succeeded",
    "Log Succeeded",
    startedPath,
    {
      workflowKey: "={{$('Validate Event').item.json.workflowKey}}",
      n8nExecutionId: "={{$execution.id}}",
      status: "succeeded",
      metadata: {
        event: "={{$('Validate Event').item.json}}",
        dispatchResponse: "={{$json}}"
      }
    },
    [1680, 0],
    { continueOnFail: true, retryOnFail: true }
  );

  const validateEvent = validateEventNode();
  const providerConfig = providerConfigStatusNode();
  const backendLogicModules = backendLogicModulesNode();
  const dispatchAutomation = dispatchAutomationNode();

  return {
    name: "Leadsy - Automation Router",
    active: false,
    nodes: [
      webhookTrigger(),
      scheduleTrigger("Follow-up Due Schedule", "follow-up-schedule", 15, [0, 220]),
      scheduleTrigger("Worker Retry Schedule", "worker-retry-schedule", 5, [0, 440]),
      normalizeWebhook(),
      normalizeSchedule("Normalize Follow-up Due", "normalize-follow-up-due", followUpWorkflow, [300, 220], 15),
      normalizeSchedule("Normalize Worker Retry", "normalize-worker-retry", workerRetryWorkflow, [300, 440], 5),
      logStarted,
      validateEvent,
      providerConfig,
      backendLogicModules,
      dispatchAutomation,
      logSucceeded
    ],
    connections: {
      "Leadsy Event Webhook": { main: [[connection("Normalize Webhook Event")]] },
      "Follow-up Due Schedule": { main: [[connection("Normalize Follow-up Due")]] },
      "Worker Retry Schedule": { main: [[connection("Normalize Worker Retry")]] },
      "Normalize Webhook Event": { main: [[connection("Log Started"), connection("Validate Event")]] },
      "Normalize Follow-up Due": { main: [[connection("Log Started"), connection("Validate Event")]] },
      "Normalize Worker Retry": { main: [[connection("Log Started"), connection("Validate Event")]] },
      "Validate Event": { main: [[connection("Provider Config Check")]] },
      "Provider Config Check": { main: [[connection("Backend Logic Modules")]] },
      "Backend Logic Modules": { main: [[connection("Dispatch Automation")]] },
      "Dispatch Automation": { main: [[connection("Log Succeeded")]] }
    },
    settings: {
      executionOrder: "v1",
      saveExecutionProgress: true,
      saveManualExecutions: true,
      saveDataErrorExecution: "all",
      saveDataSuccessExecution: "all",
      timezone: "Asia/Kolkata"
    },
    pinData: {},
    meta: {
      leadsyWorkflowKey: "automation-router",
      providerConfigs: n8nProviderConfigGroups,
      routeProviderRequirements: n8nProviderConfigByWorkflowKey,
      backendLogicModules: n8nBackendLogicModules,
      purpose: "Route every Leadsy automation event through one configurable n8n workflow.",
      preserves: "n8n owns mutable automation logic and provider config; Leadsy remains the auth/RBAC boundary, API gateway, and Postgres source of truth.",
      routes: automationWorkflowDefinitions.map((workflow) => ({
        key: workflow.key,
        name: workflow.name,
        purpose: workflow.purpose,
        trigger: workflow.trigger,
        preserves: workflow.preserves
      }))
    }
  };
}

export const n8nWorkflowBlueprints = [n8nAutomationRouterBlueprint()];
