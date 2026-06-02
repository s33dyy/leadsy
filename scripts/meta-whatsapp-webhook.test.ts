import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-meta-whatsapp-"));
  process.env.LEADSY_DATA_DIR = tempDir;
  process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN = "leadsy_verify";

  try {
    const {
      extractMetaWhatsAppInboundMessages,
      listMetaWhatsAppConversations,
      listMetaWhatsAppInboundMessages,
      saveMetaWhatsAppInboundMessages,
      setMetaWhatsAppContactLeadStatus,
      verifyMetaWebhookChallenge,
      verifyMetaWebhookSignature
    } = await import("../apps/web/src/lib/meta-whatsapp-webhook-store");

    const payload = {
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
                  phone_number_id: "phone_number_123"
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
                    id: "wamid.inbound-1",
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

    const extracted = extractMetaWhatsAppInboundMessages(payload, "2026-06-02T08:00:00.000Z");
    assert.equal(extracted.length, 1);
    assert.equal(extracted[0].from, "919830000000");
    assert.equal(extracted[0].profileName, "Asha Buyer");
    assert.equal(extracted[0].messageText, "Interested in MCA admission");
    assert.equal(extracted[0].phoneNumberId, "phone_number_123");
    assert.equal(extracted[0].whatsappBusinessAccountId, "waba_123");
    assert.equal(extracted[0].referral?.sourceId, "ad_123");
    assert.equal(extracted[0].referral?.ctwaClid, "clid_123");

    const firstSave = await saveMetaWhatsAppInboundMessages(payload, "2026-06-02T08:00:00.000Z");
    const secondSave = await saveMetaWhatsAppInboundMessages(payload, "2026-06-02T08:00:01.000Z");
    const followUpPayload = {
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
                  phone_number_id: "phone_number_123"
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
                    id: "wamid.inbound-2",
                    timestamp: "1780391260",
                    type: "text",
                    text: { body: "Can you send details?" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };
    const followUpSave = await saveMetaWhatsAppInboundMessages(followUpPayload, "2026-06-02T08:01:00.000Z");
    const saved = await listMetaWhatsAppInboundMessages();
    assert.equal(firstSave.saved.length, 1);
    assert.equal(secondSave.saved.length, 0, "same WhatsApp message id should be deduped");
    assert.equal(followUpSave.saved.length, 1);
    assert.equal(saved.length, 2);
    assert.equal(saved[0].messageId, "wamid.inbound-2");

    const conversations = await listMetaWhatsAppConversations({
      tenantId: "tenant_test",
      ownerId: "owner_test"
    });
    assert.equal(conversations.length, 1);
    assert.equal(conversations[0].contactId, "919830000000");
    assert.equal(conversations[0].profileName, "Asha Buyer");
    assert.equal(conversations[0].leadStatus, "lead");
    assert.equal(conversations[0].messageCount, 2);
    assert.equal(conversations[0].messages.at(-1)?.messageText, "Can you send details?");
    assert.equal(conversations[0].whatsappUrl, "https://web.whatsapp.com/send?phone=919830000000");

    await setMetaWhatsAppContactLeadStatus({
      tenantId: "tenant_test",
      ownerId: "owner_test",
      contactId: "919830000000",
      leadStatus: "excluded"
    });
    const excludedConversations = await listMetaWhatsAppConversations({
      tenantId: "tenant_test",
      ownerId: "owner_test"
    });
    assert.equal(excludedConversations[0].leadStatus, "excluded");
    assert.equal(excludedConversations[0].messageCount, 2, "excluded contacts should keep their conversation history");

    assert.equal(
      verifyMetaWebhookChallenge({
        mode: "subscribe",
        token: "leadsy_verify",
        challenge: "challenge_123"
      }),
      "challenge_123"
    );
    assert.equal(
      verifyMetaWebhookChallenge({
        mode: "subscribe",
        token: "wrong",
        challenge: "challenge_123"
      }),
      null
    );

    const rawBody = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", "app_secret").update(rawBody).digest("hex")}`;
    assert.equal(verifyMetaWebhookSignature(rawBody, signature, "app_secret"), true);
    assert.equal(verifyMetaWebhookSignature(rawBody, "sha256=bad", "app_secret"), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
