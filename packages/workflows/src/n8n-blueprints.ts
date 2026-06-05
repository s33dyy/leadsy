import { automationWorkflowDefinitions, type AutomationWorkflowDefinition } from "./automation-catalog";

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
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
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

function switchNode(): N8nNode {
  return {
    id: nodeId("route-event"),
    name: "Route Event",
    type: "n8n-nodes-base.switch",
    typeVersion: 3.2,
    position: [660, 0],
    parameters: {
      mode: "rules",
      rules: {
        values: automationWorkflowDefinitions.map((workflow) => ({
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: "",
              typeValidation: "strict",
              version: 2
            },
            conditions: [
              {
                leftValue: "={{$json.workflowKey}}",
                rightValue: workflow.key,
                operator: {
                  type: "string",
                  operation: "equals"
                }
              }
            ],
            combinator: "and"
          },
          renameOutput: true,
          outputKey: workflow.name
        }))
      },
      options: {
        fallbackOutput: "extra"
      }
    },
    notes: "One router switch keeps all Leadsy automation routes visible on a single n8n canvas.",
    notesInFlow: true
  };
}

function actionNode(workflow: AutomationWorkflowDefinition, index: number): N8nNode {
  return httpNode(
    `run-${workflow.key}`,
    `Run ${workflow.name}`,
    `={{$env.LEADSY_API_BASE_URL + '${workflowActionPath[workflow.key]}'}}`,
    {
      workflowKey: workflow.key,
      n8nExecutionId: "={{$execution.id}}",
      idempotencyKey: "={{$json.idempotencyKey}}",
      payload: "={{$json.payload}}"
    },
    [980, -420 + index * 140],
    { retryOnFail: true }
  );
}

function unsupportedRouteNode(): N8nNode {
  return {
    id: nodeId("unsupported-route"),
    name: "Unsupported Event",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [980, 1000],
    parameters: {
      jsCode: [
        "throw new Error(`Unsupported Leadsy workflowKey: ${$json.workflowKey ?? 'missing'}`);"
      ].join("\n")
    },
    notes: "Fails fast when Leadsy sends a workflowKey this router does not recognize.",
    notesInFlow: true
  };
}

export function n8nAutomationRouterBlueprint(): N8nWorkflowBlueprint {
  const followUpWorkflow = automationWorkflowDefinitions.find((workflow) => workflow.key === "follow-up-due")!;
  const workerRetryWorkflow = automationWorkflowDefinitions.find((workflow) => workflow.key === "worker-retry")!;
  const startedPath = "={{$env.LEADSY_API_BASE_URL + '/api/automation/executions'}}";
  const actionNodes = automationWorkflowDefinitions.map(actionNode);

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
      workflowKey: "={{$json.workflowKey}}",
      n8nExecutionId: "={{$execution.id}}",
      status: "succeeded",
      metadata: "={{$json}}"
    },
    [1280, 0],
    { continueOnFail: true, retryOnFail: true }
  );

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
      switchNode(),
      ...actionNodes,
      unsupportedRouteNode(),
      logSucceeded
    ],
    connections: {
      "Leadsy Event Webhook": { main: [[connection("Normalize Webhook Event")]] },
      "Follow-up Due Schedule": { main: [[connection("Normalize Follow-up Due")]] },
      "Worker Retry Schedule": { main: [[connection("Normalize Worker Retry")]] },
      "Normalize Webhook Event": { main: [[connection("Log Started"), connection("Route Event")]] },
      "Normalize Follow-up Due": { main: [[connection("Log Started"), connection("Route Event")]] },
      "Normalize Worker Retry": { main: [[connection("Log Started"), connection("Route Event")]] },
      "Route Event": {
        main: [
          ...automationWorkflowDefinitions.map((workflow) => [connection(`Run ${workflow.name}`)]),
          [connection("Unsupported Event")]
        ]
      },
      ...Object.fromEntries(actionNodes.map((node) => [node.name, { main: [[connection("Log Succeeded")]] }]))
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
      purpose: "Route every Leadsy automation event through one configurable n8n workflow.",
      preserves: "Leadsy remains the application backend, auth/RBAC boundary, and Postgres source of truth.",
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
