import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "leadsy-app-data-reset-"));
  const dataDir = join(root, "data/app");
  const backupRoot = join(root, "backups/pre-twilio-reset");
  process.env.LEADSY_DATA_DIR = dataDir;

  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "auth.json"), JSON.stringify({ users: [{ id: "usr_owner" }], sessions: [{ id: "sess_owner" }] }, null, 2));
  await writeFile(join(dataDir, "lead-knowledge.json"), JSON.stringify({ leads: [{ id: "lead_delete" }], conversations: [{ id: "conv_delete" }], messages: [{ id: "msg_delete" }] }, null, 2));
  await writeFile(join(dataDir, "lead-crm.json"), JSON.stringify({ assignmentRules: [{ id: "rule_keep" }], assignmentHistory: [{ id: "assignment_delete" }], followUpTasks: [{ id: "task_delete" }], qualificationProfiles: [{ id: "profile_keep" }] }, null, 2));
  await writeFile(join(dataDir, "workspace-whatsapp-senders.json"), JSON.stringify({ senders: [{ id: "sender_keep" }] }, null, 2));
  await writeFile(join(dataDir, "teamspace.json"), JSON.stringify({ members: [{ id: "member_delete" }], threadMessages: [{ id: "thread_delete" }] }, null, 2));
  await writeFile(join(dataDir, "calendar.json"), JSON.stringify({ events: [{ id: "event_delete" }] }, null, 2));

  const reset = await import("../apps/web/src/lib/pre-twilio-reset");

  await assert.rejects(
    () => reset.resetLocalCrmForTwilio({ dataDir, requiredBackupDir: join(backupRoot, "missing") }),
    /backup/i,
    "reset should require a successful backup directory"
  );

  const backup = await reset.createPreTwilioResetBackup({ dataDir, backupRoot, label: "test-snapshot" });
  assert.equal(existsSync(join(backup.backupDir, "lead-knowledge.json")), true);
  assert.equal(backup.summary.leadKnowledge.leads, 1);
  assert.equal(backup.summary.teamspace.members, 1);
  assert.equal(backup.summary.calendar.events, 1);

  const result = await reset.resetLocalCrmForTwilio({ dataDir, requiredBackupDir: backup.backupDir });
  assert.equal(result.preserved.authUsers, 1);
  assert.equal(result.preserved.authSessions, 1);
  assert.equal(result.preserved.crmAssignmentRules, 1);
  assert.equal(result.preserved.qualificationProfiles, 1);
  assert.equal(result.preserved.workspaceSenders, 1);
  assert.equal(result.removed.leads, 1);
  assert.equal(result.removed.conversations, 1);
  assert.equal(result.removed.messages, 1);
  assert.equal(result.removed.crmAssignmentHistory, 1);
  assert.equal(result.removed.crmFollowUpTasks, 1);
  assert.equal(result.removed.teamMembers, 1);
  assert.equal(result.removed.internalMessages, 1);
  assert.equal(result.removed.calendarEvents, 1);

  assert.deepEqual(await readJson(join(dataDir, "lead-knowledge.json")), { leads: [], conversations: [], messages: [] });
  assert.deepEqual(await readJson(join(dataDir, "teamspace.json")), { members: [], threadMessages: [] });
  assert.deepEqual(await readJson(join(dataDir, "calendar.json")), { events: [] });
  assert.deepEqual(await readJson(join(dataDir, "workspace-whatsapp-senders.json")), { senders: [{ id: "sender_keep" }] });
  assert.deepEqual(await readJson(join(dataDir, "auth.json")), { users: [{ id: "usr_owner" }], sessions: [{ id: "sess_owner" }] });

  const crm = await readJson(join(dataDir, "lead-crm.json"));
  assert.deepEqual(crm.assignmentRules, [{ id: "rule_keep" }]);
  assert.deepEqual(crm.assignmentHistory, []);
  assert.deepEqual(crm.followUpTasks, []);
  assert.deepEqual(crm.qualificationProfiles, [{ id: "profile_keep" }]);

  console.log("app-data reset regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
