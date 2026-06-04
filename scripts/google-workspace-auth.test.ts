import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-google-auth-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const {
      createAuthSession,
      findOrCreateGoogleWorkspaceUser,
      listAuthUsers,
      resolveAuthSession
    } = await import("../apps/web/src/lib/auth-store");

    const first = await findOrCreateGoogleWorkspaceUser({ name: "Asha Buyer", email: "asha@example.com" });
    const second = await findOrCreateGoogleWorkspaceUser({ name: "Rahul Seller", email: "rahul@example.com" });
    const firstAgain = await findOrCreateGoogleWorkspaceUser({ name: "Asha Buyer", email: "asha@example.com" });
    const users = await listAuthUsers();

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(firstAgain.ok, true);
    assert.equal(users.length, 2, "Google signup should dedupe by email but allow multiple customer workspaces");
    assert.equal(first.user.id, firstAgain.user.id, "same Google email should return the same user");
    assert.notEqual(first.user.tenantId, second.user.tenantId, "different customers should not share a tenant workspace");
    assert.equal(first.user.role, "owner");
    assert.equal(second.user.role, "owner");

    const authSession = await createAuthSession(first.user);
    const authFile = join(tempDir, "auth.json");
    const stateBeforeResolve = await readFile(authFile, "utf8");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const resolvedSession = await resolveAuthSession(authSession.token);
    const stateAfterResolve = await readFile(authFile, "utf8");
    assert.equal(resolvedSession?.user.id, first.user.id, "created session should resolve for the Google user");
    assert.equal(stateAfterResolve, stateBeforeResolve, "resolving a session should not write auth.json or risk a lost update");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
