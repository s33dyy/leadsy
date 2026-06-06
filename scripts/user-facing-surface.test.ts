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

  for (const route of [
    "apps/web/src/app/api/qualification/profile/route.ts",
    "apps/web/src/app/api/crm/assignment-rules/route.ts",
    "apps/web/src/app/api/crm/follow-up-tasks/route.ts"
  ]) {
    assert.equal(await fileExists(join(root, route)), true, `${route} should exist for WhatsApp CRM qualification V1`);
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
  assert(appShell.includes('label: "Dashboard"'), "workspace nav should include Dashboard");
  assert(appShell.includes('label: "Leads"'), "workspace nav should include Leads");
  assert(appShell.includes('label: "Inbox"'), "workspace nav should include Inbox");
  assert(appShell.includes('label: "Automations"'), "workspace nav should include Automations");
  assert(appShell.includes('label: "Team"'), "workspace nav should include Team");
  assert(appShell.includes('label: "Analytics"'), "workspace nav should include Analytics");
  assert(appShell.includes('label: "Settings"'), "workspace nav should include Settings");
  assert(!appShell.includes('label: "CRM"'), "workspace nav should no longer present CRM as a primary product label");
  assert(!appShell.includes('label: "Workers"'), "workspace nav should no longer present Workers as a primary product label");
  assert(!appShell.includes('label: "Communications"'), "workspace nav should no longer present Communications as a primary product label");
  assert(!appShell.includes("4 workers running"), "workspace header should not show fake worker counts");
  assert(!appShell.includes("queue {82 + pendingApprovalCount}"), "workspace header should not show fake queue counts");
  assert(appShell.includes("hasMetaConnection"), "workspace shell should receive the saved Meta connection state");
  assert(appShell.includes("Meta connection needs attention"), "workspace notifications should still surface missing Meta setup");
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
  assert(authPage.includes("lead capture, qualification, and conversion workspace"), "auth page should frame access around lead capture, qualification, and conversion");
  for (const fakePreview of ['value: "38"', 'value: "14"', 'delta: "+12"', 'delta: "+4"', "4 workers running · queue 82", "7 items need your eyes", "[38, 27, 18, 11]"]) {
    assert(!authPage.includes(fakePreview), `auth preview should not include fake metric ${fakePreview}`);
  }

  const landingPage = await readFile(join(root, "apps/web/src/app/page.tsx"), "utf8");
  assert(landingPage.includes("/login?next=/app/leads"), "landing page should enter the leads page");
  assert(landingPage.includes("/extension"), "landing page should link to the extension download page");
  assert(landingPage.includes("AI Lead Capture, Qualification & Conversion Platform"), "landing page should use the Phase 1 product identity");
  assert(landingPage.includes("Capture leads"), "landing page should lead with lead capture");
  assert(landingPage.includes("Qualify conversations"), "landing page should highlight AI qualification");
  assert(landingPage.includes("Convert with follow-up"), "landing page should highlight conversion follow-up");
  assert(!landingPage.includes("AI Lead Intelligence & Operations Platform"), "landing page should not use the old lead intelligence identity");
  assert(!landingPage.includes("Research prospects"), "landing page should not lead with prospect research");
  assert(!landingPage.includes("Build lead knowledge"), "landing page should not market lead knowledge as the product");
  assert(landingPage.includes("Draft with approval"), "landing page should keep outreach human-approved");
  for (const fakeLandingMetric of ["knowledge records", "operator tasks", "autonomous sends"]) {
    assert(!landingPage.includes(fakeLandingMetric), `landing page should not show fake ${fakeLandingMetric} counters`);
  }
  const landingScene = await readFile(join(root, "apps/web/src/components/landing-scene.tsx"), "utf8");
  for (const fakeSceneMetric of ['["Connect", "1"', '["Leads", "0"', '["Knowledge", "0"', '["Worker", "0"', "0 records", "0 intent"]) {
    assert(!landingScene.includes(fakeSceneMetric), `landing scene should not show fake preview metric ${fakeSceneMetric}`);
  }
  for (const oldSceneLabel of ["Worker handoff", "Knowledge base", "Worker Chat"]) {
    assert(!landingScene.includes(oldSceneLabel), `landing scene should not foreground old ${oldSceneLabel} positioning`);
  }
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
  assert(leadsPage.includes("Lead capture, qualification, and conversion"), "leads page should position around the target product workflow");
  assert(leadsPage.includes("Leads workspace"), "leads page should present Leads as the main workspace");
  assert(leadsPage.includes("Lead → Conversation → Qualification → Action"), "Phase 3 lead workspace should foreground the conversion flow");
  assert(leadsPage.includes("15-second lead brief"), "selected lead should expose a fast lead detail brief before admin controls");
  for (const goldenField of ["Current status", "Last conversation", "Qualification summary", "Owner", "Follow-up status"]) {
    assert(leadsPage.includes(goldenField), `selected lead brief should expose ${goldenField}`);
  }
  assert(leadsPage.includes("AI qualification"), "leads page should expose AI qualification state");
  assert(leadsPage.includes("Qualification fields"), "selected lead details should expose qualification fields");
  assert(leadsPage.includes("Lead source"), "selected lead details should expose CRM lead source");
  assert(leadsPage.includes("Campaign ID"), "selected lead details should expose campaign/source metadata");
  assert(leadsPage.includes("Assignee"), "selected lead details should expose assignee controls");
  assert(leadsPage.includes("Pipeline status"), "selected lead details should expose product-facing pipeline status controls");
  assert(leadsPage.includes("productPipelineStatusForLead"), "leads page should use the product-facing status mapping");
  assert(leadsPage.includes("Conversation chat"), "leads page should present comms as a chat transcript");
  assert(leadsPage.includes('data-testid="lead-comms-chat"'), "comms tab should expose a stable chat transcript pane");
  assert(leadsPage.includes('data-testid="lead-chat-bubble"'), "comms tab should render messages as chat bubbles");
  assert(leadsPage.includes("justify-end"), "outbound comms should be aligned like sent chat bubbles");
  assert(!leadsPage.includes("Activity timeline"), "comms tab should no longer present messages as a generic activity timeline");
  assert(leadsPage.includes("Next action"), "leads page should make next operational action visible");
  assert(leadsPage.includes("Needs reply"), "leads page should separate conversations that need a response");
  assert(!leadsPage.includes("<LeadTaskGenerateMenu"), "selected lead header should not expose the AI task generation menu");
  assert(leadsPage.includes("SelectedLeadTasks"), "tasks tab should still expose selected lead task controls");
  assert(leadsPage.includes("/api/crm/follow-up-tasks"), "tasks tab should create lightweight CRM follow-up tasks");
  assert(leadsPage.includes("CRM follow-ups"), "tasks tab should label CRM follow-ups separately from browser-send tasks");
  assert(leadsPage.includes("Follow-up task"), "tasks tab should include lightweight follow-up task controls");
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
  assert(selectedLeadTasks.includes("LeadTaskGenerateMenu"), "tasks tab should reuse the selected lead AI generation menu");
  assert(selectedLeadTasks.includes("AI Generate tasks"), "selected lead tasks tab should show the AI Generate tasks control");
  assert(selectedLeadTasks.includes("Auto-detect best task"), "task generation should auto-detect the best task");
  assert(!selectedLeadTasks.includes("Intro task"), "task generation should not ask operators to choose intro manually");
  assert(!selectedLeadTasks.includes("Follow-up task"), "task generation should not ask operators to choose follow-up manually");
  assert(!selectedLeadTasks.includes("Reply to inbound"), "task generation should not ask operators to choose reply-to-inbound manually");
  assert(selectedLeadTasks.includes("/api/extension/tasks/generate"), "selected lead tasks should queue extension-assisted reply work");
  assert(selectedLeadTasks.includes("leadIds: [leadId]"), "selected lead extension queueing should target only the selected lead");
  assert(selectedLeadTasks.includes('type: "auto_detect"'), "selected lead task generation should delegate task type detection to the server");
  assert(selectedLeadTasks.includes("Generate an extension task for this lead"), "selected lead tasks should explain AI task generation is selected-lead scoped");
  assert(selectedLeadTasks.includes("No extension = log manually"), "selected lead tasks should keep the no-extension tracking boundary visible");
  assert(leadsPage.includes("All Meta and browser conversations"), "leads page should track all Meta and extension conversations");
  assert(leadsPage.includes("Official webhook"), "lead comms should badge official Meta webhook messages");
  assert(leadsPage.includes("Browser capture"), "lead comms should badge browser extension captured messages");
  assert(leadsPage.includes("Open conversation"), "lead rows should open channel-specific conversations when possible");
  assert(leadsPage.includes("Exclude lead"), "leads page should let non-lead contacts be excluded");
  assert(leadsPage.includes("Restore as lead"), "excluded contacts should be restorable without deleting the conversation");
  assert(leadsPage.includes("/api/leads/edit"), "leads page should let users edit lead details and knowledge fields");
  assert(leadsPage.includes("/api/leads/delete"), "leads page should let users soft-delete/archive lead records");
  assert(leadsPage.includes("/api/leads/message-status"), "leads page should let users hide or restore individual communication records");
  assert(leadsPage.includes("Edit lead"), "selected lead details should expose edit controls");
  assert(leadsPage.includes("Archive lead"), "selected lead details should expose soft-delete controls");
  assert(leadsPage.includes('data-testid="lead-chat-hide-message"'), "chat bubbles should expose soft-delete controls for comm records");
  assert(!leadsPage.includes("Incoming WhatsApp leads from Meta ads"), "leads page should not imply only Meta ad leads are tracked");

  const communicationsPage = await readFile(join(root, "apps/web/src/app/app/communications/page.tsx"), "utf8");
  assert(communicationsPage.includes("conversion workspace"), "Inbox should be positioned as a conversion workspace, not a generic messaging app");
  assert(communicationsPage.includes("conversionUrgency"), "Inbox should sort conversations by conversion urgency");
  assert(communicationsPage.includes("leadBackedIds"), "Inbox should avoid duplicating lead-backed conversations as separate raw inbox items");
  assert(communicationsPage.includes("tab=comms"), "Inbox should route lead-backed conversations to the selected lead comms tab");
  assert(communicationsPage.includes("Suggested next action"), "Inbox detail should show a suggested next action when lead context exists");
  assert(communicationsPage.includes("Owner"), "Inbox detail should show the lead owner when lead context exists");
  assert(communicationsPage.includes("Qualification"), "Inbox detail should show qualification context before advanced messaging features");

  for (const adminCopy of ["Raw webhook message", "rawPreview", "message.raw"]) {
    assert(!leadsPage.includes(adminCopy), `leads page should not expose admin/raw webhook copy: ${adminCopy}`);
  }

  const magnetPage = await readFile(join(root, "apps/web/src/app/app/magnet/page.tsx"), "utf8");
  assert(magnetPage.includes("redirect(\"/app/leads"), "archived Magnet page should redirect to Leads");
  assert(!magnetPage.includes("LeadMagnetLab"), "archived Magnet page should not render the old lab");

  const rootPackage = await readFile(join(root, "package.json"), "utf8");
  assert(rootPackage.includes("AI Lead Capture, Qualification & Conversion Platform"), "package metadata should use the Phase 1 product identity");
  assert(!rootPackage.includes("Lead Intelligence"), "package metadata should not use the old lead intelligence identity");
  assert(!rootPackage.includes("Revenue OS"), "package metadata should not position Leadsy as Revenue OS");

  const rootLayout = await readFile(join(root, "apps/web/src/app/layout.tsx"), "utf8");
  assert(rootLayout.includes("AI Lead Capture, Qualification & Conversion Platform"), "app metadata should use the Phase 1 product identity");
  assert(!rootLayout.includes("Lead Intelligence"), "app metadata should not use the old lead intelligence identity");
  assert(!rootLayout.includes("Revenue OS"), "app metadata should not position Leadsy as Revenue OS");

  const dashboardPage = await readFile(join(root, "apps/web/src/app/app/page.tsx"), "utf8");
  assert(dashboardPage.includes("New leads · 24h"), "dashboard should show compact new lead volume");
  assert(dashboardPage.includes("Lead sources"), "dashboard should show source split from lead records");
  assert(dashboardPage.includes("Qualification funnel"), "dashboard should show the Lovable qualification funnel");
  assert(dashboardPage.includes("Follow-up and automation activity"), "dashboard should show real follow-up and automation activity");
  assert(dashboardPage.includes("Needs you"), "dashboard should expose the right-side approval rail");
  assert(dashboardPage.includes("productPipelineStatusForLead"), "dashboard counts should use product-facing pipeline status mapping");
  assert(!dashboardPage.includes("convertedCount = 0"), "dashboard should not hardcode a fake converted count");
  assert(!dashboardPage.includes("delta:"), "dashboard metric cards should not display decorative fake deltas");
  assert(dashboardPage.includes("leadSource"), "dashboard counts should use stored lead source fields");

  const workerPage = await readFile(join(root, "apps/web/src/app/app/worker/page.tsx"), "utf8");
  const extensionPairing = await readFile(join(root, "apps/web/src/components/extension-pairing.tsx"), "utf8");
  const extensionTokenRoute = await readFile(join(root, "apps/web/src/app/api/extension/tokens/route.ts"), "utf8");
  assert(workerPage.includes("ExtensionTaskBoard"), "worker page should keep the extension task board");
  assert(workerPage.includes("listExtensionChannelMonitorHealth"), "worker page should derive dashboard-visible channel monitor health");
  assert(workerPage.includes("Hybrid channel monitor"), "worker page should explain the V4 hybrid monitor");
  assert(workerPage.includes("Official webhook"), "worker page should show official webhook as the preferred source");
  assert(workerPage.includes("Browser extension fallback"), "worker page should show browser extension fallback status");
  assert(extensionPairing.includes("Delete token"), "worker pairing should expose a delete control for worker tokens");
  assert(extensionPairing.includes('method: "DELETE"'), "worker pairing delete control should call the token delete API");
  assert(extensionPairing.includes("tokenId"), "worker pairing delete control should send the selected token id");
  assert(extensionTokenRoute.includes("export async function DELETE"), "extension token API should support deleting worker tokens");
  assert(extensionTokenRoute.includes("deleteExtensionToken"), "extension token API should revoke worker tokens through the store");
  const extensionTaskBoard = await readFile(join(root, "apps/web/src/components/extension-task-board.tsx"), "utf8");
  assert(extensionTaskBoard.includes("Edit task"), "worker board should expose task edit controls");
  assert(extensionTaskBoard.includes("Delete task"), "worker board should expose soft-delete controls");
  assert(extensionTaskBoard.includes("postponed"), "worker board should show postponed tasks");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
