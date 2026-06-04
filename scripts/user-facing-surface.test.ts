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
    "apps/web/src/app/signup/page.tsx",
    "apps/web/src/app/forgot-password/page.tsx",
    "apps/web/src/app/extension/page.tsx",
    "apps/web/src/app/app/connect/page.tsx",
    "apps/web/src/app/app/leads/page.tsx",
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
  for (const route of ["/app/connect", "/app/leads", "/app/worker"]) {
    assert(appShell.includes(route), `app nav should include ${route}`);
  }
  for (const route of ["/app/analytics", "/app/capture", "/app/clients", "/app/crm", "/app/inbox", "/app/magnet", "/app/meta", "/app/workflows"]) {
    assert(!appShell.includes(route), `app nav should not include ${route}`);
  }
  assert(appShell.includes("Meta messaging connection"), "workspace header should frame connection as Meta messaging onboarding");
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
  const authPage = await readFile(join(root, "apps/web/src/components/auth-page.tsx"), "utf8");
  for (const adminCopy of ["owner", "Railway", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "local access"]) {
    assert(!loginPage.includes(adminCopy), `login page should not expose admin copy: ${adminCopy}`);
    assert(!authPage.includes(adminCopy), `auth page should not expose admin copy: ${adminCopy}`);
  }
  assert(authPage.includes("lead intelligence workspace"), "auth page should frame access around lead intelligence");

  const landingPage = await readFile(join(root, "apps/web/src/app/page.tsx"), "utf8");
  assert(landingPage.includes("/login?next=/app/leads"), "landing page should enter the leads page");
  assert(landingPage.includes("/extension"), "landing page should link to the extension download page");
  assert(landingPage.includes("AI Lead Intelligence & Operations Platform"), "landing page should use the Step 2 product identity");
  assert(landingPage.includes("Research prospects"), "landing page should lead with prospect research");
  assert(landingPage.includes("Build lead knowledge"), "landing page should highlight lead knowledge");
  assert(landingPage.includes("Generate operator tasks"), "landing page should highlight human operator tasks");
  assert(landingPage.includes("Draft with approval"), "landing page should keep outreach human-approved");
  assert(!landingPage.includes("Leadsy Lead OS"), "landing page should not position Leadsy as a Lead OS");
  assert(!landingPage.includes("lead operating system"), "landing page should not position Leadsy as an operating system");
  assert(!landingPage.includes("/app/magnet"), "landing page should not link to archived Magnet");
  assert(!landingPage.includes("Lead Magnet"), "landing page should not market archived Lead Magnet");
  assert(!landingPage.includes("/onboarding"), "landing page should not link to old onboarding");
  assert(!landingPage.includes("/app/workflows"), "landing page should not link to old workflows");
  for (const adminCopy of ["app secret", "verify tokens", "Railway", "GOOGLE_CLIENT", "META_APP_SECRET"]) {
    assert(!landingPage.includes(adminCopy), `landing page should not expose admin copy: ${adminCopy}`);
  }

  const connectPage = await readFile(join(root, "apps/web/src/app/app/connect/page.tsx"), "utf8");
  assert(connectPage.includes("listMetaOAuthConnections"), "connection page should read saved Meta OAuth connections");
  assert(connectPage.includes("Connect Meta messaging"), "connection config should lead with all-channel customer Meta onboarding");
  for (const channel of ["WhatsApp", "Instagram", "Facebook"]) {
    assert(connectPage.includes(channel), `connection config should show ${channel} as a first-class Meta channel`);
  }
  assert(connectPage.includes("channelAssetsForConnection"), "connection config should derive per-channel asset readiness from saved Meta connection records");
  assert(connectPage.includes("Connected"), "connection config should show connected state after OAuth");
  assert(connectPage.includes("Reconnect Meta account"), "connection config should allow reconnecting without pretending setup is missing");
  assert(connectPage.includes("Facebook Login is currently unavailable"), "connection config should explain the common Meta feature-unavailable state");
  assert(connectPage.includes("Configure Meta later from Profile Settings"), "connection config should give users a safe skip-later path");
  assert(connectPage.includes("Steps to connect Meta"), "connection config should show customer-friendly Meta setup steps");
  assert(connectPage.includes("Skip Meta for later"), "connection config should include skip-later guidance");
  assert(connectPage.includes("Advanced developer details"), "connection config should demote webhook details to an advanced section");
  assert(connectPage.includes("/api/meta/whatsapp/webhook"), "connection config may expose the WhatsApp webhook callback only as advanced details");
  assert(!connectPage.includes("Connect WhatsApp leads and the browser worker"), "connection config should not present worker setup as the main Meta connection flow");
  assert(!connectPage.includes("Meta callback"), "connection config should not lead with raw Meta callback setup");
  assert(!connectPage.includes("embedded signup URL"), "connection config should not expose Meta setup jargon in the customer workspace");
  for (const adminCopy of ["META_WHATSAPP_WEBHOOK_VERIFY_TOKEN", "META_APP_SECRET", "App secret", "EnvBadge", "missing"]) {
    assert(!connectPage.includes(adminCopy), `connection config should not expose admin ops copy: ${adminCopy}`);
  }

  const leadsPage = await readFile(join(root, "apps/web/src/app/app/leads/page.tsx"), "utf8");
  const manualLeadIntake = await readFile(join(root, "apps/web/src/components/manual-lead-intake.tsx"), "utf8");
  const leadSurface = `${leadsPage}\n${manualLeadIntake}`;
  assert(leadsPage.includes("listLeadKnowledgeRecords"), "leads page should read unified lead knowledge records");
  assert.equal(await fileExists(join(root, "apps/web/src/app/api/leads/manual/route.ts")), true, "leads page should have a dedicated manual lead create endpoint");
  assert(leadsPage.includes("/api/leads/manual"), "leads page should create manual leads through the dedicated endpoint");
  assert(leadSurface.includes("Add Lead"), "leads page should expose a manual Add Lead entry point");
  assert(leadSurface.includes("role=\"dialog\""), "manual Add Lead should open as modal/drawer UI");
  assert(leadSurface.includes("All questions are skippable"), "manual lead AI-style intake questions should be skippable");
  assert(leadSurface.includes("Question type: MCQ"), "manual lead intake should include MCQ guidance");
  assert(leadSurface.includes("Question type: Number"), "manual lead intake should include numerical guidance");
  assert(leadSurface.includes("Related lead"), "manual lead intake should allow connecting context to other leads");
  assert(leadSurface.includes("Additional emails"), "manual lead intake should collect optional extra emails as knowledge facts");
  assert(leadsPage.includes("/api/leads/manual-message"), "leads page should allow manual communication logging");
  assert(leadsPage.includes("/api/leads/status"), "leads page should allow lead-level exclude and restore");
  assert(leadsPage.includes("/api/leads/conversation-status"), "leads page should allow conversation-level knowledge exclusion");
  assert(leadsPage.includes("Lead Intelligence"), "leads page should be positioned around lead intelligence");
  assert(leadsPage.includes("Knowledge workspace"), "leads page should make knowledge primary over CRM copy");
  assert(!leadsPage.includes("CRM pipeline"), "leads page should not be positioned as CRM-first");
  assert(leadsPage.includes("Activity timeline"), "leads page should expose logged communication activity");
  assert(leadsPage.includes("Next action"), "leads page should make next operational action visible");
  assert(leadsPage.includes("Needs reply"), "leads page should separate conversations that need a response");
  assert(leadsPage.includes("Manual reply handoff"), "selected lead comms should expose a manual reply handoff");
  assert(leadsPage.includes("Leadsy tracks this. You send it."), "manual reply workflow should make no-extension sending boundaries explicit");
  assert(leadsPage.includes("Open WhatsApp Web"), "manual reply workflow should offer a WhatsApp handoff when a phone exists");
  assert(leadsPage.includes("Open email client"), "manual reply workflow should offer an email handoff when an email exists");
  assert(leadsPage.includes("Log outbound after sending"), "manual reply workflow should guide operators to log external replies");
  assert(leadsPage.includes("data-testid=\"lead-list-pane\""), "leads page should expose a stable lead list pane");
  assert(leadsPage.includes("data-testid=\"lead-workspace-pane\""), "leads page should expose a stable selected-record workspace");
  assert(leadsPage.includes("Details"), "selected lead workspace should expose a Details tab");
  assert(leadsPage.includes("Comms"), "selected lead workspace should expose a Comms tab");
  assert(leadsPage.includes("Tasks"), "selected lead workspace should expose a Tasks tab");
  assert(leadsPage.includes("commChannel"), "selected lead comms tab should be controlled by channel params");
  for (const label of ["WhatsApp", "Instagram", "Facebook", "Email", "Call Notes", "Browser Chat", "Manual"]) {
    assert(leadsPage.includes(label), `comms tab should expose ${label}`);
  }
  assert(leadsPage.includes("Selected lead tasks"), "tasks tab should focus on selected lead tasks");
  assert(leadsPage.includes("tasksForLead"), "leads page should filter task records by selected lead");
  const selectedLeadTasks = await readFile(join(root, "apps/web/src/components/selected-lead-tasks.tsx"), "utf8");
  assert(selectedLeadTasks.includes("/api/extension/tasks/generate"), "selected lead tasks should queue extension-assisted reply work");
  assert(selectedLeadTasks.includes("leadIds: [leadId]"), "selected lead extension queueing should target only the selected lead");
  assert(selectedLeadTasks.includes("Queue extension follow-up"), "selected lead tasks should expose a follow-up queue action");
  assert(selectedLeadTasks.includes("No extension = log manually"), "selected lead tasks should keep the no-extension tracking boundary visible");
  assert(leadsPage.includes("All Meta and browser conversations"), "leads page should track all Meta and extension conversations");
  assert(leadsPage.includes("Open conversation"), "lead rows should open channel-specific conversations when possible");
  assert(leadsPage.includes("Exclude lead"), "leads page should let non-lead contacts be excluded");
  assert(leadsPage.includes("Restore as lead"), "excluded contacts should be restorable without deleting the conversation");
  assert(leadsPage.includes("/api/leads/edit"), "leads page should let users edit lead details and knowledge fields");
  assert(leadsPage.includes("/api/leads/delete"), "leads page should let users soft-delete/archive lead records");
  assert(leadsPage.includes("/api/leads/message-status"), "leads page should let users hide or restore individual communication records");
  assert(leadsPage.includes("Edit lead"), "selected lead details should expose edit controls");
  assert(leadsPage.includes("Archive lead"), "selected lead details should expose soft-delete controls");
  assert(leadsPage.includes("Hide from timeline"), "communication timeline should expose soft-delete controls for comm records");
  assert(!leadsPage.includes("Incoming WhatsApp leads from Meta ads"), "leads page should not imply only Meta ad leads are tracked");
  for (const adminCopy of ["Raw webhook message", "rawPreview", "message.raw"]) {
    assert(!leadsPage.includes(adminCopy), `leads page should not expose admin/raw webhook copy: ${adminCopy}`);
  }

  const magnetPage = await readFile(join(root, "apps/web/src/app/app/magnet/page.tsx"), "utf8");
  assert(magnetPage.includes("redirect(\"/app/leads"), "archived Magnet page should redirect to Leads");
  assert(!magnetPage.includes("LeadMagnetLab"), "archived Magnet page should not render the old lab");

  const rootPackage = await readFile(join(root, "package.json"), "utf8");
  assert(rootPackage.includes("AI Lead Intelligence & Operations Platform"), "package metadata should use the Step 2 product identity");
  assert(!rootPackage.includes("Revenue OS"), "package metadata should not position Leadsy as Revenue OS");

  const rootLayout = await readFile(join(root, "apps/web/src/app/layout.tsx"), "utf8");
  assert(rootLayout.includes("AI Lead Intelligence & Operations Platform"), "app metadata should use the Step 2 product identity");
  assert(!rootLayout.includes("Revenue OS"), "app metadata should not position Leadsy as Revenue OS");

  const workerPage = await readFile(join(root, "apps/web/src/app/app/worker/page.tsx"), "utf8");
  assert(workerPage.includes("ExtensionTaskBoard"), "worker page should keep the extension task board");
  const extensionTaskBoard = await readFile(join(root, "apps/web/src/components/extension-task-board.tsx"), "utf8");
  assert(extensionTaskBoard.includes("Edit task"), "worker board should expose task edit controls");
  assert(extensionTaskBoard.includes("Delete task"), "worker board should expose soft-delete controls");
  assert(extensionTaskBoard.includes("postponed"), "worker board should show postponed tasks");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
