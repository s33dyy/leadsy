import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-demo-seed-"));
  process.env.LEADSY_DATA_DIR = tempDir;
  process.env.LEADSY_DEMO_OWNER_PASSWORD = "demo-seed-test-password";

  try {
    const { seedLeadsyDemoWorkspace } = await import("../apps/web/src/lib/demo-workspace-seed");

    const first = await seedLeadsyDemoWorkspace({ requirePassword: true });
    const second = await seedLeadsyDemoWorkspace({ requirePassword: true });

    assert.equal(first.credentials.emailOrPhone, "demo-owner@leadsy.local");
    assert.equal(first.credentials.passwordSource, "LEADSY_DEMO_OWNER_PASSWORD");
    assert.equal(first.owner.id, "usr_demo_agency_owner");
    assert.equal(first.owner.tenantId, "tenant_demo_agency");
    assert.equal(first.created.owner, true, "first seed should create the deterministic owner");
    assert.equal(second.created.owner, false, "second seed should reuse the deterministic owner");

    const auth = await readJson(join(tempDir, "auth.json"));
    assert.equal(auth.users.filter((user: { id: string }) => user.id === "usr_demo_agency_owner").length, 1);

    const knowledge = await readJson(join(tempDir, "lead-knowledge.json"));
    const demoLeads = knowledge.leads.filter((lead: { tenantId: string; ownerId: string }) => {
      return lead.tenantId === "tenant_demo_agency" && lead.ownerId === "usr_demo_agency_owner";
    });
    assert.equal(demoLeads.length, first.counts.leads);
    assert(demoLeads.length >= 4, "demo workspace should include multiple lead records");
    assert.equal(demoLeads.filter((lead: { leadStatus: string }) => lead.leadStatus === "excluded").length, 1);

    const demoConversations = knowledge.conversations.filter((conversation: { tenantId: string; ownerId: string }) => {
      return conversation.tenantId === "tenant_demo_agency" && conversation.ownerId === "usr_demo_agency_owner";
    });
    const channels = new Set(demoConversations.map((conversation: { channel: string }) => conversation.channel));
    for (const channel of ["whatsapp", "instagram", "facebook", "email", "call", "generic-web-chat", "manual"]) {
      assert(channels.has(channel), `demo workspace should include ${channel} communications`);
    }
    assert.equal(
      demoConversations.some((conversation: { knowledgeStatus: string }) => conversation.knowledgeStatus === "excluded"),
      true,
      "demo workspace should include an excluded conversation"
    );

    const extension = await readJson(join(tempDir, "extension.json"));
    const tasks = extension.tasks.filter((task: { tenantId: string; ownerId: string }) => {
      return task.tenantId === "tenant_demo_agency" && task.ownerId === "usr_demo_agency_owner";
    });
    assert.equal(tasks.length, first.counts.tasks);
    assert.deepEqual(
      new Set(tasks.map((task: { status: string }) => task.status)),
      new Set(["queued", "awaiting_send_approval", "blocked", "sent"])
    );
    assert.equal(second.counts.tasks, first.counts.tasks, "seed should be idempotent for tasks");

    delete process.env.LEADSY_DEMO_OWNER_PASSWORD;
    await assert.rejects(
      () => seedLeadsyDemoWorkspace({ requirePassword: true }),
      /LEADSY_DEMO_OWNER_PASSWORD/,
      "production/demo endpoint seed should fail when the password env is missing"
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
