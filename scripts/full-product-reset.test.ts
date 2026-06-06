import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "leadsy-full-product-reset-"));
  const dataDir = join(root, "data/app");
  const backupRoot = join(root, "data/leadsy/backups");
  process.env.LEADSY_DATA_DIR = dataDir;
  await mkdir(dataDir, { recursive: true });

  await writeFile(join(dataDir, "auth.json"), JSON.stringify({ users: [{ id: "usr_delete" }], sessions: [{ id: "sess_delete" }] }, null, 2));
  await writeFile(join(dataDir, "lead-knowledge.json"), JSON.stringify({ leads: [{ id: "lead_delete" }], conversations: [{ id: "conv_delete" }], messages: [{ id: "msg_delete" }] }, null, 2));
  await writeFile(join(dataDir, "extension.json"), JSON.stringify({ tokens: [{ id: "token_delete" }], conversations: [{ id: "ext_conv_delete" }], messages: [{ id: "ext_msg_delete" }], events: [{ id: "event_delete" }], tasks: [{ id: "approval_delete" }], taskEvents: [{ id: "task_event_delete" }] }, null, 2));
  await writeFile(join(dataDir, "lead-magnet.json"), JSON.stringify({ briefs: [{ id: "brief_delete" }], briefHistory: [{ id: "brief_history_delete" }], leads: [{ id: "magnet_lead_delete" }], runs: [{ id: "run_delete" }], drafts: [{ id: "draft_delete" }], agentRuns: [{ id: "agent_delete" }], searchSessions: [{ id: "search_delete" }], ownerSearchMemory: [{ id: "memory_delete" }] }, null, 2));
  await writeFile(join(dataDir, "lead-crm.json"), JSON.stringify({ assignmentRules: [{ id: "rule_delete" }], assignmentHistory: [{ id: "assignment_delete" }], followUpTasks: [{ id: "task_delete" }], qualificationProfiles: [{ id: "profile_delete" }] }, null, 2));
  await writeFile(join(dataDir, "agency-clients.json"), JSON.stringify([{ id: "client_delete" }], null, 2));
  await writeFile(join(dataDir, "meta-oauth.json"), JSON.stringify({ connections: [{ id: "meta_delete" }] }, null, 2));
  await writeFile(join(dataDir, "meta-whatsapp-inbound.json"), JSON.stringify({ messages: [{ id: "meta_msg_delete" }], contactStatuses: [{ id: "meta_status_delete" }] }, null, 2));
  await writeFile(join(dataDir, "workspace-whatsapp-senders.json"), JSON.stringify({ senders: [{ tenantId: "tenant_delete", ownerId: "owner_delete", status: "approved" }] }, null, 2));
  await writeFile(join(dataDir, "twilio-integration.json"), JSON.stringify({ lastWebhookMessageSid: "SMDELETE" }, null, 2));

  const reset = await import("../apps/web/src/lib/pre-twilio-reset");

  assert.equal(typeof reset.createFullProductResetBackup, "function");
  assert.equal(typeof reset.resetFullProductData, "function");
  assert.equal(typeof reset.summarizeFullProductResetStores, "function");
  assert(reset.fullProductResetManifest.some((store: { file: string }) => store.file === "auth.json"));
  assert(reset.fullProductResetManifest.some((store: { file: string }) => store.file === "workspace-whatsapp-senders.json"));

  await assert.rejects(
    () => reset.resetFullProductData({ dataDir, requiredBackupDir: join(backupRoot, "missing") }),
    /backup/i,
    "full product reset should require a successful backup"
  );

  const backup = await reset.createFullProductResetBackup({ dataDir, backupRoot, label: "full-product-reset-test" });
  assert.equal(backup.backupDir, join(backupRoot, "full-product-reset-test"));
  assert.equal(existsSync(join(backup.backupDir, "auth.json")), true);
  assert.equal(existsSync(join(backup.backupDir, "workspace-whatsapp-senders.json")), true);
  assert.equal(backup.summary.auth.users, 1);
  assert.equal(backup.summary.workspaceSenders.senders, 1);

  const result = await reset.resetFullProductData({ dataDir, requiredBackupDir: backup.backupDir });
  assert.equal(result.removed.authUsers, 1);
  assert.equal(result.removed.authSessions, 1);
  assert.equal(result.removed.leads, 1);
  assert.equal(result.removed.workspaceSenders, 1);
  assert.equal(result.removed.metaConnections, 1);

  assert.deepEqual(await readJson(join(dataDir, "auth.json")), { users: [], sessions: [] });
  assert.deepEqual(await readJson(join(dataDir, "lead-knowledge.json")), { leads: [], conversations: [], messages: [] });
  assert.deepEqual(await readJson(join(dataDir, "extension.json")), { tokens: [], conversations: [], messages: [], events: [], tasks: [], taskEvents: [] });
  assert.deepEqual(await readJson(join(dataDir, "lead-magnet.json")), { briefs: [], briefHistory: [], leads: [], runs: [], drafts: [], agentRuns: [], searchSessions: [], ownerSearchMemory: [] });
  assert.deepEqual(await readJson(join(dataDir, "lead-crm.json")), { assignmentRules: [], assignmentHistory: [], followUpTasks: [], qualificationProfiles: [] });
  assert.deepEqual(await readJson(join(dataDir, "agency-clients.json")), []);
  assert.deepEqual(await readJson(join(dataDir, "meta-oauth.json")), { connections: [] });
  assert.deepEqual(await readJson(join(dataDir, "meta-whatsapp-inbound.json")), { messages: [], contactStatuses: [] });
  assert.deepEqual(await readJson(join(dataDir, "workspace-whatsapp-senders.json")), { senders: [] });
  assert.deepEqual(await readJson(join(dataDir, "twilio-integration.json")), {});

  const healthRoute = await readFile(join(process.cwd(), "apps/web/src/app/api/health/route.ts"), "utf8");
  assert(healthRoute.includes("summarizeAuthHealth"), "health should report auth user/session counts after full reset");
  assert(healthRoute.includes("workspaceWhatsAppSenders"), "health should report workspace sender count");

  console.log("full product reset regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
