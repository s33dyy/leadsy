import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-meta-oauth-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const {
      exchangeMetaOAuthCode,
      listMetaOAuthConnections,
      saveMetaOAuthConnection
    } = await import("../apps/web/src/lib/meta-oauth-store");

    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    const unconfigured = await exchangeMetaOAuthCode({
      code: "code_123",
      redirectUri: "https://leadsy.up.railway.app/api/meta/oauth/callback",
      fetchImpl: async () => {
        throw new Error("fetch should not run without app credentials");
      }
    });
    assert.equal(unconfigured.ok, false);
    assert.equal(unconfigured.reason, "unconfigured");

    process.env.META_APP_ID = "app_123";
    process.env.META_APP_SECRET = "secret_123";
    let requestedUrl = "";
    const exchanged = await exchangeMetaOAuthCode({
      code: "code_123",
      redirectUri: "https://leadsy.up.railway.app/api/meta/oauth/callback",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return new Response(
          JSON.stringify({
            access_token: "EAAB_token_123456",
            token_type: "bearer",
            expires_in: 3600
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    assert.equal(exchanged.ok, true);
    assert.equal(exchanged.token.access_token, "EAAB_token_123456");
    const url = new URL(requestedUrl);
    assert.equal(url.origin + url.pathname, "https://graph.facebook.com/oauth/access_token");
    assert.equal(url.searchParams.get("client_id"), "app_123");
    assert.equal(url.searchParams.get("client_secret"), "secret_123");
    assert.equal(url.searchParams.get("code"), "code_123");
    assert.equal(url.searchParams.get("redirect_uri"), "https://leadsy.up.railway.app/api/meta/oauth/callback");

    const saved = await saveMetaOAuthConnection({
      tenantId: "tenant_test",
      ownerId: "owner_test",
      token: exchanged.token,
      query: {
        business_id: "business_123",
        waba_id: "waba_123",
        phone_number_id: "phone_123",
        code: "code_123"
      }
    });
    assert.equal(saved.tokenPreview, "...3456");
    assert.equal(saved.businessId, "business_123");
    assert.equal(saved.whatsappBusinessAccountId, "waba_123");
    assert.equal(saved.phoneNumberId, "phone_123");
    assert.equal(saved.rawQuery.code, undefined, "OAuth codes should not be persisted after exchange");

    const connections = await listMetaOAuthConnections("tenant_test", "owner_test");
    assert.equal(connections.length, 1);
    assert.equal(connections[0].tokenPreview, "...3456");
    assert.equal(connections[0].accessToken, undefined, "List responses should not expose stored access tokens");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
