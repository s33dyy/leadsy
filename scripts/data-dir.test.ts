import assert from "node:assert/strict";
import { resolveDataDir } from "../apps/web/src/lib/data-dir";

async function main() {
  const localDataDir = resolveDataDir({
    initCwd: "/tmp/leadsy-root",
    configured: "",
    railwayEnvironment: ""
  });

  assert.equal(localDataDir, "/tmp/leadsy-root/data/app");
  assert.equal(localDataDir.includes(".leadsy-data"), false, "default data dir should not create hidden duplicate stores");

  const railwayDataDir = resolveDataDir({
    initCwd: "/app",
    configured: "",
    railwayEnvironment: "production"
  });

  assert.equal(railwayDataDir, "/data/leadsy", "Railway should use the mounted volume when no explicit data dir is set");

  const relativeConfiguredDataDir = resolveDataDir({
    initCwd: "/tmp/leadsy-root",
    configured: "custom-data",
    railwayEnvironment: "production"
  });
  assert.equal(relativeConfiguredDataDir, "/tmp/leadsy-root/custom-data", "explicit relative data dir should still win over Railway default");

  console.log("data dir regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
