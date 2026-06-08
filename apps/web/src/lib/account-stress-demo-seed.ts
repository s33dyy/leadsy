import { randomUUID, scrypt as scryptCallback } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

type JsonObject = Record<string, unknown>;

type SeedInput = {
  email: string;
  confirm: string;
  dataDir?: string;
};

type AuthUser = JsonObject & {
  id: string;
  tenantId: string;
  teamMemberId?: string;
  name: string;
  emailOrPhone: string;
  normalizedLogin: string;
  role: string;
};

type Scope = {
  tenantId: string;
  ownerId: string;
};

type SeedCredential = {
  memberId: string;
  userId: string;
  name: string;
  login: string;
  temporaryPassword: string;
};

const touchedStores = [
  "auth.json",
  "lead-knowledge.json",
  "lead-crm.json",
  "teamspace.json",
  "calendar.json",
  "workspace-whatsapp-senders.json",
  "twilio-integration.json",
  "user-settings.json",
  "lead-magnet.json"
];

const scryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function normalizeLogin(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function assertConfirm(input: SeedInput) {
  const email = normalizeLogin(input.email);
  if (normalizeLogin(input.confirm) !== email) {
    throw new Error(`confirmation_required:${email}`);
  }
  return email;
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function isoDateOffset(days: number, hour: number, minute = 0) {
  return new Date(Date.UTC(2026, 5, 8 + days, hour, minute, 0)).toISOString();
}

function stablePhone(index: number) {
  return `+91910000${String(index + 1000).padStart(4, "0")}`;
}

function waId(phone: string) {
  return phone.replace(/\D/g, "");
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

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

async function hashPassword(password: string, saltSeed: string) {
  const salt = `stress-demo-${saltSeed}`;
  const derived = await derivePasswordKey(password, salt, 64);
  return `scrypt$${scryptOptions.N}$${scryptOptions.r}$${scryptOptions.p}$${salt}$${derived.toString("base64url")}`;
}

async function readJson<T>(dataDir: string, file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(join(dataDir, file), "utf8");
    return raw.trim() ? (JSON.parse(raw) as T) : fallback;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return fallback;
    throw error;
  }
}

async function writeJson(dataDir: string, file: string, value: unknown) {
  const path = join(dataDir, file);
  await mkdir(dirname(path), { recursive: true });
  const tempFile = `${path}.${randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`);
  await rename(tempFile, path);
}

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function backupStores(dataDir: string) {
  const label = `account-stress-demo-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const backupDir = join(dataDir, "backups", label);
  await mkdir(backupDir, { recursive: true });
  const manifest: Array<{ file: string; copied: boolean }> = [];
  for (const file of touchedStores) {
    const source = join(dataDir, file);
    const copied = await exists(source);
    if (copied) await copyFile(source, join(backupDir, file));
    manifest.push({ file, copied });
  }
  await writeFile(join(backupDir, "manifest.json"), `${JSON.stringify({ createdAt: new Date().toISOString(), files: manifest }, null, 2)}\n`);
  return backupDir;
}

function scopeMatches(scope: Scope, item: JsonObject) {
  return item.tenantId === scope.tenantId && item.ownerId === scope.ownerId;
}

function withoutScope<T extends JsonObject>(items: T[] | undefined, scope: Scope) {
  return (Array.isArray(items) ? items : []).filter((item) => !scopeMatches(scope, item));
}

function keepNonTargetLeadMagnetItems<T extends JsonObject>(items: T[] | undefined, scope: Scope) {
  return (Array.isArray(items) ? items : []).filter((item) => item.tenantId !== scope.tenantId || item.ownerId !== scope.ownerId);
}

const memberSpecs = [
  {
    id: "stress_tm_qualification_ai",
    type: "ai_agent_full",
    name: "Qualification AI",
    role: "agent",
    stages: ["new", "collecting"],
    autoReply: true,
    senderMode: "workspace",
    instruction: "Qualify new WhatsApp leads with one natural question per turn and stop after handoff."
  },
  {
    id: "stress_tm_pricing_ai",
    type: "ai_agent_assisted",
    name: "Pricing Assistant AI",
    role: "agent",
    stages: ["qualified", "proposal_sent"],
    autoReply: false,
    senderMode: "simulator",
    instruction: "Draft price guidance for approval and never send external pricing without review."
  },
  {
    id: "stress_tm_calendar_ai",
    type: "ai_agent_assisted",
    name: "Calendar AI",
    role: "agent",
    stages: ["meeting_scheduled"],
    autoReply: false,
    senderMode: "simulator",
    instruction: "Use Leadsy calendar records only when proposing times."
  },
  {
    id: "stress_tm_retention_ai",
    type: "ai_agent_full",
    name: "Retention AI",
    role: "agent",
    stages: ["proposal_sent", "won", "lost"],
    autoReply: true,
    senderMode: "simulator",
    instruction: "Follow up politely after proposals and stop on human escalation keywords."
  },
  {
    id: "stress_tm_sales_manager",
    type: "human",
    name: "Riya Mehta",
    role: "manager",
    stages: ["qualified", "proposal_sent", "won"],
    autoReply: false,
    senderMode: "simulator",
    instruction: "Own high-value optical retail and corporate opportunities."
  },
  {
    id: "stress_tm_sdr",
    type: "human",
    name: "Arjun Sen",
    role: "agent",
    stages: ["qualified", "meeting_scheduled"],
    autoReply: false,
    senderMode: "simulator",
    instruction: "Book meetings and keep lead details current."
  },
  {
    id: "stress_tm_field_visit",
    type: "human",
    name: "Neha Kapoor",
    role: "agent",
    stages: ["meeting_scheduled", "proposal_sent"],
    autoReply: false,
    senderMode: "simulator",
    instruction: "Handle store visits, school visits, and lens measurement appointments."
  },
  {
    id: "stress_tm_support",
    type: "human",
    name: "Kabir Rao",
    role: "agent",
    stages: ["human_review", "lost"],
    autoReply: false,
    senderMode: "simulator",
    instruction: "Handle escalations, repair requests, and service-sensitive leads."
  },
  {
    id: "stress_tm_owner_operator",
    type: "human",
    name: "Pratik Choudhuri",
    role: "owner",
    stages: ["won", "human_review"],
    autoReply: false,
    senderMode: "workspace",
    instruction: "Final owner review for strategic accounts and sensitive escalations."
  }
];

const leadSpecs = [
  ["Asha Verma", "LensMart Koramangala", "Needs WhatsApp follow-up for 80 daily store enquiries", "today", "qualified", "interested", "qualified", "stress_tm_sales_manager", "Riya Mehta", "high"],
  ["Rahul Nair", "BrightSight Clinic", "Wants appointment reminders for eye tests", "this week", "collecting", "needs_reply", "new", "stress_tm_qualification_ai", "Qualification AI", "normal"],
  ["Meera Iyer", "Oakridge School", "Exploring annual student eye-check camp", "June", "meeting_scheduled", "interested", "meeting_scheduled", "stress_tm_field_visit", "Neha Kapoor", "high"],
  ["Vikram Shah", "FrameHouse Franchise", "Asked about franchise lead handling", "30 days", "proposal_sent", "interested", "proposal_sent", "stress_tm_pricing_ai", "Pricing Assistant AI", "high"],
  ["Nisha Gupta", "Corporate HR - Zento", "Needs corporate eyewear benefits for 450 employees", "Q3", "qualified", "interested", "qualified", "stress_tm_sales_manager", "Riya Mehta", "high"],
  ["Imran Khan", "Walk-in Repair", "Urgent broken frame replacement", "same day", "human_review", "human_review", "human_review", "stress_tm_support", "Kabir Rao", "urgent"],
  ["Priya Saha", "ClearView Durgapur", "Interested in appointment booking and reminders", "next week", "collecting", "needs_reply", "new", "stress_tm_qualification_ai", "Qualification AI", "normal"],
  ["Ankit Jain", "Metro Optical", "Asked for quote on WhatsApp CRM and campaigns", "2 weeks", "proposal_sent", "interested", "proposal_sent", "stress_tm_pricing_ai", "Pricing Assistant AI", "normal"],
  ["Devika Menon", "Parent Lead", "Needs blue-cut glasses for two children", "Saturday", "meeting_scheduled", "interested", "meeting_scheduled", "stress_tm_sdr", "Arjun Sen", "normal"],
  ["Samar Bose", "VisionCare Siliguri", "Comparing Leadsy with manual WhatsApp follow-up", "this month", "collecting", "needs_reply", "new", "stress_tm_qualification_ai", "Qualification AI", "normal"],
  ["Tara Singh", "EyeStyle Jaipur", "Asked for multi-branch lead assignment", "July", "qualified", "interested", "qualified", "stress_tm_sales_manager", "Riya Mehta", "high"],
  ["Aditya Rao", "Startup Founder", "Needs employee eyewear reimbursement workflow", "Q3", "new", "new_lead", "new", "stress_tm_qualification_ai", "Qualification AI", "normal"],
  ["Kavya Pillai", "Premium Buyer", "Looking for progressive lenses and home visit", "tomorrow", "meeting_scheduled", "interested", "meeting_scheduled", "stress_tm_field_visit", "Neha Kapoor", "high"],
  ["Rohit Agarwal", "OpticPlus Indore", "Lost on budget after initial quote", "later", "qualified", "interested", "lost", "stress_tm_retention_ai", "Retention AI", "low"],
  ["Mala Dutta", "School Admin", "Needs camp proposal for 1,200 students", "August", "proposal_sent", "interested", "proposal_sent", "stress_tm_pricing_ai", "Pricing Assistant AI", "high"],
  ["Yusuf Ali", "Angry Customer", "Escalated about delayed lens delivery", "now", "human_review", "human_review", "human_review", "stress_tm_support", "Kabir Rao", "urgent"],
  ["Sneha Roy", "Won Lead - Boutique", "Confirmed pilot for WhatsApp qualification", "June", "qualified", "interested", "won", "stress_tm_sales_manager", "Riya Mehta", "normal"],
  ["Harsh Patel", "Manual Referral", "Referral from supplier for new store launch", "45 days", "new", "new_lead", "new", "stress_tm_qualification_ai", "Qualification AI", "normal"],
  ["Pooja Kulkarni", "Clinic Chain", "Needs routing between three clinic locations", "2 months", "collecting", "needs_reply", "new", "stress_tm_qualification_ai", "Qualification AI", "normal"],
  ["Gaurav Malhotra", "Luxury Frames", "Asked about premium lens package follow-up", "next week", "qualified", "interested", "qualified", "stress_tm_sales_manager", "Riya Mehta", "high"],
  ["Maya Fernandes", "Tourist Buyer", "Needs urgent contact lens availability", "today", "human_review", "human_review", "human_review", "stress_tm_support", "Kabir Rao", "urgent"],
  ["Siddharth Das", "Regional Distributor", "Asks if Leadsy can route dealer leads", "Q4", "collecting", "needs_reply", "new", "stress_tm_qualification_ai", "Qualification AI", "normal"],
  ["Rina Thomas", "Online Lead", "Interested in eye test booking via WhatsApp", "this week", "meeting_scheduled", "interested", "meeting_scheduled", "stress_tm_sdr", "Arjun Sen", "normal"],
  ["Manav Chopra", "B2B Admin", "Needs approval workflow before sending offers", "July", "qualified", "interested", "qualified", "stress_tm_pricing_ai", "Pricing Assistant AI", "normal"],
  ["Elina Paul", "Cold Enquiry", "Only asked for catalogue", "unknown", "new", "new_lead", "new", "stress_tm_qualification_ai", "Qualification AI", "low"]
] as const;

function memberLogin(member: typeof memberSpecs[number]) {
  return `stress+${slug(member.name)}@leadsy.local`;
}

function roleForAuth(role: string) {
  if (role === "owner" || role === "admin") return "admin";
  if (role === "manager") return "manager";
  return "sdr";
}

async function buildMembers(scope: Scope, owner: AuthUser) {
  const credentials: SeedCredential[] = [];
  const authUsers: AuthUser[] = [];
  const members = [];
  for (const [index, spec] of memberSpecs.entries()) {
    const isOwnerOperator = spec.id === "stress_tm_owner_operator";
    const login = isOwnerOperator ? owner.emailOrPhone : memberLogin(spec);
    const temporaryPassword = `LeadsyDemo!${index + 10}2026`;
    const authUserId = isOwnerOperator ? owner.id : `stress_usr_${slug(spec.name)}`;
    if (!isOwnerOperator) {
      const user: AuthUser = {
        id: authUserId,
        tenantId: scope.tenantId,
        teamMemberId: spec.id,
        name: spec.name,
        emailOrPhone: login,
        normalizedLogin: normalizeLogin(login),
        passwordHash: await hashPassword(temporaryPassword, authUserId),
        role: roleForAuth(spec.role),
        createdAt: addMinutes(new Date(Date.UTC(2026, 5, 8, 3, 0, 0)), index)
      };
      authUsers.push(user);
      credentials.push({
        memberId: spec.id,
        userId: authUserId,
        name: spec.name,
        login,
        temporaryPassword
      });
    }
    members.push({
      id: spec.id,
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      type: spec.type,
      name: spec.name,
      emailOrPhone: login,
      authUserId,
      role: spec.role,
      status: "active",
      pipelineStages: spec.stages,
      behaviorInstructions: spec.instruction,
      autoReplyEnabled: spec.autoReply,
      escalationKeywords: ["human", "manager", "refund", "legal", "stop", "angry"],
      senderMode: spec.senderMode,
      simulatorSenderHandle: spec.senderMode === "simulator" ? `${spec.name} Simulator` : undefined,
      simulatorPhoneNumber: spec.senderMode === "simulator" ? `+155501${String(index + 1100).slice(-4)}` : undefined,
      workspaceSenderLabel: spec.senderMode === "workspace" ? "Account owner WhatsApp" : undefined,
      workload: { openLeads: 0, openTasks: 0 },
      createdAt: addMinutes(new Date(Date.UTC(2026, 5, 8, 3, 0, 0)), index),
      updatedAt: addMinutes(new Date(Date.UTC(2026, 5, 8, 3, 30, 0)), index)
    });
  }
  return { members, authUsers, credentials };
}

function leadSourceFor(index: number) {
  const sources = ["Twilio Simulator", "Manual referral", "Website form", "Store QR", "Campaign landing page"];
  return sources[index % sources.length];
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function buildMessages(scope: Scope, leadId: string, conversationId: string, spec: typeof leadSpecs[number], index: number) {
  const [name, company, need, timeline] = spec;
  const base = new Date(Date.UTC(2026, 5, 8, 4, index * 7, 0));
  const messageBodies = [
    {
      direction: "inbound",
      body: `Hi, this is ${name} from ${company}. ${need}. Can Leadsy help us on WhatsApp?`,
      deliveryStatus: "received"
    },
    {
      direction: "outbound",
      body: `Hi ${name.split(" ")[0]}, yes. I can help qualify this properly. Is the main goal ${need.toLowerCase()}, and who should approve the next step?`,
      deliveryStatus: "simulated_delivered"
    },
    {
      direction: "inbound",
      body: `The timeline is ${timeline}. Budget is ${index % 3 === 0 ? "above Rs 2L" : index % 3 === 1 ? "Rs 50k to Rs 2L" : "under Rs 50k"} and I am ${index % 4 === 0 ? "the final approver" : "collecting details for my team"}.`,
      deliveryStatus: "received"
    }
  ];
  if (index < 10) {
    messageBodies.push({
      direction: "outbound",
      body: index % 2 === 0
        ? `Got it. I have enough context to route this to the right owner. Would a 30 minute discussion this week work?`
        : `Thanks. I will note the budget and timeline. Which city or branch should the team prioritize first?`,
      deliveryStatus: "simulated_delivered"
    });
  }
  return messageBodies.map((message, messageIndex) => ({
    id: `stress_msg_${index + 1}_${messageIndex + 1}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    leadId,
    conversationId,
    source: "twilio_simulator",
    channel: "whatsapp",
    externalId: `${message.direction === "inbound" ? "SIMIN" : "SIMOUT"}STRESS${String(index + 1).padStart(2, "0")}${messageIndex + 1}`,
    providerMessageSid: `${message.direction === "inbound" ? "SIMIN" : "SIMOUT"}STRESS${String(index + 1).padStart(2, "0")}${messageIndex + 1}`,
    direction: message.direction,
    body: message.body,
    messageType: "text",
    sentAt: addMinutes(base, messageIndex * 4),
    receivedAt: addMinutes(base, messageIndex * 4),
    generatedBy: message.direction === "outbound" ? "ai_agent" : undefined,
    deliveryStatus: message.deliveryStatus,
    statusUpdatedAt: addMinutes(base, messageIndex * 4),
    raw: {
      source: "twilio_simulator",
      simulatorHandle: "Leadsy Simulator",
      externalDelivery: false,
      stressDemo: true
    }
  }));
}

function buildLeadKnowledge(scope: Scope) {
  const leads = [];
  const conversations = [];
  const messages = [];
  for (const [index, spec] of leadSpecs.entries()) {
    const [name, company, need, timeline, qualificationStage, crmStatus, productPipelineStatus, assigneeId, assigneeName, priority] = spec;
    const leadId = `stress_lead_${String(index + 1).padStart(2, "0")}`;
    const conversationId = `stress_conv_${String(index + 1).padStart(2, "0")}`;
    const phone = stablePhone(index);
    const leadMessages = buildMessages(scope, leadId, conversationId, spec, index);
    messages.push(...leadMessages);
    const last = leadMessages.at(-1)!;
    const inboundCount = leadMessages.filter((message) => message.direction === "inbound").length;
    const outboundCount = leadMessages.filter((message) => message.direction === "outbound").length;
    const contact = { displayName: name, phone, waId: waId(phone) };
    leads.push({
      id: leadId,
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      identityKeys: [`phone:${waId(phone)}`],
      contact,
      leadStatus: "lead",
      crmStatus,
      productPipelineStatus,
      leadSource: leadSourceFor(index),
      campaignId: index % 5 === 0 ? "stress-corporate-campaign" : undefined,
      assigneeId,
      assigneeName,
      qualificationFields: {
        name,
        phone,
        company,
        need,
        timeline,
        budget: index % 3 === 0 ? "Above Rs 2L" : index % 3 === 1 ? "Rs 50k to Rs 2L" : "Under Rs 50k",
        authority: index % 4 === 0 ? "Decision maker" : "Influencer",
        location: ["Bengaluru", "Kolkata", "Mumbai", "Delhi", "Pune"][index % 5],
        intent: priority === "urgent" || priority === "high" ? "High intent" : "Exploring"
      },
      qualificationStage,
      summary: `${name} from ${company} is discussing ${need.toLowerCase()} with timeline ${timeline}.`,
      nextAction: productPipelineStatus === "won"
        ? "Prepare onboarding handoff and first success check-in."
        : productPipelineStatus === "lost"
          ? "Let Retention AI draft a low-pressure revisit task."
          : qualificationStage === "human_review"
            ? "Human owner should review before any further outbound message."
            : "Continue qualification or route to the assigned owner.",
      facts: [
        `Company: ${company}`,
        `Need: ${need}`,
        `Timeline: ${timeline}`,
        `Priority: ${priority}`,
        `Assigned to: ${assigneeName}`
      ],
      createdAt: leadMessages[0].sentAt,
      updatedAt: last.sentAt
    });
    conversations.push({
      id: conversationId,
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      leadId,
      channel: "whatsapp",
      source: "twilio_simulator",
      externalKey: `phone:${waId(phone)}`,
      contact,
      knowledgeStatus: "included",
      messageCount: leadMessages.length,
      inboundCount,
      outboundCount,
      lastMessageAt: last.sentAt,
      lastMessagePreview: String(last.body).slice(0, 160),
      summary: `${company}: ${need}.`,
      nextAction: leads.at(-1)?.nextAction,
      sentiment: priority === "urgent" ? "concerned" : productPipelineStatus === "lost" ? "negative" : "positive",
      createdAt: leadMessages[0].sentAt,
      updatedAt: last.sentAt
    });
  }
  return { leads, conversations, messages };
}

function buildCrm(scope: Scope) {
  const assignmentRules = [
    ["stress_rule_corporate", "Corporate and school leads", "corporate", "stress_tm_sales_manager", "Riya Mehta"],
    ["stress_rule_meeting", "Meeting-stage field visits", "Store QR", "stress_tm_field_visit", "Neha Kapoor"],
    ["stress_rule_review", "Human review escalations", "Twilio Simulator", "stress_tm_support", "Kabir Rao"]
  ].map(([id, title, sourceIncludes, assigneeId, assigneeName], index) => ({
    id,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    title,
    sourceIncludes,
    assigneeId,
    assigneeName,
    createdAt: isoDateOffset(0, 3, index),
    updatedAt: isoDateOffset(0, 3, index)
  }));

  const assignmentHistory = leadSpecs.map((spec, index) => ({
    id: `stress_assignment_${String(index + 1).padStart(2, "0")}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    leadId: `stress_lead_${String(index + 1).padStart(2, "0")}`,
    method: index % 3 === 0 ? "source_based" : index % 3 === 1 ? "round_robin" : "manual",
    fromAssigneeId: "stress_tm_qualification_ai",
    fromAssigneeName: "Qualification AI",
    toAssigneeId: spec[7],
    toAssigneeName: spec[8],
    assignedById: scope.ownerId,
    assignedByName: "Pratik Choudhuri",
    reason: `Stress demo routing for ${statusLabel(spec[6])} lead.`,
    createdAt: isoDateOffset(0, 5, index)
  }));

  const taskTypes = ["whatsapp_follow_up", "meeting", "review_lead", "site_visit", "call"] as const;
  const followUpTasks = leadSpecs.map((spec, index) => {
    const isAi = spec[7].includes("_ai");
    return {
      id: `stress_task_${String(index + 1).padStart(2, "0")}`,
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      leadId: `stress_lead_${String(index + 1).padStart(2, "0")}`,
      type: taskTypes[index % taskTypes.length],
      topic: isAi ? `Review AI action for ${spec[1]}` : `Follow up with ${spec[0]}`,
      description: `${spec[2]}. Current timeline: ${spec[3]}.`,
      priority: spec[9] === "urgent" ? "urgent" : spec[9] === "high" ? "high" : "normal",
      status: index % 9 === 0 ? "in_progress" : "open",
      assigneeId: spec[7],
      assigneeName: spec[8],
      dueAt: isoDateOffset(index % 6, 10 + (index % 6), 30),
      destination: isAi ? "ai_approvals" : "human_tasks",
      eventType: isAi ? "human_review_needed" : index % 4 === 0 ? "meeting_created" : "follow_up_due",
      dedupeKey: `stress:${index + 1}:${spec[7]}`,
      source: "stress_demo_seed",
      createdByRole: "agent",
      createdByName: "Leadsy event router",
      notes: [
        {
          id: `stress_task_note_${index + 1}`,
          authorName: "Leadsy",
          note: "Seeded task for realistic queue and workload testing.",
          createdAt: isoDateOffset(0, 6, index)
        }
      ],
      createdAt: isoDateOffset(0, 6, index),
      updatedAt: isoDateOffset(0, 6, index)
    };
  });

  const qualificationProfiles = [{
    id: "stress_qualification_profile",
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    businessGoal: "Qualify optical retail, corporate eyewear, school camp, and service leads before routing.",
    introBehavior: "educate_then_qualify",
    requiredFields: ["company", "need", "budget", "timeline", "authority", "location"],
    questionOrder: ["need", "timeline", "budget", "authority", "location"],
    updatedAt: isoDateOffset(0, 3)
  }];

  return { assignmentRules, assignmentHistory, followUpTasks, qualificationProfiles };
}

function buildTeamThreads(scope: Scope) {
  const workspaceMessages = [
    ["stress_thread_001", "workspace", undefined, undefined, "system", "Stress demo workspace seeded with realistic WhatsApp leads, tasks, meetings, and simulator conversations.", "internal_note"],
    ["stress_thread_002", "workspace", "stress_lead_01", "stress_conv_01", "system", "Lead Asha Verma assigned from Qualification AI to Riya Mehta. Method: source-based. Reason: high-intent retail CRM lead.", "assignment_changed"],
    ["stress_thread_003", "workspace", "stress_lead_03", "stress_conv_03", "system", "Lead Meera Iyer assigned to Neha Kapoor for school eye-check camp site visit planning.", "assignment_changed"],
    ["stress_thread_004", "workspace", "stress_lead_04", "stress_conv_04", "human", " @Pricing Assistant AI please prepare a pricing review for FrameHouse before we send the proposal.", "ai_mention"],
    ["stress_thread_005", "workspace", "stress_lead_09", "stress_conv_09", "human", " @Calendar AI find a realistic discovery slot for Devika after school hours.", "ai_mention"],
    ["stress_thread_006", "workspace", "stress_lead_16", "stress_conv_16", "system", "Escalation: Yusuf Ali moved to human review. No AI outbound should be sent until Kabir reviews it.", "assignment_changed"],
    ["stress_thread_007", "workspace", "stress_lead_17", "stress_conv_17", "system", "Won lead handoff: Sneha Roy pilot confirmed. Prepare customer success task.", "task_generated"]
  ];
  const leadNotes = leadSpecs.slice(0, 12).map((spec, index) => ({
    id: `stress_thread_lead_${String(index + 1).padStart(2, "0")}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    threadScope: "lead",
    leadId: `stress_lead_${String(index + 1).padStart(2, "0")}`,
    conversationId: `stress_conv_${String(index + 1).padStart(2, "0")}`,
    authorMemberId: spec[7],
    authorType: spec[7].includes("_ai") ? "ai_agent" : "human",
    body: `${spec[8]} note: ${spec[2]}. Missing follow-up check is ${spec[3]}.`,
    eventType: index % 2 === 0 ? "handoff_summary" : "internal_note",
    triggerId: `stress-lead-note-${index + 1}`,
    visibility: "internal",
    createdAt: isoDateOffset(0, 7, index)
  }));
  return [
    ...workspaceMessages.map(([id, threadScope, leadId, conversationId, authorType, body, eventType], index) => ({
      id,
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      threadScope,
      leadId,
      conversationId,
      authorMemberId: authorType === "human" ? "stress_tm_sales_manager" : undefined,
      authorType,
      body: String(body).trim(),
      eventType,
      triggerId: `stress-workspace-${index + 1}`,
      visibility: "internal",
      createdAt: isoDateOffset(0, 7, index)
    })),
    ...leadNotes
  ];
}

function buildCalendar(scope: Scope) {
  const events = [];
  for (const [index, spec] of leadSpecs.slice(0, 12).entries()) {
    events.push({
      id: `stress_calev_meeting_${String(index + 1).padStart(2, "0")}`,
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      memberId: spec[7],
      leadId: `stress_lead_${String(index + 1).padStart(2, "0")}`,
      conversationId: `stress_conv_${String(index + 1).padStart(2, "0")}`,
      title: `${spec[1]} discovery call`,
      startAt: isoDateOffset(index % 8, 9 + (index % 6), index % 2 ? 30 : 0),
      endAt: isoDateOffset(index % 8, 10 + (index % 6), index % 2 ? 0 : 30),
      eventType: "meeting",
      status: index % 5 === 0 ? "proposed" : index % 7 === 0 ? "cancelled" : "confirmed",
      attendees: [spec[0], spec[8]],
      notes: `${spec[2]}. Use CRM context before offering next steps.`,
      location: index % 3 === 0 ? "Leadsy video room" : "WhatsApp follow-up",
      createdAt: isoDateOffset(0, 8, index),
      updatedAt: isoDateOffset(0, 8, index)
    });
  }
  for (const [index, member] of memberSpecs.slice(4).entries()) {
    events.push({
      id: `stress_calev_availability_${String(index + 1).padStart(2, "0")}`,
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      memberId: member.id,
      title: `${member.name} availability`,
      startAt: isoDateOffset(index, 11, 0),
      endAt: isoDateOffset(index, 15, 0),
      eventType: "availability",
      status: "available",
      attendees: [member.name],
      notes: "Seeded availability for free-slot and calendar-grid testing.",
      location: "Leadsy calendar",
      createdAt: isoDateOffset(0, 8, index),
      updatedAt: isoDateOffset(0, 8, index)
    });
  }
  events.push({
    id: "stress_calev_busy_owner",
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    memberId: "stress_tm_owner_operator",
    title: "Owner blocked for vendor call",
    startAt: isoDateOffset(1, 16, 0),
    endAt: isoDateOffset(1, 17, 0),
    eventType: "busy",
    status: "held",
    attendees: ["Pratik Choudhuri"],
    notes: "Busy block used to verify free-slot exclusions.",
    location: "Phone",
    createdAt: isoDateOffset(0, 8, 30),
    updatedAt: isoDateOffset(0, 8, 30)
  });
  return events;
}

function buildSettings(scope: Scope) {
  const notificationRecords = [
    ["newInboundLead", "New inbound lead", "Asha Verma asked about WhatsApp follow-up for LensMart.", "/app/communications?conversation=stress_conv_01", "high"],
    ["assignedToMe", "Lead assigned", "Corporate lead Zento assigned to Riya Mehta.", "/app/leads?contact=stress_lead_05", "medium"],
    ["aiEscalation", "AI escalation", "Yusuf Ali moved to human review after escalation language.", "/app/leads?contact=stress_lead_16", "high"],
    ["calendarMeeting", "Meeting confirmed", "Meera Iyer school camp call is on the calendar.", "/app/calendar", "medium"],
    ["taskDue", "Task due", "Follow up with Devika Menon after school hours.", "/app/tasks", "medium"],
    ["deliveryFailed", "Delivery check", "One simulated delivery failure is ready for review.", "/app/approvals", "high"],
    ["aiBudgetThreshold", "AI budget watch", "Stress demo includes AI task volume for cost receipt review.", "/app/settings?section=ai", "low"]
  ].map(([type, title, detail, href, priority], index) => ({
    id: `stress_notif_${String(index + 1).padStart(2, "0")}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    type,
    title,
    detail,
    href,
    priority,
    createdAt: isoDateOffset(0, 9, index)
  }));
  return {
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    profile: {
      roleTitle: "Founder and sales operator",
      seniority: "Decision maker",
      languages: ["English", "Hindi", "Bengali"],
      timezone: "Asia/Kolkata",
      workingHours: "10:00-19:00",
      communicationStyle: "Warm, practical, consultative, and concise",
      expertise: ["Optical retail", "WhatsApp qualification", "Appointment scheduling", "B2B eyewear sales"],
      markets: ["India", "Bengaluru", "Kolkata", "Mumbai", "Delhi NCR"],
      servicesHandled: ["Eye test booking", "Corporate eyewear", "School camps", "Progressive lenses", "Frame repair"],
      escalationPreferences: "Escalate angry customers, refunds, medical certainty, and discounts above 10 percent.",
      restrictedClaims: ["Do not promise medical outcomes", "Do not guarantee delivery dates without inventory confirmation"],
      knowledgeBase: "Helio Optics sells prescription glasses, progressive lenses, blue-cut eyewear, contact lenses, repair services, and corporate/school eyewear programs. Qualification should collect need, timeline, location, budget, authority, and meeting preference."
    },
    workspace: {
      businessName: "Helio Optics",
      industry: "Optical retail and eyewear services",
      website: "https://helio-optics.example",
      markets: ["India", "Bengaluru", "Kolkata", "Mumbai", "Delhi NCR", "Pune"],
      services: ["Prescription eyewear", "Progressive lenses", "Contact lenses", "Eye test booking", "Corporate eyewear", "School eye-check camps", "Frame repair"],
      leadSources: ["Twilio Simulator", "Manual referral", "Website form", "Store QR", "Campaign landing page"],
      pipelineStages: ["new", "collecting", "qualified", "meeting_scheduled", "proposal_sent", "won", "lost", "human_review"],
      qualificationFields: ["company", "need", "budget", "timeline", "authority", "location", "intent"],
      assignmentDefaults: "Qualification AI handles all new WhatsApp leads, then routes high-value retail/corporate leads to sales, meeting leads to SDR/field visit, and escalations to support.",
      followUpRules: ["Reply to hot WhatsApp leads within 5 minutes", "Create a human task after every qualified lead", "Escalate angry or refund messages immediately", "Use calendar availability before proposing times"],
      timezone: "Asia/Kolkata",
      currency: "INR",
      calendarDefaults: "Offer 30 minute meetings between 11:00 and 17:00 India time."
    },
    ai: {
      providerMode: "deterministic",
      remoteAiEnabled: false,
      costMode: "free",
      monthlyBudgetInr: 0,
      temperature: 0.25,
      maxTokens: 700,
      responseStyle: "Human, direct, context-aware, and one question per turn",
      humanReviewThreshold: 0.78,
      escalationKeywords: ["human", "manager", "refund", "legal", "stop", "angry", "complaint"],
      blockedTopics: ["medical certainty", "legal promises", "guaranteed discounts"],
      taskRouting: {
        "qualification-reply": { enabled: true, model: "openrouter/free" },
        "message-draft": { enabled: true, model: "openrouter/free" },
        "calendar-reply": { enabled: true, model: "openrouter/free" },
        "lead-research-planner": { enabled: true, model: "openrouter/free" },
        "lead-dossier": { enabled: true, model: "openrouter/free" },
        "onboarding-options": { enabled: true, model: "openrouter/free" }
      },
      promptTemplates: {
        "qualification-reply": "Use lead facts and recent WhatsApp history. Ask exactly one next qualification question.",
        "message-draft": "Draft a practical WhatsApp reply that sounds like a sales teammate.",
        "calendar-reply": "Mention only Leadsy calendar slots.",
        "lead-research-planner": "Plan low-cost research from known CRM facts.",
        "lead-dossier": "Summarize facts, risk, missing fields, and next action.",
        "onboarding-options": "Generate answer options, not questions."
      }
    },
    notifications: {
      channels: { inApp: true, toast: true, badge: true, email: false },
      quietHours: { enabled: true, start: "21:00", end: "09:00", timezone: "Asia/Kolkata" },
      digestFrequency: "daily",
      priorityThreshold: "all",
      roleRouting: "all",
      notifyOnlyMyLeads: false,
      events: {
        newInboundLead: true,
        needsReply: true,
        assignedToMe: true,
        aiEscalation: true,
        humanReviewNeeded: true,
        taskDue: true,
        taskOverdue: true,
        calendarMeeting: true,
        deliveryFailed: true,
        aiBudgetThreshold: true,
        systemHealthWarning: true
      }
    },
    notificationRecords
  };
}

function openRouterCost(input: {
  generationId: string;
  stage: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  createdAt: string;
}) {
  const fxRate = 83;
  return {
    provider: "openrouter",
    stage: input.stage,
    model: input.model,
    generationId: input.generationId,
    finishReason: "stop",
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.promptTokens + input.completionTokens,
    costUsd: input.costUsd,
    costInr: Math.round(input.costUsd * fxRate * 1_000_000) / 1_000_000,
    fx: {
      base: "USD",
      quote: "INR",
      rate: fxRate,
      source: "default",
      fetchedAt: input.createdAt
    },
    createdAt: input.createdAt
  };
}

function buildLeadMagnetStress(scope: Scope) {
  const agentRuns = [
    {
      id: "stress_airun_qualification_batch",
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      agent: "qualification-ai",
      provider: "openrouter",
      inputSummary: "Reviewed 25 simulator WhatsApp threads, current qualification facts, and missing fields.",
      outputSummary: "Generated qualification next questions, lead summaries, and routing notes for active leads.",
      displayTitle: "Qualification AI simulator review",
      displaySummary: "AI qualification pass across the seeded WhatsApp simulator inbox.",
      status: "completed",
      cost: openRouterCost({
        generationId: "stress_gen_qualification_batch",
        stage: "qualification-reply",
        model: "leadsy-lowest-cost-router",
        promptTokens: 9200,
        completionTokens: 2400,
        costUsd: 0.184,
        createdAt: isoDateOffset(0, 10, 5)
      }),
      createdAt: isoDateOffset(0, 10, 5)
    },
    {
      id: "stress_airun_reply_drafts",
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      agent: "message-drafter",
      provider: "openrouter",
      inputSummary: "Used lead details, WhatsApp history, owner profile, and workspace context to draft replies.",
      outputSummary: "Prepared contextual outbound reply drafts for high-intent and needs-reply leads.",
      displayTitle: "Contextual WhatsApp reply drafts",
      displaySummary: "Human-like reply drafting for simulator conversations.",
      status: "completed",
      cost: openRouterCost({
        generationId: "stress_gen_reply_drafts",
        stage: "message-draft",
        model: "leadsy-lowest-cost-router",
        promptTokens: 7200,
        completionTokens: 1800,
        costUsd: 0.136,
        createdAt: isoDateOffset(0, 10, 14)
      }),
      createdAt: isoDateOffset(0, 10, 14)
    },
    {
      id: "stress_airun_calendar_slots",
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      agent: "calendar-ai",
      provider: "openrouter",
      inputSummary: "Checked seeded calendar availability and busy blocks before drafting meeting proposals.",
      outputSummary: "Created calendar-backed slot suggestions for school, corporate, and field-visit leads.",
      displayTitle: "Calendar AI slot proposals",
      displaySummary: "Meeting suggestions grounded in Leadsy calendar records.",
      status: "completed",
      cost: openRouterCost({
        generationId: "stress_gen_calendar_slots",
        stage: "calendar-reply",
        model: "leadsy-lowest-cost-router",
        promptTokens: 4300,
        completionTokens: 1100,
        costUsd: 0.081,
        createdAt: isoDateOffset(0, 10, 22)
      }),
      createdAt: isoDateOffset(0, 10, 22)
    },
    {
      id: "stress_airun_pricing_reviews",
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      agent: "pricing-assistant-ai",
      provider: "openrouter",
      inputSummary: "Reviewed proposal-stage leads, budget ranges, services, and approval constraints.",
      outputSummary: "Prepared pricing review tasks for assisted AI approval queue.",
      displayTitle: "Pricing Assistant AI approval prep",
      displaySummary: "Quote review and approval-prep work for proposal-stage leads.",
      status: "completed",
      cost: openRouterCost({
        generationId: "stress_gen_pricing_reviews",
        stage: "approval-draft",
        model: "leadsy-balanced-router",
        promptTokens: 5100,
        completionTokens: 1500,
        costUsd: 0.109,
        createdAt: isoDateOffset(0, 10, 31)
      }),
      createdAt: isoDateOffset(0, 10, 31)
    }
  ];

  const runs = [
    {
      id: "stress_research_run_optical_market",
      tenantId: scope.tenantId,
      ownerId: scope.ownerId,
      status: "completed",
      sourcesRequested: ["crm-context", "conversation-history"],
      sourcesUsed: ["crm-context", "conversation-history"],
      found: 25,
      qualified: 14,
      needsReview: 3,
      blocked: 0,
      events: [
        { id: "stress_receipt_event_1", type: "cost-recorded", message: "AI utilization recorded for stress demo receipt.", createdAt: isoDateOffset(0, 10, 40) }
      ],
      cost: openRouterCost({
        generationId: "stress_gen_research_summary",
        stage: "lead-dossier",
        model: "leadsy-lowest-cost-router",
        promptTokens: 3600,
        completionTokens: 900,
        costUsd: 0.064,
        createdAt: isoDateOffset(0, 10, 40)
      }),
      scenarioLabel: "Optical CRM stress-demo summary",
      ownerSummary: "Summarized seeded optical CRM leads, routing status, and queue health for the receipt modal.",
      recommendation: "Use simulator traffic for UX validation and count only AI utilization as incurred spend.",
      connectionMessages: [],
      startedAt: isoDateOffset(0, 10, 36),
      completedAt: isoDateOffset(0, 10, 40)
    }
  ];

  return {
    briefs: [],
    briefHistory: [],
    leads: [],
    runs,
    drafts: [],
    agentRuns,
    searchSessions: [],
    ownerSearchMemory: []
  };
}

function buildSender(scope: Scope) {
  return {
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    businessName: "Helio Optics",
    transportMode: "simulator",
    simulatorHandle: "Leadsy Simulator",
    status: "approved",
    statusReason: "Simulation mode: no external WhatsApp delivery.",
    createdAt: isoDateOffset(0, 3),
    updatedAt: isoDateOffset(0, 3)
  };
}

function clearTargetTwilioStatus(value: JsonObject, scope: Scope) {
  return Object.fromEntries(
    Object.entries(value).filter(([key, entry]) => {
      if (key.includes(scope.tenantId) || key.includes(scope.ownerId)) return false;
      if (entry && typeof entry === "object") {
        const item = entry as JsonObject;
        if (item.tenantId === scope.tenantId || item.ownerId === scope.ownerId) return false;
      }
      return true;
    })
  );
}

function countSeed(crm: ReturnType<typeof buildCrm>, teamThreads: JsonObject[], settings: ReturnType<typeof buildSettings>, calendarEvents: JsonObject[], knowledge: ReturnType<typeof buildLeadKnowledge>, members: JsonObject[]) {
  const humanTasks = crm.followUpTasks.filter((task) => task.destination === "human_tasks").length;
  const aiApprovalTasks = crm.followUpTasks.filter((task) => task.destination === "ai_approvals").length;
  return {
    leads: knowledge.leads.length,
    conversations: knowledge.conversations.length,
    messages: knowledge.messages.length,
    teamMembers: members.length,
    calendarEvents: calendarEvents.length,
    humanTasks,
    aiApprovalTasks,
    assignmentHistory: crm.assignmentHistory.length,
    workspaceThreadMessages: teamThreads.filter((message) => message.threadScope === "workspace").length,
    leadThreadMessages: teamThreads.filter((message) => message.threadScope === "lead").length,
    notifications: settings.notificationRecords.length,
    workspaceSenders: 1
  };
}

export async function seedAccountStressDemo(input: SeedInput) {
  const email = assertConfirm(input);
  const dataDir = input.dataDir ?? leadsyDataDir;
  const auth = await readJson<{ users: AuthUser[]; sessions: JsonObject[] }>(dataDir, "auth.json", { users: [], sessions: [] });
  const owner = auth.users.find((user) => normalizeLogin(user.emailOrPhone) === email || user.normalizedLogin === email);
  if (!owner) throw new Error("target_account_not_found");

  const backupDir = await backupStores(dataDir);
  const scope = { tenantId: owner.tenantId, ownerId: owner.id };
  const { members, authUsers, credentials } = await buildMembers(scope, owner);
  const knowledge = buildLeadKnowledge(scope);
  const crm = buildCrm(scope);
  const teamThreads = buildTeamThreads(scope);
  const calendarEvents = buildCalendar(scope);
  const settings = buildSettings(scope);
  const sender = buildSender(scope);
  const leadMagnetStress = buildLeadMagnetStress(scope);

  const deletedTeamUserIds = new Set(
    auth.users
      .filter((user) => user.tenantId === scope.tenantId && Boolean(user.teamMemberId) && user.id !== owner.id)
      .map((user) => user.id)
  );
  const preservedUsers = auth.users.filter((user) => user.id === owner.id || user.tenantId !== scope.tenantId || !user.teamMemberId);
  const updatedOwner: AuthUser = {
    ...owner,
    name: owner.name || "Pratik Choudhuri",
    onboardingCompletedAt: isoDateOffset(0, 2),
    onboardingProfile: {
      ...(owner.onboardingProfile && typeof owner.onboardingProfile === "object" ? owner.onboardingProfile : {}),
      businessName: "Helio Optics",
      industry: "Optical retail and eyewear services",
      whatsappTransport: "leadsy_managed_twilio",
      leadSources: ["Twilio Simulator", "Store QR", "Website form", "Manual referral"],
      assignmentPreference: ["Qualification AI first", "Route qualified leads by pipeline owner"],
      followUpPreference: ["Calendar-backed meetings", "Human task queue", "AI approval queue"]
    }
  };
  await writeJson(dataDir, "auth.json", {
    users: [
      ...preservedUsers.map((user) => (user.id === owner.id ? updatedOwner : user)),
      ...authUsers
    ],
    sessions: auth.sessions.filter((session) => !deletedTeamUserIds.has(String(session.userId)))
  });

  const leadKnowledge = await readJson<{ leads: JsonObject[]; conversations: JsonObject[]; messages: JsonObject[] }>(dataDir, "lead-knowledge.json", { leads: [], conversations: [], messages: [] });
  await writeJson(dataDir, "lead-knowledge.json", {
    leads: [...withoutScope(leadKnowledge.leads, scope), ...knowledge.leads],
    conversations: [...withoutScope(leadKnowledge.conversations, scope), ...knowledge.conversations],
    messages: [...withoutScope(leadKnowledge.messages, scope), ...knowledge.messages]
  });

  const existingCrm = await readJson<{ assignmentRules: JsonObject[]; assignmentHistory: JsonObject[]; followUpTasks: JsonObject[]; qualificationProfiles: JsonObject[] }>(dataDir, "lead-crm.json", {
    assignmentRules: [],
    assignmentHistory: [],
    followUpTasks: [],
    qualificationProfiles: []
  });
  await writeJson(dataDir, "lead-crm.json", {
    assignmentRules: [...withoutScope(existingCrm.assignmentRules, scope), ...crm.assignmentRules],
    assignmentHistory: [...withoutScope(existingCrm.assignmentHistory, scope), ...crm.assignmentHistory],
    followUpTasks: [...withoutScope(existingCrm.followUpTasks, scope), ...crm.followUpTasks],
    qualificationProfiles: [...withoutScope(existingCrm.qualificationProfiles, scope), ...crm.qualificationProfiles]
  });

  const teamspace = await readJson<{ members: JsonObject[]; threadMessages: JsonObject[] }>(dataDir, "teamspace.json", { members: [], threadMessages: [] });
  await writeJson(dataDir, "teamspace.json", {
    members: [...withoutScope(teamspace.members, scope), ...members],
    threadMessages: [...withoutScope(teamspace.threadMessages, scope), ...teamThreads]
  });

  const calendar = await readJson<{ events: JsonObject[] }>(dataDir, "calendar.json", { events: [] });
  await writeJson(dataDir, "calendar.json", {
    events: [...withoutScope(calendar.events, scope), ...calendarEvents]
  });

  const senders = await readJson<{ senders: JsonObject[] }>(dataDir, "workspace-whatsapp-senders.json", { senders: [] });
  await writeJson(dataDir, "workspace-whatsapp-senders.json", {
    senders: [...withoutScope(senders.senders, scope), sender]
  });

  const twilioStatus = await readJson<JsonObject>(dataDir, "twilio-integration.json", {});
  await writeJson(dataDir, "twilio-integration.json", clearTargetTwilioStatus(twilioStatus, scope));

  const userSettings = await readJson<{ workspaces: JsonObject[] }>(dataDir, "user-settings.json", { workspaces: [] });
  await writeJson(dataDir, "user-settings.json", {
    workspaces: [...withoutScope(userSettings.workspaces, scope), settings]
  });

  const leadMagnet = await readJson<JsonObject>(dataDir, "lead-magnet.json", {});
  await writeJson(dataDir, "lead-magnet.json", {
    briefs: [...keepNonTargetLeadMagnetItems(leadMagnet.briefs as JsonObject[], scope), ...leadMagnetStress.briefs],
    briefHistory: [...keepNonTargetLeadMagnetItems(leadMagnet.briefHistory as JsonObject[], scope), ...leadMagnetStress.briefHistory],
    leads: [...keepNonTargetLeadMagnetItems(leadMagnet.leads as JsonObject[], scope), ...leadMagnetStress.leads],
    runs: [...keepNonTargetLeadMagnetItems(leadMagnet.runs as JsonObject[], scope), ...leadMagnetStress.runs],
    drafts: [...keepNonTargetLeadMagnetItems(leadMagnet.drafts as JsonObject[], scope), ...leadMagnetStress.drafts],
    agentRuns: [...keepNonTargetLeadMagnetItems(leadMagnet.agentRuns as JsonObject[], scope), ...leadMagnetStress.agentRuns],
    searchSessions: [...keepNonTargetLeadMagnetItems(leadMagnet.searchSessions as JsonObject[], scope), ...leadMagnetStress.searchSessions],
    ownerSearchMemory: [...keepNonTargetLeadMagnetItems(leadMagnet.ownerSearchMemory as JsonObject[], scope), ...leadMagnetStress.ownerSearchMemory]
  });

  return {
    ok: true,
    backupDir,
    owner: {
      id: owner.id,
      tenantId: owner.tenantId,
      name: updatedOwner.name,
      emailOrPhone: owner.emailOrPhone,
      role: owner.role
    },
    counts: countSeed(crm, teamThreads, settings, calendarEvents, knowledge, members),
    credentials
  };
}
