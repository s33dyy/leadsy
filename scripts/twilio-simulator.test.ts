import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function closeTo(actual: number, expected: number) {
  assert(Math.abs(actual - expected) < 0.000001, `${actual} should be close to ${expected}`);
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-twilio-simulator-"));
  process.env.LEADSY_DATA_DIR = tempDir;
  process.env.TWILIO_ACCOUNT_SID = "AC00000000000000000000000000000000";
  process.env.TWILIO_AUTH_TOKEN = "twilio_auth_token";
  process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";

  try {
    const {
      ensureWorkspaceTwilioSimulator,
      saveSimulatedTwilioInboundMessage,
      sendAndStoreSimulatedWhatsAppMessage
    } = await import("../apps/web/src/lib/twilio-simulator");
    const { sendAndStoreWhatsAppMessage } = await import("../apps/web/src/lib/whatsapp-transport");
    const { calculateTwilioPricingEstimate } = await import("../apps/web/src/lib/whatsapp-pricing-estimator");
    const { buildLeadBackedInboxItems } = await import("../apps/web/src/lib/inbox-stabilization");
    const { buildQualificationInputAudit, listLeadKnowledgeRecords } = await import("../apps/web/src/lib/lead-knowledge-store");
    const { getWorkspaceWhatsAppSender, upsertWorkspaceWhatsAppSender } = await import("../apps/web/src/lib/workspace-whatsapp-sender-store");

    const scope = { tenantId: "tenant_simulator", ownerId: "owner_simulator" };
    const sender = await ensureWorkspaceTwilioSimulator({ ...scope, businessName: "Simulator Workspace" });
    assert.equal(sender.transportMode, "simulator");
    assert.equal(sender.status, "approved");
    assert.equal(sender.simulatorHandle, "Leadsy Simulator");
    assert.equal(sender.twilioFrom, undefined);
    assert.equal(sender.assignedPhoneNumber, undefined);

    const storedSender = await getWorkspaceWhatsAppSender(scope);
    assert.equal(storedSender?.transportMode, "simulator");
    assert.equal(storedSender?.status, "approved");

    const inbound = await saveSimulatedTwilioInboundMessage({
      ...scope,
      from: "+919000000001",
      profileName: "Asha Simulator",
      body: "Company: LensMart\nNeed: WhatsApp CRM follow-up\nTimeline: today",
      receivedAt: "2026-06-07T09:00:00.000Z"
    });
    assert.equal(inbound.saved.length, 1);
    assert.equal(inbound.saved[0].source, "twilio_simulator");
    assert.equal(inbound.saved[0].channel, "whatsapp");
    assert.equal(inbound.saved[0].direction, "inbound");
    assert.equal(inbound.saved[0].deliveryStatus, "received");

    let [lead] = await listLeadKnowledgeRecords(scope);
    assert.equal(lead.leadSource, "Twilio Simulator");
    assert.equal(lead.conversations.length, 1);
    assert.equal(lead.conversations[0].source, "twilio_simulator");
    assert.equal(lead.messages.length, 1);
    assert.equal(buildLeadBackedInboxItems([lead])[0].needsReply, true);
    const qualificationAudit = buildQualificationInputAudit(lead);
    assert.equal(qualificationAudit.fields.find((field) => field.field === "need")?.state, "Collected");

    let twilioFetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      twilioFetchCalled = true;
      throw new Error("Simulator transport must not call Twilio.");
    }) as typeof fetch;

    try {
      const directOutbound = await sendAndStoreSimulatedWhatsAppMessage({
        ...scope,
        leadId: lead.id,
        to: "whatsapp:+919000000001",
        body: "Thanks, we can help you track these demo replies."
      });
      assert.equal(directOutbound.transportMode, "simulator");
      assert.equal(directOutbound.deliveryStatus, "simulated_delivered");
      assert.match(directOutbound.providerMessageSid, /^SIMOUT/);

      const genericOutbound = await sendAndStoreWhatsAppMessage({
        ...scope,
        leadId: lead.id,
        to: "whatsapp:+919000000001",
        body: "This reply is stored only inside Leadsy."
      });
      assert.equal(genericOutbound.transportMode, "simulator");
      assert.equal(genericOutbound.deliveryStatus, "simulated_delivered");
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(twilioFetchCalled, false);

    [lead] = await listLeadKnowledgeRecords(scope);
    assert.equal(lead.messages.filter((message) => message.source === "twilio_simulator").length, 3);
    assert.equal(lead.messages.filter((message) => message.direction === "outbound").at(-1)?.deliveryStatus, "simulated_delivered");

    await upsertWorkspaceWhatsAppSender({
      tenantId: "tenant_real_sender",
      ownerId: "owner_real_sender",
      businessName: "Real Sender Workspace",
      whatsappNumber: "+14155238886",
      status: "approved"
    });
    let realTwilioFetchCalled = false;
    globalThis.fetch = (async (url, init) => {
      realTwilioFetchCalled = true;
      assert.equal(String(url), "https://api.twilio.com/2010-04-01/Accounts/AC00000000000000000000000000000000/Messages.json");
      const body = init?.body as URLSearchParams;
      assert.equal(body.get("From"), "whatsapp:+14155238886");
      assert.equal(body.get("To"), "whatsapp:+919000000002");
      return new Response(
        JSON.stringify({
          sid: "SMREAL000000000000000000000000000001",
          status: "queued",
          from: "whatsapp:+14155238886",
          to: "whatsapp:+919000000002",
          body: "Real transport reply"
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;
    try {
      const realOutbound = await sendAndStoreWhatsAppMessage({
        tenantId: "tenant_real_sender",
        ownerId: "owner_real_sender",
        to: "whatsapp:+919000000002",
        body: "Real transport reply"
      });
      assert.equal(realOutbound.transportMode, "twilio");
      assert.equal(realOutbound.deliveryStatus, "queued");
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(realTwilioFetchCalled, true);

    const estimate = calculateTwilioPricingEstimate({
      workspaceCount: 2,
      inboundMessages: 1000,
      outboundFreeformMessages: 500,
      utilityTemplates: 100,
      marketingTemplates: 25,
      authenticationTemplates: 10,
      phoneNumberMonthlyUsd: 1.15,
      metaUtilityTemplateFeeUsd: 0.004,
      metaMarketingTemplateFeeUsd: 0.01,
      metaAuthenticationTemplateFeeUsd: 0.003,
      fxRateInr: 83
    });
    closeTo(estimate.twilioMessageFeesUsd, 8.175);
    closeTo(estimate.phoneNumberFeesUsd, 2.3);
    closeTo(estimate.metaTemplateFeesUsd, 0.68);
    closeTo(estimate.totalUsd, 11.155);
    closeTo(estimate.totalInr, 925.865);
    assert.equal(estimate.simulatorMonthlyUsd, 0);

    const simulatorPageSource = await readFile(join(process.cwd(), "apps/web/src/app/simulate-twilio/page.tsx"), "utf8");
    assert.match(simulatorPageSource, /requireAgencySession/);
    assert.match(simulatorPageSource, /TwilioSimulatorConsole/);
    const simulatorConsoleSource = await readFile(join(process.cwd(), "apps/web/src/components/twilio-simulator-console.tsx"), "utf8");
    assert.match(simulatorConsoleSource, /Create inbound lead message/);
    assert.match(simulatorConsoleSource, /Simulation mode: no external WhatsApp delivery/);
    assert.match(simulatorConsoleSource, /Pricing estimator/);
    assert.match(simulatorConsoleSource, /workspaceCount: 1,/, "Pricing defaults should start at one workspace, not a scaled agency scenario");
    assert.match(simulatorConsoleSource, /inboundMessages: 100,/, "Pricing defaults should use a modest starter inbound volume");
    assert.match(simulatorConsoleSource, /outboundFreeformMessages: 100,/, "Pricing defaults should use a modest starter outbound volume");
    assert.match(simulatorConsoleSource, /utilityTemplates: 0,/, "Pricing defaults should avoid paid template volume until the user opts in");
    assert.match(simulatorConsoleSource, /Current simulator mode/, "Simulator page should lead with the zero-cost simulator baseline");

    const aliasSource = await readFile(join(process.cwd(), "apps/web/src/app/simulate-twillio/page.tsx"), "utf8");
    assert.match(aliasSource, /redirect\("\/simulate-twilio"\)/);

    const inboundRouteSource = await readFile(join(process.cwd(), "apps/web/src/app/api/simulate-twilio/inbound/route.ts"), "utf8");
    assert.match(inboundRouteSource, /requireApiSession\(request, "crm:write"\)/);
    assert.match(inboundRouteSource, /saveSimulatedTwilioInboundMessage/);

    const genericRouteSource = await readFile(join(process.cwd(), "apps/web/src/app/api/whatsapp/messages/route.ts"), "utf8");
    assert.match(genericRouteSource, /sendAndStoreWhatsAppMessage/);
    assert.match(genericRouteSource, /transportMode/);

    const composerSource = await readFile(join(process.cwd(), "apps/web/src/components/inbox-reply-composer.tsx"), "utf8");
    assert.match(composerSource, /\/api\/whatsapp\/messages/);
    assert.match(composerSource, /Simulation mode: no external WhatsApp delivery/);

    console.log("twilio simulator regression passed");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
