import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

async function main() {
  const pagePath = join(process.cwd(), "apps/web/src/app/extension/page.tsx");
  const zipPath = join(process.cwd(), "apps/web/public/downloads/leadsy-extension.zip");

  const source = await readFile(pagePath, "utf8");
  assert(source.includes("/downloads/leadsy-extension.zip"), "extension page must link to the packaged extension zip");
  assert(source.includes("chrome://extensions"), "extension page must include Chrome extensions install path");
  assert(source.includes("Developer mode"), "extension page must tell users to enable Developer mode");
  assert(source.includes("Load unpacked"), "extension page must explain unpacked extension installation");
  assert(source.includes("Leadsy extension"), "extension page should identify the downloadable asset clearly");

  await access(zipPath, constants.R_OK);
  const zip = await stat(zipPath);
  assert(zip.size > 0, "extension zip must exist and be non-empty");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
