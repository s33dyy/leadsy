import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-knowledge-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const {
      appendManualLeadMessage,
      buildLeadKnowledgeContext,
      listLeadKnowledgeRecords,
      saveUnifiedMetaWebhookMessages,
      setLeadConversationKnowledgeStatus,
      setLeadKnowledgeStatus,
      summarizeLeadKnowledgeHealth,
      syncLeadKnowledgeFromExtensionTasks,
      syncLeadsyExtensionConversation
    } = await import("../apps/web/src/lib/lead-knowledge-store");

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
                    profile: { name: "Asha Buyer" },
                    wa_id: "919830000000"
                  }
                ],
                messages: [
                  {
                    from: "919830000000",
                    id: "wamid.1",
                    timestamp: "1780391200",
                    type: "text",
                    text: { body: "Interested in MCA admission" },
                    referral: {
                      source_type: "ad",
                      source_id: "ad_123",
                      source_url: "https://fb.me/leadsy-ad",
                      headline: "MCA admissions open",
                      body: "Tap to connect on WhatsApp",
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

    const instagramPayload = {
      object: "instagram",
      entry: [
        {
          id: "ig_business_123",
          messaging: [
            {
              sender: { id: "ig_user_1" },
              recipient: { id: "ig_business_123" },
              timestamp: 1780391260000,
              message: {
                mid: "igmid.1",
                text: "Can you DM the course fees?"
              }
            }
          ]
        }
      ]
    };

    const facebookPayload = {
      object: "page",
      entry: [
        {
          id: "fb_page_123",
          messaging: [
            {
              sender: { id: "fb_user_1" },
              recipient: { id: "fb_page_123" },
              timestamp: 1780391320000,
              message: {
                mid: "fbmid.1",
                text: "Need a callback today"
              }
            }
          ]
        }
      ]
    };

    const scope = { tenantId: "tenant_test", ownerId: "owner_test" };
    const savedWhatsApp = await saveUnifiedMetaWebhookMessages({ ...scope, payload: whatsappPayload, receivedAt: "2026-06-02T08:00:00.000Z" });
    const duplicateWhatsApp = await saveUnifiedMetaWebhookMessages({ ...scope, payload: whatsappPayload, receivedAt: "2026-06-02T08:00:01.000Z" });
    const savedInstagram = await saveUnifiedMetaWebhookMessages({ ...scope, payload: instagramPayload, receivedAt: "2026-06-02T08:01:00.000Z" });
    const savedFacebook = await saveUnifiedMetaWebhookMessages({ ...scope, payload: facebookPayload, receivedAt: "2026-06-02T08:02:00.000Z" });

    assert.equal(savedWhatsApp.saved.length, 1);
    assert.equal(duplicateWhatsApp.saved.length, 0, "Meta message ids should be deduped");
    assert.equal(savedInstagram.saved.length, 1);
    assert.equal(savedFacebook.saved.length, 1);

    const browserDuplicate = await syncLeadsyExtensionConversation({
      ...scope,
      platform: "whatsapp-web",
      sourceUrl: "https://web.whatsapp.com/send?phone=919830000000",
      chatFingerprint: "https://web.whatsapp.com/chat/919830000000",
      captureSource: "browser-extension",
      captureConfidence: 0.92,
      tabUrl: "https://web.whatsapp.com/",
      observedAt: "2026-06-02T08:00:02.000Z",
      profileId: "local:whatsapp",
      contact: {
        displayName: "Asha Buyer",
        phone: "+91 98300 00000"
      },
      messages: [
        {
          externalId: "browser-local-duplicate-1",
          direction: "inbound",
          body: "Interested in MCA admission",
          sentAt: "2026-06-02T09:06:40.000Z"
        }
      ],
      events: [
        {
          type: "monitor_synced",
          summary: "Browser monitor saw the same WhatsApp message already received from Meta.",
          occurredAt: "2026-06-02T08:00:02.000Z"
        }
      ]
    });
    assert.equal(browserDuplicate.lead.messageCount, 1, "browser capture should not duplicate an official webhook message");

    const extensionSync = await syncLeadsyExtensionConversation({
      ...scope,
      platform: "whatsapp-web",
      sourceUrl: "https://web.whatsapp.com/send?phone=919830000000",
      chatFingerprint: "https://web.whatsapp.com/chat/919830000000",
      contact: {
        displayName: "Asha Buyer",
        phone: "+91 98300 00000"
      },
      messages: [
        {
          externalId: "ext-in-1",
          direction: "inbound",
          body: "Following up from WhatsApp web",
          sentAt: "2026-06-02T08:04:00.000Z"
        }
      ],
      events: [
        {
          type: "inbound-synced",
          summary: "Visible chat messages synced to Leadsy.",
          occurredAt: "2026-06-02T08:04:01.000Z"
        }
      ],
      insight: {
        summary: "Asha asked for course information.",
        nextAction: "Send course fees and ask timeline.",
        sentiment: "positive"
      }
    });

    assert.equal(extensionSync.lead.contact.displayName, "Asha Buyer");
    assert.equal(extensionSync.lead.messageCount, 2, "extension WhatsApp sync should merge with the webhook lead by phone");

    const shiftedFingerprintSync = await syncLeadsyExtensionConversation({
      ...scope,
      platform: "whatsapp-web",
      sourceUrl: "https://web.whatsapp.com/",
      chatFingerprint: "https://web.whatsapp.com/",
      contact: {
        displayName: "Asha Buyer",
        phone: "+91 98300 00000"
      },
      messages: [
        {
          externalId: "ext-in-shifted-fingerprint",
          direction: "inbound",
          body: "Same buyer after WhatsApp changed the page URL",
          sentAt: "2026-06-02T08:04:30.000Z"
        }
      ],
      events: [
        {
          type: "monitor_synced",
          summary: "Visible chat messages synced after the route changed.",
          occurredAt: "2026-06-02T08:04:31.000Z"
        }
      ]
    });
    const shiftedExtensionConversations = shiftedFingerprintSync.lead.conversations.filter(
      (conversation) => conversation.source === "extension" && conversation.channel === "whatsapp-web"
    );
    assert.equal(
      shiftedExtensionConversations.length,
      1,
      "same extension contact target should keep one conversation even when the chat fingerprint changes"
    );

    await appendManualLeadMessage({
      ...scope,
      leadId: extensionSync.lead.id,
      direction: "outbound",
      body: "Called and shared the MCA fee range.",
      occurredAt: "2026-06-02T08:05:00.000Z"
    });
    await appendManualLeadMessage({
      ...scope,
      leadId: extensionSync.lead.id,
      direction: "outbound",
      channel: "email",
      body: "Sent the brochure by email.",
      occurredAt: "2026-06-02T08:06:00.000Z"
    });
    await appendManualLeadMessage({
      ...scope,
      leadId: extensionSync.lead.id,
      direction: "note",
      channel: "call",
      body: "Call note: parent wants a weekend counselling slot.",
      occurredAt: "2026-06-02T08:07:00.000Z"
    });
    const manualOnlyLead = await appendManualLeadMessage({
      ...scope,
      direction: "note",
      channel: "manual",
      contact: {
        displayName: "Manual Prospect",
        phone: "+91 90000 00000",
        email: "manual@example.com",
        handle: "@manual-prospect"
      },
      body: [
        "Manual lead created from CRM intake.",
        "Company: Manual Labs",
        "Priority: High",
        "Estimated budget: 250000",
        "Related lead: Asha Buyer",
        "Additional email: buyer-team@example.com"
      ].join("\n"),
      occurredAt: "2026-06-02T08:08:00.000Z"
    });
    assert.equal(manualOnlyLead.contact.displayName, "Manual Prospect");
    assert.equal(manualOnlyLead.contact.email, "manual@example.com");
    assert.equal(manualOnlyLead.channels.includes("manual"), true);
    assert.equal(manualOnlyLead.messages.some((message) => message.body.includes("Manual lead created from CRM intake")), true);

    const leads = await listLeadKnowledgeRecords(scope);
    assert.equal(leads.length, 4, "WhatsApp, Instagram, Facebook, and manual contacts should be tracked as lead records");
    const asha = leads.find((lead) => lead.contact.displayName === "Asha Buyer");
    assert(asha, "Asha lead should exist");
    assert.equal(asha.messageCount, 6);
    assert.equal(asha.channels.includes("whatsapp"), true);
    assert.equal(asha.channels.includes("whatsapp-web"), true);
    assert.equal(asha.channels.includes("email"), true);
    assert.equal(asha.channels.includes("call"), true);

    const ashaConversation = asha.conversations.find((conversation) => conversation.channel === "whatsapp-web");
    assert(ashaConversation, "extension conversation should be attached to Asha");
    await setLeadConversationKnowledgeStatus({
      ...scope,
      conversationId: ashaConversation.id,
      knowledgeStatus: "excluded"
    });

    const contextAfterConversationExclusion = await buildLeadKnowledgeContext({
      ...scope,
      platform: "whatsapp-web",
      chatFingerprint: "https://web.whatsapp.com/chat/919830000000",
      contact: {
        phone: "+91 98300 00000"
      }
    });
    assert.equal(contextAfterConversationExclusion.lead?.contact.displayName, "Asha Buyer");
    assert.equal(
      contextAfterConversationExclusion.messages.some((message) => message.body.includes("Following up from WhatsApp web")),
      false,
      "excluded conversations should not feed the AI knowledge context"
    );
    assert.equal(
      contextAfterConversationExclusion.messages.some((message) => message.body.includes("Interested in MCA admission")),
      true,
      "included webhook messages should remain in AI knowledge context"
    );

    await setLeadKnowledgeStatus({ ...scope, leadId: asha.id, leadStatus: "excluded" });
    const contextAfterLeadExclusion = await buildLeadKnowledgeContext({
      ...scope,
      platform: "whatsapp-web",
      contact: {
        phone: "+91 98300 00000"
      }
    });
    assert.equal(contextAfterLeadExclusion.lead?.leadStatus, "excluded");
    assert.equal(contextAfterLeadExclusion.messages.length, 0, "excluded leads should not feed AI message context");

    await syncLeadKnowledgeFromExtensionTasks(scope, [
      {
        id: "task_worker_only_1",
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        type: "initiate_conversation",
        status: "queued",
        priority: "normal",
        platform: "whatsapp-web",
        targetUrl: "https://web.whatsapp.com/send?phone=919810000000",
        contact: {
          displayName: "Worker Only Lead",
          phone: "+91 98100 00000"
        },
        draftMessage: "Hi Worker Only Lead, would it make sense to discuss this week?",
        contextSummary: "Worker task exists before any webhook or extension chat sync.",
        createdAt: "2026-06-02T09:00:00.000Z",
        updatedAt: "2026-06-02T09:00:00.000Z"
      }
    ]);

    const recordsAfterTaskSync = await listLeadKnowledgeRecords(scope);
    const workerOnlyLead = recordsAfterTaskSync.find((lead) => lead.contact.displayName === "Worker Only Lead");
    assert(workerOnlyLead, "worker-only tasks should appear as CRM lead knowledge records");
    assert.equal(workerOnlyLead.channels.includes("whatsapp-web"), true);
    assert.equal(workerOnlyLead.messages.some((message) => message.body.includes("Worker task exists before any webhook")), true);

    await syncLeadKnowledgeFromExtensionTasks(scope, [
      {
        id: "task_worker_split_a",
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        leadId: "lead_worker_split_a",
        type: "initiate_conversation",
        status: "queued",
        priority: "normal",
        platform: "whatsapp-web",
        targetUrl: "https://web.whatsapp.com/send?phone=919810000001",
        contact: {
          displayName: "Worker Split A",
          phone: "+91 98100 00001"
        },
        draftMessage: "Hi Worker Split A, checking if this is useful.",
        contextSummary: "Worker task A should stay attached only to lead A.",
        createdAt: "2026-06-02T09:10:00.000Z",
        updatedAt: "2026-06-02T09:10:00.000Z"
      },
      {
        id: "task_worker_split_b",
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        leadId: "lead_worker_split_b",
        type: "initiate_conversation",
        status: "queued",
        priority: "normal",
        platform: "whatsapp-web",
        targetUrl: "https://web.whatsapp.com/send?phone=919810000002",
        contact: {
          displayName: "Worker Split B",
          phone: "+91 98100 00002"
        },
        draftMessage: "Hi Worker Split B, checking if this is useful.",
        contextSummary: "Worker task B should stay attached only to lead B.",
        createdAt: "2026-06-02T09:11:00.000Z",
        updatedAt: "2026-06-02T09:11:00.000Z"
      }
    ]);

    const splitRecords = await listLeadKnowledgeRecords(scope);
    const splitA = splitRecords.find((lead) => lead.id === "lead_worker_split_a");
    const splitB = splitRecords.find((lead) => lead.id === "lead_worker_split_b");
    assert(splitA, "task A should create its own CRM lead");
    assert(splitB, "task B should create its own CRM lead");
    assert.equal(splitA.messages.some((message) => message.body.includes("Worker task B")), false);
    assert.equal(splitB.messages.some((message) => message.body.includes("Worker task A")), false);

    const health = await summarizeLeadKnowledgeHealth();
    assert.equal(health.records, 7, "lead health should count all non-deleted lead knowledge records");
    assert.equal(health.activeLeads, 6, "lead health should count active lead knowledge records");
    assert.equal(health.excludedLeads, 1, "lead health should count excluded lead knowledge records");
    assert.equal(health.metaSourced, 3, "lead health should count official Meta-sourced records");
    assert.equal(health.extensionSourced, 4, "lead health should count extension and worker-task sourced records");
    assert(health.messages >= 10, "lead health should expose real message volume");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
