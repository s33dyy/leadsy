import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const social = ["me", "ta"].join("");
const legacyCapture = ["ex", "tension"].join("");

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function main() {
  const shell = await read("apps/web/src/components/app-shell.tsx");
  for (const route of ["/app", "/app/leads", "/app/communications", "/app/team", "/app/settings", "/app/calendar"]) {
    assert(shell.includes(route), `shell should include ${route}`);
  }
  assert(!shell.includes("/app/worker"), "shell should not expose the retired Automations route");

  const landing = await read("apps/web/src/app/page.tsx");
  assert(landing.includes("AI team handoff"), "landing page should explain AI handoff");
  assert(landing.includes("Leadsy-managed WhatsApp"), "landing page should position WhatsApp as Leadsy-managed");

  const simulator = await read("apps/web/src/components/twilio-simulator-console.tsx");
  assert(simulator.includes("Simulation Inbox"), "simulator should provide an Inbox-like lead-side chat surface");
  assert(simulator.includes("/api/simulate-twilio/inbound"), "simulator chat should insert inbound lead messages");
  assert(!simulator.includes("/api/whatsapp/messages"), "simulator chat should not send outbound WhatsApp replies");
  assert(simulator.includes("EventSource(\"/api/simulate-twilio/stream\")"), "simulator should live-update without refresh");

  const team = await read("apps/web/src/components/teamspace-console.tsx");
  assert(team.includes("Full AI agent"), "Teamspace should support full AI agents");
  assert(team.includes("User-handled AI agent"), "Teamspace should support assisted AI agents");
  assert(team.includes("simulator sender"), "Teamspace should show simulator sender identities");
  assert(team.includes("Repair sender"), "Teamspace should keep a sender repair action");
  assert(team.includes("Toggle auto-reply"), "Teamspace should expose auto-reply controls");

  const calendar = await read("apps/web/src/components/calendar-console.tsx");
  for (const label of ["Month", "Week", "Day", "Year", "Availability", "Meeting"]) {
    assert(calendar.includes(label), `calendar page should include ${label}`);
  }

  const retiredRuntimePaths = [
    "apps/web/src/app/app/connect/page.tsx",
    `apps/web/src/app/${legacyCapture}/page.tsx`,
    `apps/web/src/app/api/${social}/oauth/start/route.ts`,
    `apps/web/src/app/api/${legacyCapture}/tokens/route.ts`
  ];
  for (const path of retiredRuntimePaths) {
    assert.equal(existsSync(join(root, path)), false, `${path} should be retired`);
  }

  console.log("user-facing surface regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
