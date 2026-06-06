import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  automationWorkflowDefinitions,
  n8nWorkflowBlueprints,
  type N8nWorkflowBlueprint
} from "@leadsy/workflows";

const requiredWorkflowKeys = [
  "follow-up-scheduled",
  "reminder-generated",
  "task-created",
  "escalation-triggered"
];

const forbiddenN8nTerms = [
  "research-requested",
  "qualification-requested",
  "lead-added",
  "meta-lead-received",
  "whatsapp-message-received",
  "OpenRouter Chat Model",
  "WhatsApp Business Cloud",
  "Meta Graph API",
  "Research + Qualification Writer",
  "run-qualification",
  "run-research"
];

function nodeNames(workflow: N8nWorkflowBlueprint) {
  return new Set(workflow.nodes.map((node) => node.name));
}

function assertRequiredNodes(workflow: N8nWorkflowBlueprint) {
  const names = nodeNames(workflow);
  for (const name of [
    "Leadsy Frontend Webhook",
    "Follow-Up Schedule",
    "Reminder Schedule",
    "Escalation Schedule",
    "Edit Fields / Normalize Event",
    "Normalize Follow-Up Schedule",
    "Normalize Reminder Schedule",
    "Normalize Escalation Schedule",
    "Log Started",
    "Validate Event",
    "Provider Config Check",
    "Leadsy Context Loader",
    "Leadsy Automation Rule Agent",
    "Operator Email Notification",
    "Task + Reminder Writer",
    "Escalation Writer",
    "Audit Event Writer",
    "Leadsy Result Writer",
    "Log Succeeded"
  ]) {
    assert(names.has(name), `${workflow.name} should include ${name}`);
  }
  assert.equal(
    workflow.nodes.some((node) => node.name.startsWith("Run ")),
    false,
    `${workflow.name} should not fan out into one visible node per event type`
  );
  assert.equal(
    workflow.nodes.some((node) => node.type === "n8n-nodes-base.switch"),
    false,
    `${workflow.name} should route with event data instead of a visual switch branch explosion`
  );
}

function assertLeadsyBoundaries(workflow: N8nWorkflowBlueprint) {
  const serialized = JSON.stringify(workflow);
  assert(
    serialized.includes("$env.LEADSY_API_BASE_URL"),
    `${workflow.name} should call Leadsy APIs instead of direct business table access`
  );
  assert(
    serialized.includes("$env.LEADSY_N8N_WEBHOOK_SECRET"),
    `${workflow.name} should use a shared env-backed header instead of per-node n8n credentials`
  );
  assert(
    !serialized.includes("genericCredentialType"),
    `${workflow.name} should not import with missing credential warnings on HTTP nodes`
  );
  assert(
    serialized.includes("X-Leadsy-Config-Source"),
    `${workflow.name} should identify n8n as the automation config source`
  );
  assert(
    serialized.includes("providerConfigMissing"),
    `${workflow.name} should report missing optional n8n provider config to Leadsy`
  );
  assert(
    serialized.includes("field.secret ? undefined"),
    `${workflow.name} should redact secret provider values before dispatching to Leadsy`
  );
  assert(
    workflow.meta.preserves.includes("CRM") && workflow.meta.preserves.includes("conversations") && workflow.meta.preserves.includes("assignments") && workflow.meta.preserves.includes("leads"),
    `${workflow.name} should document that Leadsy keeps CRM, conversations, assignments, and leads`
  );
  for (const forbidden of forbiddenN8nTerms) {
    assert(!serialized.includes(forbidden), `n8n workflow must not own or route ${forbidden}`);
  }
}

function assertProviderConfigHub(workflow: N8nWorkflowBlueprint) {
  assert.deepEqual(
    workflow.meta.providerConfigs.map((provider) => provider.key),
    ["email"],
    `${workflow.name} should keep only optional operator notification config in n8n`
  );
  for (const provider of workflow.meta.providerConfigs) {
    assert.equal(provider.owner, "n8n", `${provider.label} config should be owned by n8n`);
    assert(provider.leadsyBoundary.includes("Leadsy keeps auth"), `${provider.label} should document the Leadsy boundary`);
    assert(provider.fields.length > 0, `${provider.label} should list optional n8n configuration fields`);
  }
  assert.deepEqual(
    Object.fromEntries(Object.entries(workflow.meta.routeProviderRequirements).map(([key, value]) => [key, value])),
    {
      "follow-up-scheduled": [],
      "reminder-generated": [],
      "task-created": [],
      "escalation-triggered": []
    },
    "n8n routes should not require Meta, WhatsApp, OpenRouter, or CRM provider config"
  );
}

function assertBackendLogicModules(workflow: N8nWorkflowBlueprint) {
  assert.deepEqual(
    workflow.meta.backendLogicModules.map((module) => module.key),
    requiredWorkflowKeys,
    `${workflow.name} should carry n8n-owned modules only for the allowed operational automations`
  );
  for (const module of workflow.meta.backendLogicModules) {
    assert.equal(module.owner, "n8n", `${module.label} should be owned by n8n`);
    assert(module.editableFrom.includes("n8n_canvas"), `${module.label} should be manually editable in n8n`);
    assert(module.editableFrom.includes("github_json"), `${module.label} should be source-editable through GitHub`);
    assert(module.editableFrom.includes("codex"), `${module.label} should be Codex-editable`);
    assert(module.actionPlan.length > 0, `${module.label} should define planned backend actions`);
    assert(module.leadsyOwns.length > 0, `${module.label} should preserve a Leadsy boundary`);
    assert(module.n8nOwns.length > 0, `${module.label} should define mutable logic owned by n8n`);
    assert(module.guardrails.some((guardrail) => /Do not|only/i.test(guardrail)), `${module.label} should include explicit boundary guardrails`);
  }
  const serialized = JSON.stringify(workflow);
  assert(
    serialized.includes("n8nLogicPlan"),
    `${workflow.name} should dispatch the n8n-generated operational plan to Leadsy`
  );
  assert(
    serialized.includes("create-task") && serialized.includes("generate-reminder") && serialized.includes("create-escalation"),
    `${workflow.name} should encode task, reminder, and escalation actions`
  );
}

function assertRetryPolicy(workflow: N8nWorkflowBlueprint) {
  const retryingNodes = workflow.nodes.filter((node) => node.retryOnFail);
  assert(
    retryingNodes.length >= 3,
    `${workflow.name} should retry Leadsy gateway handoffs and optional notification handoffs`
  );
  for (const node of retryingNodes) {
    assert.equal(node.maxTries, 3, `${workflow.name} ${node.name} should retry three times`);
    assert.equal(node.waitBetweenTries, 60000, `${workflow.name} ${node.name} should back off before retry`);
  }
}

function assertBackendAgentCanvas(workflow: N8nWorkflowBlueprint) {
  assert(
    workflow.nodes.length <= 20,
    `${workflow.name} should stay readable on one n8n backend-agent canvas`
  );
  const agentNodes = workflow.nodes.filter((node) => node.name === "Leadsy Automation Rule Agent");
  assert.equal(agentNodes.length, 1, `${workflow.name} should have exactly one central automation-rule node`);
  const writerNodes = workflow.nodes.filter((node) => node.name === "Leadsy Result Writer");
  assert.equal(writerNodes.length, 1, `${workflow.name} should have one Leadsy state-boundary writer`);
  const agentConnections = workflow.connections["Leadsy Automation Rule Agent"]?.main?.flat().map((target) => target.node) ?? [];
  for (const target of [
    "Operator Email Notification",
    "Task + Reminder Writer",
    "Escalation Writer",
    "Audit Event Writer",
    "Leadsy Result Writer"
  ]) {
    assert(agentConnections.includes(target), `${workflow.name} should visibly connect the automation rule agent to ${target}`);
  }
}

async function main() {
  const root = process.cwd();
  assert.deepEqual(
    automationWorkflowDefinitions.map((workflow) => workflow.key),
    requiredWorkflowKeys,
    "automation catalog should cover only the allowed n8n workflow set in order"
  );

  assert.equal(n8nWorkflowBlueprints.length, 1, "n8n should export one easy-to-configure backend-agent workflow");
  const workflow = n8nWorkflowBlueprints[0];
  assert(workflow, "backend-agent workflow should exist");
  assert.equal(workflow.name, "Leadsy - Backend Agent", "single n8n workflow should use backend-agent naming");
  assert.equal(workflow.active, false, "backend agent should import disabled until manually reviewed");
  assert.equal(workflow.settings.executionOrder, "v1", "backend agent should use v1 execution order");
  assert.equal(workflow.settings.saveExecutionProgress, true, "backend agent should save execution progress");
  assert.deepEqual(
    workflow.meta.routes.map((route) => route.key),
    requiredWorkflowKeys,
    "backend-agent metadata should list every supported operational route"
  );
  assertRequiredNodes(workflow);
  assertBackendAgentCanvas(workflow);
  assertRetryPolicy(workflow);
  assertLeadsyBoundaries(workflow);
  assertProviderConfigHub(workflow);
  assertBackendLogicModules(workflow);

  const exported = JSON.parse(
    await readFile(join(root, "packages", "workflows", "n8n", "leadsy-backend-agent.json"), "utf8")
  );
  assert.deepEqual(exported, workflow, "exported backend-agent JSON should match the typed blueprint");

  const index = JSON.parse(await readFile(join(root, "packages", "workflows", "n8n", "index.json"), "utf8"));
  assert.deepEqual(
    index.map((entry: { key: string }) => entry.key),
    ["backend-agent"],
    "workflow export index should list only the easy-to-configure backend agent"
  );
  assert.deepEqual(
    index[0].routes.map((entry: { key: string }) => entry.key),
    requiredWorkflowKeys,
    "workflow export index should describe every route inside the backend agent"
  );
  assert.deepEqual(
    index[0].providerConfigs.map((entry: { key: string }) => entry.key),
    ["email"],
    "workflow export index should advertise only optional operator notification config"
  );
  assert.deepEqual(
    index[0].backendLogicModules.map((entry: { key: string }) => entry.key),
    requiredWorkflowKeys,
    "workflow export index should advertise every allowed n8n backend logic module"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
