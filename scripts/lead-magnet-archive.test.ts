import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const archivedRoutes = [
  "apps/web/src/app/api/lead-magnet/brief/route.ts",
  "apps/web/src/app/api/lead-magnet/discover/route.ts",
  "apps/web/src/app/api/lead-magnet/discover/stream/route.ts",
  "apps/web/src/app/api/lead-magnet/draft/route.ts",
  "apps/web/src/app/api/lead-magnet/import/route.ts",
  "apps/web/src/app/api/lead-magnet/leads/[leadId]/route.ts",
  "apps/web/src/app/api/lead-magnet/outreach/route.ts",
  "apps/web/src/app/api/lead-magnet/plan-preview/route.ts",
  "apps/web/src/app/api/lead-magnet/search/answer/route.ts",
  "apps/web/src/app/api/lead-magnet/search/start/route.ts",
  "apps/web/src/app/api/lead-magnet/search/stop/route.ts",
  "apps/web/src/app/api/lead-magnet/search/stream/route.ts"
];

for (const route of archivedRoutes) {
  const source = readFileSync(join(root, route), "utf8");
  assert(source.includes("leadMagnetArchivedResponse"), `${route} should return the archived Lead Magnet API response`);
  assert(source.includes("lead_magnet_archived"), `${route} should expose the lead_magnet_archived error code`);
}

for (const route of [
  "apps/web/src/app/api/lead-magnet/brief/form/route.ts",
  "apps/web/src/app/api/lead-magnet/discover/form/route.ts"
]) {
  const source = readFileSync(join(root, route), "utf8");
  assert(source.includes("leadMagnetArchivedRedirect"), `${route} should redirect archived Lead Magnet form submissions back to Leads`);
}

console.log("lead magnet archive regression passed");
