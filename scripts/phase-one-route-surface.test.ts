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
    assert.equal(await fileExists(route.page), true, `${route.page} should expose the Step 8 route surface`);
    const source = await read(route.page);
    assert(source.includes('import { redirect } from "next/navigation"'), `${route.page} should redirect through Next navigation`);
    assert(source.includes(`redirect("${route.target}")`), `${route.page} should preserve existing logic by redirecting to ${route.target}`);
  }

  const appShell = await read("apps/web/src/components/app-shell.tsx");
  for (const href of ['href: "/app"', 'href: "/app/leads"', 'href: "/app/communications"', 'href: "/app/worker"', 'href: "/app/team"', 'href: "/app?view=analytics"', 'href: "/app/settings"']) {
    assert(appShell.includes(href), `global sidebar should keep tab navigation inside the authenticated shell with ${href}`);
  }
  for (const legacyPath of ["/app", "/app/leads", "/app/worker", "/app/approvals", "/app/communications", "/app/tasks", "/app/integrations", "/app/connect", "/app/settings"]) {
    assert(appShell.includes(legacyPath), `app shell should keep ${legacyPath} as a legacy active/preserved route`);
  }
  assert(appShell.includes("isActiveLink"), "app shell should preserve active path matching for existing workspace routes");
  assert(!appShell.includes('href: "/crm", label: "CRM"'), "CRM tab clicks should not leave the authenticated shell first");
  assert(!appShell.includes('href: "/workers", label: "Workers"'), "Worker tab clicks should not leave the authenticated shell first");
  assert(appShell.includes("Quick search"), "app shell should include the Lovable-style quick search control");
  assert(appShell.includes("Conversion workflow"), "app shell should group primary navigation by conversion workflow");
  assert(appShell.includes("Supporting routes"), "app shell should keep preserved legacy routes visible outside primary navigation");
  assert(!appShell.includes("4 workers running"), "app shell top bar should not expose fake worker activity context");
  assert(!appShell.includes("queue {82 + pendingApprovalCount}"), "app shell top bar should not expose fake queue counts");

  const workspaceIndex = await read("apps/web/src/app/app/page.tsx");
  assert(!workspaceIndex.includes('redirect("/app/leads")'), "Dashboard navigation should not redirect operators into the CRM leads workspace");
  assert(workspaceIndex.includes("listLeadKnowledgeRecords"), "Dashboard should render live lead intelligence instead of a redirect");
  assert(workspaceIndex.includes("Operations dashboard"), "Dashboard should expose a real operator dashboard surface");
  assert(workspaceIndex.includes("Operator overview"), "Dashboard should match the Lovable operator overview layout");
  assert(workspaceIndex.includes("Qualification funnel"), "Dashboard should include the Lovable qualification funnel surface");
  assert(workspaceIndex.includes("Follow-up and automation activity"), "Dashboard should include real follow-up and automation activity");
  assert(workspaceIndex.includes("Needs you"), "Dashboard should include the right-side Needs You rail");

  const settingsPage = await read("apps/web/src/app/app/settings/page.tsx");
  assert(settingsPage.includes("overflow-y-auto overflow-x-hidden"), "Settings automation view should scroll vertically without horizontal overflow");
  assert(settingsPage.includes("grid min-w-0 grid-cols-12"), "Settings automation rows should opt into shrinking inside grid tracks");
  assert(settingsPage.includes("col-span-12 min-w-0 truncate text-muted-foreground md:col-span-5"), "Backend logic module details should truncate instead of widening the page");
  assert(settingsPage.includes("col-span-4 min-w-0 truncate whitespace-nowrap text-right"), "Backend logic owner labels should stay inside their grid cell");
  assert(settingsPage.includes("grid min-w-0 grid-cols-1 gap-px overflow-hidden"), "Provider config cards should be horizontally contained");
  assert(settingsPage.includes("<Badge className=\"shrink-0\""), "Provider config status badges should not stretch or push text columns wider");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
