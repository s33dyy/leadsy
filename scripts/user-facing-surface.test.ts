import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

async function fileExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function main() {
  const root = process.cwd();
  const expectedPages = [
    "apps/web/src/app/page.tsx",
    "apps/web/src/app/login/page.tsx",
    "apps/web/src/app/extension/page.tsx",
    "apps/web/src/app/app/connect/page.tsx",
    "apps/web/src/app/app/leads/page.tsx",
    "apps/web/src/app/app/magnet/page.tsx",
    "apps/web/src/app/app/worker/page.tsx"
  ];
  const removedPages = [
    "apps/web/src/app/app/analytics/page.tsx",
    "apps/web/src/app/app/capture/page.tsx",
    "apps/web/src/app/app/clients/page.tsx",
    "apps/web/src/app/app/crm/page.tsx",
    "apps/web/src/app/app/extension/page.tsx",
    "apps/web/src/app/app/inbox/page.tsx",
    "apps/web/src/app/app/intelligence/page.tsx",
    "apps/web/src/app/app/meta/page.tsx",
    "apps/web/src/app/app/outreach/page.tsx",
    "apps/web/src/app/app/workflows/page.tsx",
    "apps/web/src/app/client/onboarding/page.tsx",
    "apps/web/src/app/client/register/page.tsx",
    "apps/web/src/app/onboarding/page.tsx",
    "apps/web/src/app/setup/page.tsx"
  ];
  const removedApiRoutes = [
    "apps/web/src/app/api/auth/setup/route.ts",
    "apps/web/src/app/api/auth/setup/form/route.ts",
    "apps/web/src/app/api/client/register/route.ts",
    "apps/web/src/app/api/client/register/form/route.ts",
    "apps/web/src/app/api/clients/route.ts",
    "apps/web/src/app/api/copilot/route.ts",
    "apps/web/src/app/api/intelligence/enrich/route.ts",
    "apps/web/src/app/api/meta/leads/route.ts",
    "apps/web/src/app/api/qualification/score/route.ts",
    "apps/web/src/app/api/whatsapp/reply/route.ts",
    "apps/web/src/app/api/workflows/run/route.ts"
  ];

  for (const page of expectedPages) {
    assert.equal(await fileExists(join(root, page)), true, `${page} should exist in the clean Leadsy surface`);
  }

  for (const page of removedPages) {
    assert.equal(await fileExists(join(root, page)), false, `${page} should be removed from the user-facing surface`);
  }

  for (const route of removedApiRoutes) {
    assert.equal(await fileExists(join(root, route)), false, `${route} should not ship in the clean MVP API surface`);
  }

  const appShell = await readFile(join(root, "apps/web/src/components/app-shell.tsx"), "utf8");
  for (const route of ["/app/connect", "/app/leads", "/app/magnet", "/app/worker"]) {
    assert(appShell.includes(route), `app nav should include ${route}`);
  }
  for (const route of ["/app/analytics", "/app/capture", "/app/clients", "/app/crm", "/app/inbox", "/app/meta", "/app/workflows"]) {
    assert(!appShell.includes(route), `app nav should not include ${route}`);
  }
  assert(appShell.includes("Meta WhatsApp connection"), "workspace header should frame connection as Meta onboarding");
  assert(appShell.includes("hasMetaConnection"), "workspace header should receive the saved Meta connection state");
  assert(appShell.includes("Connected"), "workspace header should show connected Meta state after OAuth");
  assert(!appShell.includes("WhatsApp leads · browser worker"), "workspace header should not merge Meta connection with worker ops");
  assert(!appShell.includes("CopilotDock"), "copilot dock should not be part of the clean user-facing shell");

  const loginForm = await readFile(join(root, "apps/web/src/components/login-form.tsx"), "utf8");
  assert(loginForm.includes("/api/auth/google"), "login/signup page should expose Google signup");
  assert(loginForm.includes("Continue with Google"), "login/signup page should label the Google signup action");
  assert(!loginForm.includes("/setup"), "login/signup page should not expose setup as a separate user-facing page");
  assert(!loginForm.includes("/client/register"), "login/signup page should not expose client registration");

  const loginPage = await readFile(join(root, "apps/web/src/app/login/page.tsx"), "utf8");
  for (const adminCopy of ["owner", "Railway", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "local access"]) {
    assert(!loginPage.includes(adminCopy), `login page should not expose admin copy: ${adminCopy}`);
  }

  const landingPage = await readFile(join(root, "apps/web/src/app/page.tsx"), "utf8");
  assert(landingPage.includes("/login?next=/app/leads"), "landing page should enter the leads page");
  assert(landingPage.includes("/extension"), "landing page should link to the extension download page");
  assert(!landingPage.includes("/onboarding"), "landing page should not link to old onboarding");
  assert(!landingPage.includes("/app/workflows"), "landing page should not link to old workflows");
  for (const adminCopy of ["app secret", "verify tokens", "Railway", "GOOGLE_CLIENT", "META_APP_SECRET"]) {
    assert(!landingPage.includes(adminCopy), `landing page should not expose admin copy: ${adminCopy}`);
  }

  const connectPage = await readFile(join(root, "apps/web/src/app/app/connect/page.tsx"), "utf8");
  assert(connectPage.includes("listMetaOAuthConnections"), "connection page should read saved Meta OAuth connections");
  assert(connectPage.includes("Connect Meta / WhatsApp"), "connection config should lead with customer Meta onboarding");
  assert(connectPage.includes("Connected"), "connection config should show connected state after OAuth");
  assert(connectPage.includes("Reconnect Meta account"), "connection config should allow reconnecting without pretending setup is missing");
  assert(connectPage.includes("Advanced developer details"), "connection config should demote webhook details to an advanced section");
  assert(connectPage.includes("/api/meta/whatsapp/webhook"), "connection config may expose the WhatsApp webhook callback only as advanced details");
  assert(!connectPage.includes("Connect WhatsApp leads and the browser worker"), "connection config should not present worker setup as the main Meta connection flow");
  assert(!connectPage.includes("Meta callback"), "connection config should not lead with raw Meta callback setup");
  assert(!connectPage.includes("embedded signup URL"), "connection config should not expose Meta setup jargon in the customer workspace");
  for (const adminCopy of ["META_WHATSAPP_WEBHOOK_VERIFY_TOKEN", "META_APP_SECRET", "App secret", "EnvBadge", "missing"]) {
    assert(!connectPage.includes(adminCopy), `connection config should not expose admin ops copy: ${adminCopy}`);
  }

  const leadsPage = await readFile(join(root, "apps/web/src/app/app/leads/page.tsx"), "utf8");
  assert(leadsPage.includes("listMetaWhatsAppConversations"), "leads page should read aggregated WhatsApp conversations");
  assert(leadsPage.includes("All WhatsApp conversations"), "leads page should track all conversations, not only ad leads");
  assert(leadsPage.includes("web.whatsapp.com/send"), "lead rows should open the WhatsApp Web conversation");
  assert(leadsPage.includes("Exclude contact"), "leads page should let non-lead contacts be excluded");
  assert(leadsPage.includes("Restore as lead"), "excluded contacts should be restorable without deleting the conversation");
  assert(!leadsPage.includes("Incoming WhatsApp leads from Meta ads"), "leads page should not imply only Meta ad leads are tracked");
  for (const adminCopy of ["Raw webhook message", "rawPreview", "message.raw"]) {
    assert(!leadsPage.includes(adminCopy), `leads page should not expose admin/raw webhook copy: ${adminCopy}`);
  }

  const magnetPage = await readFile(join(root, "apps/web/src/app/app/magnet/page.tsx"), "utf8");
  const leadMagnetLab = await readFile(join(root, "apps/web/src/components/lead-magnet-lab.tsx"), "utf8");
  const leadsTableIndex = leadMagnetLab.indexOf('data-testid="lead-magnet-leads-table"');
  const briefFormIndex = leadMagnetLab.indexOf('data-testid="lead-brief-form"');
  assert(leadsTableIndex >= 0, "Lead Magnet should expose a stable leads-table section");
  assert(briefFormIndex >= 0, "Lead Magnet should keep the search form");
  assert(leadsTableIndex < briefFormIndex, "Lead Magnet leads table should appear before the search form");
  for (const adminCopy of ["agency owner workflow", "owner summary"]) {
    assert(!magnetPage.includes(adminCopy), `magnet page should not expose admin copy: ${adminCopy}`);
    assert(!leadMagnetLab.includes(adminCopy), `magnet component should not expose admin copy: ${adminCopy}`);
  }

  const workerPage = await readFile(join(root, "apps/web/src/app/app/worker/page.tsx"), "utf8");
  assert(workerPage.includes("ExtensionTaskBoard"), "worker page should keep the extension task board");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
