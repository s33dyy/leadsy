import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-extension-store-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
  const {
    cancelExtensionTask,
    claimExtensionTask,
    completeExtensionTask,
    createExtensionTask,
    createExtensionToken,
    deleteExtensionToken,
    editExtensionTask,
    logExtensionTaskEvent,
    listExtensionTasks,
    listExtensionConversations,
    listExtensionChannelMonitorHealth,
    listExtensionTaskEvents,
    listExtensionTokens,
    softDeleteExtensionTask,
    prepareExtensionTask,
    resolveExtensionBearerToken,
    summarizeExtensionHealth,
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

  const intruderDelete = await deleteExtensionToken({
    tenantId: "tenant_test",
    ownerId: "usr_intruder",
    tokenId: token.record.id
  });
  assert.equal(intruderDelete, null, "token deletion should be scoped to the owner");

  const deletedToken = await deleteExtensionToken({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    tokenId: token.record.id
  });
  assert.equal(deletedToken?.id, token.record.id, "token deletion should return the deleted token record");
  assert.equal(Number.isFinite(Date.parse(deletedToken?.revokedAt ?? "")), true, "deleted tokens should be revoked immediately");
  assert.equal(await resolveExtensionBearerToken(`Bearer ${token.token}`), null, "deleted worker token should no longer authenticate");

  const activeTokens = await listExtensionTokens("tenant_test", "usr_owner");
  assert.equal(activeTokens.some((item) => item.id === token.record.id), false, "deleted worker tokens should disappear from active token lists");

  const synced = await syncExtensionConversation({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    platform: "whatsapp-web",
    sourceUrl: "https://web.whatsapp.com/",
    chatFingerprint: "https://web.whatsapp.com/chat/123",
    captureSource: "browser-extension",
    captureConfidence: 0.94,
    tabUrl: "https://web.whatsapp.com/",
    observedAt: "2026-06-02T06:00:12.000Z",
    profileId: "local:whatsapp",
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
        type: "monitor_started",
        summary: "Browser monitor started on WhatsApp Web.",
        occurredAt: "2026-06-02T06:00:11.000Z"
      },
      {
        type: "monitor_synced",
        summary: "Browser monitor synced visible WhatsApp messages.",
        occurredAt: "2026-06-02T06:00:12.000Z"
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
  assert.equal(synced.conversation.captureSource, "browser-extension");
  assert.equal(synced.conversation.captureConfidence, 0.94);
  assert.equal(synced.conversation.tabUrl, "https://web.whatsapp.com/");
  assert.equal(synced.conversation.observedAt, "2026-06-02T06:00:12.000Z");
  assert.equal(synced.conversation.profileId, "local:whatsapp");
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
  assert.equal(conversations[0].events.some((event) => event.type === "monitor_started"), true);
  assert.equal(conversations[0].events.some((event) => event.type === "monitor_synced"), true);

  await syncExtensionConversation({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    platform: "whatsapp-web",
    sourceUrl: "https://web.whatsapp.com/",
    chatFingerprint: "https://web.whatsapp.com/",
    contact: {
      displayName: "Asha Buyer",
      phone: "+919830000000"
    },
    messages: [
      {
        externalId: "in_shifted_fingerprint",
        direction: "inbound",
        body: "The route changed but this is still Asha.",
        sentAt: "2026-06-02T06:02:00.000Z"
      }
    ],
    events: []
  });

  const shiftedConversations = await listExtensionConversations("tenant_test", "usr_owner");
  assert.equal(shiftedConversations.length, 1, "same contact target should update one extension conversation when fingerprint changes");
  assert.equal(shiftedConversations[0].messages.length, 4);
  assert.equal(shiftedConversations[0].conversation.lastMessagePreview, "The route changed but this is still Asha.");

  const monitorHealth = await listExtensionChannelMonitorHealth("tenant_test", "usr_owner");
  const whatsAppHealth = monitorHealth.find((item) => item.platform === "whatsapp-web");
  assert(whatsAppHealth, "monitor health should summarize WhatsApp Web");
  assert.equal(whatsAppHealth.captureSource, "browser-extension");
  assert.equal(whatsAppHealth.status, "active");
  assert.equal(whatsAppHealth.lastSyncedAt, "2026-06-02T06:02:00.000Z");
  assert.equal(whatsAppHealth.lastEventType, "monitor_synced");
  assert.equal(whatsAppHealth.captureConfidence, 0.94);

  const task = await createExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    type: "initiate_conversation",
    status: "queued",
    priority: "high",
    leadId: "lead_asha",
    platform: "whatsapp-web",
    targetUrl: "https://web.whatsapp.com/send?phone=919830000000",
    contact: {
      displayName: "Asha Buyer",
      phone: "+919830000000"
    },
    draftMessage: "Hi Asha, should I send the pricing options here?",
    contextSummary: "Imported lead with pricing interest.",
    dueAt: "2026-06-02T08:00:00.000Z"
  });

  const duplicateTask = await createExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    type: "initiate_conversation",
    status: "queued",
    priority: "high",
    leadId: "lead_asha",
    platform: "whatsapp-web",
    targetUrl: "https://web.whatsapp.com/send?phone=919830000000",
    contact: {
      displayName: "Asha Buyer",
      phone: "+919830000000"
    },
    draftMessage: "Hi Asha, should I send the pricing options here?",
    contextSummary: "Imported lead with pricing interest."
  });

  assert.equal(duplicateTask.id, task.id, "same lead/type should update one active task");
  assert.equal(duplicateTask.status, "queued", "generated tasks should enter the worker queue without task approval");

  const claimed = await claimExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    taskId: task.id
  });
  assert.equal(claimed.status, "in_progress");

  const prepared = await prepareExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    taskId: task.id,
    draftMessage: "Hi Asha, I can send pricing here. What team size should I quote for?"
  });
  assert.equal(prepared.status, "awaiting_send_approval");
  assert.equal(prepared.preparedAt?.startsWith("2026-"), true);
  assert.equal(prepared.draftMessage, "Hi Asha, I can send pricing here. What team size should I quote for?");

  const completed = await completeExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    taskId: task.id,
    status: "sent",
    resultSummary: "Worker sent the WhatsApp opener.",
    outboundMessage: {
      externalId: "task_out_1",
      body: "Hi Asha, I can send pricing here. What team size should I quote for?",
      sentAt: "2026-06-02T08:01:00.000Z"
    }
  });
  assert.equal(completed.status, "sent");
  assert.equal(completed.resultSummary, "Worker sent the WhatsApp opener.");
  assert.equal(completed.completedAt, "2026-06-02T08:01:00.000Z");

  const blocked = await createExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    type: "follow_up",
    status: "queued",
    priority: "normal",
    platform: "instagram-web",
    contact: {
      displayName: "No Profile Lead"
    },
    draftMessage: "Following up on your enquiry.",
    contextSummary: "Missing Instagram profile URL."
  });
  await logExtensionTaskEvent({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    taskId: blocked.id,
    type: "monitor_blocked",
    reason: "target_not_on_whatsapp",
    summary: "The number +91 124 425 2720 is not on WhatsApp."
  });
  await completeExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    taskId: blocked.id,
    status: "blocked",
    resultSummary: "The number +91 124 425 2720 is not on WhatsApp.",
    reason: "target_not_on_whatsapp"
  });

  const taskEvents = await listExtensionTaskEvents("tenant_test", "usr_owner", blocked.id);
  assert.equal(taskEvents.length, 2);
  assert.equal(taskEvents.some((event) => event.reason === "target_not_on_whatsapp"), true);
  assert.equal(taskEvents.some((event) => event.type === "monitor_blocked"), true);

  const postponed = await completeExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    taskId: blocked.id,
    status: "postponed",
    resultSummary: "WhatsApp reports this number is not on WhatsApp. Retrying tomorrow.",
    reason: "target_not_on_whatsapp",
    postponedUntil: "2026-06-03T08:01:00.000Z"
  });
  assert.equal(postponed.status, "postponed");
  assert.equal(postponed.postponedUntil, "2026-06-03T08:01:00.000Z");
  assert.equal(postponed.postponedReason, "target_not_on_whatsapp");

  const edited = await editExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    taskId: postponed.id,
    draftMessage: "Edited follow-up draft.",
    priority: "urgent",
    leadId: "lead_no_profile"
  });
  assert.equal(edited.draftMessage, "Edited follow-up draft.");
  assert.equal(edited.priority, "urgent");
  assert.equal(edited.leadId, "lead_no_profile");

  const deleted = await softDeleteExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    taskId: postponed.id,
    resultSummary: "Task hidden from active worker queue."
  });
  assert.equal(deleted.status, "cancelled");
  assert.equal(typeof deleted.deletedAt, "string");

  const cancelled = await cancelExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    taskId: blocked.id,
    resultSummary: "Owner decided not to contact this lead."
  });
  assert.equal(cancelled.status, "cancelled");

  const tasks = await listExtensionTasks("tenant_test", "usr_owner");
  assert.equal(tasks.length, 1, "soft-deleted tasks should be hidden from the default worker list");
  assert.deepEqual(
    tasks.map((item) => item.status).sort(),
    ["sent"],
    "task list should include non-deleted lifecycle states"
  );
  const allTasks = await listExtensionTasks("tenant_test", "usr_owner", { includeDeleted: true });
  assert.equal(allTasks.length, 2, "deleted tasks should remain recoverable when explicitly requested");

  await createExtensionTask({
    tenantId: "tenant_test",
    ownerId: "usr_owner",
    type: "reply_to_inbound",
    status: "awaiting_send_approval",
    priority: "urgent",
    platform: "whatsapp-web",
    contact: {
      displayName: "Approval Lead",
      phone: "+919830000001"
    },
    draftMessage: "Hi Approval Lead, can I send this now?",
    contextSummary: "Prepared draft needs owner approval."
  });

  const health = await summarizeExtensionHealth();
  assert.equal(health.tasks, 3, "extension health should count all stored worker tasks");
  assert.equal(health.activeTasks, 1, "extension health should count non-terminal, non-deleted tasks");
  assert.equal(health.pendingApprovals, 1, "extension health should expose send approvals for badges and health checks");
  assert.equal(health.conversations, 1, "extension health should count synced browser conversations");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
