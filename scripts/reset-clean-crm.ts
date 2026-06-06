import {
  createPreTwilioResetBackup,
  backupRunId,
  resetConfirmationToken,
  resetLocalCrmForTwilio
} from "../apps/web/src/lib/pre-twilio-reset";

async function main() {
  const confirmation = process.env.CONFIRM_RESET?.trim();
  const required = resetConfirmationToken();
  if (confirmation !== required) {
    console.error(`Refusing to reset CRM data. Set CONFIRM_RESET=${required} to proceed.`);
    process.exit(1);
  }

  const backup = await createPreTwilioResetBackup({ label: backupRunId() });
  const reset = await resetLocalCrmForTwilio({ requiredBackupDir: backup.backupDir });
  console.log(
    JSON.stringify(
      {
        ok: true,
        backupDir: backup.backupDir,
        reset
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
