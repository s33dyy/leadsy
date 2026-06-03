import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-meta-route-"));
  process.env.LEADSY_DATA_DIR = tempDir;
  process.env.META_APP_SECRET = "secret_123";
  process.env.LEADSY_META_TENANT_ID = "tenant_default";
  process.env.LEADSY_META_OWNER_ID = "owner_default";

  try {
    const { saveMetaOAuthConnection } = await import("../apps/web/src/lib/meta-oauth-store");
    const { listLeadKnowledgeRecords } = await import("../apps/web/src/lib/lead-knowledge-store");
    const { POST } = await import("../apps/web/src/app/api/meta/whatsapp/webhook/route");

    await saveMetaOAuthConnection({
      tenantId: "tenant_owner_x",
      ownerId: "owner_x",
      token: { access_token: "EAAB_owner_x" },
      query: {
        waba_id: "waba_owner_x",
        phone_number_id: "phone_owner_x"
      }
    });
    await saveMetaOAuthConnection({
      tenantId: "tenant_owner_y",
      ownerId: "owner_y",
      token: { access_token: "EAAB_owner_y" },
      query: {
        waba_id: "waba_owner_y",
        phone_number_id: "phone_owner_y"
      }
    });

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_owner_x",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "16505551111",
                  phone_number_id: "phone_owner_x"
                },
                contacts: [
                  {
                    profile: { name: "Owner X Lead" },
                    wa_id: "16315551181"
                  }
                ],
                messages: [
                  {
                    from: "16315551181",
                    id: "wamid.owner-x-1",
                    timestamp: "1780391200",
                    type: "text",
                    text: { body: "Owner X private message" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };
    const rawBody = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET).update(rawBody).digest("hex")}`;

    const response = await POST(
      new Request("https://leadsy.test/api/meta/whatsapp/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature
        },
        body: rawBody
      }) as never
    );
    assert.equal(response.status, 200);

    const ownerXLeads = await listLeadKnowledgeRecords({ tenantId: "tenant_owner_x", ownerId: "owner_x" });
    const ownerYLeads = await listLeadKnowledgeRecords({ tenantId: "tenant_owner_y", ownerId: "owner_y" });
    const defaultLeads = await listLeadKnowledgeRecords({ tenantId: "tenant_default", ownerId: "owner_default" });

    assert.equal(ownerXLeads.length, 1);
    assert.equal(ownerXLeads[0].contact.displayName, "Owner X Lead");
    assert.equal(ownerXLeads[0].lastMessagePreview, "Owner X private message");
    assert.equal(ownerYLeads.length, 0, "owner Y must not see owner X webhook messages");
    assert.equal(defaultLeads.length, 0, "webhook messages must not fall back to the default owner");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
