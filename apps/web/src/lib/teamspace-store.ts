import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const teamspaceFile = join(leadsyDataDir, "teamspace.json");

export type TeamMemberType = "human" | "ai_agent_full" | "ai_agent_assisted";
export type TeamMemberRole = "owner" | "admin" | "manager" | "agent";
export type TeamMemberStatus = "active" | "paused" | "invited";
export type TeamMemberSenderMode = "none" | "simulator" | "twilio" | "workspace";
export type TeamThreadAuthorType = "human" | "ai_agent" | "system";
export type TeamThreadEventType =
  | "internal_note"
  | "task_assignment"
  | "handoff_summary"
  | "calendar_proposal"
  | "agent_guard";

export type TeamMember = {
  id: string;
  tenantId: string;
  ownerId: string;
  type: TeamMemberType;
  name: string;
  emailOrPhone?: string;
  authUserId?: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  pipelineStages: string[];
  behaviorInstructions?: string;
  autoReplyEnabled: boolean;
  escalationKeywords: string[];
  senderMode: TeamMemberSenderMode;
  simulatorSenderHandle?: string;
  simulatorPhoneNumber?: string;
  workspaceSenderLabel?: string;
  workload: {
    openLeads: number;
    openTasks: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type TeamThreadMessage = {
  id: string;
  tenantId: string;
  ownerId: string;
  leadId: string;
  conversationId?: string;
  authorMemberId?: string;
  authorType: TeamThreadAuthorType;
  body: string;
  eventType: TeamThreadEventType;
  triggerId?: string;
  visibility: "internal";
  createdAt: string;
};

type Scope = {
  tenantId: string;
  ownerId: string;
};

type TeamspaceState = {
  members: TeamMember[];
  threadMessages: TeamThreadMessage[];
};

type CreateTeamMemberInput = Scope & {
  type: TeamMemberType;
  name: string;
  emailOrPhone?: string;
  password?: string;
  role?: TeamMemberRole;
  pipelineStages?: string[];
  behaviorInstructions?: string;
  autoReplyEnabled?: boolean;
  escalationKeywords?: string[];
};

type UpdateTeamMemberInput = Scope & {
  memberId: string;
  name?: string;
  emailOrPhone?: string;
  role?: TeamMemberRole;
  status?: TeamMemberStatus;
  pipelineStages?: string[];
  behaviorInstructions?: string;
  autoReplyEnabled?: boolean;
  escalationKeywords?: string[];
};

type PostThreadInput = Scope & {
  leadId: string;
  conversationId?: string;
  authorMemberId?: string;
  authorType: TeamThreadAuthorType;
  body: string;
  eventType?: TeamThreadEventType;
  triggerId?: string;
};

function emptyState(): TeamspaceState {
  return { members: [], threadMessages: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function cleanString(value?: string) {
  return value?.trim() || undefined;
}

function uniqueStrings(values: string[] = []) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export const defaultQualificationAgentName = "Qualification AI";
const defaultQualificationStages = ["new", "collecting"];

function scopeMatches(scope: Scope, item: Scope) {
  return item.tenantId === scope.tenantId && item.ownerId === scope.ownerId;
}

async function readState(): Promise<TeamspaceState> {
  try {
    const raw = await readFile(teamspaceFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<TeamspaceState>;
    return {
      members: Array.isArray(parsed.members) ? parsed.members.map(normalizeMember) : [],
      threadMessages: Array.isArray(parsed.threadMessages) ? parsed.threadMessages.map(normalizeThreadMessage) : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return emptyState();
    throw error;
  }
}

async function writeState(state: TeamspaceState) {
  await mkdir(dirname(teamspaceFile), { recursive: true });
  const tempFile = `${teamspaceFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, teamspaceFile);
}

let teamspaceMutationQueue = Promise.resolve();

async function mutateState<T>(updater: (state: TeamspaceState) => { result: T; state?: TeamspaceState } | Promise<{ result: T; state?: TeamspaceState }>) {
  const operation = teamspaceMutationQueue.then(async () => {
    const state = await readState();
    const next = await updater(state);
    if (next.state) await writeState(next.state);
    return next.result;
  });
  teamspaceMutationQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

function normalizeMember(member: TeamMember): TeamMember {
  return {
    ...member,
    role: member.role ?? "agent",
    status: member.status ?? "active",
    pipelineStages: uniqueStrings(member.pipelineStages ?? []),
    escalationKeywords: uniqueStrings(member.escalationKeywords ?? []),
    autoReplyEnabled: Boolean(member.autoReplyEnabled),
    senderMode: member.senderMode ?? "none",
    workload: member.workload ?? { openLeads: 0, openTasks: 0 }
  };
}

function normalizeThreadMessage(message: TeamThreadMessage): TeamThreadMessage {
  return {
    ...message,
    eventType: message.eventType ?? "internal_note",
    visibility: "internal"
  };
}

function createHumanAuthUserId(input: CreateTeamMemberInput) {
  const basis = `${input.tenantId}:${input.emailOrPhone ?? input.name}:${Date.now()}:${crypto.randomUUID()}`;
  return `usr_${Buffer.from(basis).toString("base64url").slice(0, 12)}`;
}

function isDefaultQualificationAgent(member: Pick<TeamMember, "type" | "name">) {
  return member.type === "ai_agent_full" && member.name.trim().toLowerCase() === defaultQualificationAgentName.toLowerCase();
}

function randomDigits(length: number) {
  let digits = "";
  while (digits.length < length) {
    digits += crypto.randomUUID().replace(/\D/g, "");
  }
  return digits.slice(0, length);
}

function simulatorPhoneNumber() {
  return `+1555${randomDigits(7)}`;
}

function simulatorSenderHandle(name: string) {
  return `${name.trim() || "Team Member"} Simulator`;
}

function applyInitialSenderIdentity(member: TeamMember): TeamMember {
  if (isDefaultQualificationAgent(member)) {
    return {
      ...member,
      senderMode: "workspace",
      simulatorSenderHandle: undefined,
      simulatorPhoneNumber: undefined,
      workspaceSenderLabel: "Account owner WhatsApp"
    };
  }

  return {
    ...member,
    senderMode: "simulator",
    simulatorSenderHandle: simulatorSenderHandle(member.name),
    simulatorPhoneNumber: member.simulatorPhoneNumber ?? simulatorPhoneNumber(),
    workspaceSenderLabel: undefined
  };
}

function defaultQualificationAgent(scope: Scope, now: string, existing?: TeamMember): TeamMember {
  return normalizeMember({
    id: existing?.id ?? `tm_${crypto.randomUUID()}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    type: "ai_agent_full",
    name: defaultQualificationAgentName,
    emailOrPhone: existing?.emailOrPhone,
    authUserId: existing?.authUserId,
    role: "agent",
    status: "active",
    pipelineStages: defaultQualificationStages,
    behaviorInstructions: existing?.behaviorInstructions ?? "Qualify early-stage leads, keep replies concise, and stop after handoff.",
    autoReplyEnabled: true,
    escalationKeywords: uniqueStrings(existing?.escalationKeywords?.length ? existing.escalationKeywords : ["human", "manager", "refund", "legal", "stop"]),
    senderMode: "workspace",
    workspaceSenderLabel: "Account owner WhatsApp",
    workload: existing?.workload ?? { openLeads: 0, openTasks: 0 },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
}

export async function createTeamMember(input: CreateTeamMemberInput) {
  return mutateState((state) => {
    const now = nowIso();
    if (isDefaultQualificationAgent({ type: input.type, name: input.name })) {
      const existing = state.members.find((member) => scopeMatches(input, member) && isDefaultQualificationAgent(member));
      const agent = defaultQualificationAgent(input, now, existing);
      return {
        state: {
          ...state,
          members: existing
            ? state.members.map((member) => (member.id === existing.id ? agent : member))
            : [...state.members, agent]
        },
        result: agent
      };
    }

    const member: TeamMember = applyInitialSenderIdentity({
      id: `tm_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      type: input.type,
      name: input.name.trim(),
      emailOrPhone: cleanString(input.emailOrPhone),
      authUserId: input.type === "human" ? createHumanAuthUserId(input) : undefined,
      role: input.role ?? (input.type === "human" ? "agent" : "agent"),
      status: input.type === "human" ? "active" : "active",
      pipelineStages: uniqueStrings(input.pipelineStages ?? (input.type === "ai_agent_full" ? ["new", "collecting"] : [])),
      behaviorInstructions: cleanString(input.behaviorInstructions),
      autoReplyEnabled: Boolean(input.autoReplyEnabled),
      escalationKeywords: uniqueStrings(input.escalationKeywords ?? []),
      senderMode: "none",
      workload: { openLeads: 0, openTasks: 0 },
      createdAt: now,
      updatedAt: now
    });
    return { state: { ...state, members: [...state.members, member] }, result: member };
  });
}

export async function ensureDefaultQualificationAgent(scope: Scope) {
  return mutateState((state) => {
    const now = nowIso();
    const existing = state.members.find((member) => scopeMatches(scope, member) && isDefaultQualificationAgent(member));
    const agent = defaultQualificationAgent(scope, now, existing);
    return {
      state: {
        ...state,
        members: existing
          ? state.members.map((member) => (member.id === existing.id ? agent : member))
          : [...state.members, agent]
      },
      result: agent
    };
  });
}

export async function updateTeamMember(input: UpdateTeamMemberInput) {
  return mutateState((state) => {
    const existing = state.members.find((member) => member.id === input.memberId && scopeMatches(input, member));
    if (!existing) throw new Error("Team member was not found.");
    const updated: TeamMember = normalizeMember({
      ...existing,
      name: input.name?.trim() || existing.name,
      emailOrPhone: cleanString(input.emailOrPhone) ?? existing.emailOrPhone,
      role: input.role ?? existing.role,
      status: input.status ?? existing.status,
      pipelineStages: input.pipelineStages ? uniqueStrings(input.pipelineStages) : existing.pipelineStages,
      behaviorInstructions: cleanString(input.behaviorInstructions) ?? existing.behaviorInstructions,
      autoReplyEnabled: input.autoReplyEnabled ?? existing.autoReplyEnabled,
      escalationKeywords: input.escalationKeywords ? uniqueStrings(input.escalationKeywords) : existing.escalationKeywords,
      updatedAt: nowIso()
    });
    return {
      state: {
        ...state,
        members: state.members.map((member) => (member.id === existing.id ? updated : member))
      },
      result: updated
    };
  });
}

export async function listTeamMembers(scope: Scope) {
  const state = await readState();
  return state.members
    .filter((member) => scopeMatches(scope, member))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function getTeamMember(input: Scope & { memberId: string }) {
  const state = await readState();
  return state.members.find((member) => member.id === input.memberId && scopeMatches(input, member)) ?? null;
}

export async function findPrimaryQualificationAgent(scope: Scope) {
  return ensureDefaultQualificationAgent(scope);
}

export async function findPipelineOwner(scope: Scope, stage: string) {
  const members = await listTeamMembers(scope);
  return (
    members.find((member) => member.status === "active" && member.type === "human" && member.pipelineStages.includes(stage)) ??
    members.find((member) => member.status === "active" && member.pipelineStages.includes(stage)) ??
    members.find((member) => member.status === "active" && member.type === "human") ??
    null
  );
}

export async function provisionTeamMemberSender(input: Scope & { memberId: string }) {
  return mutateState((state) => {
    const existing = state.members.find((member) => member.id === input.memberId && scopeMatches(input, member));
    if (!existing) throw new Error("Team member was not found.");
    const updated: TeamMember = {
      ...applyInitialSenderIdentity(existing),
      updatedAt: nowIso()
    };
    return {
      state: {
        ...state,
        members: state.members.map((member) => (member.id === existing.id ? updated : member))
      },
      result: {
        member: updated,
        sender: {
          memberId: updated.id,
          transportMode: updated.senderMode,
          simulatorHandle: updated.simulatorSenderHandle,
          simulatorPhoneNumber: updated.simulatorPhoneNumber,
          workspaceSenderLabel: updated.workspaceSenderLabel,
          status: "approved" as const
        }
      }
    };
  });
}

export async function postTeamThreadMessage(input: PostThreadInput) {
  return mutateState((state) => {
    if (input.triggerId) {
      const existing = state.threadMessages.find(
        (message) => scopeMatches(input, message) && message.leadId === input.leadId && message.triggerId === input.triggerId
      );
      if (existing) return { result: existing };
    }
    const message: TeamThreadMessage = {
      id: `tthread_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      leadId: input.leadId,
      conversationId: input.conversationId,
      authorMemberId: input.authorMemberId,
      authorType: input.authorType,
      body: input.body.trim(),
      eventType: input.eventType ?? "internal_note",
      triggerId: input.triggerId,
      visibility: "internal",
      createdAt: nowIso()
    };
    return {
      state: {
        ...state,
        threadMessages: [...state.threadMessages, message]
      },
      result: message
    };
  });
}

export async function listTeamThreadMessages(input: Scope & { leadId?: string; conversationId?: string }) {
  const state = await readState();
  return state.threadMessages
    .filter((message) => scopeMatches(input, message))
    .filter((message) => !input.leadId || message.leadId === input.leadId)
    .filter((message) => !input.conversationId || message.conversationId === input.conversationId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function summarizeTeamspaceHealth() {
  const state = await readState();
  return {
    members: state.members.length,
    aiAgents: state.members.filter((member) => member.type.startsWith("ai_agent")).length,
    humans: state.members.filter((member) => member.type === "human").length,
    internalThreadMessages: state.threadMessages.length
  };
}
