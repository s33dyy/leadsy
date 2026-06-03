import assert from "node:assert/strict";

async function main() {
  delete process.env.LEADSY_DATA_DIR;
  process.env.INIT_CWD = "/tmp/leadsy-root";

  const { leadsyDataDir } = await import("../apps/web/src/lib/data-dir");

  assert.equal(leadsyDataDir, "/tmp/leadsy-root/data/app");
  assert.equal(leadsyDataDir.includes(".leadsy-data"), false, "default data dir should not create hidden duplicate stores");

  console.log("data dir regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
