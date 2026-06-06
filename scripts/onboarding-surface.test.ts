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
  for (const label of ["About You", "About Your Business", "Your Target Customer", "Integration Verification", "Completion Score"]) {
    assert(wizard.includes(label), `onboarding wizard should include ${label}`);
  }
  for (const label of ["Business name", "Industry", "Team size", "WhatsApp number", "Lead sources", "Assignment preferences", "Follow-up preferences"]) {
    assert(wizard.includes(label), `onboarding wizard should collect ${label}`);
  }
  assert(!wizard.includes("Twilio connected?"), "onboarding should not ask end users to connect Twilio");
  assert(wizard.includes("Leadsy manages Twilio internally"), "onboarding should explain that WhatsApp transport is managed by Leadsy");
  assert(wizard.includes('whatsappTransport: "leadsy_managed_twilio"'), "workspace configuration should record Leadsy-managed WhatsApp transport");
  assert(wizard.includes("workspaceConfiguration"), "onboarding should save CRM setup answers to workspace configuration");
  assert(wizard.includes("/api/onboarding"), "wizard should save progress through the onboarding API");
  const onboardingRoute = await read("apps/web/src/app/api/onboarding/route.ts");
  assert(onboardingRoute.includes("upsertWorkspaceWhatsAppSender"), "onboarding API should register the workspace WhatsApp sender");
  assert(
    /fetch\("\/api\/onboarding",\s*{[\s\S]*credentials:\s*"include"/.test(wizard),
    "wizard should preserve the authenticated session when saving onboarding progress"
  );
  assert(wizard.includes("/api/extension/tokens"), "integration verification should create extension tokens through the existing API");
  assert(wizard.includes("/downloads/leadsy-extension.zip"), "integration verification should link to the extension zip download");
  assert(wizard.includes("chrome://extensions"), "integration verification should explain manual extension installation");
  assert(wizard.includes("Optional during onboarding. Connect now or skip"), "Meta setup should be optional during onboarding");
  assert(wizard.includes("Profile Settings"), "Meta setup should point users to profile settings for later configuration");
  assert(wizard.includes("Leadsy already handles OpenRouter provider routing"), "OpenRouter setup should explain that Leadsy handles configured API keys");
  assert(wizard.includes("aria-invalid"), "wizard should use inline validation");
  assert(!wizard.includes("window.alert"), "wizard should not use browser alerts");
  assert(!wizard.includes("window.confirm"), "wizard should not use browser confirms");
  assert(!wizard.includes("window.prompt"), "wizard should not use browser prompts");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
