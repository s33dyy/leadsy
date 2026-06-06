import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { leadsyDataDir } from "./data-dir";

export type ResetClassification = "SAFE_TO_DELETE" | "SHOULD_BACKUP" | "MUST_PRESERVE" | "MIXED";

export type ResetStoreManifestItem = {
  file: string;
  store: string;
  classification: ResetClassification;
  resetBehavior: string;
};

export const preTwilioResetManifest: ResetStoreManifestItem[] = [
  {
    file: "auth.json",
    store: "Authentication users and sessions",
    classification: "MUST_PRESERVE",
    resetBehavior: "Back up only; users and sessions are not modified by the CRM reset."
  },
  {
    file: "lead-knowledge.json",
    store: "Lead records, conversations, messages, qualification history",
    classification: "SAFE_TO_DELETE",
    resetBehavior: "Clear leads, conversations, and messages after backup."
  },
  {
    file: "extension.json",
    store: "Legacy extension tokens, captured conversations, messages, events, approvals, tasks",
    classification: "MIXED",
    resetBehavior: "Preserve extension tokens; clear captured conversations, messages, events, tasks, and task events."
  },
  {
    file: "lead-magnet.json",
    store: "Archived lead magnet briefs, generated leads, runs, drafts, and search sessions",
    classification: "MIXED",
    resetBehavior: "Preserve briefs, brief history, and owner search memory; clear generated leads, runs, drafts, agent runs, and search sessions."
  },
  {
    file: "lead-crm.json",
    store: "CRM assignment rules, assignment history, follow-up tasks, qualification profiles",
    classification: "MIXED",
    resetBehavior: "Preserve qualification profiles; clear assignment rules, assignment history, and follow-up tasks."
  },
  {
    file: "agency-clients.json",
    store: "Agency/client configuration",
    classification: "MUST_PRESERVE",
    resetBehavior: "Back up only; agency/client configuration is not modified by the CRM reset."
  }
];

type JsonObject = Record<string, unknown>;

export type ResetStoreSummary = {
  auth: { users: number; sessions: number };
  leadKnowledge: { leads: number; conversations: number; messages: number };
  extension: { tokens: number; conversations: number; messages: number; events: number; tasks: number; taskEvents: number };
  leadMagnet: { briefs: number; briefHistory: number; leads: number; runs: number; drafts: number; agentRuns: number; searchSessions: number; ownerSearchMemory: number };
  crm: { assignmentRules: number; assignmentHistory: number; followUpTasks: number; qualificationProfiles: number };
  agencyClients: { records: number };
};

export type PreTwilioBackupResult = {
  backupDir: string;
  files: string[];
  summary: ResetStoreSummary;
};

export type PreTwilioResetResult = {
  removed: {
    leads: number;
    conversations: number;
    messages: number;
    extensionConversations: number;
    extensionMessages: number;
    extensionEvents: number;
    extensionTasks: number;
    extensionTaskEvents: number;
    leadMagnetLeads: number;
    leadMagnetRuns: number;
    leadMagnetDrafts: number;
    leadMagnetAgentRuns: number;
    leadMagnetSearchSessions: number;
    crmAssignmentRules: number;
    crmAssignmentHistory: number;
    crmFollowUpTasks: number;
  };
  preserved: {
    authUsers: number;
    authSessions: number;
    extensionTokens: number;
    leadMagnetBriefs: number;
    leadMagnetBriefHistory: number;
    leadMagnetOwnerSearchMemory: number;
    crmQualificationProfiles: number;
    agencyClients: number;
  };
};

function arrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

async function readJsonFile(dataDir: string, file: string): Promise<unknown> {
  try {
    const raw = await readFile(join(dataDir, file), "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || error instanceof SyntaxError) return {};
    throw error;
  }
}

async function writeJsonFile(dataDir: string, file: string, value: unknown) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, file), `${JSON.stringify(value, null, 2)}\n`);
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function backupLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function summarizePreTwilioResetStores(input: { dataDir?: string } = {}): Promise<ResetStoreSummary> {
  const dataDir = input.dataDir ?? leadsyDataDir;
  const auth = objectValue(await readJsonFile(dataDir, "auth.json"));
  const leadKnowledge = objectValue(await readJsonFile(dataDir, "lead-knowledge.json"));
  const extension = objectValue(await readJsonFile(dataDir, "extension.json"));
  const leadMagnet = objectValue(await readJsonFile(dataDir, "lead-magnet.json"));
  const crm = objectValue(await readJsonFile(dataDir, "lead-crm.json"));
  const agencyClients = await readJsonFile(dataDir, "agency-clients.json");

  return {
    auth: {
      users: arrayCount(auth.users),
      sessions: arrayCount(auth.sessions)
    },
    leadKnowledge: {
      leads: arrayCount(leadKnowledge.leads),
      conversations: arrayCount(leadKnowledge.conversations),
      messages: arrayCount(leadKnowledge.messages)
    },
    extension: {
      tokens: arrayCount(extension.tokens),
      conversations: arrayCount(extension.conversations),
      messages: arrayCount(extension.messages),
      events: arrayCount(extension.events),
      tasks: arrayCount(extension.tasks),
      taskEvents: arrayCount(extension.taskEvents)
    },
    leadMagnet: {
      briefs: arrayCount(leadMagnet.briefs),
      briefHistory: arrayCount(leadMagnet.briefHistory),
      leads: arrayCount(leadMagnet.leads),
      runs: arrayCount(leadMagnet.runs),
      drafts: arrayCount(leadMagnet.drafts),
      agentRuns: arrayCount(leadMagnet.agentRuns),
      searchSessions: arrayCount(leadMagnet.searchSessions),
      ownerSearchMemory: arrayCount(leadMagnet.ownerSearchMemory)
    },
    crm: {
      assignmentRules: arrayCount(crm.assignmentRules),
      assignmentHistory: arrayCount(crm.assignmentHistory),
      followUpTasks: arrayCount(crm.followUpTasks),
      qualificationProfiles: arrayCount(crm.qualificationProfiles)
    },
    agencyClients: {
      records: arrayCount(agencyClients)
    }
  };
}

export async function createPreTwilioResetBackup(input: {
  dataDir?: string;
  backupRoot?: string;
  label?: string;
} = {}): Promise<PreTwilioBackupResult> {
  const dataDir = input.dataDir ?? leadsyDataDir;
  const backupRoot = input.backupRoot ?? join(process.cwd(), "backups/pre-twilio-reset");
  const backupDir = join(backupRoot, input.label?.trim() || backupLabel());
  await mkdir(backupDir, { recursive: true });

  const files: string[] = [];
  for (const item of preTwilioResetManifest) {
    const source = join(dataDir, item.file);
    if (!existsSync(source)) continue;
    await copyFile(source, join(backupDir, item.file));
    files.push(item.file);
  }

  const summary = await summarizePreTwilioResetStores({ dataDir });
  await writeFile(
    join(backupDir, "manifest.json"),
    `${JSON.stringify({ createdAt: new Date().toISOString(), dataDir, files, summary, stores: preTwilioResetManifest }, null, 2)}\n`
  );

  return { backupDir, files, summary };
}

export async function resetLocalCrmForTwilio(input: {
  dataDir?: string;
  requiredBackupDir: string;
}): Promise<PreTwilioResetResult> {
  const dataDir = input.dataDir ?? leadsyDataDir;
  if (!input.requiredBackupDir) {
    throw new Error("A successful pre-Twilio reset backup directory is required before reset.");
  }
  const backupStats = await stat(input.requiredBackupDir).catch(() => undefined);
  if (!backupStats?.isDirectory()) {
    throw new Error("A successful pre-Twilio reset backup directory is required before reset.");
  }

  const auth = objectValue(await readJsonFile(dataDir, "auth.json"));
  const leadKnowledge = objectValue(await readJsonFile(dataDir, "lead-knowledge.json"));
  const extension = objectValue(await readJsonFile(dataDir, "extension.json"));
  const leadMagnet = objectValue(await readJsonFile(dataDir, "lead-magnet.json"));
  const crm = objectValue(await readJsonFile(dataDir, "lead-crm.json"));
  const agencyClients = await readJsonFile(dataDir, "agency-clients.json");

  const result: PreTwilioResetResult = {
    removed: {
      leads: arrayCount(leadKnowledge.leads),
      conversations: arrayCount(leadKnowledge.conversations),
      messages: arrayCount(leadKnowledge.messages),
      extensionConversations: arrayCount(extension.conversations),
      extensionMessages: arrayCount(extension.messages),
      extensionEvents: arrayCount(extension.events),
      extensionTasks: arrayCount(extension.tasks),
      extensionTaskEvents: arrayCount(extension.taskEvents),
      leadMagnetLeads: arrayCount(leadMagnet.leads),
      leadMagnetRuns: arrayCount(leadMagnet.runs),
      leadMagnetDrafts: arrayCount(leadMagnet.drafts),
      leadMagnetAgentRuns: arrayCount(leadMagnet.agentRuns),
      leadMagnetSearchSessions: arrayCount(leadMagnet.searchSessions),
      crmAssignmentRules: arrayCount(crm.assignmentRules),
      crmAssignmentHistory: arrayCount(crm.assignmentHistory),
      crmFollowUpTasks: arrayCount(crm.followUpTasks)
    },
    preserved: {
      authUsers: arrayCount(auth.users),
      authSessions: arrayCount(auth.sessions),
      extensionTokens: arrayCount(extension.tokens),
      leadMagnetBriefs: arrayCount(leadMagnet.briefs),
      leadMagnetBriefHistory: arrayCount(leadMagnet.briefHistory),
      leadMagnetOwnerSearchMemory: arrayCount(leadMagnet.ownerSearchMemory),
      crmQualificationProfiles: arrayCount(crm.qualificationProfiles),
      agencyClients: arrayCount(agencyClients)
    }
  };

  await writeJsonFile(dataDir, "lead-knowledge.json", { leads: [], conversations: [], messages: [] });
  await writeJsonFile(dataDir, "extension.json", {
    tokens: arrayValue(extension.tokens),
    conversations: [],
    messages: [],
    events: [],
    tasks: [],
    taskEvents: []
  });
  await writeJsonFile(dataDir, "lead-magnet.json", {
    briefs: arrayValue(leadMagnet.briefs),
    briefHistory: arrayValue(leadMagnet.briefHistory),
    leads: [],
    runs: [],
    drafts: [],
    agentRuns: [],
    searchSessions: [],
    ownerSearchMemory: arrayValue(leadMagnet.ownerSearchMemory)
  });
  await writeJsonFile(dataDir, "lead-crm.json", {
    assignmentRules: [],
    assignmentHistory: [],
    followUpTasks: [],
    qualificationProfiles: arrayValue(crm.qualificationProfiles)
  });

  return result;
}

export function resetConfirmationToken() {
  return "RESET_TWILIO_CRM";
}

export function backupRunId() {
  return `pre-twilio-reset-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}
