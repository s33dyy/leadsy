import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const root = process.cwd();
  const settingsPage = await readFile(join(root, "apps/web/src/app/app/settings/page.tsx"), "utf8");
  assert(settingsPage.includes("getTwilioIntegrationStatus"), "settings page should read Twilio integration status");
  assert(settingsPage.includes('id: "twilio"'), "settings navigation should expose Twilio under integrations");
  for (const label of ["Connection Status", "Account SID", "WhatsApp Number", "Last Webhook", "Last Delivery Callback"]) {
    assert(settingsPage.includes(label), `settings Twilio panel should display ${label}`);
  }
  assert(settingsPage.includes("maskTwilioAccountSid"), "settings should mask the Twilio account SID before display");
  assert(settingsPage.includes("/api/twilio/webhook"), "settings should show the Twilio inbound webhook route");
  assert(settingsPage.includes("/api/twilio/status"), "settings should show the Twilio status callback route");
  for (const secretLeak of ["TWILIO_AUTH_TOKEN", "Auth Token", "authToken"]) {
    assert(!settingsPage.includes(secretLeak), `settings page should not expose ${secretLeak}`);
  }

  const integrationsPage = await readFile(join(root, "apps/web/src/app/app/integrations/page.tsx"), "utf8");
  assert(integrationsPage.includes("Twilio WhatsApp"), "integrations page should list Twilio WhatsApp as the primary WhatsApp transport");
  assert(integrationsPage.includes("Leadsy-managed WhatsApp transport"), "integrations page should position Twilio as Leadsy-managed infrastructure");
  assert(integrationsPage.includes("Clients do not connect their own Twilio account"), "integrations page should not ask clients to connect Twilio");
  assert(integrationsPage.includes("/app/settings?section=twilio"), "integrations page should link Twilio to settings");
  assert(!integrationsPage.includes("TWILIO_AUTH_TOKEN"), "integrations page should not expose Twilio secrets");

  console.log("twilio settings surface regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
