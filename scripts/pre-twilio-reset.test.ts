import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "leadsy-pre-twilio-reset-"));
  const dataDir = join(root, "data/app");
  const backupRoot = join(root, "backups/pre-twilio-reset");
  process.env.LEADSY_DATA_DIR = dataDir;

  await mkdir(dataDir, { recursive: true });
  await writeFile(
    join(dataDir, "auth.json"),
    JSON.stringify({ users: [{ id: "usr_owner" }], sessions: [{ id: "sess_owner" }] }, null, 2)
  );
  await writeFile(
    join(dataDir, "lead-knowledge.json"),
    JSON.stringify(
      {
        leads: [{ id: "lead_legacy", qualificationFields: { budget: "fake" } }],
        conversations: [{ id: "conv_legacy", leadId: "lead_legacy" }],
        messages: [{ id: "msg_legacy", conversationId: "conv_legacy", direction: "inbound" }]
      },
      null,
      2
    )
  );
  await writeFile(
    join(dataDir, "extension.json"),
    JSON.stringify(
      {
        tokens: [{ id: "token_keep", label: "Existing extension user" }],
        conversations: [{ id: "ext_conv_legacy" }],
        messages: [{ id: "ext_msg_legacy" }],
        events: [{ id: "ext_evt_legacy" }],
        tasks: [{ id: "ext_task_legacy", status: "awaiting_send_approval" }],
        taskEvents: [{ id: "ext_task_evt_legacy" }]
      },
      null,
      2
    )
  );
  await writeFile(
    join(dataDir, "lead-magnet.json"),
    JSON.stringify(
      {
        briefs: [{ id: "brief_keep" }],
        briefHistory: [{ id: "brief_history_keep" }],
        leads: [{ id: "magnet_lead_legacy" }],
        runs: [{ id: "run_legacy" }],
        drafts: [{ id: "draft_legacy" }],
        agentRuns: [{ id: "agent_run_legacy" }],
        searchSessions: [{ id: "session_legacy" }],
        ownerSearchMemory: [{ id: "memory_keep" }]
      },
      null,
      2
    )
  );
  await writeFile(
    join(dataDir, "lead-crm.json"),
    JSON.stringify(
      {
        assignmentRules: [{ id: "rule_legacy" }],
        followUpTasks: [{ id: "task_legacy" }],
        qualificationProfiles: [{ id: "profile_keep" }]
      },
      null,
      2
    )
  );
  await writeFile(join(dataDir, "agency-clients.json"), JSON.stringify([{ id: "client_keep" }], null, 2));

  const reset = await import("../apps/web/src/lib/pre-twilio-reset");

  await assert.rejects(
    () => reset.resetLocalCrmForTwilio({ dataDir, requiredBackupDir: join(backupRoot, "missing") }),
    /backup/i,
    "reset should require a successful backup directory"
  );

  const backup = await reset.createPreTwilioResetBackup({ dataDir, backupRoot, label: "test-snapshot" });
  assert.equal(existsSync(join(backup.backupDir, "lead-knowledge.json")), true);
  assert.equal(backup.files.length, 6);
  assert.equal(backup.summary.leadKnowledge.leads, 1);
  assert.equal(backup.summary.extension.tokens, 1);

  const result = await reset.resetLocalCrmForTwilio({ dataDir, requiredBackupDir: backup.backupDir });
  assert.equal(result.preserved.authUsers, 1);
  assert.equal(result.preserved.extensionTokens, 1);
  assert.equal(result.removed.leads, 1);
  assert.equal(result.removed.conversations, 1);
  assert.equal(result.removed.messages, 1);
  assert.equal(result.removed.extensionTasks, 1);
  assert.equal(result.removed.crmFollowUpTasks, 1);

  const leadKnowledge = await readJson(join(dataDir, "lead-knowledge.json"));
  assert.deepEqual(leadKnowledge, { leads: [], conversations: [], messages: [] });

  const extension = await readJson(join(dataDir, "extension.json"));
  assert.deepEqual(extension.tokens, [{ id: "token_keep", label: "Existing extension user" }]);
  assert.deepEqual(extension.conversations, []);
  assert.deepEqual(extension.messages, []);
  assert.deepEqual(extension.events, []);
  assert.deepEqual(extension.tasks, []);
  assert.deepEqual(extension.taskEvents, []);

  const leadMagnet = await readJson(join(dataDir, "lead-magnet.json"));
  assert.deepEqual(leadMagnet.briefs, [{ id: "brief_keep" }]);
  assert.deepEqual(leadMagnet.briefHistory, [{ id: "brief_history_keep" }]);
  assert.deepEqual(leadMagnet.ownerSearchMemory, [{ id: "memory_keep" }]);
  assert.deepEqual(leadMagnet.leads, []);
  assert.deepEqual(leadMagnet.runs, []);
  assert.deepEqual(leadMagnet.drafts, []);
  assert.deepEqual(leadMagnet.agentRuns, []);
  assert.deepEqual(leadMagnet.searchSessions, []);

  const crm = await readJson(join(dataDir, "lead-crm.json"));
  assert.deepEqual(crm.assignmentRules, []);
  assert.deepEqual(crm.followUpTasks, []);
  assert.deepEqual(crm.qualificationProfiles, [{ id: "profile_keep" }]);

  const auth = await readJson(join(dataDir, "auth.json"));
  assert.equal(auth.users.length, 1);
  assert.equal(auth.sessions.length, 1);

  const agencyClients = await readJson(join(dataDir, "agency-clients.json"));
  assert.deepEqual(agencyClients, [{ id: "client_keep" }]);

  assert(
    reset.preTwilioResetManifest.some((store: { file: string; classification: string }) => store.file === "extension.json" && store.classification === "MIXED")
  );

  console.log("pre-twilio reset regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
