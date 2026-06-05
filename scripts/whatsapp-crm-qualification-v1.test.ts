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
      saveUnifiedMetaWebhookMessages,
      syncLeadsyExtensionConversation
    } = await import("../apps/web/src/lib/lead-knowledge-store");
    const {
      createCrmFollowUpTask,
      listCrmAssignmentRules,
      listCrmFollowUpTasks,
      summarizeCrmHealth
    } = await import("../apps/web/src/lib/crm-store");

    const scope = { tenantId: "tenant_crm_v1", ownerId: "owner_crm_v1" };
    const whatsappPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_123",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "15551234567",
                  phone_number_id: "phone_123"
                },
                contacts: [
                  {
                    profile: { name: "InnoVibe Mobility" },
                    wa_id: "919014336878"
                  }
                ],
                messages: [
                  {
                    from: "919014336878",
                    id: "wamid.crm.1",
                    timestamp: "1780391200",
                    type: "text",
                    text: { body: "Hi, I want WhatsApp CRM automation for 100-500 queries per day." },
                    referral: {
                      source_type: "ad",
                      source_id: "meta_campaign_123",
                      source_url: "https://fb.me/leadsy-ctwa",
                      headline: "WhatsApp CRM automation",
                      body: "Click to WhatsApp",
                      ctwa_clid: "clid_123"
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const saved = await saveUnifiedMetaWebhookMessages({
      ...scope,
      payload: whatsappPayload,
      receivedAt: "2026-06-05T08:00:00.000Z"
    });
    assert.equal(saved.saved.length, 1);

    let [lead] = await listLeadKnowledgeRecords(scope);
    assert.equal(lead.leadSource, "Meta CTWA Ads", "Meta click-to-WhatsApp referral should be exposed as CRM lead source");
    assert.equal(lead.campaignId, "meta_campaign_123", "Meta referral campaign id should be stored");
    assert.equal(lead.assigneeName, "Meta sales owner", "Meta CTWA default routing should assign the lead");
    assert.equal(lead.crmStatus, "needs_reply", "first inbound should require a reply");
    assert.equal(lead.qualificationStage, "collecting", "first inbound should start qualification collection");
    assert.equal(lead.qualificationFields.need, "WhatsApp CRM automation");
    assert.equal(lead.qualificationFields.teamOrQueryVolume, "100-500 queries per day");
    assert.match(lead.nextAction ?? "", /ask.*name/i, "next action should ask the next missing qualification question");

    lead = await editLeadKnowledgeRecord({
      ...scope,
      leadId: lead.id,
      contact: {
        displayName: "InnoVibe Mobility",
        phone: "+91 90143 36878"
      },
      leadSource: lead.leadSource,
      campaignId: lead.campaignId,
      facts: [
        "Company: InnoVibe Mobility India Pvt Ltd",
        "Need: WhatsApp automation",
        "Queries per day: 100-500",
        "Budget: 50000 INR",
        "Timeline: this week"
      ]
    });
    assert.equal(lead.crmStatus, "interested", "three-plus captured qualification fields should mark lead interested");
    assert.equal(lead.qualificationStage, "qualified", "captured core fields should mark qualification complete");
    assert.equal(lead.qualificationFields.company, "InnoVibe Mobility India Pvt Ltd");
    assert.equal(lead.qualificationFields.budget, "50000 INR");

    const rules = await listCrmAssignmentRules(scope);
    assert.equal(rules.some((rule) => rule.sourceIncludes === "Meta CTWA" && rule.assigneeName === "Meta sales owner"), true);
    assert.equal(rules.some((rule) => rule.sourceIncludes === "Google" && rule.assigneeName === "Website sales owner"), true);

    const followUp = await createCrmFollowUpTask({
      ...scope,
      leadId: lead.id,
      topic: "Confirm demo slot",
      description: "Call InnoVibe and confirm the WhatsApp CRM demo time.",
      priority: "high",
      assigneeName: "Meta sales owner",
      dueAt: "2026-06-06T10:00:00.000Z"
    });
    assert.equal(followUp.type, "follow_up");
    const followUps = await listCrmFollowUpTasks(scope, { leadId: lead.id });
    assert.equal(followUps.length, 1, "selected lead follow-up tasks should be stored separately from browser-send tasks");

    const humanReview = await appendManualLeadMessage({
      ...scope,
      leadId: lead.id,
      direction: "inbound",
      channel: "whatsapp",
      body: "What the fuck, I need a human now",
      occurredAt: "2026-06-05T08:05:00.000Z"
    });
    assert.equal(humanReview.crmStatus, "human_review");
    assert.equal(humanReview.qualificationStage, "human_review");
    assert.match(humanReview.nextAction ?? "", /human/i);

    const echoSync = await syncLeadsyExtensionConversation({
      ...scope,
      platform: "whatsapp-web",
      sourceUrl: "https://web.whatsapp.com/send?phone=919014336878",
      chatFingerprint: "https://web.whatsapp.com/chat/919014336878",
      contact: {
        displayName: "InnoVibe Mobility",
        phone: "+91 90143 36878"
      },
      messages: [
        {
          externalId: "leadsy-out-1",
          direction: "outbound",
          body: "Could you share your business name?",
          sentAt: "2026-06-05T08:06:00.000Z",
          generatedBy: "leadsy"
        },
        {
          externalId: "rerendered-inbound-echo",
          direction: "inbound",
          body: "Could you share your business name?",
          sentAt: "2026-06-05T08:06:30.000Z"
        }
      ]
    });
    const echoCopies = echoSync.messages.filter((message) => message.body === "Could you share your business name?");
    assert.equal(echoCopies.length, 1, "Leadsy outbound text re-rendered as inbound should not create a fake inbound turn");

    const health = await summarizeCrmHealth(scope);
    assert.equal(health.followUpTasks, 1);
    assert.equal(health.assigneeWorkload["Meta sales owner"], 1);
    assert.equal(health.statusPipeline.human_review, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
