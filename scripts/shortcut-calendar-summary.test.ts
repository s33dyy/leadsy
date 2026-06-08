import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function main() {
  const [communications, calendar, appShell, teamPage, packageJson] = await Promise.all([
    read("apps/web/src/components/communications-console.tsx"),
    read("apps/web/src/components/calendar-console.tsx"),
    read("apps/web/src/components/app-shell.tsx"),
    read("apps/web/src/app/app/team/page.tsx"),
    read("package.json")
  ]);

  assert(packageJson.includes("test:shortcut-calendar-summary"), "package should expose the focused shortcut/calendar regression");

  assert(communications.includes("conversationSearchRef"), "communications should keep a focusable conversation search ref");
  assert(communications.includes("conversationQuery"), "communications should dynamically filter conversations by query");
  assert(communications.includes("handleCommunicationsShortcut"), "communications should centralize scoped inbox shortcuts");
  for (const key of ['"u"', '"r"', '"m"', '"a"', '"o"', '"t"', '"q"']) {
    assert(communications.includes(key), `communications shortcut ${key} should be handled`);
  }
  assert(communications.includes("LeadSummaryModal"), "communications should render the lead summary modal");
  assert(communications.includes("summaryOpen"), "communications should track summary modal state");
  assert(communications.includes("event.key.toLowerCase() !== \"s\""), "communications should intercept Cmd/Ctrl+S for scoped summary");
  assert(!communications.includes("<span className=\"inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 text-[12px]\">\n                  <Sparkles"), "Summarize should not remain a passive span");

  assert(calendar.includes("eventSearchRef"), "calendar should keep a focusable event search ref");
  assert(calendar.includes("eventModalOpen"), "calendar should render event create/edit in a modal");
  assert(calendar.includes("handleCalendarShortcut"), "calendar should centralize scoped keyboard shortcuts");
  for (const key of ['"d"', '"w"', '"m"', '"y"', '"t"', '"e"', '"/"']) {
    assert(calendar.includes(key), `calendar shortcut ${key} should be handled`);
  }
  assert(calendar.includes("leadNameById"), "calendar search should include linked lead names");
  assert(calendar.includes("memberNameById"), "calendar search should include owner names");
  assert(!calendar.includes("xl:grid-cols-[1fr_340px]"), "calendar should not keep the create/edit side panel layout");
  assert(!calendar.includes("Leadsy / Calendar"), "calendar should not duplicate the navbar breadcrumb in-page");

  assert(appShell.includes("event.key !== \",\""), "AppShell should listen for Cmd/Ctrl+,");
  assert(appShell.includes('router.push("/app/settings")'), "Cmd/Ctrl+, should open settings");

  assert(!teamPage.includes("Humans, AI agents, routing, and handoffs"), "Teamspace explanatory header should be removed");
  assert(!teamPage.includes("AI qualification"), "Teamspace should not show the removed AI qualification badge");
  assert(teamPage.includes("TeamspaceConsole"), "Teamspace should keep the editable console");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
