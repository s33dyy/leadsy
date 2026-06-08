import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function main() {
  const packageJson = JSON.parse(await read("apps/web/package.json")) as { scripts?: Record<string, string> };
  assert.equal(packageJson.scripts?.start, "node scripts/start-next-gracefully.mjs", "web start should use the graceful Railway wrapper");

  const wrapper = await read("apps/web/scripts/start-next-gracefully.mjs");
  assert(wrapper.includes("SIGTERM"), "start wrapper should handle Railway shutdown signals");
  assert(wrapper.includes("process.exit(0)"), "SIGTERM shutdown should not be reported as a failed npm lifecycle");
  assert(wrapper.includes("next"), "start wrapper should still launch Next.js");
  assert(!packageJson.scripts?.start.includes("next start"), "web start script should not call next start directly");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
