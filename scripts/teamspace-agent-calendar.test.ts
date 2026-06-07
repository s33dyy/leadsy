import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-teamspace-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const {
      createTeamMember,
      listTeamMembers,
      postTeamThreadMessage,
      listTeamThreadMessages,
      provisionTeamMemberSender,
      updateTeamMember
    } = await import("../apps/web/src/lib/teamspace-store");
    const {
      createCalendarEvent,
      findCalendarFreeSlots,
      listCalendarEvents
    } = await import("../apps/web/src/lib/calendar-store");

    const scope = { tenantId: "tenant_teamspace", ownerId: "owner_teamspace" };

    const human = await createTeamMember({
      ...scope,
      type: "human",
      name: "Nisha Manager",
      emailOrPhone: "nisha@example.com",
      password: "strong-password-1",
      role: "manager",
      pipelineStages: ["qualified", "meeting"],
      autoReplyEnabled: false
    });
    assert.equal(human.type, "human");
    assert.equal(human.authUserId?.startsWith("usr_"), true);
    assert.equal(human.status, "active");

    const qualificationAgent = await createTeamMember({
      ...scope,
      type: "ai_agent_full",
      name: "Qualification AI",
      role: "agent",
      pipelineStages: ["new", "collecting"],
      behaviorInstructions: "Qualify inbound WhatsApp leads with one concise question at a time.",
      autoReplyEnabled: true,
      escalationKeywords: ["human", "manager", "refund"]
    });
    assert.equal(qualificationAgent.autoReplyEnabled, true);

    const assistedAgent = await createTeamMember({
      ...scope,
      type: "ai_agent_assisted",
      name: "Demo Prep AI",
      role: "agent",
      pipelineStages: ["qualified"],
      behaviorInstructions: "Prepare demo tasks for humans.",
      autoReplyEnabled: false
    });
    assert.equal(assistedAgent.type, "ai_agent_assisted");

    const provisioned = await provisionTeamMemberSender({ ...scope, memberId: qualificationAgent.id });
    assert.equal(provisioned.sender.transportMode, "workspace");
    assert.equal(provisioned.member.senderMode, "workspace");

    const assistedProvisioned = await provisionTeamMemberSender({ ...scope, memberId: assistedAgent.id });
    assert.equal(assistedProvisioned.sender.transportMode, "simulator");
    assert.equal(assistedProvisioned.member.senderMode, "simulator");
    assert.match(assistedProvisioned.member.simulatorPhoneNumber ?? "", /^\+1555\d{7}$/);

    const paused = await updateTeamMember({
      ...scope,
      memberId: qualificationAgent.id,
      autoReplyEnabled: false
    });
    assert.equal(paused.autoReplyEnabled, false);

    const members = await listTeamMembers(scope);
    assert.equal(members.length, 3);
    assert.equal(members.some((member) => member.type === "human"), true);
    assert.equal(members.filter((member) => member.type.startsWith("ai_agent")).length, 2);

    const internal = await postTeamThreadMessage({
      ...scope,
      leadId: "lead_1",
      conversationId: "conv_1",
      authorMemberId: qualificationAgent.id,
      authorType: "ai_agent",
      body: "Qualified need and asked for budget.",
      eventType: "handoff_summary",
      triggerId: "trigger_1"
    });
    assert.equal(internal.visibility, "internal");
    const deduped = await postTeamThreadMessage({
      ...scope,
      leadId: "lead_1",
      conversationId: "conv_1",
      authorMemberId: qualificationAgent.id,
      authorType: "ai_agent",
      body: "Qualified need and asked for budget.",
      eventType: "handoff_summary",
      triggerId: "trigger_1"
    });
    assert.equal(deduped.id, internal.id, "internal agent turns should dedupe by trigger id");
    const thread = await listTeamThreadMessages({ ...scope, leadId: "lead_1" });
    assert.equal(thread.length, 1);

    await createCalendarEvent({
      ...scope,
      memberId: human.id,
      title: "Existing demo",
      startAt: "2026-06-08T05:00:00.000Z",
      endAt: "2026-06-08T05:30:00.000Z",
      status: "confirmed",
      eventType: "meeting",
      leadId: "lead_1",
      conversationId: "conv_1"
    });
    const freeSlots = await findCalendarFreeSlots({
      ...scope,
      memberId: human.id,
      from: "2026-06-08T04:30:00.000Z",
      to: "2026-06-08T06:30:00.000Z",
      slotMinutes: 30
    });
    assert(!freeSlots.some((slot) => slot.startAt === "2026-06-08T05:00:00.000Z"), "busy meetings should not be returned as free slots");
    assert(freeSlots.some((slot) => slot.startAt === "2026-06-08T04:30:00.000Z"));
    assert.equal((await listCalendarEvents(scope)).length, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
