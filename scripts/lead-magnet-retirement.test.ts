import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function assertMissing(path: string) {
  assert(!existsSync(join(root, path)), `${path} should be deleted because Lead Magnet is retired`);
}

const deletedPaths = [
  "apps/web/src/app/app/magnet",
  "apps/web/src/app/api/lead-magnet",
  "apps/web/src/components/lead-magnet-lab.tsx",
  "apps/web/src/lib/lead-magnet-archive.ts",
  "apps/web/src/lib/lead-magnet-campaign.ts",
  "apps/web/src/lib/lead-magnet-form.ts",
  "apps/web/src/lib/lead-magnet-store.ts",
  "apps/lead-magnet-tutorial",
  "scripts/lead-magnet-agent-tools.test.ts",
  "scripts/lead-magnet-archive.test.ts",
  "scripts/lead-magnet-regression.mjs"
];

for (const path of deletedPaths) {
  assertMissing(path);
}

const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
assert(!packageJson.scripts["test:lead-magnet"], "package.json should not expose a Lead Magnet test script");
assert(!packageJson.scripts["test:lead-magnet-archive"], "package.json should not expose a Lead Magnet archive test script");
assert(packageJson.scripts["test:lead-magnet-retirement"], "package.json should expose the Lead Magnet retirement guard");
assert(!packageJson.scripts.test.includes("test:lead-magnet "), "full test chain should not run old Lead Magnet tests");
assert(!packageJson.scripts.test.includes("test:lead-magnet-archive"), "full test chain should not run Lead Magnet archive tests");

const costReceipt = read("apps/web/src/lib/cost-receipt.ts");
assert(!costReceipt.includes("lead-magnet-store"), "cost receipt should not import the retired Lead Magnet store");
assert(!costReceipt.includes("getLeadMagnetWorkspace"), "cost receipt should not read AI cost usage from Lead Magnet");
assert(costReceipt.includes("ai-usage-store"), "cost receipt should read AI costs from the neutral AI usage store");

const accountSeed = read("apps/web/src/lib/account-stress-demo-seed.ts");
assert(!accountSeed.includes("lead-magnet.json"), "stress demo seed should not write retired lead-magnet.json");
assert(!accountSeed.includes("buildLeadMagnetStress"), "stress demo seed should not build Lead Magnet records");
assert(accountSeed.includes("ai-usage.json"), "stress demo seed should seed neutral AI usage records for the receipt");

const commandSearch = read("apps/web/src/lib/command-search.ts");
assert(commandSearch.includes("lead magnet"), "command search should explicitly filter retired Lead Magnet queries");

const healthRoute = read("apps/web/src/app/api/health/route.ts");
assert(!healthRoute.includes("leadMagnetSources"), "health should not report retired Lead Magnet sources");
assert(!healthRoute.includes("discoveredLeads"), "health should not report retired Lead Magnet discovery counts");

console.log("lead magnet retirement guard passed");
