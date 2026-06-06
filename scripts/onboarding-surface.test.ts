import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function fileExists(path: string) {
  try {
    await stat(join(root, path));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  assert.equal(await fileExists("apps/web/src/components/onboarding-wizard.tsx"), true, "first-login onboarding wizard should exist");
  assert.equal(await fileExists("apps/web/src/app/api/onboarding/route.ts"), true, "onboarding progress API should exist");
  assert.equal(await fileExists("apps/web/src/app/api/onboarding/options/route.ts"), true, "AI-assisted onboarding option API should exist");
  assert.equal(await fileExists("apps/web/src/lib/workspace-whatsapp-sender-store.ts"), true, "workspace WhatsApp sender registry should exist");

  const authStore = await read("apps/web/src/lib/auth-store.ts");
  assert(authStore.includes("onboardingCompletedAt?"), "auth users should store onboarding completion without a migration");
  assert(authStore.includes("saveUserOnboarding"), "auth store should expose a first-login onboarding persistence helper");
  assert(authStore.includes("completeUserOnboarding"), "auth store should expose an onboarding completion helper");

  const security = await read("packages/security/src/index.ts");
  assert(security.includes("onboardingCompletedAt?"), "session users should carry onboarding completion state");

  const auth = await read("apps/web/src/lib/auth.ts");
  assert(auth.includes("onboardingCompletedAt: user.onboardingCompletedAt"), "session conversion should expose onboarding completion");
  assert(auth.includes("onboardingProfile: user.onboardingProfile"), "session conversion should expose saved onboarding progress");

  const appShell = await read("apps/web/src/components/app-shell.tsx");
  assert(appShell.includes("OnboardingWizard"), "app shell should render onboarding from inside the authenticated workspace");
  assert(appShell.includes("!session.onboardingCompletedAt"), "onboarding should only appear for users who have not completed it");
  assert(appShell.includes("onboardingReminder"), "incomplete onboarding should contribute to the notification badge");

  const wizard = await read("apps/web/src/components/onboarding-wizard.tsx");
  for (const label of ["About You", "About Your Business", "Your Target Customer", "Completion Score"]) {
    assert(wizard.includes(label), `onboarding wizard should include ${label}`);
  }
  assert(!wizard.includes("Integration Verification"), "onboarding should not include an integration verification step");
  for (const label of ["Business name", "Industry", "Team size", "Business phone (optional)", "Lead sources", "Assignment preferences", "Follow-up preferences"]) {
    assert(wizard.includes(label), `onboarding wizard should collect ${label}`);
  }
  for (const removedField of ["Business website URL", "Services/products offered", "Geography / target markets"]) {
    assert(!wizard.includes(removedField), `onboarding should not overwhelm users with ${removedField}`);
  }
  for (const targetLabel of ["Customer segment", "Sales cycle"]) {
    assert(wizard.includes(targetLabel), `shortened target profile should collect ${targetLabel}`);
  }
  for (const removedTargetQuestion of ["What company size do you typically sell to?", "What is your average deal size?", "What is your typical sales cycle?"]) {
    assert(!wizard.includes(removedTargetQuestion), `target profile labels should not be question prompts like ${removedTargetQuestion}`);
  }
  assert(!wizard.includes("whatsappNumber"), "onboarding should not persist or render a user-entered WhatsApp sender number field");
  assert(!wizard.includes("Twilio connected?"), "onboarding should not ask end users to connect Twilio");
  assert(wizard.includes("Leadsy assigns a dedicated WhatsApp lead number"), "onboarding should explain Leadsy-assigned sender provisioning");
  assert(wizard.includes("Your WhatsApp Number is:"), "completion should show the assigned WhatsApp number when provisioning succeeds");
  assert(wizard.includes("Your WhatsApp Number is being prepared"), "completion should show an honest pending state when provisioning is not ready");
  assert(wizard.includes("WhatsApp approval status:"), "completion should separate WhatsApp approval status from assigned number display");
  assert(wizard.includes("Your Leadsy number is assigned"), "completion toast should confirm number assignment when onboarding receives a Twilio number");
  assert(wizard.includes("Refresh AI options"), "onboarding should let users refresh AI-generated chip options");
  assert(wizard.includes("Add custom"), "onboarding should preserve compact custom option entry");
  assert(wizard.includes('whatsappTransport: "leadsy_assigned_twilio"'), "workspace configuration should record Leadsy-assigned WhatsApp transport");
  assert(wizard.includes('whatsappAssignment: "leadsy_assigned"'), "workspace configuration should record assigned sender state");
  assert(wizard.includes("workspaceConfiguration"), "onboarding should save CRM setup answers to workspace configuration");
  assert(wizard.includes("/api/onboarding"), "wizard should save progress through the onboarding API");
  assert(wizard.includes("/api/onboarding/options"), "wizard should request AI-assisted onboarding options");
  for (const answer of ["Consumers", "Small businesses", "Mid-market", "Enterprise", "Parents/students", "Same day", "1-7 days", "2-4 weeks", "1-3 months"]) {
    assert(wizard.includes(answer), `target customer chips should include answer option ${answer}`);
  }
  for (const questionChip of ["What’s your main goal?", "What does a “won” deal mean?", "Where do most leads come from?", "Who should new leads go to?"]) {
    assert(!wizard.includes(questionChip), `target customer chips should not include question option ${questionChip}`);
  }
  const onboardingRoute = await read("apps/web/src/app/api/onboarding/route.ts");
  assert(onboardingRoute.includes("ensureWorkspaceWhatsAppSender"), "onboarding API should create a not-started workspace sender during progress saves");
  assert(onboardingRoute.includes("provisionLeadsyAssignedWhatsAppSender"), "onboarding completion should trigger live Leadsy WhatsApp sender provisioning");
  assert(
    /fetch\("\/api\/onboarding",\s*{[\s\S]*credentials:\s*"include"/.test(wizard),
    "wizard should preserve the authenticated session when saving onboarding progress"
  );
  assert(!wizard.includes("/api/extension/tokens"), "onboarding should not create extension tokens");
  assert(!wizard.includes("/downloads/leadsy-extension.zip"), "onboarding should not link to the extension zip download");
  assert(!wizard.includes("chrome://extensions"), "onboarding should not explain extension installation");
  assert(!wizard.includes("Optional during onboarding. Connect now or skip"), "onboarding should not push Meta setup");
  assert(!wizard.includes("Profile Settings"), "onboarding should not route users to Meta settings");
  assert(!wizard.includes("Leadsy already handles OpenRouter provider routing"), "onboarding should not include integration cards");
  const optionsRoute = await read("apps/web/src/app/api/onboarding/options/route.ts");
  const optionsHelper = await read("apps/web/src/lib/onboarding-options.ts");
  assert(optionsRoute.includes("normalizeOnboardingOptionGroups"), "AI option API should normalize options through the shared sanitizer");
  assert(optionsHelper.includes("sanitizeOptionGroup"), "AI option helper should sanitize every option group");
  assert(optionsHelper.includes("questionLikeOption"), "AI option helper should reject question-like chips for every group");
  assert(optionsRoute.includes("Never return questions as options for any key"), "AI option prompt should forbid question-like options globally");
  const appLayout = await read("apps/web/src/app/app/layout.tsx");
  assert(appLayout.includes("getWorkspaceWhatsAppSender"), "authenticated layout should load workspace WhatsApp sender server-side");
  assert(appLayout.includes("whatsAppSender"), "authenticated layout should pass minimal WhatsApp sender state to AppShell");
  assert(!appLayout.includes("listMetaOAuthConnections"), "authenticated layout should not load Meta just to pressure first-run setup");
  assert(appShell.includes("whatsAppSender"), "app shell should accept WhatsApp sender state");
  assert(appShell.includes("WhatsApp ·"), "account block should show WhatsApp number or status");
  assert(!appShell.includes("Meta connection needs attention"), "main shell should not pressure users about missing Meta");
  assert(wizard.includes("aria-invalid"), "wizard should use inline validation");
  assert(!wizard.includes("window.alert"), "wizard should not use browser alerts");
  assert(!wizard.includes("window.confirm"), "wizard should not use browser confirms");
  assert(!wizard.includes("window.prompt"), "wizard should not use browser prompts");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
