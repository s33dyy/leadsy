import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function main() {
  const appShell = await read("apps/web/src/components/app-shell.tsx");
  assert(appShell.includes("useSearchParams"), "app shell should use query params for query-specific nav items");
  assert(!appShell.includes('label === "Approvals" || label === "Knowledge" || label === "Settings"'), "query-specific nav items should not be hard-disabled");
  assert(appShell.includes("pendingApprovalCount"), "app shell should receive live pending approval counts");
  assert(!appShell.includes("const pendingApprovals = 0"), "app shell should not hardcode the approval notification count");

  const workspaceLayout = await read("apps/web/src/app/app/layout.tsx");
  assert(workspaceLayout.includes("listExtensionTasks"), "workspace layout should load extension tasks for shell notifications");
  assert(workspaceLayout.includes("pendingApprovalCount"), "workspace layout should pass live pending approvals into AppShell");

  const dashboard = await read("apps/web/src/app/app/page.tsx");
  assert(dashboard.includes("awaitingApprovalTaskStatuses"), "dashboard should share the same approval status definition used by the shell");
  assert(!dashboard.includes('redirect("/app/leads")'), "dashboard hard loads should render the dashboard instead of redirecting or blanking");

  const leadsPage = await read("apps/web/src/app/app/leads/page.tsx");
  assert(leadsPage.includes("type LeadPanel"), "leads page should understand CRM versus knowledge sidebar panels");
  assert(leadsPage.includes("panelFromValue"), "leads page should parse panel search params");
  assert(leadsPage.includes("panel?: LeadPanel"), "CRM links should preserve the selected panel");
  assert(!leadsPage.includes("leads.find((lead) => lead.id === selectedLeadId)"), "selected lead should not fall back to records hidden by current filters");
  assert(!leadsPage.includes('name="contact" value={selectedLead.id}'), "search forms should not preserve stale selected contacts across a new query");

  const workerPage = await read("apps/web/src/app/app/worker/page.tsx");
  assert(workerPage.includes("type WorkerPageProps"), "worker page should accept search params");
  assert(workerPage.includes("focusColumnFromTab"), "worker page should convert tab=pending into a focused task column");
  assert(workerPage.includes('focusColumn={focusColumn}'), "worker page should pass the focused column to the task board");

  const taskBoard = await read("apps/web/src/components/extension-task-board.tsx");
  assert(taskBoard.includes("focusColumn"), "task board should accept a focused column from sidebar routing");
  assert(taskBoard.includes("orderedColumns"), "task board should prioritize the focused column for query routes");
  assert(taskBoard.includes("data-focused"), "task board should mark the focused lane for browser verification");

  const connectPage = await read("apps/web/src/app/app/connect/page.tsx");
  assert(connectPage.includes("type ConnectPanel"), "connect page should understand settings/profile query panels");
  assert(connectPage.includes("panelFromValue"), "connect page should parse panel search params");
  assert(connectPage.includes("activePanel"), "connect page should alter the page surface for selected settings panels");

  const healthRoute = await read("apps/web/src/app/api/health/route.ts");
  assert(healthRoute.includes("summarizeLeadKnowledgeHealth"), "health route should include real lead knowledge counts");
  assert(healthRoute.includes("summarizeExtensionHealth"), "health route should include real extension workflow counts");
  assert(healthRoute.includes("leadKnowledge.records"), "health route should map module lead counts to live knowledge records");
  assert(healthRoute.includes("extension.pendingApprovals"), "health route should expose live pending worker approvals");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
