import { createPreTwilioResetBackup, backupRunId } from "../apps/web/src/lib/pre-twilio-reset";

async function main() {
  const backup = await createPreTwilioResetBackup({ label: backupRunId() });
  console.log(
    JSON.stringify(
      {
        ok: true,
        backupDir: backup.backupDir,
        files: backup.files,
        summary: backup.summary
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
