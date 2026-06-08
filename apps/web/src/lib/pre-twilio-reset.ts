import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

export type ResetClassification = "SAFE_TO_DELETE" | "SHOULD_BACKUP" | "MUST_PRESERVE" | "MIXED";

export type ResetStoreManifestItem = {
  file: string;
  store: string;
  classification: ResetClassification;
  resetBehavior: string;
};

const appDataStores = [
  {
    file: "lead-knowledge.json",
    store: "Leads, conversations, external messages, qualification inputs",
    classification: "SHOULD_BACKUP",
    resetBehavior: "Clear leads, conversations, and messages after backup."
  },
  {
    file: "lead-crm.json",
    store: "Assignment rules, assignment history, follow-up tasks, qualification profiles",
    classification: "MIXED",
    resetBehavior: "Clear CRM execution data; profile presets may be preserved by app-data-only reset."
  },
  {
    file: "agency-clients.json",
    store: "Agency and client workspace records",
    classification: "SHOULD_BACKUP",
    resetBehavior: "Clear client records for full reset."
  },
  {
    file: "workspace-whatsapp-senders.json",
    store: "Workspace WhatsApp sender registry",
    classification: "SHOULD_BACKUP",
    resetBehavior: "Clear sender records for full reset."
  },
  {
    file: "twilio-integration.json",
    store: "Twilio webhook and delivery status cache",
    classification: "SAFE_TO_DELETE",
    resetBehavior: "Clear transport status cache after backup."
  },
  {
    file: "teamspace.json",
    store: "Team members, AI agents, and internal team thread messages",
    classification: "SHOULD_BACKUP",
    resetBehavior: "Clear teamspace records for full reset."
  },
  {
    file: "calendar.json",
    store: "Availability windows, busy blocks, and lead-linked meetings",
    classification: "SHOULD_BACKUP",
    resetBehavior: "Clear calendar records for full reset."
  }
] satisfies ResetStoreManifestItem[];

export const preTwilioResetManifest: ResetStoreManifestItem[] = [
  {
    file: "auth.json",
    store: "Users and sessions",
    classification: "MUST_PRESERVE",
    resetBehavior: "Preserve users and sessions for app-data-only reset."
  },
  ...appDataStores
];

export const fullProductResetManifest: ResetStoreManifestItem[] = [
  {
    file: "auth.json",
    store: "Users and sessions",
    classification: "SHOULD_BACKUP",
    resetBehavior: "Clear all users and sessions after backup."
  },
  ...appDataStores.map((item) => ({
    ...item,
    resetBehavior: item.file === "lead-crm.json" ? "Clear all CRM configuration and execution data after backup." : item.resetBehavior
  }))
];

export type ResetStoreSummary = {
  auth: { users: number; sessions: number };
  leadKnowledge: { leads: number; conversations: number; messages: number };
  leadCrm: { assignmentRules: number; assignmentHistory: number; followUpTasks: number; qualificationProfiles: number };
  agencyClients: { clients: number };
  workspaceSenders: { senders: number };
  twilioIntegration: { entries: number };
  teamspace: { members: number; threadMessages: number };
  calendar: { events: number };
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
    crmAssignmentHistory: number;
    crmFollowUpTasks: number;
    teamMembers: number;
    internalMessages: number;
    calendarEvents: number;
  };
  preserved: {
    authUsers: number;
    authSessions: number;
    crmAssignmentRules: number;
    qualificationProfiles: number;
    workspaceSenders: number;
  };
};

export type FullProductResetResult = {
  removed: {
    authUsers: number;
    authSessions: number;
    leads: number;
    conversations: number;
    messages: number;
    crmAssignmentRules: number;
    crmAssignmentHistory: number;
    crmFollowUpTasks: number;
    qualificationProfiles: number;
    agencyClients: number;
    workspaceSenders: number;
    twilioStatusEntries: number;
    teamMembers: number;
    internalMessages: number;
    calendarEvents: number;
  };
  preserved: Record<string, never>;
};

async function readJsonFile(dataDir: string, file: string) {
  try {
    const raw = await readFile(join(dataDir, file), "utf8");
    return raw.trim() ? (JSON.parse(raw) as unknown) : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return {};
    throw error;
  }
}

async function writeJsonFile(dataDir: string, file: string, value: unknown) {
  const path = join(dataDir, file);
  await mkdir(dirname(path), { recursive: true });
  const tempFile = `${path}.${randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`);
  await rename(tempFile, path);
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function arrayCount(value: unknown) {
  return arrayValue(value).length;
}

function objectEntryCount(value: unknown) {
  return Object.keys(objectValue(value)).length;
}

export async function summarizePreTwilioResetStores(input: { dataDir?: string } = {}): Promise<ResetStoreSummary> {
  const dataDir = input.dataDir ?? leadsyDataDir;
  const auth = objectValue(await readJsonFile(dataDir, "auth.json"));
  const leadKnowledge = objectValue(await readJsonFile(dataDir, "lead-knowledge.json"));
  const leadCrm = objectValue(await readJsonFile(dataDir, "lead-crm.json"));
  const workspaceSenders = objectValue(await readJsonFile(dataDir, "workspace-whatsapp-senders.json"));
  const teamspace = objectValue(await readJsonFile(dataDir, "teamspace.json"));
  const calendar = objectValue(await readJsonFile(dataDir, "calendar.json"));

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
    leadCrm: {
      assignmentRules: arrayCount(leadCrm.assignmentRules),
      assignmentHistory: arrayCount(leadCrm.assignmentHistory),
      followUpTasks: arrayCount(leadCrm.followUpTasks),
      qualificationProfiles: arrayCount(leadCrm.qualificationProfiles)
    },
    agencyClients: {
      clients: arrayCount(await readJsonFile(dataDir, "agency-clients.json"))
    },
    workspaceSenders: {
      senders: arrayCount(workspaceSenders.senders)
    },
    twilioIntegration: {
      entries: objectEntryCount(await readJsonFile(dataDir, "twilio-integration.json"))
    },
    teamspace: {
      members: arrayCount(teamspace.members),
      threadMessages: arrayCount(teamspace.threadMessages)
    },
    calendar: {
      events: arrayCount(calendar.events)
    }
  };
}

export async function summarizeFullProductResetStores(input: { dataDir?: string } = {}) {
  return summarizePreTwilioResetStores(input);
}

async function backupStores(input: {
  dataDir: string;
  backupRoot: string;
  label: string;
  manifest: ResetStoreManifestItem[];
}) {
  const backupDir = join(input.backupRoot, input.label);
  await mkdir(backupDir, { recursive: true });
  const files: string[] = [];
  for (const item of input.manifest) {
    const source = join(input.dataDir, item.file);
    try {
      await stat(source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    await cp(source, join(backupDir, item.file));
    files.push(item.file);
  }
  await writeFile(join(backupDir, "RESET_MANIFEST.json"), `${JSON.stringify(input.manifest, null, 2)}\n`);
  return { backupDir, files };
}

export async function createPreTwilioResetBackup(input: {
  dataDir?: string;
  backupRoot?: string;
  label?: string;
} = {}): Promise<PreTwilioBackupResult> {
  const dataDir = input.dataDir ?? leadsyDataDir;
  const backupRoot = input.backupRoot ?? join(process.cwd(), "backups/pre-twilio-reset");
  const label = input.label ?? backupRunId();
  const backup = await backupStores({ dataDir, backupRoot, label, manifest: preTwilioResetManifest });
  return {
    ...backup,
    summary: await summarizePreTwilioResetStores({ dataDir })
  };
}

export async function createFullProductResetBackup(input: {
  dataDir?: string;
  backupRoot?: string;
  label?: string;
} = {}): Promise<PreTwilioBackupResult> {
  const dataDir = input.dataDir ?? leadsyDataDir;
  const backupRoot = input.backupRoot ?? "/data/leadsy/backups";
  const label = input.label ?? fullProductResetRunId();
  const backup = await backupStores({ dataDir, backupRoot, label, manifest: fullProductResetManifest });
  return {
    ...backup,
    summary: await summarizeFullProductResetStores({ dataDir })
  };
}

async function assertBackupDir(path?: string) {
  if (!path) throw new Error("A successful backup directory is required before reset.");
  try {
    const info = await stat(path);
    if (!info.isDirectory()) throw new Error("A successful backup directory is required before reset.");
  } catch {
    throw new Error("A successful backup directory is required before reset.");
  }
}

export async function resetLocalCrmForTwilio(input: {
  dataDir?: string;
  requiredBackupDir?: string;
} = {}): Promise<PreTwilioResetResult> {
  await assertBackupDir(input.requiredBackupDir);
  const dataDir = input.dataDir ?? leadsyDataDir;
  const before = await summarizePreTwilioResetStores({ dataDir });
  const leadCrm = objectValue(await readJsonFile(dataDir, "lead-crm.json"));
  const workspaceSenders = objectValue(await readJsonFile(dataDir, "workspace-whatsapp-senders.json"));

  await writeJsonFile(dataDir, "lead-knowledge.json", { leads: [], conversations: [], messages: [] });
  await writeJsonFile(dataDir, "lead-crm.json", {
    assignmentRules: arrayValue(leadCrm.assignmentRules),
    assignmentHistory: [],
    followUpTasks: [],
    qualificationProfiles: arrayValue(leadCrm.qualificationProfiles)
  });
  await writeJsonFile(dataDir, "teamspace.json", { members: [], threadMessages: [] });
  await writeJsonFile(dataDir, "calendar.json", { events: [] });
  await writeJsonFile(dataDir, "twilio-integration.json", {});
  await writeJsonFile(dataDir, "workspace-whatsapp-senders.json", {
    senders: arrayValue(workspaceSenders.senders)
  });

  return {
    removed: {
      leads: before.leadKnowledge.leads,
      conversations: before.leadKnowledge.conversations,
      messages: before.leadKnowledge.messages,
      crmAssignmentHistory: before.leadCrm.assignmentHistory,
      crmFollowUpTasks: before.leadCrm.followUpTasks,
      teamMembers: before.teamspace.members,
      internalMessages: before.teamspace.threadMessages,
      calendarEvents: before.calendar.events
    },
    preserved: {
      authUsers: before.auth.users,
      authSessions: before.auth.sessions,
      crmAssignmentRules: before.leadCrm.assignmentRules,
      qualificationProfiles: before.leadCrm.qualificationProfiles,
      workspaceSenders: before.workspaceSenders.senders
    }
  };
}

export async function resetFullProductData(input: {
  dataDir?: string;
  requiredBackupDir?: string;
} = {}): Promise<FullProductResetResult> {
  await assertBackupDir(input.requiredBackupDir);
  const dataDir = input.dataDir ?? leadsyDataDir;
  const before = await summarizeFullProductResetStores({ dataDir });

  await writeJsonFile(dataDir, "auth.json", { users: [], sessions: [] });
  await writeJsonFile(dataDir, "lead-knowledge.json", { leads: [], conversations: [], messages: [] });
  await writeJsonFile(dataDir, "lead-crm.json", {
    assignmentRules: [],
    assignmentHistory: [],
    followUpTasks: [],
    qualificationProfiles: []
  });
  await writeJsonFile(dataDir, "agency-clients.json", []);
  await writeJsonFile(dataDir, "workspace-whatsapp-senders.json", { senders: [] });
  await writeJsonFile(dataDir, "twilio-integration.json", {});
  await writeJsonFile(dataDir, "teamspace.json", { members: [], threadMessages: [] });
  await writeJsonFile(dataDir, "calendar.json", { events: [] });

  return {
    removed: {
      authUsers: before.auth.users,
      authSessions: before.auth.sessions,
      leads: before.leadKnowledge.leads,
      conversations: before.leadKnowledge.conversations,
      messages: before.leadKnowledge.messages,
      crmAssignmentRules: before.leadCrm.assignmentRules,
      crmAssignmentHistory: before.leadCrm.assignmentHistory,
      crmFollowUpTasks: before.leadCrm.followUpTasks,
      qualificationProfiles: before.leadCrm.qualificationProfiles,
      agencyClients: before.agencyClients.clients,
      workspaceSenders: before.workspaceSenders.senders,
      twilioStatusEntries: before.twilioIntegration.entries,
      teamMembers: before.teamspace.members,
      internalMessages: before.teamspace.threadMessages,
      calendarEvents: before.calendar.events
    },
    preserved: {}
  };
}

export function resetConfirmationToken() {
  return "RESET_LEADSY_CRM";
}

export function backupRunId() {
  return `pre-twilio-reset-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}

export function fullProductResetConfirmationToken() {
  return "RESET_ALL_LEADSY_APP_DATA_AND_USERS";
}

export function fullProductResetRunId() {
  return `full-product-reset-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}
