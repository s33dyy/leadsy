import assert from "node:assert/strict";

const dataDirModule = new URL("../apps/web/src/lib/data-dir.ts", import.meta.url);

async function loadDataDir(env: Record<string, string | undefined>, suffix: string) {
  const previous = {
    INIT_CWD: process.env.INIT_CWD,
    LEADSY_DATA_DIR: process.env.LEADSY_DATA_DIR,
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const imported = await import(`${dataDirModule.href}?case=${suffix}`);

  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return imported.leadsyDataDir as string;
}

async function main() {
  const localDataDir = await loadDataDir(
    {
      INIT_CWD: "/tmp/leadsy-root",
      LEADSY_DATA_DIR: undefined,
      RAILWAY_ENVIRONMENT: undefined
    },
    "local-default"
  );

  assert.equal(localDataDir, "/tmp/leadsy-root/data/app");
  assert.equal(localDataDir.includes(".leadsy-data"), false, "default data dir should not create hidden duplicate stores");

  const railwayDataDir = await loadDataDir(
    {
      INIT_CWD: "/app",
      LEADSY_DATA_DIR: undefined,
      RAILWAY_ENVIRONMENT: "production"
    },
    "railway-default"
  );

  assert.equal(railwayDataDir, "/data/leadsy", "Railway should use the mounted volume when no explicit data dir is set");

  console.log("data dir regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
