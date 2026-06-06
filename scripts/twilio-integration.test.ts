import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function twilioSignature(url: string, params: URLSearchParams, token: string) {
  const payload = [...params.keys()]
    .sort()
    .reduce((acc, key) => `${acc}${key}${params.getAll(key).join("")}`, url);
  return createHmac("sha1", token).update(payload).digest("base64");
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-twilio-"));
  process.env.LEADSY_DATA_DIR = tempDir;
  process.env.TWILIO_ACCOUNT_SID = "AC00000000000000000000000000000000";
  process.env.TWILIO_AUTH_TOKEN = "twilio_auth_token";
  process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
  process.env.TWILIO_CONTENT_SID = "HXtemplate";
  process.env.TWILIO_STATUS_CALLBACK_URL = "https://leadsy.test/api/twilio/status";

  try {
    const {
      createTwilioSignature,
      saveTwilioInboundFromForm,
      sendAndStoreTwilioWhatsAppMessage,
      updateTwilioDeliveryStatusFromForm,
      verifyTwilioSignature,
      getTwilioIntegrationStatus
    } = await import("../apps/web/src/lib/twilio-transport");
    const { conversationMessages, listLeadKnowledgeRecords } = await import("../apps/web/src/lib/lead-knowledge-store");

    const scope = { tenantId: "tenant_twilio", ownerId: "owner_twilio" };
    const webhookUrl = "https://leadsy.test/api/twilio/webhook";
    const inboundForm = new URLSearchParams({
      AccountSid: process.env.TWILIO_ACCOUNT_SID,
      MessageSid: "SMINBOUND0000000000000000000000000001",
      SmsMessageSid: "SMINBOUND0000000000000000000000000001",
      From: "whatsapp:+919123374792",
      To: "whatsapp:+14155238886",
      Body: "Hi, I need WhatsApp CRM automation for my admissions team.",
      ProfileName: "Asha Buyer",
      WaId: "919123374792",
      SmsStatus: "received"
    });

    assert.equal(
      verifyTwilioSignature({
        url: webhookUrl,
        params: inboundForm,
        signature: twilioSignature(webhookUrl, inboundForm, process.env.TWILIO_AUTH_TOKEN),
        authToken: process.env.TWILIO_AUTH_TOKEN
      }),
      true
    );
    assert.equal(createTwilioSignature(webhookUrl, inboundForm, process.env.TWILIO_AUTH_TOKEN), twilioSignature(webhookUrl, inboundForm, process.env.TWILIO_AUTH_TOKEN));
    assert.equal(
      verifyTwilioSignature({ url: webhookUrl, params: inboundForm, signature: "bad", authToken: process.env.TWILIO_AUTH_TOKEN }),
      false
    );

    const inbound = await saveTwilioInboundFromForm({ ...scope, form: inboundForm, receivedAt: "2026-06-06T09:00:00.000Z" });
    assert.equal(inbound.saved.length, 1);
    assert.equal(inbound.saved[0].direction, "inbound");
    assert.equal(inbound.saved[0].channel, "whatsapp");
    assert.equal(inbound.saved[0].source, "twilio");
    assert.equal(inbound.saved[0].providerMessageSid, "SMINBOUND0000000000000000000000000001");
    assert.equal(inbound.saved[0].deliveryStatus, "received");

    const duplicateInbound = await saveTwilioInboundFromForm({ ...scope, form: inboundForm, receivedAt: "2026-06-06T09:00:02.000Z" });
    assert.equal(duplicateInbound.saved.length, 0, "Twilio MessageSid should dedupe inbound webhooks");

    let [lead] = await listLeadKnowledgeRecords(scope);
    assert.equal(lead.leadSource, "Twilio WhatsApp");
    assert.equal(lead.contact.displayName, "Asha Buyer");
    assert.equal(lead.conversations.length, 1);
    assert.equal(conversationMessages(lead.messages).length, 1, "only inbound/outbound customer messages should be conversation messages");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url, init) => {
      assert.equal(String(url), "https://api.twilio.com/2010-04-01/Accounts/AC00000000000000000000000000000000/Messages.json");
      assert.equal(init?.method, "POST");
      assert(String(init?.headers).includes("Basic") || init?.headers instanceof Headers);
      const body = init?.body as URLSearchParams;
      assert.equal(body.get("From"), "whatsapp:+14155238886");
      assert.equal(body.get("To"), "whatsapp:+919123374792");
      assert.equal(body.get("ContentSid"), "HXtemplate");
      assert.equal(body.get("ContentVariables"), "{\"1\":\"12/1\",\"2\":\"3pm\"}");
      assert.equal(body.get("StatusCallback"), "https://leadsy.test/api/twilio/status");
      return new Response(
        JSON.stringify({
          sid: "SMOUTBOUND0000000000000000000000000001",
          status: "queued",
          from: "whatsapp:+14155238886",
          to: "whatsapp:+919123374792",
          body: "",
          date_created: "Sat, 06 Jun 2026 09:01:00 +0000"
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const outbound = await sendAndStoreTwilioWhatsAppMessage({
        ...scope,
        leadId: lead.id,
        to: "whatsapp:+919123374792",
        contentSid: "HXtemplate",
        contentVariables: { "1": "12/1", "2": "3pm" }
      });
      assert.equal(outbound.message.providerMessageSid, "SMOUTBOUND0000000000000000000000000001");
      assert.equal(outbound.message.direction, "outbound");
      assert.equal(outbound.message.deliveryStatus, "queued");
      assert.equal(outbound.twilio.status, "queued");
    } finally {
      globalThis.fetch = originalFetch;
    }

    [lead] = await listLeadKnowledgeRecords(scope);
    assert.equal(lead.conversations.length, 1, "outbound Twilio send should link to the existing lead conversation");
    assert.equal(conversationMessages(lead.messages).length, 2);
    assert.equal(lead.messages.filter((message) => message.source === "twilio").length, 2);

    const statusForm = new URLSearchParams({
      AccountSid: process.env.TWILIO_ACCOUNT_SID,
      MessageSid: "SMOUTBOUND0000000000000000000000000001",
      MessageStatus: "delivered",
      To: "whatsapp:+919123374792",
      From: "whatsapp:+14155238886",
      ErrorCode: ""
    });
    const statusUpdate = await updateTwilioDeliveryStatusFromForm({ form: statusForm, receivedAt: "2026-06-06T09:02:00.000Z" });
    assert.equal(statusUpdate.updated, true);
    assert.equal(statusUpdate.message?.deliveryStatus, "delivered");

    [lead] = await listLeadKnowledgeRecords(scope);
    const outboundMessage = lead.messages.find((message) => message.providerMessageSid === "SMOUTBOUND0000000000000000000000000001");
    assert.equal(outboundMessage?.deliveryStatus, "delivered");
    assert.equal(outboundMessage?.statusUpdatedAt, "2026-06-06T09:02:00.000Z");

    const twilioState = JSON.parse(await readFile(join(tempDir, "twilio-integration.json"), "utf8"));
    assert.equal(twilioState.lastWebhookMessageSid, "SMINBOUND0000000000000000000000000001");
    assert.equal(twilioState.lastDeliveryMessageSid, "SMOUTBOUND0000000000000000000000000001");
    assert.equal(twilioState.lastDeliveryStatus, "delivered");

    const integration = await getTwilioIntegrationStatus();
    assert.equal(integration.connected, true);
    assert.equal(integration.accountSid, "AC00000000000000000000000000000000");
    assert.equal(integration.whatsappNumber, "whatsapp:+14155238886");
    assert.equal(integration.lastWebhook?.messageSid, "SMINBOUND0000000000000000000000000001");
    assert.equal(integration.lastDeliveryCallback?.status, "delivered");

    console.log("twilio integration regression passed");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
