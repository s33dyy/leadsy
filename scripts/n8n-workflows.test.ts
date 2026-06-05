import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  automationWorkflowDefinitions,
  n8nWorkflowBlueprints,
  type N8nWorkflowBlueprint
} from "@leadsy/workflows";

const requiredWorkflowKeys = [
  "lead-added",
  "lead-updated",
  "research-requested",
  "qualification-requested",
  "task-generated",
  "approval-requested",
  "follow-up-due",
  "meta-lead-received",
  "whatsapp-message-received",
  "worker-retry"
];

function nodeNames(workflow: N8nWorkflowBlueprint) {
  return new Set(workflow.nodes.map((node) => node.name));
}

function assertRequiredNodes(workflow: N8nWorkflowBlueprint) {
  const names = nodeNames(workflow);
  for (const name of [
    "Leadsy Event Webhook",
    "Follow-up Due Schedule",
    "Worker Retry Schedule",
    "Normalize Webhook Event",
    "Normalize Follow-up Due",
    "Normalize Worker Retry",
    "Log Started",
    "Validate Event",
    "Dispatch Automation",
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
    `${workflow.name} should use a shared env-backed header instead of per-node n8n credential setup`
  );
  assert(
    !serialized.includes("genericCredentialType"),
    `${workflow.name} should not import with missing credential warnings on HTTP nodes`
  );
  assert(
    !serialized.includes("OPENROUTER_API_KEY"),
    `${workflow.name} should not hold OpenRouter secrets in workflow JSON`
  );
  assert(
    !serialized.includes("META_APP_SECRET"),
    `${workflow.name} should not hold Meta secrets in workflow JSON`
  );
  assert(
    !serialized.includes("WHATSAPP_BUSINESS_TOKEN"),
    `${workflow.name} should not hold WhatsApp secrets in workflow JSON`
  );
  assert(
    workflow.meta.preserves.includes("Leadsy") || workflow.meta.preserves.includes("Postgres"),
    `${workflow.name} should document the Leadsy-owned boundary it preserves`
  );
}

function assertRetryPolicy(workflow: N8nWorkflowBlueprint) {
  const retryingNodes = workflow.nodes.filter((node) => node.retryOnFail);
  assert.equal(retryingNodes.length, 3, `${workflow.name} should retry the three Leadsy HTTP handoff steps`);
  for (const node of retryingNodes) {
    assert.equal(node.maxTries, 3, `${workflow.name} ${node.name} should retry three times`);
    assert.equal(node.waitBetweenTries, 60000, `${workflow.name} ${node.name} should back off before retry`);
  }
}

function assertSimpleCanvas(workflow: N8nWorkflowBlueprint) {
  assert(
    workflow.nodes.length <= 10,
    `${workflow.name} should stay visually small enough to configure on one n8n screen`
  );
  const dispatchNodes = workflow.nodes.filter((node) => node.name === "Dispatch Automation");
  assert.equal(dispatchNodes.length, 1, `${workflow.name} should have exactly one configurable action node`);
}

async function main() {
  const root = process.cwd();
  assert.deepEqual(
    automationWorkflowDefinitions.map((workflow) => workflow.key),
    requiredWorkflowKeys,
    "automation catalog should cover the requested workflow set in order"
  );

  assert.equal(n8nWorkflowBlueprints.length, 1, "n8n should export one easy-to-configure router workflow");
  const workflow = n8nWorkflowBlueprints[0];
  assert(workflow, "router workflow should exist");
  assert.equal(workflow.name, "Leadsy - Automation Router", "single n8n workflow should use the router naming");
  assert.equal(workflow.active, false, "router should import disabled until manually reviewed");
  assert.equal(workflow.settings.executionOrder, "v1", "router should use v1 execution order");
  assert.equal(workflow.settings.saveExecutionProgress, true, "router should save execution progress");
  assert.deepEqual(
    workflow.meta.routes.map((route) => route.key),
    requiredWorkflowKeys,
    "router metadata should list every supported route"
  );
  assertRequiredNodes(workflow);
  assertSimpleCanvas(workflow);
  assertRetryPolicy(workflow);
  assertLeadsyBoundaries(workflow);

  const exported = JSON.parse(
    await readFile(join(root, "packages", "workflows", "n8n", "leadsy-automation-router.json"), "utf8")
  );
  assert.deepEqual(exported, workflow, "exported router JSON should match the typed blueprint");

  const index = JSON.parse(await readFile(join(root, "packages", "workflows", "n8n", "index.json"), "utf8"));
  assert.deepEqual(
    index.map((entry: { key: string }) => entry.key),
    ["automation-router"],
    "workflow export index should list only the easy-to-configure router"
  );
  assert.deepEqual(
    index[0].routes.map((entry: { key: string }) => entry.key),
    requiredWorkflowKeys,
    "workflow export index should describe every route inside the router"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
