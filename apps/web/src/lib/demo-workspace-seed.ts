import { scrypt as scryptCallback } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";
import type { LeadKnowledgeChannel, LeadKnowledgeDirection, LeadKnowledgeSource } from "./lead-knowledge-store";
import type { ExtensionPlatform, ExtensionTaskPriority, ExtensionTaskStatus, ExtensionTaskType } from "./extension-store";

const authFile = join(leadsyDataDir, "auth.json");
const knowledgeFile = join(leadsyDataDir, "lead-knowledge.json");
const extensionFile = join(leadsyDataDir, "extension.json");

const demoOwner = {
  id: "usr_demo_agency_owner",
  tenantId: "tenant_demo_agency",
  name: "Demo Agency Owner",
  emailOrPhone: "demo-owner@leadsy.local",
  normalizedLogin: "demo-owner@leadsy.local",
  role: "owner" as const,
  createdAt: "2026-06-03T06:00:00.000Z"
};

type AuthUser = typeof demoOwner & {
  passwordHash: string;
  lastLoginAt?: string;
};

type AuthState = {
  users: AuthUser[];
  sessions: unknown[];
};

type DemoLead = {
  id: string;
  contact: {
    displayName?: string;
    phone?: string;
    email?: string;
    handle?: string;
    profileUrl?: string;
    waId?: string;
  };
  identityKeys: string[];
  leadStatus?: "lead" | "excluded";
  summary: string;
  nextAction: string;
  facts: string[];
  conversations: Array<{
    id: string;
    channel: LeadKnowledgeChannel;
    source: LeadKnowledgeSource;
    externalKey: string;
    sourceUrl?: string;
    knowledgeStatus?: "included" | "excluded";
    summary?: string;
    nextAction?: string;
    messages: Array<{
      id: string;
      externalId: string;
      direction: LeadKnowledgeDirection;
      body: string;
      messageType?: string;
      sentAt: string;
      generatedBy?: "leadsy" | "fallback" | "human" | "manual";
    }>;
  }>;
};

type KnowledgeState = {
  leads: Array<Record<string, unknown>>;
  conversations: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
};

type ExtensionState = {
  tokens: unknown[];
  conversations: unknown[];
  messages: unknown[];
  events: unknown[];
  tasks: Array<Record<string, unknown>>;
  taskEvents: Array<Record<string, unknown>>;
};

type DemoTask = {
  id: string;
  type: ExtensionTaskType;
  status: ExtensionTaskStatus;
  priority: ExtensionTaskPriority;
  leadId: string;
  conversationId?: string;
  platform: ExtensionPlatform;
  targetUrl?: string;
  contact: { displayName?: string; phone?: string; email?: string; handle?: string; profileUrl?: string };
  draftMessage: string;
  contextSummary: string;
  resultSummary?: string;
  blockedReason?: string;
  preparedAt?: string;
  sendApprovedAt?: string;
  completedAt?: string;
  dueAt?: string;
};

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
  const tempFile = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`);
  await rename(tempFile, path);
}

function nowFor(index: number) {
  return new Date(Date.UTC(2026, 5, 3, 6, index * 4, 0)).toISOString();
}

const demoLeads: DemoLead[] = [
  {
    id: "lead_demo_ria_admissions",
    contact: {
      displayName: "Ria Sharma",
      phone: "+91 98300 11111",
      waId: "919830011111",
      email: "ria.sharma@example.edu"
    },
    identityKeys: ["phone:919830011111", "email:ria.sharma@example.edu"],
    summary: "Ria is evaluating MCA admissions and wants fees, scholarship details, and a weekend counselling slot.",
    nextAction: "Approve the prepared WhatsApp follow-up and confirm Saturday counselling availability.",
    facts: ["Asked for MCA fees.", "Parent prefers weekend counselling.", "Email brochure was sent."],
    conversations: [
      {
        id: "leadconv_demo_ria_whatsapp",
        channel: "whatsapp",
        source: "meta-webhook",
        externalKey: "meta:whatsapp:919830011111",
        sourceUrl: "https://web.whatsapp.com/send?phone=919830011111",
        messages: [
          {
            id: "leadmsg_demo_ria_wa_1",
            externalId: "demo-ria-wa-1",
            direction: "inbound",
            body: "Hi, can you share MCA fees and admission dates?",
            sentAt: nowFor(1)
          },
          {
            id: "leadmsg_demo_ria_wa_2",
            externalId: "demo-ria-wa-2",
            direction: "outbound",
            body: "Sure, I can share the fee range and help book a counselling slot.",
            sentAt: nowFor(2),
            generatedBy: "leadsy"
          }
        ]
      },
      {
        id: "leadconv_demo_ria_email",
        channel: "email",
        source: "manual",
        externalKey: "manual:lead_demo_ria_admissions:email",
        messages: [
          {
            id: "leadmsg_demo_ria_email_1",
            externalId: "demo-ria-email-1",
            direction: "outbound",
            body: "Sent MCA brochure, fees, scholarship ranges, and hostel details.",
            messageType: "manual",
            sentAt: nowFor(3),
            generatedBy: "manual"
          }
        ]
      },
      {
        id: "leadconv_demo_ria_call",
        channel: "call",
        source: "manual",
        externalKey: "manual:lead_demo_ria_admissions:call",
        messages: [
          {
            id: "leadmsg_demo_ria_call_1",
            externalId: "demo-ria-call-1",
            direction: "note",
            body: "Call note: parent wants Saturday after 4 PM for counselling.",
            messageType: "manual",
            sentAt: nowFor(4),
            generatedBy: "manual"
          }
        ]
      }
    ]
  },
  {
    id: "lead_demo_zoya_events",
    contact: {
      displayName: "Zoya Khan",
      handle: "zoya.events",
      profileUrl: "https://www.instagram.com/zoya.events"
    },
    identityKeys: ["instagram:handle:zoya.events", "instagram:profile:www.instagram.com/zoya.events"],
    summary: "Zoya asked on Instagram about event booking automation for wedding venue enquiries.",
    nextAction: "Send an Instagram follow-up asking expected monthly enquiry volume.",
    facts: ["Runs a wedding venue enquiry page.", "Interested in response speed and booking conversion."],
    conversations: [
      {
        id: "leadconv_demo_zoya_instagram",
        channel: "instagram",
        source: "meta-webhook",
        externalKey: "meta:instagram:zoya.events",
        sourceUrl: "https://www.instagram.com/zoya.events",
        messages: [
          {
            id: "leadmsg_demo_zoya_ig_1",
            externalId: "demo-zoya-ig-1",
            direction: "inbound",
            body: "Can your team handle Instagram DMs for venue bookings?",
            sentAt: nowFor(5)
          }
        ]
      }
    ]
  },
  {
    id: "lead_demo_omar_property",
    contact: {
      displayName: "Omar Realty",
      handle: "omar.realty",
      profileUrl: "https://www.facebook.com/omar.realty"
    },
    identityKeys: ["facebook:handle:omar.realty", "facebook:profile:www.facebook.com/omar.realty"],
    summary: "Omar requested a callback about property lead qualification and missed follow-ups.",
    nextAction: "Manual review the blocked Facebook task and add a better contact URL.",
    facts: ["Needs callback today.", "Property team misses high-intent Facebook leads."],
    conversations: [
      {
        id: "leadconv_demo_omar_facebook",
        channel: "facebook",
        source: "meta-webhook",
        externalKey: "meta:facebook:omar.realty",
        sourceUrl: "https://www.facebook.com/omar.realty",
        messages: [
          {
            id: "leadmsg_demo_omar_fb_1",
            externalId: "demo-omar-fb-1",
            direction: "inbound",
            body: "Need a callback today about property lead follow-ups.",
            sentAt: nowFor(6)
          }
        ]
      }
    ]
  },
  {
    id: "lead_demo_meera_health",
    contact: {
      displayName: "Meera Wellness",
      email: "hello@meerawellness.example",
      profileUrl: "https://chat.example.com/meera"
    },
    identityKeys: ["email:hello@meerawellness.example", "generic:profile:chat.example.com/meera"],
    summary: "Meera synced from a browser chat and wants patient appointment triage.",
    nextAction: "Review included manual note; browser chat is excluded from AI knowledge for now.",
    facts: ["Healthcare team.", "Wants appointment triage.", "Browser thread excluded due privacy preference."],
    conversations: [
      {
        id: "leadconv_demo_meera_browser",
        channel: "generic-web-chat",
        source: "extension",
        externalKey: "extension:generic-web-chat:https://chat.example.com/meera",
        sourceUrl: "https://chat.example.com/meera",
        knowledgeStatus: "excluded",
        messages: [
          {
            id: "leadmsg_demo_meera_browser_1",
            externalId: "demo-meera-browser-1",
            direction: "inbound",
            body: "We need appointment triage, but please exclude this private browser thread from AI.",
            sentAt: nowFor(7),
            generatedBy: "human"
          }
        ]
      },
      {
        id: "leadconv_demo_meera_manual",
        channel: "manual",
        source: "manual",
        externalKey: "manual:lead_demo_meera_health",
        messages: [
          {
            id: "leadmsg_demo_meera_manual_1",
            externalId: "demo-meera-manual-1",
            direction: "note",
            body: "Manual note: clinic manager approved AI context from call notes only.",
            messageType: "manual",
            sentAt: nowFor(8),
            generatedBy: "manual"
          }
        ]
      }
    ]
  },
  {
    id: "lead_demo_excluded_vendor",
    contact: {
      displayName: "Vendor Pitch",
      email: "vendor@example.com"
    },
    identityKeys: ["email:vendor@example.com"],
    leadStatus: "excluded",
    summary: "Vendor solicitation. Kept for history, excluded from sales follow-up.",
    nextAction: "Track only. No sales follow-up.",
    facts: ["Excluded vendor solicitation."],
    conversations: [
      {
        id: "leadconv_demo_vendor_email",
        channel: "email",
        source: "manual",
        externalKey: "manual:lead_demo_excluded_vendor:email",
        messages: [
          {
            id: "leadmsg_demo_vendor_email_1",
            externalId: "demo-vendor-email-1",
            direction: "inbound",
            body: "We sell lead lists. Can we pitch?",
            messageType: "manual",
            sentAt: nowFor(9),
            generatedBy: "manual"
          }
        ]
      }
    ]
  }
];

const demoTasks: DemoTask[] = [
  {
    id: "exttask_demo_ria_approval",
    type: "follow_up",
    status: "awaiting_send_approval",
    priority: "urgent",
    leadId: "lead_demo_ria_admissions",
    conversationId: "leadconv_demo_ria_whatsapp",
    platform: "whatsapp-web",
    targetUrl: "https://web.whatsapp.com/send?phone=919830011111",
    contact: { displayName: "Ria Sharma", phone: "+91 98300 11111", email: "ria.sharma@example.edu" },
    draftMessage: "Hi Ria, Saturday after 4 PM is available. Should I reserve that counselling slot?",
    contextSummary: "Ria needs MCA fees and a weekend counselling slot.",
    preparedAt: nowFor(10),
    dueAt: nowFor(13)
  },
  {
    id: "exttask_demo_zoya_queued",
    type: "initiate_conversation",
    status: "queued",
    priority: "high",
    leadId: "lead_demo_zoya_events",
    conversationId: "leadconv_demo_zoya_instagram",
    platform: "instagram-web",
    targetUrl: "https://www.instagram.com/zoya.events",
    contact: { displayName: "Zoya Khan", handle: "zoya.events", profileUrl: "https://www.instagram.com/zoya.events" },
    draftMessage: "Hi Zoya, roughly how many venue enquiries do you handle each month right now?",
    contextSummary: "Instagram lead asking about venue booking automation.",
    dueAt: nowFor(14)
  },
  {
    id: "exttask_demo_omar_blocked",
    type: "manual_review",
    status: "blocked",
    priority: "normal",
    leadId: "lead_demo_omar_property",
    conversationId: "leadconv_demo_omar_facebook",
    platform: "facebook-web",
    targetUrl: "https://www.facebook.com/omar.realty",
    contact: { displayName: "Omar Realty", handle: "omar.realty", profileUrl: "https://www.facebook.com/omar.realty" },
    draftMessage: "Hi Omar, what areas and property types should the assistant qualify first?",
    contextSummary: "Facebook contact requested callback; worker needs a confirmed profile target.",
    resultSummary: "Worker could not confirm the Facebook target profile.",
    blockedReason: "target_profile_unconfirmed",
    completedAt: nowFor(15)
  },
  {
    id: "exttask_demo_meera_sent",
    type: "report_update",
    status: "sent",
    priority: "low",
    leadId: "lead_demo_meera_health",
    conversationId: "leadconv_demo_meera_manual",
    platform: "generic-web-chat",
    targetUrl: "https://chat.example.com/meera",
    contact: { displayName: "Meera Wellness", email: "hello@meerawellness.example" },
    draftMessage: "Thanks, Meera. I logged that AI should use call notes only for now.",
    contextSummary: "Manual privacy preference was recorded.",
    resultSummary: "Worker reported the privacy-safe note back to Leadsy.",
    completedAt: nowFor(16)
  }
];

function cleanPreview(body: string) {
  return body.trim().replace(/\s+/g, " ").slice(0, 180);
}

function latestMessage(messages: DemoLead["conversations"][number]["messages"]) {
  return [...messages].sort((left, right) => left.sentAt.localeCompare(right.sentAt)).at(-1);
}

function leadUpdatedAt(lead: DemoLead) {
  return lead.conversations
    .flatMap((conversation) => conversation.messages.map((message) => message.sentAt))
    .sort()
    .at(-1) ?? lead.conversations[0]?.messages[0]?.sentAt ?? demoOwner.createdAt;
}

async function seedOwner(password: string) {
  const state = await readJson<AuthState>(authFile, { users: [], sessions: [] });
  const existed = state.users.some((user) => user.id === demoOwner.id || user.normalizedLogin === demoOwner.normalizedLogin);
  const passwordHash = await hashDemoPassword(password);
  const existing = state.users.find((user) => user.id === demoOwner.id || user.normalizedLogin === demoOwner.normalizedLogin);
  const user: AuthUser = {
    ...demoOwner,
    passwordHash,
    lastLoginAt: existing?.lastLoginAt
  };
  state.users = [user, ...state.users.filter((candidate) => candidate.id !== demoOwner.id && candidate.normalizedLogin !== demoOwner.normalizedLogin)];
  await writeJson(authFile, state);
  return { user, created: !existed };
}

async function seedKnowledge() {
  const state = await readJson<KnowledgeState>(knowledgeFile, { leads: [], conversations: [], messages: [] });
  state.leads = state.leads.filter((lead) => lead.tenantId !== demoOwner.tenantId || lead.ownerId !== demoOwner.id);
  state.conversations = state.conversations.filter((conversation) => conversation.tenantId !== demoOwner.tenantId || conversation.ownerId !== demoOwner.id);
  state.messages = state.messages.filter((message) => message.tenantId !== demoOwner.tenantId || message.ownerId !== demoOwner.id);

  for (const lead of demoLeads) {
    const updatedAt = leadUpdatedAt(lead);
    state.leads.push({
      id: lead.id,
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      identityKeys: lead.identityKeys,
      contact: lead.contact,
      leadStatus: lead.leadStatus ?? "lead",
      excludedAt: lead.leadStatus === "excluded" ? updatedAt : undefined,
      summary: lead.summary,
      nextAction: lead.nextAction,
      facts: lead.facts,
      createdAt: demoOwner.createdAt,
      updatedAt
    });

    for (const conversation of lead.conversations) {
      const messages = conversation.messages;
      const last = latestMessage(messages);
      state.conversations.push({
        id: conversation.id,
        tenantId: demoOwner.tenantId,
        ownerId: demoOwner.id,
        leadId: lead.id,
        channel: conversation.channel,
        source: conversation.source,
        externalKey: conversation.externalKey,
        sourceUrl: conversation.sourceUrl,
        contact: lead.contact,
        knowledgeStatus: conversation.knowledgeStatus ?? "included",
        excludedAt: conversation.knowledgeStatus === "excluded" ? last?.sentAt : undefined,
        messageCount: messages.length,
        inboundCount: messages.filter((message) => message.direction === "inbound").length,
        outboundCount: messages.filter((message) => message.direction === "outbound").length,
        lastMessageAt: last?.sentAt,
        lastMessagePreview: last ? cleanPreview(last.body) : undefined,
        summary: conversation.summary ?? lead.summary,
        nextAction: conversation.nextAction ?? lead.nextAction,
        createdAt: demoOwner.createdAt,
        updatedAt: last?.sentAt ?? updatedAt
      });

      for (const message of messages) {
        state.messages.push({
          id: message.id,
          tenantId: demoOwner.tenantId,
          ownerId: demoOwner.id,
          leadId: lead.id,
          conversationId: conversation.id,
          source: conversation.source,
          channel: conversation.channel,
          externalId: message.externalId,
          direction: message.direction,
          body: message.body,
          messageType: message.messageType ?? "text",
          sentAt: message.sentAt,
          receivedAt: message.sentAt,
          generatedBy: message.generatedBy,
          raw: { demo: true }
        });
      }
    }
  }

  await writeJson(knowledgeFile, state);
  return {
    leads: demoLeads.length,
    conversations: demoLeads.flatMap((lead) => lead.conversations).length,
    messages: demoLeads.flatMap((lead) => lead.conversations.flatMap((conversation) => conversation.messages)).length
  };
}

async function seedTasks() {
  const state = await readJson<ExtensionState>(extensionFile, {
    tokens: [],
    conversations: [],
    messages: [],
    events: [],
    tasks: [],
    taskEvents: []
  });
  state.tasks = state.tasks.filter((task) => task.tenantId !== demoOwner.tenantId || task.ownerId !== demoOwner.id);
  state.taskEvents = state.taskEvents.filter((event) => event.tenantId !== demoOwner.tenantId || event.ownerId !== demoOwner.id);

  for (const [index, task] of demoTasks.entries()) {
    const now = task.completedAt ?? task.preparedAt ?? task.dueAt ?? nowFor(index + 10);
    state.tasks.push({
      ...task,
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      approvedAt: task.status === "queued" ? undefined : nowFor(index + 10),
      claimedAt: task.status === "awaiting_send_approval" ? nowFor(index + 9) : undefined,
      createdAt: nowFor(index + 9),
      updatedAt: now
    });
    state.taskEvents.push({
      id: `taskevt_${task.id}`,
      tenantId: demoOwner.tenantId,
      ownerId: demoOwner.id,
      taskId: task.id,
      type:
        task.status === "awaiting_send_approval"
          ? "worker_prepared"
          : task.status === "blocked"
            ? "worker_blocked"
            : task.status === "sent"
              ? "worker_sent"
              : "monitoring_event",
      summary:
        task.resultSummary ??
        (task.status === "awaiting_send_approval"
          ? "Worker prepared the draft and is waiting for Leadsy approval."
          : "Task is ready for the browser worker."),
      reason: task.blockedReason,
      occurredAt: now
    });
  }

  await writeJson(extensionFile, state);
  return { tasks: demoTasks.length, taskEvents: demoTasks.length };
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
  const taskCounts = await seedTasks();
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
      ...taskCounts
    }
  };
}
