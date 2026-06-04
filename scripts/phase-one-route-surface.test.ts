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
    { page: "apps/web/src/app/settings/page.tsx", target: "/app/connect?panel=settings" }
  ];

  for (const route of routeAliases) {
    assert.equal(await fileExists(route.page), true, `${route.page} should expose the Step 8 route surface`);
    const source = await read(route.page);
    assert(source.includes('import { redirect } from "next/navigation"'), `${route.page} should redirect through Next navigation`);
    assert(source.includes(`redirect("${route.target}")`), `${route.page} should preserve existing logic by redirecting to ${route.target}`);
  }

  const appShell = await read("apps/web/src/components/app-shell.tsx");
  for (const href of ['href: "/app"', 'href: "/app/leads"', 'href: "/app/worker"', 'href: "/app/connect?panel=settings"']) {
    assert(appShell.includes(href), `global sidebar should keep tab navigation inside the authenticated shell with ${href}`);
  }
  for (const legacyPath of ["/app", "/app/leads", "/app/worker", "/app/connect"]) {
    assert(appShell.includes(legacyPath), `app shell should keep ${legacyPath} as a legacy active/preserved route`);
  }
  assert(appShell.includes("activePaths"), "app shell should preserve active path mapping for existing workspace routes");
  assert(!appShell.includes('href: "/crm", label: "CRM"'), "CRM tab clicks should not leave the authenticated shell first");
  assert(!appShell.includes('href: "/workers", label: "Workers"'), "Worker tab clicks should not leave the authenticated shell first");

  const workspaceIndex = await read("apps/web/src/app/app/page.tsx");
  assert(!workspaceIndex.includes('redirect("/app/leads")'), "Dashboard navigation should not redirect operators into the CRM leads workspace");
  assert(workspaceIndex.includes("listLeadKnowledgeRecords"), "Dashboard should render live lead intelligence instead of a redirect");
  assert(workspaceIndex.includes("Operations dashboard"), "Dashboard should expose a real operator dashboard surface");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
