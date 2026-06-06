import {
  createFullProductResetBackup,
  fullProductResetConfirmationToken,
  fullProductResetRunId,
  resetFullProductData
} from "../apps/web/src/lib/pre-twilio-reset";

async function main() {
  const confirmation = process.env.CONFIRM_FULL_PRODUCT_RESET?.trim();
  const required = fullProductResetConfirmationToken();
  if (confirmation !== required) {
    console.error(`Refusing to reset all app data and users. Set CONFIRM_FULL_PRODUCT_RESET=${required} to proceed.`);
    process.exit(1);
  }

  const backup = await createFullProductResetBackup({ label: fullProductResetRunId() });
  const reset = await resetFullProductData({ requiredBackupDir: backup.backupDir });
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
