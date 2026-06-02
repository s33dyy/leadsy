import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-extension-store-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
  const {
    createExtensionToken,
    listExtensionConversations,
    resolveExtensionBearerToken,
    syncExtensionConversation
  } = await import("../apps/web/src/lib/extension-store");

  const token = await createExtensionToken({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    label: "Chrome on Mac"
  });

  assert.equal(token.token.startsWith("lext_"), true, "token should use the extension token prefix");
  assert.equal(token.record.tokenPreview.endsWith(token.token.slice(-4)), true, "stored record should expose only a token preview");

  const resolved = await resolveExtensionBearerToken(`Bearer ${token.token}`);
  assert.deepEqual(
    resolved && { tenantId: resolved.tenantId, ownerId: resolved.ownerId },
    { tenantId: "tenant_test", ownerId: "usr_owner" },
    "bearer token should resolve to the paired owner scope"
  );

  const synced = await syncExtensionConversation({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    platform: "whatsapp-web",
    sourceUrl: "https://web.whatsapp.com/",
    chatFingerprint: "https://web.whatsapp.com/chat/123",
    contact: {
      displayName: "Asha Buyer",
      phone: "+919830000000"
    },
    messages: [
      {
        externalId: "in_1",
        direction: "inbound",
        body: "Can you send pricing?",
        sentAt: "2026-06-02T06:00:00.000Z"
      },
      {
        externalId: "out_1",
        direction: "outbound",
        body: "Yes, what team size should I quote for?",
        sentAt: "2026-06-02T06:00:10.000Z",
        generatedBy: "leadsy"
      }
    ],
    events: [
      {
        type: "reply-sent",
        summary: "Full-auto reply sent by extension.",
        occurredAt: "2026-06-02T06:00:11.000Z"
      }
    ],
    insight: {
      summary: "Buyer asked for pricing.",
      qualification: "pricing-intent",
      nextAction: "Ask budget and timeline.",
      sentiment: "positive"
    }
  });

  assert.equal(synced.conversation.contact.displayName, "Asha Buyer");
  assert.equal(synced.conversation.messageCount, 2);
  assert.equal(synced.conversation.lastMessagePreview, "Yes, what team size should I quote for?");
  assert.equal(synced.conversation.nextAction, "Ask budget and timeline.");

  await syncExtensionConversation({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    platform: "whatsapp-web",
    sourceUrl: "https://web.whatsapp.com/",
    chatFingerprint: "https://web.whatsapp.com/chat/123",
    contact: {
      displayName: "Asha Buyer",
      phone: "+919830000000"
    },
    messages: [
      {
        externalId: "in_1",
        direction: "inbound",
        body: "Can you send pricing?",
        sentAt: "2026-06-02T06:00:00.000Z"
      },
      {
        externalId: "in_2",
        direction: "inbound",
        body: "Need this by Friday.",
        sentAt: "2026-06-02T06:01:00.000Z"
      }
    ],
    events: []
  });

  const conversations = await listExtensionConversations("tenant_test", "usr_owner");
  assert.equal(conversations.length, 1, "same chat fingerprint should update one conversation");
  assert.equal(conversations[0].messages.length, 3, "message sync should dedupe by external id");
  assert.equal(conversations[0].conversation.messageCount, 3);
  assert.equal(conversations[0].conversation.lastMessagePreview, "Need this by Friday.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
