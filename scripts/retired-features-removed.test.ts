import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const social = ["me", "ta"].join("");
const legacyCapture = ["ex", "tension"].join("");
const oldWebChannelPrefix = "whatsapp";

async function exists(path: string) {
  try {
    await stat(join(root, path));
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return walk(path);
      return [path];
    })
  );
  return nested.flat();
}

async function main() {
  for (const removedPath of [
    `apps/web/src/app/api/${social}`,
    `apps/web/src/app/api/${legacyCapture}`,
    `apps/${legacyCapture}`,
    `apps/web/src/lib/${social}-oauth-store.ts`,
    `apps/web/src/lib/${social}-${["whatsapp", "webhook"].join("-")}-store.ts`,
    `apps/web/src/lib/${social}-webhook-routing.ts`,
    `apps/web/src/lib/${legacyCapture}-store.ts`,
    `apps/web/src/lib/${legacyCapture}-auth.ts`,
    `apps/web/src/lib/${legacyCapture}-task-drafts.ts`
  ]) {
    assert.equal(await exists(removedPath), false, `${removedPath} should be removed from runtime code`);
  }

  const packageJson = await readFile(join(root, "package.json"), "utf8");
  for (const retiredScript of [
    `test:${legacyCapture}-store`,
    `test:${legacyCapture}-drafts`,
    `test:${legacyCapture}-retirement`,
    `test:${legacyCapture}-download`,
    `test:${social}-oauth`,
    `test:${social}-whatsapp`,
    `test:${social}-routing`,
    `test:${social}-login-surface`,
    "test:preserved-integrations"
  ]) {
    assert(!packageJson.includes(retiredScript), `${retiredScript} should be removed from package scripts`);
  }

  const runtimeFiles = (await walk("apps/web/src")).filter((path) => /\.(tsx?|jsx?)$/.test(path));
  const disallowed = [
    new RegExp(`\\b${social}\\b`, "i"),
    new RegExp(`\\b${legacyCapture}\\b`, "i"),
    new RegExp(`${oldWebChannelPrefix}-web`, "i"),
    new RegExp(`${["insta", "gram"].join("")}-web`, "i"),
    new RegExp(`${["face", "book"].join("")}-web`, "i"),
    new RegExp(`${["generic", "web", "chat"].join("-")}`, "i"),
    new RegExp(["Connect", "channels"].join(" "), "i")
  ];

  const offenders: string[] = [];
  for (const file of runtimeFiles) {
    const source = await readFile(join(root, file), "utf8");
    if (disallowed.some((pattern) => pattern.test(source))) offenders.push(file);
  }

  assert.deepEqual(offenders, [], "retired channel terms should not remain in app runtime files");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
