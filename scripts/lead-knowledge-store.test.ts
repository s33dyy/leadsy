import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-knowledge-current-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const {
      appendManualLeadMessage,
      appendTwilioOutboundMessage,
      buildQualificationInputAudit,
      listLeadKnowledgeRecords,
      saveTwilioInboundMessage,
      summarizeLeadKnowledgeHealth,
      updateTwilioMessageDeliveryStatus
    } = await import("../apps/web/src/lib/lead-knowledge-store");

    const scope = { tenantId: "tenant_current", ownerId: "owner_current" };
    const inbound = await saveTwilioInboundMessage({
      ...scope,
      messageSid: "SMINBOUNDCURRENT",
      from: "whatsapp:+919000000001",
      to: "whatsapp:+14155238886",
      profileName: "Asha Buyer",
      body: "Company: LensMart\nNeed: WhatsApp CRM follow-up\nTimeline: today",
      source: "twilio_simulator",
      receivedAt: "2026-06-07T09:00:00.000Z"
    });

    assert.equal(inbound.saved.length, 1);
    assert.equal(inbound.conversation.channel, "whatsapp");
    assert.equal(inbound.lead.qualificationFields.company, "LensMart");
    assert.equal(inbound.lead.qualificationFields.need, "WhatsApp CRM follow-up");
    assert.equal(inbound.lead.crmStatus, "interested");
    assert.equal(inbound.lead.qualificationStage, "qualified");

    const outbound = await appendTwilioOutboundMessage({
      ...scope,
      leadId: inbound.lead.id,
      messageSid: "SMOUTBOUNDCURRENT",
      to: "whatsapp:+919000000001",
      from: "whatsapp:leadsy-simulator",
      body: "Thanks. What budget range should we plan around?",
      source: "twilio_simulator",
      deliveryStatus: "simulated_delivered",
      sentAt: "2026-06-07T09:01:00.000Z"
    });
    assert.equal(outbound.message.direction, "outbound");
    assert.equal(outbound.message.deliveryStatus, "simulated_delivered");

    const delivery = await updateTwilioMessageDeliveryStatus({
      messageSid: "SMOUTBOUNDCURRENT",
      deliveryStatus: "delivered",
      statusUpdatedAt: "2026-06-07T09:02:00.000Z"
    });
    assert.equal(delivery.updated, false, "simulator messages are not updated by real delivery callbacks");

    const manual = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Nina Manual", phone: "+919000000002" },
      channel: "whatsapp",
      direction: "inbound",
      body: "Need a follow-up workflow for our clinic",
      occurredAt: "2026-06-07T10:00:00.000Z"
    });
    assert.equal(manual.conversations[0].channel, "whatsapp");
    assert.equal(manual.messages.length, 1);

    const naturalContentLead = await saveTwilioInboundMessage({
      ...scope,
      messageSid: "SIMINNATURALCONTENT",
      from: "whatsapp:+919000000003",
      to: "whatsapp:leadsy-simulator",
      profileName: "Rohan",
      body:
        "Hi, I’m Rohan from NovaFit. We need 12 SEO blogs and LinkedIn posts every month. Budget is around ₹80k monthly and I approve content spends. Want to start this month.",
      source: "twilio_simulator",
      receivedAt: "2026-06-07T11:00:00.000Z"
    });
    assert.equal(naturalContentLead.lead.qualificationFields.company, "NovaFit");
    assert.match(naturalContentLead.lead.qualificationFields.need ?? "", /SEO blogs|LinkedIn/i);
    assert.match(naturalContentLead.lead.qualificationFields.budget ?? "", /80k/i);
    assert.match(naturalContentLead.lead.qualificationFields.authority ?? "", /approve|Rohan/i);
    assert.match(naturalContentLead.lead.qualificationFields.timeline ?? "", /this month/i);

    const followUp = await saveTwilioInboundMessage({
      ...scope,
      messageSid: "SIMINNATURALFOLLOWUP",
      from: "whatsapp:+919000000004",
      to: "whatsapp:leadsy-simulator",
      profileName: "Maya",
      body:
        "I handle marketing at BloomNest. Budget can be around ₹1.2L, but final approval is with our founder. Need a content calendar and LinkedIn ghostwriting.",
      source: "twilio_simulator",
      receivedAt: "2026-06-07T11:10:00.000Z"
    });
    assert.equal(followUp.lead.qualificationFields.company, "BloomNest");
    assert.match(followUp.lead.qualificationFields.budget ?? "", /1.2L/i);
    assert.match(followUp.lead.qualificationFields.authority ?? "", /founder/i);

    const records = await listLeadKnowledgeRecords(scope);
    assert.equal(records.length, 4);
    const asha = records.find((record) => record.contact.displayName === "Asha Buyer");
    assert(asha);
    const audit = buildQualificationInputAudit(asha);
    assert.equal(audit.fields.find((field) => field.field === "company")?.state, "Collected");
    assert.equal(audit.fields.find((field) => field.field === "need")?.state, "Collected");

    const health = await summarizeLeadKnowledgeHealth();
    assert.equal(health.records, 4);
    assert.equal(health.whatsappSourced, 4);
    assert.equal(health.messages, 5);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
