import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-cleanup-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  const tenantId = "tenant_test";
  const ownerId = "usr_owner";
  const otherTenantId = "tenant_other";

  await mkdir(tempDir, { recursive: true });
  await writeFile(
  join(tempDir, "lead-knowledge.json"),
  JSON.stringify(
    {
      leads: [
        {
          id: "lead_bibhor",
          tenantId,
          ownerId,
          identityKeys: ["phone:918100510961"],
          contact: { displayName: "Bibhor Das", phone: "+91 81005 10961" },
          leadStatus: "lead",
          crmStatus: "new_lead",
          qualificationFields: {},
          qualificationStage: "new",
          facts: ["Manual lead for Contendo."],
          createdAt: "2026-06-05T10:00:00.000Z",
          updatedAt: "2026-06-05T10:00:00.000Z"
        },
        {
          id: "lead_dummy",
          tenantId,
          ownerId,
          identityKeys: ["phone:919999999999"],
          contact: { displayName: "Dummy Lead", phone: "+91 99999 99999" },
          leadStatus: "lead",
          crmStatus: "new_lead",
          qualificationFields: {},
          qualificationStage: "new",
          facts: [],
          createdAt: "2026-06-05T10:00:00.000Z",
          updatedAt: "2026-06-05T10:00:00.000Z"
        },
        {
          id: "lead_other_tenant",
          tenantId: otherTenantId,
          ownerId,
          identityKeys: ["phone:918888888888"],
          contact: { displayName: "Other Tenant Lead", phone: "+91 88888 88888" },
          leadStatus: "lead",
          crmStatus: "new_lead",
          qualificationFields: {},
          qualificationStage: "new",
          facts: [],
          createdAt: "2026-06-05T10:00:00.000Z",
          updatedAt: "2026-06-05T10:00:00.000Z"
        }
      ],
      conversations: [
        {
          id: "conv_bibhor",
          tenantId,
          ownerId,
          leadId: "lead_bibhor",
          channel: "whatsapp-web",
          source: "extension",
          externalKey: "phone:918100510961",
          contact: { displayName: "Bibhor Das", phone: "+91 81005 10961" },
          knowledgeStatus: "included",
          messageCount: 1,
          inboundCount: 1,
          outboundCount: 0,
          createdAt: "2026-06-05T10:00:00.000Z",
          updatedAt: "2026-06-05T10:00:00.000Z"
        },
        {
          id: "conv_dummy",
          tenantId,
          ownerId,
          leadId: "lead_dummy",
          channel: "whatsapp-web",
          source: "extension",
          externalKey: "phone:919999999999",
          contact: { displayName: "Dummy Lead", phone: "+91 99999 99999" },
          knowledgeStatus: "included",
          messageCount: 1,
          inboundCount: 1,
          outboundCount: 0,
          createdAt: "2026-06-05T10:00:00.000Z",
          updatedAt: "2026-06-05T10:00:00.000Z"
        }
      ],
      messages: [
        {
          id: "msg_bibhor",
          tenantId,
          ownerId,
          leadId: "lead_bibhor",
          conversationId: "conv_bibhor",
          source: "extension",
          channel: "whatsapp-web",
          externalId: "bibhor-1",
          direction: "inbound",
          body: "Can I get more info?",
          messageType: "text",
          sentAt: "2026-06-05T10:00:00.000Z",
          receivedAt: "2026-06-05T10:00:00.000Z"
        },
        {
          id: "msg_dummy",
          tenantId,
          ownerId,
          leadId: "lead_dummy",
          conversationId: "conv_dummy",
          source: "extension",
          channel: "whatsapp-web",
          externalId: "dummy-1",
          direction: "inbound",
          body: "Dummy message",
          messageType: "text",
          sentAt: "2026-06-05T10:00:00.000Z",
          receivedAt: "2026-06-05T10:00:00.000Z"
        }
      ]
    },
    null,
    2
  )
  );

  await writeFile(
  join(tempDir, "extension.json"),
  JSON.stringify(
    {
      tokens: [
        {
          id: "token_keep",
          tenantId,
          ownerId,
          label: "Extension",
          tokenHash: "hash",
          tokenPreview: "...hash",
          createdAt: "2026-06-05T10:00:00.000Z",
          expiresAt: "2027-06-05T10:00:00.000Z"
        }
      ],
      conversations: [
        {
          id: "extconv_bibhor",
          tenantId,
          ownerId,
          platform: "whatsapp-web",
          sourceUrl: "https://web.whatsapp.com/send?phone=918100510961",
          chatFingerprint: "phone:918100510961",
          contact: { displayName: "Bibhor Das", phone: "+91 81005 10961" },
          status: "active",
          messageCount: 1,
          createdAt: "2026-06-05T10:00:00.000Z",
          updatedAt: "2026-06-05T10:00:00.000Z"
        },
        {
          id: "extconv_dummy",
          tenantId,
          ownerId,
          platform: "whatsapp-web",
          sourceUrl: "https://web.whatsapp.com/send?phone=919999999999",
          chatFingerprint: "phone:919999999999",
          contact: { displayName: "Dummy Lead", phone: "+91 99999 99999" },
          status: "active",
          messageCount: 1,
          createdAt: "2026-06-05T10:00:00.000Z",
          updatedAt: "2026-06-05T10:00:00.000Z"
        }
      ],
      messages: [
        {
          id: "extconv_bibhor:msg_1",
          externalId: "bibhor-1",
          direction: "inbound",
          body: "Can I get more info?",
          sentAt: "2026-06-05T10:00:00.000Z"
        },
        {
          id: "extconv_dummy:msg_1",
          externalId: "dummy-1",
          direction: "inbound",
          body: "Dummy message",
          sentAt: "2026-06-05T10:00:00.000Z"
        }
      ],
      events: [
        { id: "extconv_bibhor:evt_1", type: "monitor_synced", summary: "Bibhor synced.", occurredAt: "2026-06-05T10:00:00.000Z" },
        { id: "extconv_dummy:evt_1", type: "monitor_synced", summary: "Dummy synced.", occurredAt: "2026-06-05T10:00:00.000Z" }
      ],
      tasks: [
        {
          id: "task_bibhor",
          tenantId,
          ownerId,
          type: "follow_up",
          status: "in_progress",
          priority: "normal",
          platform: "whatsapp-web",
          targetUrl: "https://web.whatsapp.com/send?phone=918100510961",
          contact: { displayName: "Bibhor Das", phone: "+91 81005 10961" },
          draftMessage: "Hi Bibhor Das, following up.",
          contextSummary: "Manual lead for Contendo.",
          createdAt: "2026-06-05T10:00:00.000Z",
          updatedAt: "2026-06-05T10:00:00.000Z"
        },
        {
          id: "task_dummy",
          tenantId,
          ownerId,
          type: "follow_up",
          status: "queued",
          priority: "normal",
          platform: "whatsapp-web",
          targetUrl: "https://web.whatsapp.com/send?phone=919999999999",
          contact: { displayName: "Dummy Lead", phone: "+91 99999 99999" },
          draftMessage: "Hi dummy.",
          contextSummary: "Dummy data.",
          createdAt: "2026-06-05T10:00:00.000Z",
          updatedAt: "2026-06-05T10:00:00.000Z"
        }
      ],
      taskEvents: [
        { id: "evt_task_bibhor", tenantId, ownerId, taskId: "task_bibhor", type: "worker_opened", summary: "Opened.", occurredAt: "2026-06-05T10:00:00.000Z" },
        { id: "evt_task_dummy", tenantId, ownerId, taskId: "task_dummy", type: "worker_opened", summary: "Opened.", occurredAt: "2026-06-05T10:00:00.000Z" }
      ]
    },
    null,
    2
  )
  );

  const { pruneLeadKnowledgeToTargets } = await import("../apps/web/src/lib/lead-knowledge-store");
  const { pruneExtensionDataToTargets } = await import("../apps/web/src/lib/extension-store");

  const keepTerms = ["Bibhor Das", "8100510961", "Contendo"];
  const dryRun = await pruneLeadKnowledgeToTargets({ tenantId, ownerId, keepTerms, tenantWide: true, dryRun: true });
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.removed.leads, 1);

  const leadResult = await pruneLeadKnowledgeToTargets({ tenantId, ownerId, keepTerms, tenantWide: true });
  const extensionResult = await pruneExtensionDataToTargets({ tenantId, ownerId, keepTerms, tenantWide: true });

  assert.deepEqual(leadResult.removed, { leads: 1, conversations: 1, messages: 1 });
  assert.equal(extensionResult.removed.conversations, 1);
  assert.equal(extensionResult.removed.messages, 1);
  assert.equal(extensionResult.removed.events, 1);
  assert.equal(extensionResult.removed.tasks, 1);
  assert.equal(extensionResult.removed.taskEvents, 1);
  assert.equal(extensionResult.removed.tokens, 0);

  const knowledge = JSON.parse(await readFile(join(tempDir, "lead-knowledge.json"), "utf8"));
  assert.deepEqual(knowledge.leads.map((lead: { id: string }) => lead.id).sort(), ["lead_bibhor", "lead_other_tenant"]);
  assert.deepEqual(knowledge.conversations.map((conversation: { id: string }) => conversation.id), ["conv_bibhor"]);
  assert.deepEqual(knowledge.messages.map((message: { id: string }) => message.id), ["msg_bibhor"]);

  const extension = JSON.parse(await readFile(join(tempDir, "extension.json"), "utf8"));
  assert.deepEqual(extension.tokens.map((token: { id: string }) => token.id), ["token_keep"]);
  assert.deepEqual(extension.conversations.map((conversation: { id: string }) => conversation.id), ["extconv_bibhor"]);
  assert.deepEqual(extension.messages.map((message: { id: string }) => message.id), ["extconv_bibhor:msg_1"]);
  assert.deepEqual(extension.events.map((event: { id: string }) => event.id), ["extconv_bibhor:evt_1"]);
  assert.deepEqual(extension.tasks.map((task: { id: string }) => task.id), ["task_bibhor"]);
  assert.deepEqual(extension.taskEvents.map((event: { id: string }) => event.id), ["evt_task_bibhor"]);

  console.log("dummy data cleanup regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
