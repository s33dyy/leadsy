import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const root = process.cwd();
  const settingsPage = await readFile(join(root, "apps/web/src/app/app/settings/page.tsx"), "utf8");
  assert(!settingsPage.includes("getTwilioIntegrationStatus"), "settings page should not read Twilio integration status");
  assert(!settingsPage.includes("getWorkspaceWhatsAppSender"), "settings page should not read the workspace assigned sender");
  assert(!settingsPage.includes('id: "twilio"'), "settings navigation should not expose Twilio");
  for (const label of ["Workspace sender status", "Assigned lead number", "Provisioning detail", "Platform connection status", "Platform account SID", "Platform default sender", "Last webhook", "Last delivery callback"]) {
    assert(!settingsPage.includes(label), `settings page should not display user-facing ${label}`);
  }
  assert(!settingsPage.includes("maskTwilioAccountSid"), "settings should not render Twilio SID helpers");
  assert(!settingsPage.includes("Leadsy assigns each workspace a dedicated WhatsApp lead number"), "settings should not describe Twilio sender infrastructure");
  assert(!settingsPage.includes("/api/twilio/webhook"), "settings should not show the Twilio inbound webhook route");
  assert(!settingsPage.includes("/api/twilio/status"), "settings should not show the Twilio status callback route");
  for (const secretLeak of ["TWILIO_AUTH_TOKEN", "Auth Token", "authToken"]) {
    assert(!settingsPage.includes(secretLeak), `settings page should not expose ${secretLeak}`);
  }

  const integrationsPage = await readFile(join(root, "apps/web/src/app/app/integrations/page.tsx"), "utf8");
  assert(integrationsPage.includes("Leadsy WhatsApp"), "integrations page can describe the user-facing WhatsApp channel");
  assert(!integrationsPage.includes("/app/settings?section=twilio"), "integrations page should not link Twilio to settings");
  assert(!integrationsPage.includes("TWILIO_AUTH_TOKEN"), "integrations page should not expose Twilio secrets");

  const senderRoute = await readFile(join(root, "apps/web/src/app/api/twilio/sender/route.ts"), "utf8");
  assert(senderRoute.includes("ensureWorkspaceWhatsAppSender"), "sender API should create assignment state for the workspace");
  const provisioningRoute = await readFile(join(root, "apps/web/src/app/api/twilio/sender/provision/route.ts"), "utf8");
  assert(provisioningRoute.includes("provisionLeadsyAssignedWhatsAppSender"), "provisioning API should attempt live Leadsy-assigned sender setup");

  console.log("twilio settings surface regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
