import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function fileExists(path: string) {
  try {
    await stat(join(root, path));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  assert.equal(await fileExists("apps/web/src/app/api/meta/oauth/start/route.ts"), true, "Meta OAuth should start through an authenticated local route");

  const startRoute = await read("apps/web/src/app/api/meta/oauth/start/route.ts");
  assert(startRoute.includes("getSessionFromRequest"), "Meta OAuth start should verify the Leadsy session before leaving the app");
  assert(startRoute.includes("META_EMBEDDED_SIGNUP_URL"), "Meta OAuth start should preserve the existing Meta URL env var");
  assert(startRoute.includes("/login?next=/app/connect&error=meta_session"), "Meta OAuth start should send unauthenticated users to a clear reconnect login");
  assert(startRoute.includes("NextResponse.redirect(metaConnectUrl)"), "Meta OAuth start should redirect to the existing Meta authorization URL");

  const connectPage = await read("apps/web/src/app/app/connect/page.tsx");
  assert(connectPage.includes('href="/api/meta/oauth/start"'), "connect page should not link directly to Meta before checking the Leadsy session");
  assert(connectPage.includes("META_EMBEDDED_SIGNUP_URL"), "connect page should still use existing Meta env configuration for readiness only");

  const authPage = await read("apps/web/src/components/auth-page.tsx");
  assert(authPage.includes("meta_session"), "auth page should explain Meta reconnect sessions instead of showing a blank login");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
