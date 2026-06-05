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
  for (const name of ["Trigger", "Normalize Execution", "Log Started", "Run Leadsy Action", "Log Succeeded", "Log Failed"]) {
    assert(names.has(name), `${workflow.name} should include ${name}`);
  }
}

function assertLeadsyBoundaries(workflow: N8nWorkflowBlueprint) {
  const serialized = JSON.stringify(workflow);
  assert(
    serialized.includes("$env.LEADSY_API_BASE_URL"),
    `${workflow.name} should call Leadsy APIs instead of direct business table access`
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
    workflow.meta.preserves.includes("Leadsy") || workflow.meta.preserves.includes("storage"),
    `${workflow.name} should document the Leadsy-owned boundary it preserves`
  );
}

function assertRetryPolicy(workflow: N8nWorkflowBlueprint) {
  const retryingNodes = workflow.nodes.filter((node) => node.retryOnFail);
  assert(retryingNodes.length >= 3, `${workflow.name} should retry transient HTTP steps`);
  for (const node of retryingNodes) {
    assert.equal(node.maxTries, 3, `${workflow.name} ${node.name} should retry three times`);
    assert.equal(node.waitBetweenTries, 60000, `${workflow.name} ${node.name} should back off before retry`);
  }
}

async function main() {
  const root = process.cwd();
  assert.deepEqual(
    automationWorkflowDefinitions.map((workflow) => workflow.key),
    requiredWorkflowKeys,
    "automation catalog should cover the requested workflow set in order"
  );

  assert.equal(
    n8nWorkflowBlueprints.length,
    automationWorkflowDefinitions.length,
    "n8n blueprints should be generated for every automation workflow"
  );

  for (const workflow of n8nWorkflowBlueprints) {
    assert(workflow.name.startsWith("Leadsy - "), `${workflow.name} should use the Leadsy workflow naming prefix`);
    assert.equal(workflow.active, false, `${workflow.name} should import disabled until manually reviewed`);
    assert.equal(workflow.settings.executionOrder, "v1", `${workflow.name} should use v1 execution order`);
    assert.equal(workflow.settings.saveExecutionProgress, true, `${workflow.name} should save execution progress`);
    assertRequiredNodes(workflow);
    assertRetryPolicy(workflow);
    assertLeadsyBoundaries(workflow);

    const exported = JSON.parse(
      await readFile(
        join(root, "packages", "workflows", "n8n", `${workflow.meta.leadsyWorkflowKey}.json`),
        "utf8"
      )
    );
    assert.deepEqual(exported, workflow, `${workflow.name} exported JSON should match the typed blueprint`);
  }

  const index = JSON.parse(await readFile(join(root, "packages", "workflows", "n8n", "index.json"), "utf8"));
  assert.deepEqual(
    index.map((entry: { key: string }) => entry.key),
    requiredWorkflowKeys,
    "workflow export index should list every requested workflow"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
