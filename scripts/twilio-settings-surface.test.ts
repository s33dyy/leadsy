import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const root = process.cwd();
  const settingsPage = await readFile(join(root, "apps/web/src/app/app/settings/page.tsx"), "utf8");
  const settingsConsole = await readFile(join(root, "apps/web/src/components/settings-console.tsx"), "utf8");
  const route = await readFile(join(root, "apps/web/src/app/api/settings/twilio/route.ts"), "utf8");
  const store = await readFile(join(root, "apps/web/src/lib/twilio-settings-store.ts"), "utf8");

  assert(settingsPage.includes('id: "twilio"'), "settings navigation should expose Twilio");
  assert(settingsPage.includes("getWorkspaceTwilioSettingsSummary"), "settings page should read masked Twilio settings");
  assert(settingsConsole.includes("TwilioSettings"), "settings console should render a Twilio settings panel");
  for (const label of ["Twilio WhatsApp", "Simulator fallback", "Account SID", "WhatsApp From", "Webhook URL", "Status callback URL", "Clear Twilio config"]) {
    assert(settingsConsole.includes(label), `Twilio settings should display ${label}`);
  }
  assert(settingsConsole.includes("/api/settings/twilio"), "Twilio settings should save through the settings API");
  assert(route.includes("requireApiSession(request, \"crm:write\")"), "Twilio settings updates should require write auth");
  assert(route.includes("maskWorkspaceTwilioConfig"), "Twilio settings API should return masked config");
  assert(store.includes("authToken"), "Twilio settings store should persist an auth token server-side");
  assert(store.includes("maskedAuthToken"), "Twilio settings store should expose only masked token status");
  assert(!settingsConsole.includes("TWILIO_AUTH_TOKEN"), "Twilio settings UI should not show env secret names");
  assert(!settingsConsole.includes("authToken:"), "Twilio settings UI should not render raw auth token object keys");

  const integrationsPage = await readFile(join(root, "apps/web/src/app/app/integrations/page.tsx"), "utf8");
  assert(integrationsPage.includes("Leadsy WhatsApp"), "integrations page can describe the user-facing WhatsApp channel");
  assert(integrationsPage.includes("/app/settings?section=twilio"), "integrations page should link WhatsApp setup to Twilio settings");
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
