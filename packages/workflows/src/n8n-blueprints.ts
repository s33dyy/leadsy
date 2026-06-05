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
    leadsyWorkflowKey: "backend-agent";
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
  "lead-added": "/api/automation/agent",
  "lead-updated": "/api/automation/agent",
  "research-requested": "/api/automation/agent",
  "qualification-requested": "/api/automation/agent",
  "task-generated": "/api/automation/agent",
  "approval-requested": "/api/automation/agent",
  "follow-up-due": "/api/automation/agent",
  "meta-lead-received": "/api/automation/agent",
  "whatsapp-message-received": "/api/automation/agent",
  "worker-retry": "/api/automation/agent"
};

function nodeId(suffix: string) {
  return `leadsy-backend-agent-${suffix}`;
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
    name: "Leadsy Frontend Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    parameters: {
      httpMethod: "POST",
      path: "leadsy/backend-agent",
      responseMode: "onReceived",
      options: {
        responseCode: 202,
        responseData: "firstEntryJson"
      }
    },
    notes: "Leadsy frontend/API entrypoint. Send { workflowKey, tenantId, ownerId, idempotencyKey, payload } to the n8n backend agent.",
    notesInFlow: true
  };
}

function providerWebhookTrigger(): N8nNode {
  return {
    id: nodeId("provider-webhook-trigger"),
    name: "Meta / WhatsApp Event Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 220],
    parameters: {
      httpMethod: "POST",
      path: "leadsy/provider-events",
      responseMode: "onReceived",
      options: {
        responseCode: 202,
        responseData: "firstEntryJson"
      }
    },
    notes: "Optional internal relay for stored Meta/WhatsApp events. Public provider verification and raw intake still stay in Leadsy.",
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
    notes: `${name} feeds the same backend-agent canvas as external Leadsy events.`,
    notesInFlow: true
  };
}

function normalizeWebhook(): N8nNode {
  return {
    id: nodeId("normalize-webhook"),
    name: "Edit Fields / Normalize Event",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [300, 110],
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
    notes: "Edit this node when Leadsy, Meta, WhatsApp, or extension payloads need field mapping before the backend agent runs.",
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
    name: "Leadsy Backend AI Agent",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [1460, 160],
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
    notes: "Central backend-agent node. Mutable automation decisions, action plans, guardrails, approval requirements, and failure policy live here.",
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
    position: [620, 160],
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
    notes: "Validates the workflowKey and pins all durable writes to the single Leadsy backend-agent gateway.",
    notesInFlow: true
  };
}

function contextLoaderNode(): N8nNode {
  return {
    id: nodeId("context-loader"),
    name: "Leadsy Context Loader",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [1180, 160],
    parameters: {
      jsCode: [
        "return [{",
        "  json: {",
        "    ...$json,",
        "    contextSource: 'leadsy-api',",
        "    contextRequest: {",
        "      workflowKey: $json.workflowKey,",
        "      tenantId: $json.tenantId,",
        "      ownerId: $json.ownerId,",
        "      leadId: $json.leadId,",
        "      taskId: $json.taskId,",
        "      conversationId: $json.conversationId,",
        "      source: 'n8n-backend-agent'",
        "    }",
        "  }",
        "}];"
      ].join("\n")
    },
    notes: "Prepares the context request shape. Leadsy remains the source of truth; n8n receives only the event context Leadsy exposes.",
    notesInFlow: true
  };
}

function providerToolNode(
  suffix: string,
  name: string,
  toolKey: string,
  position: [number, number],
  notes: string
): N8nNode {
  return {
    id: nodeId(suffix),
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 60000,
    continueOnFail: true,
    parameters: {
      jsCode: [
        "const commands = Array.isArray($json.providerCommands) ? $json.providerCommands : [];",
        "return [{",
        "  json: {",
        "    ...$json,",
        "    providerCommand: {",
        `      toolKey: ${JSON.stringify(toolKey)},`,
        `      label: ${JSON.stringify(name)},`,
        "      source: 'n8n',",
        "      status: ($json.providerConfigMissing || []).length ? 'blocked_provider_config' : 'ready_for_manual_wiring',",
        "      workflowKey: $json.workflowKey,",
        "      guardrail: 'No durable business state is written outside the Leadsy gateway.'",
        "    },",
        "    providerCommands: [",
        "      ...commands,",
        "      {",
        `        toolKey: ${JSON.stringify(toolKey)},`,
        `        label: ${JSON.stringify(name)},`,
        "        source: 'n8n',",
        "        status: ($json.providerConfigMissing || []).length ? 'blocked_provider_config' : 'ready_for_manual_wiring'",
        "      }",
        "    ]",
        "  }",
        "}];"
      ].join("\n")
    },
    notes,
    notesInFlow: true
  };
}

function leadsyWriterNode(
  suffix: string,
  name: string,
  writerKey: string,
  position: [number, number],
  notes: string
): N8nNode {
  return {
    id: nodeId(suffix),
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: {
      jsCode: [
        "const writeCommands = Array.isArray($json.leadsyWriteCommands) ? $json.leadsyWriteCommands : [];",
        "return [{",
        "  json: {",
        "    ...$json,",
        "    leadsyWriteCommand: {",
        `      writerKey: ${JSON.stringify(writerKey)},`,
        `      label: ${JSON.stringify(name)},`,
        "      source: 'n8n',",
        "      status: 'ready_for_leadsy_gateway',",
        "      workflowKey: $json.workflowKey",
        "    },",
        "    leadsyWriteCommands: [",
        "      ...writeCommands,",
        "      {",
        `        writerKey: ${JSON.stringify(writerKey)},`,
        `        label: ${JSON.stringify(name)},`,
        "        source: 'n8n',",
        "        status: 'ready_for_leadsy_gateway'",
        "      }",
        "    ]",
        "  }",
        "}];"
      ].join("\n")
    },
    notes,
    notesInFlow: true
  };
}

function dispatchAutomationNode(): N8nNode {
  return httpNode(
    "dispatch-automation",
    "Leadsy Result Writer",
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
      providerCommand: "={{$json.providerCommand}}",
      providerCommands: "={{$json.providerCommands}}",
      leadsyWriteCommand: "={{$json.leadsyWriteCommand}}",
      leadsyWriteCommands: "={{$json.leadsyWriteCommands}}",
      payload: "={{$json.payload}}"
    },
    [2220, 160],
    { retryOnFail: true }
  );
}

export function n8nBackendAgentBlueprint(): N8nWorkflowBlueprint {
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
    [620, -130],
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
    [2500, 160],
    { continueOnFail: true, retryOnFail: true }
  );

  const validateEvent = validateEventNode();
  const providerConfig = providerConfigStatusNode();
  const contextLoader = contextLoaderNode();
  const backendLogicModules = backendLogicModulesNode();
  const openRouterTool = providerToolNode(
    "openrouter-chat-model",
    "OpenRouter Chat Model",
    "openrouter",
    [1460, 460],
    "Model-routing tool node. Configure OPENROUTER_* env vars in n8n; Leadsy stores outputs and cost metadata."
  );
  const whatsappTool = providerToolNode(
    "whatsapp-business-cloud",
    "WhatsApp Business Cloud",
    "whatsapp",
    [1700, 460],
    "WhatsApp provider tool node. It may send only after Leadsy approval state is present in the event payload."
  );
  const metaTool = providerToolNode(
    "meta-graph-api",
    "Meta Graph API",
    "meta",
    [1700, 620],
    "Meta provider tool node. OAuth, webhooks, and raw Lead Ads intake stay in Leadsy."
  );
  const emailTool = providerToolNode(
    "email-send",
    "Email Send",
    "email",
    [1700, 780],
    "Email provider tool node for notifications and approved outreach. Configure SMTP, Resend, or Postmark in n8n env vars."
  );
  const taskWriter = leadsyWriterNode(
    "task-approval-writer",
    "Task + Approval Writer",
    "tasks-approvals",
    [1940, 300],
    "Writes task and approval commands back through the Leadsy gateway; no direct Postgres writes from n8n."
  );
  const researchWriter = leadsyWriterNode(
    "research-qualification-writer",
    "Research + Qualification Writer",
    "research-qualification",
    [1940, 460],
    "Writes research and qualification outputs through Leadsy APIs so Postgres remains the source of truth."
  );
  const auditWriter = leadsyWriterNode(
    "audit-event-writer",
    "Audit Event Writer",
    "audit-events",
    [1940, 620],
    "Writes audit-event metadata through the Leadsy gateway."
  );
  const retryHandler = providerToolNode(
    "failure-retry-handler",
    "Failure / Retry Handler",
    "failure-retry",
    [1940, 780],
    "Central retry/escalation lane. Edit retry policy in n8n while Leadsy stores durable execution metadata."
  );
  const dispatchAutomation = dispatchAutomationNode();

  return {
    name: "Leadsy - Backend Agent",
    active: false,
    nodes: [
      webhookTrigger(),
      providerWebhookTrigger(),
      scheduleTrigger("Follow-up Due Schedule", "follow-up-schedule", 15, [0, 440]),
      scheduleTrigger("Worker Retry Schedule", "worker-retry-schedule", 5, [0, 660]),
      normalizeWebhook(),
      normalizeSchedule("Normalize Follow-up Due", "normalize-follow-up-due", followUpWorkflow, [300, 440], 15),
      normalizeSchedule("Normalize Worker Retry", "normalize-worker-retry", workerRetryWorkflow, [300, 660], 5),
      logStarted,
      validateEvent,
      providerConfig,
      contextLoader,
      backendLogicModules,
      openRouterTool,
      whatsappTool,
      metaTool,
      emailTool,
      taskWriter,
      researchWriter,
      auditWriter,
      retryHandler,
      dispatchAutomation,
      logSucceeded
    ],
    connections: {
      "Leadsy Frontend Webhook": { main: [[connection("Edit Fields / Normalize Event")]] },
      "Meta / WhatsApp Event Webhook": { main: [[connection("Edit Fields / Normalize Event")]] },
      "Follow-up Due Schedule": { main: [[connection("Normalize Follow-up Due")]] },
      "Worker Retry Schedule": { main: [[connection("Normalize Worker Retry")]] },
      "Edit Fields / Normalize Event": { main: [[connection("Log Started"), connection("Validate Event")]] },
      "Normalize Follow-up Due": { main: [[connection("Log Started"), connection("Validate Event")]] },
      "Normalize Worker Retry": { main: [[connection("Log Started"), connection("Validate Event")]] },
      "Validate Event": { main: [[connection("Provider Config Check")]] },
      "Provider Config Check": { main: [[connection("Leadsy Context Loader")]] },
      "Leadsy Context Loader": { main: [[connection("Leadsy Backend AI Agent")]] },
      "Leadsy Backend AI Agent": {
        main: [
          [
            connection("OpenRouter Chat Model"),
            connection("WhatsApp Business Cloud"),
            connection("Meta Graph API"),
            connection("Email Send"),
            connection("Task + Approval Writer"),
            connection("Research + Qualification Writer"),
            connection("Audit Event Writer"),
            connection("Failure / Retry Handler"),
            connection("Leadsy Result Writer")
          ]
        ]
      },
      "OpenRouter Chat Model": { main: [[connection("Leadsy Result Writer")]] },
      "WhatsApp Business Cloud": { main: [[connection("Leadsy Result Writer")]] },
      "Meta Graph API": { main: [[connection("Leadsy Result Writer")]] },
      "Email Send": { main: [[connection("Leadsy Result Writer")]] },
      "Task + Approval Writer": { main: [[connection("Leadsy Result Writer")]] },
      "Research + Qualification Writer": { main: [[connection("Leadsy Result Writer")]] },
      "Audit Event Writer": { main: [[connection("Leadsy Result Writer")]] },
      "Failure / Retry Handler": { main: [[connection("Leadsy Result Writer")]] },
      "Leadsy Result Writer": { main: [[connection("Log Succeeded")]] }
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
      leadsyWorkflowKey: "backend-agent",
      providerConfigs: n8nProviderConfigGroups,
      routeProviderRequirements: n8nProviderConfigByWorkflowKey,
      backendLogicModules: n8nBackendLogicModules,
      purpose: "Run every Leadsy operational automation through one configurable n8n backend-agent canvas.",
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

export const n8nAutomationRouterBlueprint = n8nBackendAgentBlueprint;

export const n8nWorkflowBlueprints = [n8nBackendAgentBlueprint()];
