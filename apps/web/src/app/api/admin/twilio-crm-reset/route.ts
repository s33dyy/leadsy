import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { leadsyDataDir } from "@/lib/data-dir";
import {
  backupRunId,
  createPreTwilioResetBackup,
  resetConfirmationToken,
  resetLocalCrmForTwilio
} from "@/lib/pre-twilio-reset";

export const runtime = "nodejs";

function configuredResetToken() {
  return process.env.LEADSY_PROD_RESET_TOKEN?.trim();
}

export async function POST(request: NextRequest) {
  const expectedToken = configuredResetToken();
  if (!expectedToken) {
    return NextResponse.json({ error: "reset_token_not_configured" }, { status: 404 });
  }

  const providedToken = request.headers.get("x-leadsy-reset-token")?.trim();
  if (providedToken !== expectedToken) {
    return NextResponse.json({ error: "invalid_reset_token" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const confirmation = typeof body.confirm === "string" ? body.confirm.trim() : "";
  const requiredConfirmation = resetConfirmationToken();
  if (confirmation !== requiredConfirmation) {
    return NextResponse.json({ error: "confirmation_required", confirm: requiredConfirmation }, { status: 400 });
  }

  const dataDir = leadsyDataDir;
  const backup = await createPreTwilioResetBackup({
    dataDir,
    backupRoot: join(dataDir, "backups/pre-twilio-reset"),
    label: backupRunId()
  });
  const reset = await resetLocalCrmForTwilio({ dataDir, requiredBackupDir: backup.backupDir });

  return NextResponse.json({
    ok: true,
    backupDir: backup.backupDir,
    files: backup.files,
    before: backup.summary,
    reset
  });
}
