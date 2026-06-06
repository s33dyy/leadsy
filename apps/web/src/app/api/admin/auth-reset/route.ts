import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { leadsyDataDir } from "@/lib/data-dir";

export const runtime = "nodejs";

const requiredConfirmation = "RESET_LEADSY_AUTH_USERS";

function configuredResetToken() {
  return process.env.LEADSY_PROD_RESET_TOKEN?.trim();
}

function backupRunId() {
  return `pre-auth-reset-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}

function arrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

async function readAuthState(dataDir: string) {
  const raw = await readFile(join(dataDir, "auth.json"), "utf8").catch(() => "");
  const parsed = raw.trim() ? JSON.parse(raw) : {};
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
  };
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
  if (confirmation !== requiredConfirmation) {
    return NextResponse.json({ error: "confirmation_required", confirm: requiredConfirmation }, { status: 400 });
  }

  const dataDir = leadsyDataDir;
  const authFile = join(dataDir, "auth.json");
  const before = await readAuthState(dataDir);
  const backupDir = join(dataDir, "backups/pre-auth-reset", backupRunId());
  await mkdir(backupDir, { recursive: true });
  if (existsSync(authFile)) {
    await copyFile(authFile, join(backupDir, "auth.json"));
  }

  await writeFile(authFile, `${JSON.stringify({ users: [], sessions: [] }, null, 2)}\n`);
  const after = await readAuthState(dataDir);

  return NextResponse.json({
    ok: true,
    backupDir,
    before: {
      users: arrayCount(before.users),
      sessions: arrayCount(before.sessions)
    },
    after: {
      users: arrayCount(after.users),
      sessions: arrayCount(after.sessions)
    }
  });
}
