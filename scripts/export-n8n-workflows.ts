import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { n8nWorkflowBlueprints } from "@leadsy/workflows";

const routerFileName = "leadsy-automation-router.json";

async function main() {
  const outputDir = join(process.cwd(), "packages", "workflows", "n8n");
  await mkdir(outputDir, { recursive: true });
  const existingFiles = await readdir(outputDir).catch(() => []);
  for (const file of existingFiles) {
    if (file.endsWith(".json")) {
      await rm(join(outputDir, file));
    }
  }

  for (const workflow of n8nWorkflowBlueprints) {
    await writeFile(
      join(outputDir, routerFileName),
      `${JSON.stringify(workflow, null, 2)}\n`,
      "utf8"
    );
  }

  await writeFile(
    join(outputDir, "index.json"),
    `${JSON.stringify(
      n8nWorkflowBlueprints.map((workflow) => ({
        key: workflow.meta.leadsyWorkflowKey,
        name: workflow.name,
        file: routerFileName,
        active: workflow.active,
        providerConfigs: workflow.meta.providerConfigs.map((provider) => ({
          key: provider.key,
          label: provider.label,
          owner: provider.owner,
          fieldCount: provider.fields.length,
          secretFieldCount: provider.fields.filter((field) => field.secret).length
        })),
        routes: workflow.meta.routes.map((route) => ({
          key: route.key,
          name: route.name,
          purpose: route.purpose
        }))
      })),
      null,
      2
    )}\n`,
    "utf8"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
