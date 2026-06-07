import { randomUUID, scrypt as scryptCallback } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const authFile = join(leadsyDataDir, "auth.json");
const knowledgeFile = join(leadsyDataDir, "lead-knowledge.json");
const teamspaceFile = join(leadsyDataDir, "teamspace.json");
const calendarFile = join(leadsyDataDir, "calendar.json");

const demoOwner = {
  id: "usr_demo_agency_owner",
  tenantId: "tenant_demo_agency",
  name: "Demo Agency Owner",
  emailOrPhone: "demo-owner@leadsy.local",
  normalizedLogin: "demo-owner@leadsy.local",
  role: "owner" as const,
  createdAt: "2026-06-03T06:00:00.000Z"
};

const demoQualificationAgentId = "tm_demo_qualification_ai";
const demoSalesOwnerId = "tm_demo_sales_owner";
const demoLeadId = "lead_demo_asha_whatsapp";
const demoConversationId = "leadconv_demo_asha_whatsapp";

type AuthUser = typeof demoOwner & {
  passwordHash: string;
  onboardingCompletedAt?: string;
  onboardingProfile?: Record<string, unknown>;
};

type AuthState = {
  users: AuthUser[];
  sessions: unknown[];
};

type JsonObject = Record<string, unknown>;

const scryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derivePasswordKey(password: string, salt: string, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, scryptOptions, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

async function hashDemoPassword(password: string) {
  const salt = "leadsy-demo-owner-salt";
  const derived = await derivePasswordKey(password, salt, 64);
  return `scrypt$${scryptOptions.N}$${scryptOptions.r}$${scryptOptions.p}$${salt}$${derived.toString("base64url")}`;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf8");
    return raw.trim() ? (JSON.parse(raw) as T) : fallback;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return fallback;
    throw error;
  }
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const tempFile = `${path}.${randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`);
  await rename(tempFile, path);
}

function nowFor(minutes: number) {
  return new Date(Date.UTC(2026, 5, 3, 6, minutes, 0)).toISOString();
}

async function seedOwner(password: string) {
  const state = await readJson<AuthState>(authFile, { users: [], sessions: [] });
  const passwordHash = await hashDemoPassword(password);
  const existing = state.users.find((user) => user.id === demoOwner.id || user.normalizedLogin === demoOwner.normalizedLogin);
  const user: AuthUser = {
    ...demoOwner,
    passwordHash,
    onboardingCompletedAt: nowFor(0),
    onboardingProfile: {
      businessName: "Leadsy Demo Agency",
      industry: "Sales automation",
      whatsappTransport: "leadsy_managed_twilio",
      leadSources: ["Assigned WhatsApp number", "Website"],
      assignmentPreference: ["AI qualification first", "Human sales owner after qualification"],
      followUpPreference: ["Calendar-backed meeting proposals"]
    }
  };

  await writeJson(authFile, {
    users: existing
      ? state.users.map((candidate) => (candidate.id === existing.id ? user : candidate))
      : [...state.users, user],
    sessions: state.sessions.filter((session) => {
      const maybeSession = session as { userId?: string };
      return maybeSession.userId !== demoOwner.id;
    })
  });

  return { user, created: !existing };
}

async function seedKnowledge() {
  const state = await readJson<{
    leads: JsonObject[];
    conversations: JsonObject[];
    messages: JsonObject[];
  }>(knowledgeFile, { leads: [], conversations: [], messages: [] });

  const scopeMatches = (item: JsonObject) => item.tenantId === demoOwner.tenantId && item.ownerId === demoOwner.id;
  const withoutDemoScope = <T extends JsonObject>(items: T[]) => items.filter((item) => !scopeMatches(item));

  const lead = {
    id: demoLeadId,
    tenantId: demoOwner.tenantId,
    ownerId: demoOwner.id,
    identityKeys: ["phone:919000000001"],
    contact: {
      displayName: "Asha Buyer",
      phone: "+919000000001",
      waId: "919000000001"
    },
    leadStatus: "lead",
    crmStatus: "needs_reply",
    productPipelineStatus: "new",
    leadSource: "WhatsApp Simulator",
    assigneeId: demoQualificationAgentId,
    assigneeName: "Qualification AI",
    qualificationFields: {
      name: "Asha Buyer",
      phone: "+919000000001",
      company: "LensMart",
      need: "WhatsApp CRM follow-up",
      timeline: "today"
    },
    qualificationStage: "collecting",
    summary: "Asha asked about WhatsApp CRM follow-up for LensMart.",
    nextAction: "Qualification AI should ask one concise follow-up question before handoff.",
    facts: ["Company: LensMart", "Need: WhatsApp CRM follow-up", "Timeline: today"],
    createdAt: nowFor(1),
    updatedAt: nowFor(3)
  };

  const conversation = {
    id: demoConversationId,
    tenantId: demoOwner.tenantId,
    ownerId: demoOwner.id,
    leadId: demoLeadId,
    channel: "whatsapp",
    source: "twilio_simulator",
    externalKey: "phone:919000000001",
    contact: lead.contact,
    knowledgeStatus: "included",
    messageCount: 2,
    inboundCount: 1,
    outboundCount: 1,
    lastMessageAt: nowFor(3),
    lastMessagePreview: "Thanks Asha. What volume of WhatsApp enquiries does LensMart handle each day?",
    summary: lead.summary,
    nextAction: lead.nextAction,
    sentiment: "positive",
    createdAt: nowFor(1),
    updatedAt: nowFor(3)
  };

  const messages = [
    {
      id: "leadmsg_demo_asha_inbound",
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      leadId: demoLeadId,
      conversationId: demoConversationId,
      source: "twilio_simulator",
      channel: "whatsapp",
      externalId: "sim_demo_asha_inbound",
      providerMessageSid: "sim_demo_asha_inbound",
      direction: "inbound",
      body: "Company: LensMart\nNeed: WhatsApp CRM follow-up\nTimeline: today",
      messageType: "text",
      sentAt: nowFor(2),
      receivedAt: nowFor(2),
      deliveryStatus: "received",
      statusUpdatedAt: nowFor(2),
      raw: { demo: true }
    },
    {
      id: "leadmsg_demo_asha_ai_reply",
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      leadId: demoLeadId,
      conversationId: demoConversationId,
      source: "twilio_simulator",
      channel: "whatsapp",
      externalId: "sim_demo_asha_ai_reply",
      providerMessageSid: "sim_demo_asha_ai_reply",
      direction: "outbound",
      body: "Thanks Asha. What volume of WhatsApp enquiries does LensMart handle each day?",
      messageType: "text",
      sentAt: nowFor(3),
      receivedAt: nowFor(3),
      generatedBy: "ai_agent",
      deliveryStatus: "simulated_delivered",
      statusUpdatedAt: nowFor(3),
      raw: { demo: true }
    }
  ];

  await writeJson(knowledgeFile, {
    leads: [...withoutDemoScope(state.leads), lead],
    conversations: [...withoutDemoScope(state.conversations), conversation],
    messages: [...withoutDemoScope(state.messages), ...messages]
  });

  return { leads: 1, conversations: 1, messages: messages.length };
}

async function seedTeamspace() {
  const state = await readJson<{
    members: JsonObject[];
    threadMessages: JsonObject[];
  }>(teamspaceFile, { members: [], threadMessages: [] });

  const scopeMatches = (item: JsonObject) => item.tenantId === demoOwner.tenantId && item.ownerId === demoOwner.id;
  const withoutDemoScope = <T extends JsonObject>(items: T[]) => items.filter((item) => !scopeMatches(item));

  const members = [
    {
      id: demoQualificationAgentId,
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      type: "ai_agent_full",
      name: "Qualification AI",
      role: "agent",
      status: "active",
      pipelineStages: ["new", "collecting"],
      behaviorInstructions: "Ask short qualification questions and stop after handoff.",
      autoReplyEnabled: true,
      escalationKeywords: ["human", "manager", "angry", "refund", "legal"],
      senderMode: "simulator",
      simulatorSenderHandle: "Qualification AI Simulator",
      workload: { openLeads: 1, openTasks: 0 },
      createdAt: nowFor(0),
      updatedAt: nowFor(3)
    },
    {
      id: demoSalesOwnerId,
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      type: "human",
      name: "Demo Sales Owner",
      emailOrPhone: "sales-owner@leadsy.local",
      authUserId: "usr_demo_sales_owner",
      role: "manager",
      status: "active",
      pipelineStages: ["qualified", "interested", "contacted"],
      autoReplyEnabled: false,
      escalationKeywords: [],
      senderMode: "none",
      workload: { openLeads: 0, openTasks: 0 },
      createdAt: nowFor(0),
      updatedAt: nowFor(3)
    }
  ];

  const threadMessages = [
    {
      id: "teammsg_demo_asha_handoff",
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      leadId: demoLeadId,
      conversationId: demoConversationId,
      authorMemberId: demoQualificationAgentId,
      authorType: "ai_agent",
      body: "Qualification started. Awaiting query volume before handoff to sales owner.",
      eventType: "handoff_summary",
      triggerId: "demo-seed-handoff",
      visibility: "internal",
      createdAt: nowFor(4)
    }
  ];

  await writeJson(teamspaceFile, {
    members: [...withoutDemoScope(state.members), ...members],
    threadMessages: [...withoutDemoScope(state.threadMessages), ...threadMessages]
  });

  return { teamMembers: members.length, internalMessages: threadMessages.length };
}

async function seedCalendar() {
  const state = await readJson<{ events: JsonObject[] }>(calendarFile, { events: [] });
  const events = [
    {
      id: "calev_demo_sales_availability",
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      memberId: demoSalesOwnerId,
      title: "Sales owner availability",
      startAt: nowFor(8),
      endAt: nowFor(68),
      eventType: "availability",
      status: "available",
      attendees: [],
      createdAt: nowFor(0),
      updatedAt: nowFor(0)
    },
    {
      id: "calev_demo_asha_proposed",
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      memberId: demoSalesOwnerId,
      leadId: demoLeadId,
      conversationId: demoConversationId,
      title: "Proposed LensMart discovery call",
      startAt: nowFor(90),
      endAt: nowFor(120),
      eventType: "meeting",
      status: "proposed",
      attendees: ["Asha Buyer", "Demo Sales Owner"],
      createdAt: nowFor(4),
      updatedAt: nowFor(4)
    }
  ];

  await writeJson(calendarFile, {
    events: [
      ...state.events.filter((event) => event.tenantId !== demoOwner.tenantId || event.ownerId !== demoOwner.id),
      ...events
    ]
  });

  return { calendarEvents: events.length };
}

export async function seedLeadsyDemoWorkspace(options: { requirePassword?: boolean } = {}) {
  const requirePassword = options.requirePassword ?? true;
  const password = process.env.LEADSY_DEMO_OWNER_PASSWORD?.trim();
  if (requirePassword && !password) {
    throw new Error("LEADSY_DEMO_OWNER_PASSWORD is required to seed the demo workspace.");
  }
  if (!password) {
    throw new Error("LEADSY_DEMO_OWNER_PASSWORD is required to seed the demo workspace.");
  }

  const owner = await seedOwner(password);
  const knowledgeCounts = await seedKnowledge();
  const teamspaceCounts = await seedTeamspace();
  const calendarCounts = await seedCalendar();

  return {
    owner: {
      id: owner.user.id,
      tenantId: owner.user.tenantId,
      name: owner.user.name,
      emailOrPhone: owner.user.emailOrPhone,
      role: owner.user.role
    },
    credentials: {
      emailOrPhone: owner.user.emailOrPhone,
      password,
      passwordSource: "LEADSY_DEMO_OWNER_PASSWORD"
    },
    created: {
      owner: owner.created
    },
    counts: {
      ...knowledgeCounts,
      ...teamspaceCounts,
      ...calendarCounts
    }
  };
}
