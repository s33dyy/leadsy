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
    assert.deepEqual(first.counts, {
      leads: 1,
      conversations: 1,
      messages: 2,
      teamMembers: 2,
      internalMessages: 1,
      calendarEvents: 2
    });

    const auth = await readJson(join(tempDir, "auth.json"));
    assert.equal(auth.users.filter((user: { id: string }) => user.id === "usr_demo_agency_owner").length, 1);
    assert.equal(auth.users[0].onboardingProfile.whatsappTransport, "leadsy_managed_twilio");

    const knowledge = await readJson(join(tempDir, "lead-knowledge.json"));
    assert.equal(knowledge.leads.length, 1);
    assert.equal(knowledge.conversations.length, 1);
    assert.equal(knowledge.conversations[0].channel, "whatsapp");
    assert.equal(knowledge.conversations[0].source, "twilio_simulator");
    assert.equal(knowledge.messages.filter((message: { direction: string }) => message.direction === "inbound").length, 1);
    assert.equal(knowledge.messages.filter((message: { direction: string }) => message.direction === "outbound").length, 1);

    const teamspace = await readJson(join(tempDir, "teamspace.json"));
    assert.equal(teamspace.members.length, 2);
    assert(teamspace.members.some((member: { type: string; autoReplyEnabled: boolean }) => member.type === "ai_agent_full" && member.autoReplyEnabled));
    assert(teamspace.members.some((member: { type: string; pipelineStages: string[] }) => member.type === "human" && member.pipelineStages.includes("qualified")));
    assert.equal(teamspace.threadMessages.length, 1);

    const calendar = await readJson(join(tempDir, "calendar.json"));
    assert.equal(calendar.events.length, 2);
    assert(calendar.events.some((event: { eventType: string }) => event.eventType === "availability"));
    assert(calendar.events.some((event: { eventType: string; leadId?: string }) => event.eventType === "meeting" && event.leadId));

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
