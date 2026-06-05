import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return walk(path);
      return path;
    })
  );
  return paths.flat();
}

async function main() {
  const appShell = await read("apps/web/src/components/app-shell.tsx");
  const expectedNavLabels = [
    "Dashboard",
    "CRM",
    "Workers",
    "Approvals",
    "Communications",
    "Tasks",
    "Integrations",
    "Settings",
    "ICP & playbooks",
    "Recent AI findings",
    "Snippets"
  ];
  for (const label of expectedNavLabels) {
    assert(appShell.includes(`label: "${label}"`), `global sidebar should include ${label}`);
  }

  assert(appShell.includes('"use client"'), "app shell should be interactive for collapse, drawers, and menus");
  assert(appShell.includes("usePathname"), "app shell should derive the page title from the active route");
  assert(appShell.includes("data-testid=\"global-sidebar\""), "app shell should expose the desktop sidebar");
  assert(appShell.includes('data-layout="lovable-operator"'), "app shell should mark the Lovable operator layout");
  assert(appShell.includes("data-testid=\"sidebar-toggle\""), "app shell should expose a sidebar collapse toggle");
  assert(appShell.includes("aria-expanded={sidebarExpanded}"), "sidebar toggle should expose expanded state");
  assert(appShell.includes("data-testid=\"mobile-nav-drawer\""), "app shell should include a mobile drawer");
  assert(appShell.includes("data-testid=\"notification-bell\""), "top bar should include a notification bell");
  assert(appShell.includes("data-testid=\"notification-center\""), "notification bell should open a notification center");
  assert(appShell.includes("data-testid=\"user-menu\""), "top bar should include a user avatar menu");
  assert(appShell.includes("ToastProvider"), "app shell should wrap workspace content in the toast provider");
  assert(appShell.includes('fetch("/api/auth/logout"'), "logout should use an explicit POST API call");
  assert(!appShell.includes('href="/logout"'), "logout must not use a prefetchable navigation link");

  const logoutRoute = await read("apps/web/src/app/logout/route.ts");
  assert(!logoutRoute.includes("clearSessionCookie"), "GET /logout must not clear cookies because links can be prefetched");
  assert(!logoutRoute.includes("destroySessionFromRequest"), "GET /logout must not destroy sessions because links can be prefetched");

  const toastProvider = await read("apps/web/src/components/toast-provider.tsx");
  assert(toastProvider.includes('"use client"'), "toast provider should be a client component");
  assert(toastProvider.includes("createContext"), "toast provider should expose a reusable context");
  assert(toastProvider.includes("setTimeout"), "toasts should auto-dismiss");
  assert(toastProvider.includes('role="status"'), "toasts should be announced non-blockingly");
  assert(toastProvider.includes("useToast"), "toast provider should export useToast");

  const confirmationModal = await read("apps/web/src/components/confirmation-modal.tsx");
  assert(confirmationModal.includes('"use client"'), "confirmation modal should be a client component");
  assert(confirmationModal.includes('role="dialog"'), "confirmation modal should use dialog semantics");
  assert(confirmationModal.includes('aria-modal="true"'), "confirmation modal should be modal to assistive tech");
  assert(confirmationModal.includes("Escape"), "confirmation modal should close from Escape");
  assert(confirmationModal.includes("Confirm"), "confirmation modal should expose an explicit confirm action");
  assert(confirmationModal.includes("Cancel"), "confirmation modal should expose an explicit cancel action");

  const leadMagnetLab = await read("apps/web/src/components/lead-magnet-lab.tsx");
  assert(leadMagnetLab.includes("ConfirmationModal"), "lead deletion should use the reusable confirmation modal");
  assert(leadMagnetLab.includes("useToast"), "lead mutations should be able to acknowledge with global toasts");

  const sourceFiles = (await walk("apps/web/src")).filter((path) => /\.(tsx?|jsx?)$/.test(path));
  for (const path of sourceFiles) {
    const source = await read(path);
    assert(!source.includes("window.alert"), `${path} should not use window.alert`);
    assert(!source.includes("window.confirm"), `${path} should not use window.confirm`);
    assert(!source.includes("window.prompt"), `${path} should not use window.prompt`);
  }

  const packageJson = await read("package.json");
  assert(packageJson.includes("test:global-components"), "package.json should expose the global components surface test");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
