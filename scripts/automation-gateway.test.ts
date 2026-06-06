import assert from "node:assert/strict";
import {
  buildN8nAgentReceipt,
  buildN8nExecutionReceipt,
  validateN8nAutomationRequest
} from "../apps/web/src/lib/n8n-automation-gateway";

async function main() {
  const previousSecret = process.env.LEADSY_N8N_WEBHOOK_SECRET;
  process.env.LEADSY_N8N_WEBHOOK_SECRET = "test-secret";

  const unauthorized = await validateN8nAutomationRequest(
    new Request("https://leadsy.test/api/automation/executions", {
      method: "POST",
      body: JSON.stringify({ workflowKey: "task-created", n8nExecutionId: "exec-1", status: "started" })
    }),
    ["workflowKey", "n8nExecutionId", "status"]
  );
  assert.equal(unauthorized.ok, false, "gateway should reject missing bearer tokens");
  if (unauthorized.ok) throw new Error("unauthorized request should not validate");
  assert.equal(unauthorized.status, 401);

  const missing = await validateN8nAutomationRequest(
    new Request("https://leadsy.test/api/automation/agent", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
      body: JSON.stringify({ workflowKey: "task-created" })
    }),
    ["workflowKey", "n8nExecutionId", "idempotencyKey"]
  );
  assert.equal(missing.ok, false, "gateway should reject incomplete n8n payloads");
  if (missing.ok) throw new Error("missing-fields request should not validate");
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.missingFields, ["n8nExecutionId", "idempotencyKey"]);

  const executionRequest = await validateN8nAutomationRequest(
    new Request("https://leadsy.test/api/automation/executions", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
      body: JSON.stringify({
        workflowKey: "task-created",
        n8nExecutionId: "exec-2",
        status: "started",
        metadata: { source: "n8n" }
      })
    }),
    ["workflowKey", "n8nExecutionId", "status"]
  );
  assert.equal(executionRequest.ok, true, "gateway should accept valid execution log payloads");
  if (!executionRequest.ok) throw new Error("valid execution request did not validate");
  assert.deepEqual(buildN8nExecutionReceipt(executionRequest.body, new Date("2026-06-06T00:00:00.000Z")), {
    ok: true,
    accepted: true,
    workflowKey: "task-created",
    n8nExecutionId: "exec-2",
    status: "started",
    stateBoundary: "leadsy-postgres-via-next-api",
    recordedAt: "2026-06-06T00:00:00.000Z"
  });

  const agentRequest = await validateN8nAutomationRequest(
    new Request("https://leadsy.test/api/automation/agent", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
      body: JSON.stringify({
        workflowKey: "reminder-generated",
        n8nExecutionId: "exec-3",
        idempotencyKey: "idem-3",
        providerConfigMissing: [],
        n8nLogicPlan: {
          actionQueue: [{ action: "generate-reminder" }, { action: "write-audit-event" }]
        }
      })
    }),
    ["workflowKey", "n8nExecutionId", "idempotencyKey"]
  );
  assert.equal(agentRequest.ok, true, "gateway should accept valid backend-agent payloads");
  if (!agentRequest.ok) throw new Error("valid agent request did not validate");
  assert.deepEqual(buildN8nAgentReceipt(agentRequest.body, new Date("2026-06-06T00:00:00.000Z")), {
    ok: true,
    accepted: true,
    workflowKey: "reminder-generated",
    n8nExecutionId: "exec-3",
    idempotencyKey: "idem-3",
    actionCount: 2,
    providerConfigMissing: [],
    stateBoundary: "leadsy-postgres-via-next-api",
    recordedAt: "2026-06-06T00:00:00.000Z"
  });

  if (previousSecret === undefined) {
    delete process.env.LEADSY_N8N_WEBHOOK_SECRET;
  } else {
    process.env.LEADSY_N8N_WEBHOOK_SECRET = previousSecret;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
