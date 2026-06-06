import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const receivedAt = "2026-06-06T08:00:00.000Z";
const scope = { tenantId: "tenant_phase45", ownerId: "owner_phase45" };

function whatsappPayload(id: string, body: string, timestamp = "1780391200") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_phase45",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15551234567",
                phone_number_id: "phone_phase45"
              },
              contacts: [
                {
                  profile: { name: "Truthful Buyer" },
                  wa_id: "919999000111"
                }
              ],
              messages: [
                {
                  from: "919999000111",
                  id,
                  timestamp,
                  type: "text",
                  text: { body }
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-phase45-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const {
      appendManualLeadMessage,
      buildQualificationInputAudit,
      conversationMessages,
      internalNotes,
      listLeadKnowledgeRecords,
      saveUnifiedMetaWebhookMessages,
      syncLeadKnowledgeFromExtensionTasks,
      systemEvents
    } = await import("../apps/web/src/lib/lead-knowledge-store");
    const { buildLeadBackedInboxItems } = await import("../apps/web/src/lib/inbox-stabilization");

    const messageText = "Need: WhatsApp CRM automation. Budget: ₹50000. Timeline: 30 days. I am the owner in Mumbai.";
    const firstSave = await saveUnifiedMetaWebhookMessages({
      ...scope,
      payload: whatsappPayload("wamid.phase45.1", messageText),
      receivedAt
    });
    assert.equal(firstSave.saved.length, 1, "inbound WhatsApp webhook should persist one CRM message");

    const duplicateSave = await saveUnifiedMetaWebhookMessages({
      ...scope,
      payload: whatsappPayload("wamid.phase45.1", messageText),
      receivedAt
    });
    assert.equal(duplicateSave.saved.length, 0, "duplicate webhook deliveries must dedupe by source message id");
    assert.equal(duplicateSave.ignored, 1, "duplicate webhook delivery should be counted as ignored");

    let [lead] = await listLeadKnowledgeRecords(scope);
    assert(lead, "WhatsApp message should link to a lead");
    assert.equal(lead.messages.length, 1, "timeline-visible messages should contain only the customer WhatsApp message");
    assert.equal(lead.messages[0].externalId, "wamid.phase45.1", "timeline-visible message should keep the source message id");
    assert.equal(lead.messages[0].conversationId, lead.conversations[0].id, "message should link to its stored conversation");

    const inboxItems = buildLeadBackedInboxItems([lead]);
    assert.equal(inboxItems.length, 1, "inbound WhatsApp message should appear in Inbox");
    assert.equal(inboxItems[0].preview, messageText, "Inbox preview should use the real latest customer message");
    assert.equal(inboxItems[0].messages.length, 1, "Inbox thread should contain one deduped visible message");
    assert.equal(inboxItems[0].messages[0].id, lead.messages[0].id, "Inbox item should trace back to stored message id");

    const audit = buildQualificationInputAudit(lead);
    for (const field of ["need", "budget", "timeline", "authority", "location", "intent"] as const) {
      const row = audit.fields.find((item) => item.field === field);
      assert(row, `${field} audit row should exist`);
      assert.equal(row?.valid, true, `${field} should be traceable to a visible conversation message`);
      assert.equal(row?.messageId, lead.messages[0].id, `${field} should cite the source message id`);
      assert.equal(row?.sourceMessage, messageText, `${field} should cite source message text`);
    }

    await syncLeadKnowledgeFromExtensionTasks(scope, [
      {
        id: "task_phase45_worker_event",
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        type: "follow_up",
        status: "failed",
        priority: "high",
        platform: "whatsapp-web",
        targetUrl: "https://web.whatsapp.com/send?phone=919999000111",
        contact: { displayName: "Truthful Buyer", phone: "+91 99990 00111" },
        contextSummary: "Worker tried to route a follow-up.",
        draftMessage: "System-only draft must not qualify lead.",
        createdAt: "2026-06-06T08:01:00.000Z",
        updatedAt: "2026-06-06T08:01:00.000Z"
      }
    ]);

    [lead] = await listLeadKnowledgeRecords(scope);
    assert.equal(lead.messages.some((message) => message.messageType === "worker-task" || message.direction === "system"), false, "worker task events must not appear in Conversation Timeline");
    assert.equal(buildLeadBackedInboxItems([lead])[0].preview, messageText, "worker task event must not replace Inbox preview");
    assert.equal(buildQualificationInputAudit(lead).fields.find((item) => item.field === "need")?.messageId, lead.messages[0].id, "worker task event must not affect qualification source trace");

    const rawMessages = [
      ...conversationMessages(lead.messages as any),
      ...internalNotes(lead.messages as any),
      ...systemEvents(lead.messages as any)
    ];
    assert.equal(rawMessages.some((message) => message.direction === "system"), false, "public lead record should not expose system messages as visible conversation records");

    const withInvalidManualFact = await appendManualLeadMessage({
      ...scope,
      leadId: lead.id,
      direction: "note",
      body: "Budget: ₹999999",
      occurredAt: "2026-06-06T08:02:00.000Z"
    });
    const invalidBudget = buildQualificationInputAudit(withInvalidManualFact).fields.find((item) => item.field === "budget");
    assert.equal(invalidBudget?.valid, true, "existing traced customer budget should remain valid and not be overwritten by internal note");
    assert.equal(invalidBudget?.messageId, lead.messages[0].id, "internal note must not become qualification source message");

    const appShell = await readFile(join(process.cwd(), "apps/web/src/components/app-shell.tsx"), "utf8");
    assert(appShell.includes('href: "/app/team"'), "Team route should resolve to /app/team instead of Settings");
    assert(!appShell.includes('href: "/app/settings?panel=team"'), "Team nav must not point to Settings");

    const teamPage = await readFile(join(process.cwd(), "apps/web/src/app/app/team/page.tsx"), "utf8");
    for (const forbidden of ["Invite", "invitation", "Edit role", "role editing", "Remove user"]) {
      assert(!teamPage.includes(forbidden), `Team page must stay read-only and not expose ${forbidden}`);
    }

    const workerPage = await readFile(join(process.cwd(), "apps/web/src/app/app/worker/page.tsx"), "utf8");
    for (const forbidden of ["success:", "Success", "Running", "Queue", "throughput", "96", "91", "88", "94"]) {
      assert(!workerPage.includes(forbidden), `Automations page must not contain fake operational metric: ${forbidden}`);
    }
    assert(workerPage.includes("No Data Available") || workerPage.includes("Not Configured"), "Automations page should show real data or explicit empty states");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
