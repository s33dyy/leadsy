import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { n8nWorkflowBlueprints } from "@leadsy/workflows";

function fileNameForWorkflow(key: string) {
  return `${key}.json`;
}

async function main() {
  const outputDir = join(process.cwd(), "packages", "workflows", "n8n");
  await mkdir(outputDir, { recursive: true });

  for (const workflow of n8nWorkflowBlueprints) {
    await writeFile(
      join(outputDir, fileNameForWorkflow(workflow.meta.leadsyWorkflowKey)),
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
        file: fileNameForWorkflow(workflow.meta.leadsyWorkflowKey),
        active: workflow.active
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
