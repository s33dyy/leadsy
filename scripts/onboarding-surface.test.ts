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
  assert(wizard.includes("/api/onboarding"), "wizard should save progress through the onboarding API");
  assert(
    /fetch\("\/api\/onboarding",\s*{[\s\S]*credentials:\s*"same-origin"/.test(wizard),
    "wizard should preserve the authenticated session when saving onboarding progress"
  );
  assert(wizard.includes("aria-invalid"), "wizard should use inline validation");
  assert(!wizard.includes("window.alert"), "wizard should not use browser alerts");
  assert(!wizard.includes("window.confirm"), "wizard should not use browser confirms");
  assert(!wizard.includes("window.prompt"), "wizard should not use browser prompts");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
