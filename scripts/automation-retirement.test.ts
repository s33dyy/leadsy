import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const retiredRunner = ["n", "8", "n"].join("");
const retiredRunnerUpper = retiredRunner.toUpperCase();
const reportName = ["N", "8", "N_RETIREMENT_REPORT.md"].join("");
const retiredAgentPhrase = ["backend", "agent"].join(" ");
const retiredAgentSlug = ["backend", "agent"].join("-");

const removedPaths = [
  ["apps", "web", "src", "lib", `${retiredRunner}-automation-gateway.ts`],
  ["apps", "web", "src", "app", "api", "automation", "agent", "route.ts"],
  ["apps", "web", "src", "app", "api", "automation", "executions", "route.ts"],
  ["packages", "workflows", "src", `${retiredRunner}-blueprints.ts`],
  ["packages", "workflows", retiredRunner],
  ["scripts", `${retiredRunner}-workflows.test.ts`],
  ["scripts", "automation-gateway.test.ts"],
  ["scripts", `export-${retiredRunner}-workflows.ts`]
];

const scannedRoots = ["apps/web/src", "packages", "scripts", "package.json"];
const forbiddenRuntimeTerms = [
  retiredRunner,
  retiredRunnerUpper,
  `LEADSY_${retiredRunnerUpper}`,
  retiredAgentPhrase,
  retiredAgentSlug,
  `Managed in ${retiredRunner}`,
  `Open ${retiredRunner}`,
  `Pending ${retiredRunner}`
];

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function collectFiles(root: string, path: string): Promise<string[]> {
  const absolute = join(root, path);
  const info = await stat(absolute);
  if (info.isFile()) return [absolute];
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules")
      .map((entry) => collectFiles(root, join(path, entry.name)))
  );
  return nested.flat();
}

async function main() {
  const root = process.cwd();

  for (const pathParts of removedPaths) {
    const path = join(root, ...pathParts);
    assert.equal(await exists(path), false, `${relative(root, path)} should be removed`);
  }

  const runtimeFiles = (await Promise.all(scannedRoots.map((path) => collectFiles(root, path)))).flat();
  for (const file of runtimeFiles) {
    if (file.endsWith("automation-retirement.test.ts")) continue;
    const source = await readFile(file, "utf8");
    for (const term of forbiddenRuntimeTerms) {
      assert(
        !source.toLowerCase().includes(term.toLowerCase()),
        `${relative(root, file)} should not contain retired automation runner term: ${term}`
      );
    }
  }

  const reportPath = join(root, reportName);
  assert.equal(await exists(reportPath), true, `${reportName} should document the retirement`);
  const report = await readFile(reportPath, "utf8");
  for (const required of [
    "Removed app surfaces",
    "Leadsy-native replacements",
    "Railway cleanup checklist",
    "Verification",
    "Rollback note"
  ]) {
    assert(report.includes(required), `${reportName} should include ${required}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
