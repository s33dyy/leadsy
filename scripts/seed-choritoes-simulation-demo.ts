import { seedChoritoesSimulationDemo } from "../apps/web/src/lib/choritoes-simulation-demo-seed";

function argValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = argValue("email")?.trim();
  if (!email) {
    console.error("Usage: npm run seed:choritoes-simulation-demo -- --email pratikisawesom3@gmail.com --mode stress");
    process.exit(1);
  }
  const mode = argValue("mode") === "standard" ? "standard" : "stress";
  const confirm = process.env.CONFIRM_CHORITOES_SIMULATION_DEMO?.trim() ?? "";
  const result = await seedChoritoesSimulationDemo({ email, confirm, mode });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
