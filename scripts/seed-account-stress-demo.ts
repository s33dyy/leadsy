import { seedAccountStressDemo } from "../apps/web/src/lib/account-stress-demo-seed";

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
    console.error("Usage: npm run seed:account-stress-demo -- --email pratikisawesom3@gmail.com");
    process.exit(1);
  }
  const confirm = process.env.CONFIRM_ACCOUNT_STRESS_DEMO?.trim() ?? "";
  const result = await seedAccountStressDemo({ email, confirm });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
