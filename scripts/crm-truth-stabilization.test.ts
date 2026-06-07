import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-truth-current-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const {
      buildQualificationInputAudit,
      conversationMessages,
      internalNotes,
      listLeadKnowledgeRecords,
      saveTwilioInboundMessage,
      systemEvents
    } = await import("../apps/web/src/lib/lead-knowledge-store");
    const { buildLeadBackedInboxItems } = await import("../apps/web/src/lib/inbox-stabilization");
    const { postTeamThreadMessage, listTeamThreadMessages } = await import("../apps/web/src/lib/teamspace-store");

    const scope = { tenantId: "tenant_truth", ownerId: "owner_truth" };
    const messageText = "Need: WhatsApp CRM automation. Budget: ₹50000. Timeline: 30 days. I am the owner in Mumbai.";
    const firstSave = await saveTwilioInboundMessage({
      ...scope,
      messageSid: "SMTRUTH001",
      from: "whatsapp:+919999000111",
      to: "whatsapp:+14155238886",
      profileName: "Truthful Buyer",
      body: messageText,
      receivedAt: "2026-06-06T08:00:00.000Z"
    });
    assert.equal(firstSave.saved.length, 1, "inbound WhatsApp webhook should persist one CRM message");

    const duplicateSave = await saveTwilioInboundMessage({
      ...scope,
      messageSid: "SMTRUTH001",
      from: "whatsapp:+919999000111",
      to: "whatsapp:+14155238886",
      profileName: "Truthful Buyer",
      body: messageText,
      receivedAt: "2026-06-06T08:00:00.000Z"
    });
    assert.equal(duplicateSave.saved.length, 0, "duplicate webhook deliveries must dedupe by source message id");
    assert.equal(duplicateSave.ignored, 1, "duplicate webhook delivery should be counted as ignored");

    let [lead] = await listLeadKnowledgeRecords(scope);
    assert(lead, "WhatsApp message should link to a lead");
    assert.equal(lead.messages.length, 1, "timeline-visible messages should contain only the customer WhatsApp message");
    assert.equal(lead.messages[0].externalId, "SMTRUTH001", "timeline-visible message should keep the source message id");

    const inboxItems = buildLeadBackedInboxItems([lead]);
    assert.equal(inboxItems.length, 1, "inbound WhatsApp message should appear in Inbox");
    assert.equal(inboxItems[0].href, `/app/communications?conversation=${lead.conversations[0].id}`);
    assert.equal(inboxItems[0].preview, messageText, "Inbox preview should use the real latest customer message");

    const audit = buildQualificationInputAudit(lead);
    for (const field of ["need", "budget", "timeline", "authority", "location", "intent"] as const) {
      const row = audit.fields.find((item) => item.field === field);
      assert(row, `${field} audit row should exist`);
      assert.equal(row?.valid, true, `${field} should be traceable to a visible conversation message`);
      assert.equal(row?.messageId, lead.messages[0].id, `${field} should cite the source message id`);
    }

    await postTeamThreadMessage({
      ...scope,
      leadId: lead.id,
      conversationId: lead.conversations[0].id,
      authorType: "ai_agent",
      body: "Internal handoff summary should stay out of external messages.",
      eventType: "handoff_summary",
      triggerId: "truth-internal-thread"
    });

    [lead] = await listLeadKnowledgeRecords(scope);
    assert.equal(lead.messages.length, 1, "internal team messages must not appear in external timeline messages");
    assert.equal((await listTeamThreadMessages({ ...scope, leadId: lead.id })).length, 1, "internal message should be stored separately");
    assert.equal(conversationMessages(lead.messages as any).length, 1);
    assert.equal(internalNotes(lead.messages as any).length, 0);
    assert.equal(systemEvents(lead.messages as any).length, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
