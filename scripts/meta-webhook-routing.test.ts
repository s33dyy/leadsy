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
    const { listMetaWhatsAppConversations } = await import("../apps/web/src/lib/meta-whatsapp-webhook-store");
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
    await saveMetaOAuthConnection({
      tenantId: "tenant_shared_a",
      ownerId: "owner_shared_a",
      token: { access_token: "EAAB_shared_a" },
      query: {
        waba_id: "waba_shared",
        phone_number_id: "phone_shared_a"
      }
    });
    await saveMetaOAuthConnection({
      tenantId: "tenant_shared_b",
      ownerId: "owner_shared_b",
      token: { access_token: "EAAB_shared_b" },
      query: {
        waba_id: "waba_shared",
        phone_number_id: "phone_shared_b"
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
    const responseBody = await response.json();
    assert.equal(responseBody.saved, 1);
    assert.equal(responseBody.tracked, 1, "webhook response should report dedicated WhatsApp tracking writes");

    const ownerXLeads = await listLeadKnowledgeRecords({ tenantId: "tenant_owner_x", ownerId: "owner_x" });
    const ownerYLeads = await listLeadKnowledgeRecords({ tenantId: "tenant_owner_y", ownerId: "owner_y" });
    const defaultLeads = await listLeadKnowledgeRecords({ tenantId: "tenant_default", ownerId: "owner_default" });

    assert.equal(ownerXLeads.length, 1);
    assert.equal(ownerXLeads[0].contact.displayName, "Owner X Lead");
    assert.equal(ownerXLeads[0].lastMessagePreview, "Owner X private message");
    assert.equal(ownerYLeads.length, 0, "owner Y must not see owner X webhook messages");
    assert.equal(defaultLeads.length, 0, "webhook messages must not fall back to the default owner");
    const ownerXConversations = await listMetaWhatsAppConversations({
      tenantId: "tenant_owner_x",
      ownerId: "owner_x",
      whatsappBusinessAccountId: "waba_owner_x",
      phoneNumberId: "phone_owner_x"
    });
    assert.equal(ownerXConversations.length, 1, "official WhatsApp route should track inbound conversations");
    assert.equal(ownerXConversations[0].lastMessageText, "Owner X private message");
    assert.equal(ownerXConversations[0].inboundCount, 1);

    const sharedPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_shared",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "16505552222",
                  phone_number_id: "phone_shared_a"
                },
                contacts: [
                  {
                    profile: { name: "Shared A Lead" },
                    wa_id: "16315552222"
                  }
                ],
                messages: [
                  {
                    from: "16315552222",
                    id: "wamid.shared-a-1",
                    timestamp: "1780391260",
                    type: "text",
                    text: { body: "Shared WABA should route by phone" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };
    const sharedRawBody = JSON.stringify(sharedPayload);
    const sharedSignature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET).update(sharedRawBody).digest("hex")}`;

    const sharedResponse = await POST(
      new Request("https://leadsy.test/api/meta/whatsapp/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": sharedSignature
        },
        body: sharedRawBody
      }) as never
    );
    assert.equal(sharedResponse.status, 200);
    const sharedBody = await sharedResponse.json();
    assert.equal(sharedBody.ambiguous, 0, "shared WABA must not make phone-specific webhooks ambiguous");
    assert.equal(sharedBody.saved, 1);

    const sharedALeads = await listLeadKnowledgeRecords({ tenantId: "tenant_shared_a", ownerId: "owner_shared_a" });
    const sharedBLeads = await listLeadKnowledgeRecords({ tenantId: "tenant_shared_b", ownerId: "owner_shared_b" });
    assert.equal(sharedALeads.length, 1);
    assert.equal(sharedALeads[0].contact.displayName, "Shared A Lead");
    assert.equal(sharedALeads[0].lastMessagePreview, "Shared WABA should route by phone");
    assert.equal(sharedBLeads.length, 0, "shared WABA owner B must not see owner A phone messages");

    const conflictingPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_shared",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "16505553333",
                  phone_number_id: "phone_owner_y"
                },
                contacts: [
                  {
                    profile: { name: "Conflicting Asset Lead" },
                    wa_id: "16315553333"
                  }
                ],
                messages: [
                  {
                    from: "16315553333",
                    id: "wamid.conflict-1",
                    timestamp: "1780391320",
                    type: "text",
                    text: { body: "Mismatched asset ids must not route" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };
    const conflictingRawBody = JSON.stringify(conflictingPayload);
    const conflictingSignature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET).update(conflictingRawBody).digest("hex")}`;

    const conflictingResponse = await POST(
      new Request("https://leadsy.test/api/meta/whatsapp/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": conflictingSignature
        },
        body: conflictingRawBody
      }) as never
    );
    assert.equal(conflictingResponse.status, 200);
    const conflictingBody = await conflictingResponse.json();
    assert.equal(conflictingBody.saved, 0, "conflicting WABA and phone assets must not save messages");
    assert.equal(conflictingBody.unmatched, 1);
    assert.equal(conflictingBody.ambiguous, 0);
    const ownerYLeadsAfterConflict = await listLeadKnowledgeRecords({ tenantId: "tenant_owner_y", ownerId: "owner_y" });
    assert.equal(ownerYLeadsAfterConflict.length, 0, "conflicting WABA must not route by phone alone");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
