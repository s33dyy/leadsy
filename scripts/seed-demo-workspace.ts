async function main() {
  process.env.LEADSY_DATA_DIR ||= "./data/app";
  const { seedLeadsyDemoWorkspace } = await import("../apps/web/src/lib/demo-workspace-seed");
  const result = await seedLeadsyDemoWorkspace({ requirePassword: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
