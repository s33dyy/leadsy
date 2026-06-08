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
  const appShell = await read("apps/web/src/components/app-shell.tsx");
  assert(appShell.includes("CommandSearchModal"), "AppShell should render the command search modal");
  assert(appShell.includes("metaKey"), "AppShell should listen for Cmd+K");
  assert(appShell.includes("ctrlKey"), "AppShell should listen for Ctrl+K");
  assert(!appShell.includes('href="/app/leads?q="'), "Quick search should not navigate to Leads when clicked");
  assert(appShell.includes('type="button"'), "Quick search should be a button trigger");

  assert.equal(await fileExists("apps/web/src/components/command-search-modal.tsx"), true, "command search modal component should exist");
  const modalSource = await read("apps/web/src/components/command-search-modal.tsx");
  assert(modalSource.includes('role="dialog"'), "command search modal should use dialog semantics");
  assert(modalSource.includes('aria-modal="true"'), "command search modal should be modal to assistive tech");
  assert(modalSource.includes("Escape"), "command search modal should close on Escape");
  assert(modalSource.includes("ArrowDown"), "command search modal should support keyboard result navigation");
  assert(modalSource.includes("ArrowUp"), "command search modal should support keyboard result navigation");
  assert(modalSource.includes("/api/search"), "command search modal should fetch dynamic search results");

  assert.equal(await fileExists("apps/web/src/app/api/search/route.ts"), true, "search API route should exist");
  const searchRoute = await read("apps/web/src/app/api/search/route.ts");
  assert(searchRoute.includes("requireApiSession"), "search API should require auth");
  assert(searchRoute.includes('"crm:read"'), "search API should require CRM read permission");

  const { buildCommandSearchResults } = await import("../apps/web/src/lib/command-search");
  const emptyResults = buildCommandSearchResults({
    query: "",
    leads: [],
    teamMembers: [],
    calendarEvents: [],
    tasks: []
  });
  for (const title of ["Dashboard", "Leads", "Inbox", "Calendar", "Team", "Settings", "Add Lead", "Simulate Twilio"]) {
    assert(emptyResults.some((result) => result.title === title), `empty command search should include ${title}`);
  }
  for (const retired of ["Meta", "Extension", "n8n", "Infrastructure"]) {
    assert.equal(emptyResults.some((result) => new RegExp(retired, "i").test(`${result.title} ${result.subtitle}`)), false, `command search should exclude ${retired}`);
  }

  const results = buildCommandSearchResults({
    query: "asha",
    leads: [
      {
        id: "lead_asha",
        contact: { displayName: "Asha Buyer", phone: "+919000000001" },
        leadSource: "WhatsApp",
        summary: "Interested in lead qualification",
        conversations: [{ id: "conv_asha", channel: "whatsapp", lastMessagePreview: "Need a demo" }]
      }
    ],
    teamMembers: [{ id: "tm_1", name: "Qualification AI", type: "ai_agent_full", role: "agent" }],
    calendarEvents: [],
    tasks: []
  });
  assert.equal(results[0]?.title, "Asha Buyer", "exact contact matches should rank first");
  assert(results.some((result) => result.href === "/app/communications?conversation=conv_asha"), "conversation results should link to the conversation");

  console.log("command search regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
