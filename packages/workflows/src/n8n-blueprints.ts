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
    leadsyWorkflowKey: AutomationWorkflowDefinition["key"];
    purpose: string;
    preserves: string;
  };
};

const scheduledWorkflowRules: Partial<Record<AutomationWorkflowDefinition["key"], Record<string, unknown>>> = {
  "follow-up-due": {
    rule: {
      interval: [{ field: "minutes", minutesInterval: 15 }]
    }
  },
  "worker-retry": {
    rule: {
      interval: [{ field: "minutes", minutesInterval: 5 }]
    }
  }
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

function nodeId(workflow: AutomationWorkflowDefinition, suffix: string) {
  return `leadsy-${workflow.key}-${suffix}`;
}

function triggerNode(workflow: AutomationWorkflowDefinition): N8nNode {
  const scheduledRule = scheduledWorkflowRules[workflow.key];
  if (scheduledRule) {
    return {
      id: nodeId(workflow, "schedule-trigger"),
      name: "Trigger",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      parameters: scheduledRule,
      notes: workflow.trigger,
      notesInFlow: true
    };
  }

  return {
    id: nodeId(workflow, "webhook-trigger"),
    name: "Trigger",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    parameters: {
      httpMethod: "POST",
      path: `leadsy/${workflow.key}`,
      responseMode: "responseNode",
      options: {}
    },
    notes: workflow.trigger,
    notesInFlow: true
  };
}

function codeNode(workflow: AutomationWorkflowDefinition): N8nNode {
  return {
    id: nodeId(workflow, "normalize"),
    name: "Normalize Execution",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [260, 0],
    parameters: {
      jsCode: [
        "const body = $json.body ?? $json;",
        "return [{",
        "  json: {",
        `    workflowKey: ${JSON.stringify(workflow.key)},`,
        `    workflowName: ${JSON.stringify(workflow.name)},`,
        "    triggerId: body.triggerId ?? body.idempotencyKey ?? $execution.id,",
        "    idempotencyKey: body.idempotencyKey ?? $execution.id,",
        "    tenantId: body.tenantId,",
        "    ownerId: body.ownerId,",
        "    leadId: body.leadId,",
        "    taskId: body.taskId,",
        "    conversationId: body.conversationId,",
        "    startedAt: new Date().toISOString(),",
        "    payload: body",
        "  }",
        "}];"
      ].join("\n")
    },
    notes: "Normalize webhook/schedule input into the shared Leadsy execution metadata shape.",
    notesInFlow: true
  };
}

function httpNode(
  workflow: AutomationWorkflowDefinition,
  suffix: string,
  name: string,
  pathExpression: string,
  body: Record<string, unknown>,
  position: [number, number],
  retryOnFail = true
): N8nNode {
  return {
    id: nodeId(workflow, suffix),
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position,
    retryOnFail,
    maxTries: 3,
    waitBetweenTries: 60000,
    continueOnFail: suffix === "log-failed",
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

function responseNode(workflow: AutomationWorkflowDefinition): N8nNode {
  return {
    id: nodeId(workflow, "response"),
    name: "Respond",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position: [1300, 0],
    parameters: {
      respondWith: "json",
      responseBody: "={{ { ok: true, workflowKey: $json.workflowKey, executionId: $execution.id } }}",
      options: {}
    }
  };
}

function connection(to: string): N8nConnectionTarget {
  return { node: to, type: "main", index: 0 };
}

export function n8nBlueprintForWorkflow(workflow: AutomationWorkflowDefinition): N8nWorkflowBlueprint {
  const trigger = triggerNode(workflow);
  const normalize = codeNode(workflow);
  const startedPath = "={{$env.LEADSY_API_BASE_URL + '/api/automation/executions'}}";
  const actionPath = `={{$env.LEADSY_API_BASE_URL + '${workflowActionPath[workflow.key]}'}}`;

  const logStarted = httpNode(
    workflow,
    "log-started",
    "Log Started",
    startedPath,
    {
      workflowKey: "={{$json.workflowKey}}",
      n8nExecutionId: "={{$execution.id}}",
      status: "started",
      metadata: "={{$json}}"
    },
    [520, -120]
  );

  const runAction = httpNode(
    workflow,
    "run-action",
    "Run Leadsy Action",
    actionPath,
    {
      workflowKey: "={{$json.workflowKey}}",
      n8nExecutionId: "={{$execution.id}}",
      idempotencyKey: "={{$json.idempotencyKey}}",
      payload: "={{$json.payload}}"
    },
    [780, 0]
  );

  const logSucceeded = httpNode(
    workflow,
    "log-succeeded",
    "Log Succeeded",
    startedPath,
    {
      workflowKey: "={{$json.workflowKey}}",
      n8nExecutionId: "={{$execution.id}}",
      status: "succeeded",
      metadata: "={{$json}}"
    },
    [1040, -120]
  );

  const logFailed = httpNode(
    workflow,
    "log-failed",
    "Log Failed",
    startedPath,
    {
      workflowKey: "={{$json.workflowKey}}",
      n8nExecutionId: "={{$execution.id}}",
      status: "failed",
      metadata: "={{$json}}"
    },
    [1040, 180]
  );

  const respond = responseNode(workflow);

  return {
    name: `Leadsy - ${workflow.name}`,
    active: false,
    nodes: [trigger, normalize, logStarted, runAction, logSucceeded, logFailed, respond],
    connections: {
      Trigger: { main: [[connection("Normalize Execution")]] },
      "Normalize Execution": { main: [[connection("Log Started")]] },
      "Log Started": { main: [[connection("Run Leadsy Action")]] },
      "Run Leadsy Action": { main: [[connection("Log Succeeded")], [connection("Log Failed")]] },
      "Log Succeeded": { main: [[connection("Respond")]] },
      "Log Failed": { main: [[connection("Respond")]] }
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
      leadsyWorkflowKey: workflow.key,
      purpose: workflow.purpose,
      preserves: workflow.preserves
    }
  };
}

export const n8nWorkflowBlueprints = automationWorkflowDefinitions.map(n8nBlueprintForWorkflow);
