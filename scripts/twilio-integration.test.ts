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
      resolveTwilioInboundScopeFromForm,
      saveTwilioInboundFromForm,
      sendAndStoreTwilioWhatsAppMessage,
      updateTwilioDeliveryStatusFromForm,
      verifyTwilioSignature,
      getTwilioIntegrationStatus
    } = await import("../apps/web/src/lib/twilio-transport");
    const { conversationMessages, listLeadKnowledgeRecords } = await import("../apps/web/src/lib/lead-knowledge-store");
    const {
      ensureWorkspaceWhatsAppSender,
      normalizeWorkspaceWhatsAppNumber,
      provisionLeadsyAssignedWhatsAppSender,
      provisionWorkspaceWhatsAppSender,
      resolveWorkspaceWhatsAppSenderByTwilioTo,
      searchIndianTwilioNumber,
      buyTwilioPhoneNumber,
      registerTwilioWhatsAppSender,
      upsertWorkspaceWhatsAppSender
    } = await import("../apps/web/src/lib/workspace-whatsapp-sender-store");

    const scope = { tenantId: "tenant_twilio", ownerId: "owner_twilio" };
    assert.equal(normalizeWorkspaceWhatsAppNumber({ whatsappNumber: "9123374792" })?.twilioFrom, "whatsapp:+919123374792");
    assert.equal(normalizeWorkspaceWhatsAppNumber({ whatsappNumber: "+919123374792" })?.twilioFrom, "whatsapp:+919123374792");
    assert.equal(normalizeWorkspaceWhatsAppNumber({ whatsappNumber: "whatsapp:+919123374792" })?.twilioFrom, "whatsapp:+919123374792");

    const emptySender = await ensureWorkspaceWhatsAppSender({
      tenantId: "tenant_empty_sender",
      ownerId: "owner_empty_sender",
      businessName: "Waiting Workspace"
    });
    assert.equal(emptySender.status, "not_started");
    assert.equal(emptySender.twilioFrom, undefined);

    assert.equal(typeof searchIndianTwilioNumber, "function");
    assert.equal(typeof buyTwilioPhoneNumber, "function");
    assert.equal(typeof registerTwilioWhatsAppSender, "function");

    const originalFetchForProvisioning = globalThis.fetch;
    const liveProvisioningCalls: string[] = [];
    globalThis.fetch = (async (url, init) => {
      liveProvisioningCalls.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (String(url).includes("/AvailablePhoneNumbers/IN/Mobile.json")) {
        return new Response(
          JSON.stringify({
            available_phone_numbers: [{ phone_number: "+919876543210" }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (String(url).endsWith("/IncomingPhoneNumbers.json")) {
        const body = init?.body as URLSearchParams;
        assert.equal(body.get("PhoneNumber"), "+919876543210");
        return new Response(JSON.stringify({ sid: "PNLIVE000000000000000000000000000001", phone_number: "+919876543210" }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }
      if (String(url) === "https://messaging.twilio.com/v2/Channels/Senders") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        assert.equal(body.sender_id, "whatsapp:+919876543210");
        assert.equal(body.profile.name, "Live Workspace");
        assert.equal(body.webhook.callback_url, "https://leadsy.test/api/twilio/webhook");
        return new Response(JSON.stringify({ sid: "XELIVE000000000000000000000000000001", status: "CREATING", sender_id: "whatsapp:+919876543210" }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }
      throw new Error(`unexpected Twilio provisioning URL: ${String(url)}`);
    }) as typeof fetch;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "https://leadsy.test";
      const liveSender = await provisionLeadsyAssignedWhatsAppSender(
        {
          tenantId: "tenant_live_sender",
          ownerId: "owner_live_sender"
        },
        {
          businessName: "Live Workspace",
          industry: "Education",
          website: "https://leadsy.test"
        }
      );
      assert.equal(liveSender.assignedPhoneNumber, "+919876543210");
      assert.equal(liveSender.twilioFrom, "whatsapp:+919876543210");
      assert.equal(liveSender.twilioPhoneNumberSid, "PNLIVE000000000000000000000000000001");
      assert.equal(liveSender.twilioSenderSid, "XELIVE000000000000000000000000000001");
      assert.equal(liveSender.status, "pending_verification");
      assert(liveProvisioningCalls[0].includes("/AvailablePhoneNumbers/IN/Mobile.json"), "India mobile inventory should be searched first");
      assert(liveProvisioningCalls.some((call) => call.includes("/IncomingPhoneNumbers.json")), "Twilio number purchase should run after inventory search");
      assert(liveProvisioningCalls.some((call) => call.includes("/v2/Channels/Senders")), "WhatsApp sender registration should run after purchase");
    } finally {
      globalThis.fetch = originalFetchForProvisioning;
    }

    process.env.LEADSY_TWILIO_WHATSAPP_SENDER_POOL = "whatsapp:+14155239999";
    globalThis.fetch = (async (url) => {
      if (String(url).includes("/AvailablePhoneNumbers/IN/")) {
        return new Response(JSON.stringify({ available_phone_numbers: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`live provisioning should fall back after inventory miss, not call ${String(url)}`);
    }) as typeof fetch;
    let reservedSender;
    try {
      reservedSender = await provisionWorkspaceWhatsAppSender({
        tenantId: "tenant_reserved_sender",
        ownerId: "owner_reserved_sender",
        businessName: "Reserved Workspace"
      });
      assert.equal(reservedSender.status, "number_reserved");
      assert.equal(reservedSender.twilioFrom, "whatsapp:+14155239999");
      assert.match(reservedSender.statusReason ?? "", /fallback/i);
    } finally {
      globalThis.fetch = originalFetchForProvisioning;
    }

    await upsertWorkspaceWhatsAppSender({
      ...scope,
      businessName: "Leadsy Test Workspace",
      whatsappNumber: "+14155238886",
      status: "approved"
    });
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
    const resolvedSender = await resolveWorkspaceWhatsAppSenderByTwilioTo("whatsapp:+14155238886");
    assert.equal(resolvedSender?.tenantId, scope.tenantId);
    const inboundScope = await resolveTwilioInboundScopeFromForm(inboundForm);
    assert.equal(inboundScope.ownerId, scope.ownerId);

    await assert.rejects(
      () =>
        resolveTwilioInboundScopeFromForm(
          new URLSearchParams({
            ...Object.fromEntries(inboundForm.entries()),
            To: "whatsapp:+15550000000"
          })
        ),
      /No Leadsy workspace sender/
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
    await assert.rejects(
      () =>
        sendAndStoreTwilioWhatsAppMessage({
          tenantId: "tenant_without_sender",
          ownerId: "owner_without_sender",
          to: "whatsapp:+919123374792",
          body: "No sender should block this"
        }),
      /workspace WhatsApp sender is required/i
    );

    await assert.rejects(
      () =>
        sendAndStoreTwilioWhatsAppMessage({
          tenantId: reservedSender.tenantId,
          ownerId: reservedSender.ownerId,
          to: "whatsapp:+919123374792",
          body: "Reserved but not approved should block"
        }),
      /not approved/i
    );

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
