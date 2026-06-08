import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

type Json = Record<string, any>;

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as Json;
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "leadsy-account-stress-demo-"));
  const dataDir = join(root, "data");
  await mkdir(dataDir, { recursive: true });
  process.env.LEADSY_DATA_DIR = dataDir;
  process.env.USD_INR_RATE = "83";
  const targetOwner = {
    id: "usr_target_owner",
    tenantId: "tenant_target",
    name: "Pratik Choudhuri",
    emailOrPhone: "pratikisawesom3@gmail.com",
    normalizedLogin: "pratikisawesom3@gmail.com",
    passwordHash: "hash_owner",
    role: "owner",
    createdAt: "2026-06-01T00:00:00.000Z"
  };
  const otherOwner = {
    id: "usr_other_owner",
    tenantId: "tenant_other",
    name: "Other Owner",
    emailOrPhone: "other@example.com",
    normalizedLogin: "other@example.com",
    passwordHash: "hash_other",
    role: "owner",
    createdAt: "2026-06-01T00:00:00.000Z"
  };

  await writeJson(join(dataDir, "auth.json"), {
    users: [
      targetOwner,
      otherOwner,
      {
        id: "usr_old_team_member",
        tenantId: targetOwner.tenantId,
        teamMemberId: "tm_old_member",
        name: "Old SDR",
        emailOrPhone: "old-sdr@example.com",
        normalizedLogin: "old-sdr@example.com",
        passwordHash: "hash_old",
        role: "sdr",
        createdAt: "2026-06-01T00:00:00.000Z"
      }
    ],
    sessions: [
      { id: "sess_owner", tenantId: targetOwner.tenantId, userId: targetOwner.id },
      { id: "sess_old_team", tenantId: targetOwner.tenantId, userId: "usr_old_team_member" },
      { id: "sess_other", tenantId: otherOwner.tenantId, userId: otherOwner.id }
    ]
  });
  await writeJson(join(dataDir, "lead-knowledge.json"), {
    leads: [
      { id: "old_target_lead", tenantId: targetOwner.tenantId, ownerId: targetOwner.id },
      { id: "other_lead", tenantId: otherOwner.tenantId, ownerId: otherOwner.id }
    ],
    conversations: [
      { id: "old_target_conversation", tenantId: targetOwner.tenantId, ownerId: targetOwner.id },
      { id: "other_conversation", tenantId: otherOwner.tenantId, ownerId: otherOwner.id }
    ],
    messages: [
      { id: "old_target_message", tenantId: targetOwner.tenantId, ownerId: targetOwner.id },
      { id: "other_message", tenantId: otherOwner.tenantId, ownerId: otherOwner.id }
    ]
  });
  await writeJson(join(dataDir, "lead-crm.json"), {
    assignmentRules: [{ id: "old_rule", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }],
    assignmentHistory: [{ id: "old_assignment", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }],
    followUpTasks: [{ id: "old_task", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }],
    qualificationProfiles: [{ id: "old_profile", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }]
  });
  await writeJson(join(dataDir, "teamspace.json"), {
    members: [{ id: "tm_old_member", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }],
    threadMessages: [{ id: "old_thread", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }]
  });
  await writeJson(join(dataDir, "calendar.json"), {
    events: [{ id: "old_event", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }]
  });
  await writeJson(join(dataDir, "workspace-whatsapp-senders.json"), {
    senders: [{ tenantId: targetOwner.tenantId, ownerId: targetOwner.id, status: "approved", createdAt: "", updatedAt: "" }]
  });
  await writeJson(join(dataDir, "twilio-integration.json"), {
    [targetOwner.tenantId]: { lastWebhookAt: "old" },
    other: { keep: true }
  });
  await writeJson(join(dataDir, "user-settings.json"), {
    workspaces: [{ tenantId: targetOwner.tenantId, ownerId: targetOwner.id, notificationRecords: [{ id: "old_notif" }] }]
  });
  await writeJson(join(dataDir, "ai-usage.json"), {
    runs: [],
    agentRuns: []
  });

  const seed = await import("../apps/web/src/lib/account-stress-demo-seed");
  const { getCostReceipt } = await import("../apps/web/src/lib/cost-receipt");
  await assert.rejects(
    () => seed.seedAccountStressDemo({ email: "missing@example.com", confirm: "missing@example.com", dataDir }),
    /target_account_not_found/
  );
  await assert.rejects(
    () => seed.seedAccountStressDemo({ email: targetOwner.emailOrPhone, confirm: "wrong", dataDir }),
    /confirmation_required/
  );

  const first = await seed.seedAccountStressDemo({
    email: targetOwner.emailOrPhone,
    confirm: targetOwner.emailOrPhone,
    dataDir
  });
  const second = await seed.seedAccountStressDemo({
    email: targetOwner.emailOrPhone,
    confirm: targetOwner.emailOrPhone,
    dataDir
  });

  await stat(first.backupDir);
  assert.equal(first.ok, true);
  assert.equal(first.owner.id, targetOwner.id);
  assert.equal(first.counts.leads, 25);
  assert.equal(first.counts.conversations, 25);
  assert(first.counts.messages >= 70, "stress demo should include multi-turn simulated conversations");
  assert(first.counts.teamMembers >= 9, "stress demo should include all human and AI member types");
  assert(first.counts.calendarEvents >= 15);
  assert(first.counts.humanTasks > 0);
  assert(first.counts.aiApprovalTasks > 0);
  assert(first.counts.workspaceThreadMessages > 0);
  assert(first.counts.notifications > 0);
  assert(first.credentials.length >= 7, "dummy non-owner members should get credentials");
  assert.deepEqual(second.counts, first.counts, "rerun should be idempotent after account-scoped reset");

  const auth = await readJson(join(dataDir, "auth.json"));
  assert(auth.users.some((user: Json) => user.id === targetOwner.id), "target owner should be preserved");
  assert(auth.users.some((user: Json) => user.id === otherOwner.id), "other tenants should be preserved");
  assert(!auth.users.some((user: Json) => user.id === "usr_old_team_member"), "old team member auth user should be deleted");
  assert(auth.sessions.some((session: Json) => session.id === "sess_owner"), "owner sessions should be preserved");
  assert(!auth.sessions.some((session: Json) => session.id === "sess_old_team"), "old team member sessions should be deleted");

  const knowledge = await readJson(join(dataDir, "lead-knowledge.json"));
  const targetLeads = knowledge.leads.filter((lead: Json) => lead.tenantId === targetOwner.tenantId && lead.ownerId === targetOwner.id);
  const targetConversations = knowledge.conversations.filter((conversation: Json) => conversation.tenantId === targetOwner.tenantId && conversation.ownerId === targetOwner.id);
  const targetMessages = knowledge.messages.filter((message: Json) => message.tenantId === targetOwner.tenantId && message.ownerId === targetOwner.id);
  assert.equal(targetLeads.length, 25);
  assert.equal(targetConversations.length, 25);
  assert(targetMessages.every((message: Json) => message.source === "twilio_simulator"));
  assert(targetMessages.some((message: Json) => message.direction === "inbound"));
  assert(targetMessages.some((message: Json) => message.direction === "outbound"));
  assert(knowledge.leads.some((lead: Json) => lead.id === "other_lead"), "other tenant lead should remain");

  const crm = await readJson(join(dataDir, "lead-crm.json"));
  assert.equal(crm.followUpTasks.filter((task: Json) => task.destination === "human_tasks").length, first.counts.humanTasks);
  assert.equal(crm.followUpTasks.filter((task: Json) => task.destination === "ai_approvals").length, first.counts.aiApprovalTasks);
  assert(crm.assignmentHistory.some((entry: Json) => entry.id.startsWith("stress_assignment_")));

  const teamspace = await readJson(join(dataDir, "teamspace.json"));
  assert(teamspace.members.some((member: Json) => member.name === "Qualification AI" && member.senderMode === "workspace"));
  assert(teamspace.members.some((member: Json) => member.type === "ai_agent_full"));
  assert(teamspace.members.some((member: Json) => member.type === "ai_agent_assisted"));
  assert(teamspace.members.some((member: Json) => member.type === "human"));
  assert(teamspace.members.filter((member: Json) => member.name !== "Qualification AI").every((member: Json) => member.simulatorPhoneNumber || member.senderMode === "workspace"));
  assert(teamspace.threadMessages.some((message: Json) => message.threadScope === "workspace" && message.eventType === "assignment_changed"));
  assert(teamspace.threadMessages.some((message: Json) => message.body.includes("@Calendar AI")));

  const calendar = await readJson(join(dataDir, "calendar.json"));
  assert(calendar.events.some((event: Json) => event.eventType === "meeting" && event.status === "confirmed"));
  assert(calendar.events.some((event: Json) => event.eventType === "availability"));

  const settings = await readJson(join(dataDir, "user-settings.json"));
  const workspace = settings.workspaces.find((item: Json) => item.tenantId === targetOwner.tenantId && item.ownerId === targetOwner.id);
  assert.equal(workspace.workspace.businessName, "Helio Optics");
  assert(workspace.notificationRecords.length >= first.counts.notifications);

  const senders = await readJson(join(dataDir, "workspace-whatsapp-senders.json"));
  const sender = senders.senders.find((item: Json) => item.tenantId === targetOwner.tenantId && item.ownerId === targetOwner.id);
  assert.equal(sender.transportMode, "simulator");
  assert.equal(sender.status, "approved");

  const receipt = await getCostReceipt({ tenantId: targetOwner.tenantId, ownerId: targetOwner.id });
  assert(receipt.summary.conversations.simulatedMessages >= first.counts.messages, "receipt should include all simulator messages as zero-cost tracked conversations");
  assert(receipt.summary.openrouter.requests >= 4, "stress demo should seed realistic AI utilization receipt rows");
  assert(receipt.summary.openrouter.totalInr > 0, "stress demo should show non-zero AI utilization spend");
  assert(receipt.lineItems.some((item: Json) => item.category === "openrouter" && item.label.includes("Qualification")), "receipt should explain qualification AI spend");

  console.log("account stress demo seed regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
