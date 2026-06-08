import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function closeTo(actual: number, expected: number) {
  assert(Math.abs(actual - expected) < 0.000001, `${actual} should be close to ${expected}`);
}

function openRouterCost(input: { generationId: string; costUsd: number; costInr: number; createdAt: string }) {
  return {
    provider: "openrouter" as const,
    stage: "message-drafter" as const,
    model: "openrouter/free",
    generationId: input.generationId,
    finishReason: "stop",
    promptTokens: 120,
    completionTokens: 40,
    totalTokens: 160,
    costUsd: input.costUsd,
    costInr: input.costInr,
    fx: {
      base: "USD" as const,
      quote: "INR" as const,
      rate: 80,
      source: "env" as const,
      fetchedAt: input.createdAt
    },
    createdAt: input.createdAt
  };
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-cost-receipt-"));
  process.env.LEADSY_DATA_DIR = tempDir;
  process.env.USD_INR_RATE = "80";
  process.env.LEADSY_TWILIO_WHATSAPP_MESSAGE_FEE_USD = "0.005";

  try {
    const { appendTwilioOutboundMessage, saveTwilioInboundMessage } = await import("../apps/web/src/lib/lead-knowledge-store");
    const { getCostReceipt } = await import("../apps/web/src/lib/cost-receipt");

    const scope = { tenantId: "tenant_cost_receipt", ownerId: "owner_cost_receipt" };
    await saveTwilioInboundMessage({
      ...scope,
      messageSid: "SMINREAL00000000000000000000000001",
      from: "whatsapp:+919000000001",
      to: "whatsapp:+14155238886",
      body: "Need a WhatsApp CRM today",
      receivedAt: "2026-06-07T08:00:00.000Z"
    });
    await appendTwilioOutboundMessage({
      ...scope,
      messageSid: "SMOUTREAL0000000000000000000000001",
      from: "whatsapp:+14155238886",
      to: "whatsapp:+919000000001",
      body: "Thanks, we can help.",
      sentAt: "2026-06-07T08:01:00.000Z",
      deliveryStatus: "sent"
    });
    await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN0000000000000000000000000001",
      from: "whatsapp:+919000000002",
      to: "whatsapp:+000000000000",
      body: "Simulator lead",
      receivedAt: "2026-06-07T08:02:00.000Z"
    });

    const duplicateCost = openRouterCost({
      generationId: "gen_same_message",
      costUsd: 0.25,
      costInr: 20,
      createdAt: "2026-06-07T08:03:00.000Z"
    });
    const secondCost = openRouterCost({
      generationId: "gen_calendar_reply",
      costUsd: 0.1,
      costInr: 8,
      createdAt: "2026-06-07T08:04:00.000Z"
    });
    await writeFile(
      join(tempDir, "ai-usage.json"),
      JSON.stringify(
        {
          runs: [
            {
              id: "run_duplicate_cost",
              tenantId: scope.tenantId,
              ownerId: scope.ownerId,
              status: "completed",
              sourcesRequested: ["openrouter-web-search"],
              sourcesUsed: ["openrouter-web-search"],
              found: 1,
              qualified: 1,
              needsReview: 0,
              blocked: 0,
              events: [],
              cost: duplicateCost,
              recommendation: "Do not double-count this generation.",
              connectionMessages: [],
              startedAt: "2026-06-07T08:02:30.000Z",
              completedAt: "2026-06-07T08:03:00.000Z"
            }
          ],
          agentRuns: [
            {
              id: "agent_duplicate_cost",
              tenantId: scope.tenantId,
              ownerId: scope.ownerId,
              agent: "message-drafter",
              provider: "openrouter",
              inputSummary: "Draft reply",
              outputSummary: "Reply drafted",
              status: "completed",
              cost: duplicateCost,
              createdAt: "2026-06-07T08:03:00.000Z"
            },
            {
              id: "agent_calendar_cost",
              tenantId: scope.tenantId,
              ownerId: scope.ownerId,
              agent: "message-drafter",
              provider: "openrouter",
              inputSummary: "Find slots",
              outputSummary: "Calendar reply drafted",
              status: "completed",
              cost: secondCost,
              createdAt: "2026-06-07T08:04:00.000Z"
            }
          ]
        },
        null,
        2
      )
    );

    const receipt = await getCostReceipt(scope);
    assert.equal(receipt.summary.twilio.billableMessages, 2);
    assert.equal(receipt.summary.conversations.simulatedMessages, 1);
    closeTo(receipt.summary.twilio.totalUsd, 0.01);
    closeTo(receipt.summary.twilio.totalInr, 0.8);
    closeTo(receipt.summary.openrouter.totalUsd, 0.35);
    closeTo(receipt.summary.openrouter.totalInr, 28);
    closeTo(receipt.summary.totalUsd, 0.36);
    closeTo(receipt.summary.totalInr, 28.8);
    assert.equal(receipt.lineItems.filter((item) => item.category === "openrouter").length, 2);
    assert(receipt.lineItems.some((item) => item.category === "conversation" && item.amountUsd === 0));
    assert(receipt.assumptions.some((item) => item.includes("Simulator")), "receipt should explain simulator messages are not externally delivered");

    const routeSource = await readFile(join(process.cwd(), "apps/web/src/app/api/costs/receipt/route.ts"), "utf8");
    assert.match(routeSource, /getCostReceipt/);
    assert.match(routeSource, /requireApiSession\(request, "analytics:read"\)/);

    const appShellSource = await readFile(join(process.cwd(), "apps/web/src/components/app-shell.tsx"), "utf8");
    assert.match(appShellSource, /CostReceiptButton/);
    assert.match(appShellSource, /data-testid="notification-bell"/);

    const buttonSource = await readFile(join(process.cwd(), "apps/web/src/components/cost-receipt-button.tsx"), "utf8");
    assert.match(buttonSource, /data-testid="cost-receipt-button"/);
    assert.match(buttonSource, /\/api\/costs\/receipt/);
    assert.match(buttonSource, /data-testid="cost-receipt-modal"/);
    assert.match(buttonSource, /Receipt/);

    console.log("cost receipt ledger passed");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
