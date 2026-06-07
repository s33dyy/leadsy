import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-crm-v1-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const {
      appendManualLeadMessage,
      editLeadKnowledgeRecord,
      listLeadKnowledgeRecords,
      saveTwilioInboundMessage
    } = await import("../apps/web/src/lib/lead-knowledge-store");
    const {
      createCrmFollowUpTask,
      listCrmAssignmentRules,
      listCrmFollowUpTasks,
      summarizeCrmHealth
    } = await import("../apps/web/src/lib/crm-store");

    const scope = { tenantId: "tenant_crm_v1", ownerId: "owner_crm_v1" };
    const saved = await saveTwilioInboundMessage({
      ...scope,
      messageSid: "SMCRMV1001",
      from: "whatsapp:+919014336878",
      to: "whatsapp:+14155238886",
      profileName: "InnoVibe Mobility",
      body: "Hi, I want WhatsApp CRM automation for 100-500 queries per day.",
      receivedAt: "2026-06-05T08:00:00.000Z"
    });
    assert.equal(saved.saved.length, 1);

    let [lead] = await listLeadKnowledgeRecords(scope);
    assert.equal(lead.leadSource, "Twilio WhatsApp", "Twilio inbound should be exposed as CRM lead source");
    assert.equal(lead.assigneeName, "WhatsApp sales owner", "WhatsApp default routing should assign the lead");
    assert.equal(lead.crmStatus, "needs_reply", "first inbound should require a reply");
    assert.equal(lead.qualificationStage, "collecting", "first inbound should start qualification collection");
    assert.equal(lead.qualificationFields.need, "WhatsApp CRM automation");
    assert.equal(lead.qualificationFields.teamOrQueryVolume, "100-500 queries per day");

    lead = await editLeadKnowledgeRecord({
      ...scope,
      leadId: lead.id,
      contact: {
        displayName: "InnoVibe Mobility",
        phone: "+91 90143 36878"
      },
      facts: [
        "Company: InnoVibe Mobility India Pvt Ltd",
        "Need: WhatsApp automation",
        "Queries per day: 100-500",
        "Budget: 50000 INR",
        "Timeline: this week"
      ]
    });
    assert.equal(lead.crmStatus, "interested", "captured company and need should mark lead interested");
    assert.equal(lead.qualificationStage, "qualified", "captured core fields should mark qualification complete");
    assert.equal(lead.qualificationFields.company, "InnoVibe Mobility India Pvt Ltd");
    assert.equal(lead.qualificationFields.budget, "50000 INR");

    const rules = await listCrmAssignmentRules(scope);
    assert.equal(rules.some((rule) => rule.sourceIncludes === "WhatsApp" && rule.assigneeName === "WhatsApp sales owner"), true);
    assert.equal(rules.some((rule) => rule.sourceIncludes === "Google" && rule.assigneeName === "Website sales owner"), true);

    const followUp = await createCrmFollowUpTask({
      ...scope,
      leadId: lead.id,
      topic: "Confirm demo slot",
      description: "Call InnoVibe and confirm the WhatsApp CRM demo time.",
      priority: "high",
      assigneeName: "WhatsApp sales owner",
      dueAt: "2026-06-06T10:00:00.000Z"
    });
    assert.equal(followUp.type, "follow_up");
    const followUps = await listCrmFollowUpTasks(scope, { leadId: lead.id });
    assert.equal(followUps.length, 1, "selected lead follow-up tasks should be stored in CRM tasks");

    const humanReview = await appendManualLeadMessage({
      ...scope,
      leadId: lead.id,
      direction: "inbound",
      channel: "whatsapp",
      body: "I need a human now",
      occurredAt: "2026-06-05T08:05:00.000Z"
    });
    assert.equal(humanReview.crmStatus, "human_review");
    assert.equal(humanReview.qualificationStage, "human_review");
    assert.match(humanReview.nextAction ?? "", /human/i);

    const health = await summarizeCrmHealth(scope);
    assert.equal(health.followUpTasks, 1);
    assert.equal(health.assigneeWorkload["WhatsApp sales owner"], 1);
    assert.equal(health.statusPipeline.human_review, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
