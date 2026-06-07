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
  const routeAliases = [
    { page: "apps/web/src/app/dashboard/page.tsx", target: "/app" },
    { page: "apps/web/src/app/crm/page.tsx", target: "/app/leads" },
    { page: "apps/web/src/app/workers/page.tsx", target: "/app/worker" },
    { page: "apps/web/src/app/settings/page.tsx", target: "/app/settings" }
  ];

  for (const route of routeAliases) {
    assert.equal(await fileExists(route.page), true, `${route.page} should expose the route surface`);
    const source = await read(route.page);
    assert(source.includes('import { redirect } from "next/navigation"'), `${route.page} should redirect through Next navigation`);
    assert(source.includes(`redirect("${route.target}")`), `${route.page} should redirect to ${route.target}`);
  }

  const appShell = await read("apps/web/src/components/app-shell.tsx");
  for (const href of ['href: "/app"', 'href: "/app/leads"', 'href: "/app/communications"', 'href: "/app/worker"', 'href: "/app/team"', 'href: "/app/settings"', 'href: "/app/calendar"']) {
    assert(appShell.includes(href), `global sidebar should include ${href}`);
  }
  assert(appShell.includes("Quick search"), "app shell should include quick search");
  assert(appShell.includes("Conversion workflow"), "app shell should group primary navigation by conversion workflow");
  assert(appShell.includes("Supporting routes"), "app shell should keep secondary app routes visible");

  const workspaceIndex = await read("apps/web/src/app/app/page.tsx");
  assert(workspaceIndex.includes("listLeadKnowledgeRecords"), "Dashboard should render live lead intelligence");
  assert(workspaceIndex.includes("Operations dashboard"), "Dashboard should expose an operator dashboard");
  assert(workspaceIndex.includes("items need attention"), "Dashboard should include the attention rail");

  const teamPage = await read("apps/web/src/app/app/team/page.tsx");
  assert(teamPage.includes("TeamspaceConsole"), "Team route should expose Teamspace controls");
  const calendarPage = await read("apps/web/src/app/app/calendar/page.tsx");
  assert(calendarPage.includes("Month"), "Calendar route should expose calendar modes");
  assert(calendarPage.includes("listCalendarEvents"), "Calendar route should read native calendar data");

  const settingsPage = await read("apps/web/src/app/app/settings/page.tsx");
  assert(settingsPage.includes("grid min-w-0 grid-cols-1 gap-px bg-border"), "Settings status grids should stay horizontally contained");
  assert(settingsPage.includes("Leadsy-assigned WhatsApp sender"), "Settings should show Leadsy-managed WhatsApp sender status");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
