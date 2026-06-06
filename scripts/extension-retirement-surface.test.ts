import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function exists(path: string) {
  try {
    await stat(join(root, path));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  const appShell = await read("apps/web/src/components/app-shell.tsx");
  assert(appShell.includes('label: "Automations"'), "Automations should remain the primary automation surface");
  assert(!appShell.includes('label: "Extension worker"'), "extension worker should be removed from primary/supporting navigation");
  assert(!appShell.includes('/app/worker?view=extension'), "extension-specific worker view should not be linked from navigation");

  const workerPage = await read("apps/web/src/app/app/worker/page.tsx");
  assert(workerPage.includes("Legacy Capture Layer"), "worker page should mark extension surfaces as Legacy Capture Layer");
  assert(workerPage.includes("legacyCaptureLayer"), "worker page should keep the legacy extension marker close to the implementation");
  assert(workerPage.includes("Browser extension fallback"), "worker page should preserve extension fallback visibility");
  assert(workerPage.includes("ExtensionPairing"), "worker page should preserve extension pairing");
  assert(workerPage.includes("ExtensionTaskBoard"), "worker page should preserve extension task visibility");

  const connectPage = await read("apps/web/src/app/app/connect/page.tsx");
  assert(connectPage.includes("Legacy Capture Layer"), "connect page should mark browser worker pairing as legacy capture");
  assert(connectPage.includes("official Meta connection above is the primary transport"), "connect page should demote extension beneath official transport");

  for (const route of [
    "apps/web/src/app/api/extension/capture/route.ts",
    "apps/web/src/app/api/extension/context/route.ts",
    "apps/web/src/app/api/extension/conversations/sync/route.ts",
    "apps/web/src/app/api/extension/tasks/route.ts",
    "apps/web/src/app/api/extension/tokens/route.ts"
  ]) {
    assert.equal(await exists(route), true, `${route} should be preserved for existing extension users`);
  }
  assert.equal(await exists("apps/extension/package.json"), true, "extension package should remain in the repo");

  const report = await read("EXTENSION_RETIREMENT_REPORT.md");
  for (const expected of ["Legacy Capture Layer", "Preserved extension APIs", "Preserved extension package", "Removed from primary navigation"]) {
    assert(report.includes(expected), `extension retirement report should document ${expected}`);
  }

  console.log("extension retirement surface regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
