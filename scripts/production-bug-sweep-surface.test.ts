import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function main() {
  const appShell = await read("apps/web/src/components/app-shell.tsx");
  assert(appShell.includes("/app/calendar"), "primary shell should expose the native calendar");
  assert(appShell.includes("/app/communications"), "primary shell should expose Inbox");
  assert(!appShell.includes(["Connect", "channels"].join(" ")), "shell should not promote retired channel setup");

  const teamPage = await read("apps/web/src/app/app/team/page.tsx");
  assert(teamPage.includes("Teamspace"), "team page should be Teamspace, not read-only user inventory");
  assert(teamPage.includes("TeamspaceConsole"), "team page should include management controls");

  const communicationsConsole = await read("apps/web/src/components/communications-console.tsx");
  assert(communicationsConsole.includes("conversation="), "conversation rows should open the conversation view");
  assert(communicationsConsole.includes("Internal team thread"), "Inbox should expose internal lead team thread");
  assert(communicationsConsole.includes("Calendar proposals"), "Inbox should expose calendar proposals");

  const healthRoute = await read("apps/web/src/app/api/health/route.ts");
  assert(healthRoute.includes("summarizeTeamspaceHealth"), "health route should include teamspace counts");
  assert(healthRoute.includes("summarizeCalendarHealth"), "health route should include calendar counts");
  assert(healthRoute.includes("workspaceWhatsAppSenders"), "health route should include WhatsApp sender counts");

  const removedPaths = [
    "apps/web/src/app/app/connect/page.tsx",
    "apps/web/src/app/api/automation/agent/route.ts",
    "apps/web/src/app/api/automation/executions/route.ts"
  ];
  for (const path of removedPaths) {
    assert.equal(existsSync(join(root, path)), false, `${path} should not exist`);
  }

  console.log("production surface sweep passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
