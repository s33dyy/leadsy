import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";
import { runAgentForInboundLead } from "./agent-runtime";
import { createCalendarEvent, listCalendarEvents } from "./calendar-store";
import {
  assignLeadOwner,
  listCrmAssignmentHistory,
  listCrmFollowUpTasks,
  routeCrmEventToTasks,
  updateQualificationProfile
} from "./crm-store";
import { getCostReceipt } from "./cost-receipt";
import { listAiUsageRuns } from "./ai-usage-store";
import {
  appendManualLeadMessage,
  listLeadKnowledgeRecords,
  type LeadKnowledgeRecord
} from "./lead-knowledge-store";
import {
  createProvisionedTeamMember,
  createTeamMember,
  ensureDefaultQualificationAgent,
  listTeamMembers,
  listTeamThreadMessages,
  updateTeamMember,
  type TeamMember
} from "./teamspace-store";
import { ensureWorkspaceTwilioSimulator, saveSimulatedTwilioInboundMessage } from "./twilio-simulator";
import {
  listNotificationRecords,
  updateAiWorkspaceSettings,
  updateNotificationPreferences,
  updateOperatorProfileSettings,
  updateWorkspaceBusinessSettings
} from "./user-settings-store";

type JsonObject = Record<string, unknown>;

export type ChoritoesSeedInput = {
  email: string;
  confirm: string;
  dataDir?: string;
};

type Scope = {
  tenantId: string;
  ownerId: string;
};

type AuthUser = JsonObject & {
  id: string;
  tenantId: string;
  name: string;
  emailOrPhone: string;
  normalizedLogin: string;
  role: string;
  teamMemberId?: string;
};

type SeedCredential = {
  memberId: string;
  userId: string;
  name: string;
  login: string;
  temporaryPassword: string;
};

type ChoritoesScenario = {
  index: number;
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  segment: string;
  need: string;
  volume: string;
  budget: string;
  timeline: string;
  authority: string;
  source: string;
  assignmentKey: keyof TeamMap;
  meeting: boolean;
  emailActivity: boolean;
  callActivity: boolean;
  extraInbound?: string;
  crmEvent?: "follow_up_due" | "stale_needs_reply" | "human_review_needed" | "escalation";
};

type TeamMap = {
  qualification: TeamMember;
  distributorAi: TeamMember;
  samplingAi: TeamMember;
  calendarAi: TeamMember;
  pricingAi: TeamMember;
  pratik: TeamMember;
  sdr: TeamMember;
  distributorManager: TeamMember;
  fieldRep: TeamMember;
  supportOwner: TeamMember;
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
  "ai-usage.json"
];

const pipelineStages = [
  "new",
  "collecting",
  "sample_requested",
  "distributor_review",
  "meeting_scheduled",
  "proposal_sent",
  "won",
  "lost",
  "human_review"
];

function normalizeLogin(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function activeDataDir(dataDir?: string) {
  return dataDir?.trim() || process.env.LEADSY_DATA_DIR?.trim() || leadsyDataDir;
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
  const label = `choritoes-simulation-demo-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const backupDir = join(dataDir, "backups", label);
  await mkdir(backupDir, { recursive: true });
  const files: Array<{ file: string; copied: boolean }> = [];
  for (const file of touchedStores) {
    const source = join(dataDir, file);
    const copied = await exists(source);
    if (copied) await copyFile(source, join(backupDir, file));
    files.push({ file, copied });
  }
  await writeFile(
    join(backupDir, "manifest.json"),
    `${JSON.stringify({ createdAt: new Date().toISOString(), files }, null, 2)}\n`
  );
  return backupDir;
}

function scopeMatches(scope: Scope, item: JsonObject) {
  return item?.tenantId === scope.tenantId && item?.ownerId === scope.ownerId;
}

function withoutScope<T extends JsonObject>(items: T[] | undefined, scope: Scope) {
  return (Array.isArray(items) ? items : []).filter((item) => !scopeMatches(scope, item));
}

function assertConfirmation(input: ChoritoesSeedInput) {
  const email = normalizeLogin(input.email);
  if (normalizeLogin(input.confirm) !== email) {
    throw new Error(`confirmation_required:${email}`);
  }
  return email;
}

function assertOpenRouterConfigured() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("openrouter_required");
  }
}

async function resolveOwner(dataDir: string, normalizedEmail: string) {
  const auth = await readJson<{ users?: AuthUser[] }>(dataDir, "auth.json", { users: [] });
  const owner = (auth.users ?? []).find((user) => normalizeLogin(user.normalizedLogin || user.emailOrPhone || "") === normalizedEmail);
  if (!owner) throw new Error("target_account_not_found");
  return owner;
}

export async function resetAccountWorkspaceData(scope: Scope, preserveOwner = true, dataDir = activeDataDir()) {
  const auth = await readJson<{ users?: JsonObject[]; sessions?: JsonObject[] }>(dataDir, "auth.json", { users: [], sessions: [] });
  const targetTeamUsers = (auth.users ?? []).filter(
    (user) => user.tenantId === scope.tenantId && user.teamMemberId && (!preserveOwner || user.id !== scope.ownerId)
  );
  const targetTeamUserIds = new Set(targetTeamUsers.map((user) => user.id));
  await writeJson(dataDir, "auth.json", {
    users: (auth.users ?? []).filter((user) => !targetTeamUserIds.has(user.id)),
    sessions: (auth.sessions ?? []).filter((session) => !targetTeamUserIds.has(session.userId))
  });

  const knowledge = await readJson<{ leads?: JsonObject[]; conversations?: JsonObject[]; messages?: JsonObject[] }>(dataDir, "lead-knowledge.json", {});
  await writeJson(dataDir, "lead-knowledge.json", {
    leads: withoutScope(knowledge.leads, scope),
    conversations: withoutScope(knowledge.conversations, scope),
    messages: withoutScope(knowledge.messages, scope)
  });

  const crm = await readJson<{ assignmentRules?: JsonObject[]; assignmentHistory?: JsonObject[]; followUpTasks?: JsonObject[]; qualificationProfiles?: JsonObject[] }>(dataDir, "lead-crm.json", {});
  await writeJson(dataDir, "lead-crm.json", {
    assignmentRules: withoutScope(crm.assignmentRules, scope),
    assignmentHistory: withoutScope(crm.assignmentHistory, scope),
    followUpTasks: withoutScope(crm.followUpTasks, scope),
    qualificationProfiles: withoutScope(crm.qualificationProfiles, scope)
  });

  const teamspace = await readJson<{ members?: JsonObject[]; threadMessages?: JsonObject[] }>(dataDir, "teamspace.json", {});
  await writeJson(dataDir, "teamspace.json", {
    members: withoutScope(teamspace.members, scope),
    threadMessages: withoutScope(teamspace.threadMessages, scope)
  });

  const calendar = await readJson<{ events?: JsonObject[] }>(dataDir, "calendar.json", {});
  await writeJson(dataDir, "calendar.json", {
    events: withoutScope(calendar.events, scope)
  });

  const senders = await readJson<{ senders?: JsonObject[] }>(dataDir, "workspace-whatsapp-senders.json", {});
  await writeJson(dataDir, "workspace-whatsapp-senders.json", {
    senders: withoutScope(senders.senders, scope)
  });

  const twilio = await readJson<JsonObject>(dataDir, "twilio-integration.json", {});
  const nextTwilio = { ...twilio };
  delete nextTwilio[scope.tenantId];
  await writeJson(dataDir, "twilio-integration.json", nextTwilio);

  const settings = await readJson<{ workspaces?: JsonObject[] }>(dataDir, "user-settings.json", {});
  await writeJson(dataDir, "user-settings.json", {
    workspaces: withoutScope(settings.workspaces, scope)
  });

  const aiUsage = await readJson<{ runs?: JsonObject[]; agentRuns?: JsonObject[] }>(dataDir, "ai-usage.json", {});
  await writeJson(dataDir, "ai-usage.json", {
    runs: withoutScope(aiUsage.runs, scope),
    agentRuns: withoutScope(aiUsage.agentRuns, scope)
  });
}

function modelForSeed() {
  return (
    process.env.AI_DEFAULT_MODEL?.trim() ||
    process.env.LEADSY_ROUTINE_MODEL?.trim() ||
    process.env.OPENROUTER_DEFAULT_MODEL?.trim() ||
    "openrouter/auto"
  );
}

function memberLogin(scope: Scope, key: string) {
  return `${key}.${scope.ownerId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase()}@choritoes-demo.local`;
}

export async function configureChoritoesWorkspace(scope: Scope, owner: AuthUser) {
  await ensureWorkspaceTwilioSimulator({ ...scope, businessName: "Choritoes" });
  await updateWorkspaceBusinessSettings({
    ...scope,
    businessName: "Choritoes",
    industry: "Corn chips and packaged snacks / FMCG",
    website: "https://choritoes.example",
    markets: ["India", "Kolkata", "Bengaluru", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Ahmedabad"],
    services: [
      "Corn chips retail supply",
      "Distributor onboarding",
      "Bulk event snack packs",
      "School and cafe canteen supply",
      "Modern trade shelf placement",
      "Retail sampling packs"
    ],
    leadSources: ["WhatsApp Simulator", "Email enquiry", "Call log", "Retail referral", "Distributor event", "Website form"],
    pipelineStages,
    qualificationFields: ["company", "need", "monthlyVolume", "budget", "timeline", "authority", "location", "sampleRequirement"],
    assignmentDefaults: "New snack leads start with Qualification AI, distributor leads route to distributor review, and human owners handle pricing, sampling, and escalation.",
    followUpRules: [
      "Reply to hot WhatsApp distributor leads within 5 minutes",
      "Create sample tasks after sample requests",
      "Book meetings only from Leadsy calendar availability",
      "Escalate credit terms, exclusivity, and complaints to Pratik"
    ],
    timezone: "Asia/Kolkata",
    currency: "INR",
    calendarDefaults: "Offer 30 minute sales calls between 10:00 and 18:30 IST on weekdays and Saturday mornings."
  });
  await updateOperatorProfileSettings({
    ...scope,
    roleTitle: "Sales Manager",
    seniority: "Manager",
    languages: ["English", "Hindi"],
    timezone: "Asia/Kolkata",
    workingHours: "10:00-19:00 IST, Monday-Saturday",
    communicationStyle: "Concise, warm, practical, Hindi/English-friendly, and specific to snack distribution outcomes.",
    expertise: ["FMCG distribution", "Retail onboarding", "Corn chips category growth", "Distributor negotiation", "Bulk snack orders", "School and cafe supply"],
    markets: ["India", "Kolkata", "Bengaluru", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Ahmedabad"],
    servicesHandled: [
      "Corn chips retail supply",
      "Distributor onboarding",
      "Modern trade proposals",
      "Retail sampling",
      "Bulk event packs",
      "School and cafe canteen supply"
    ],
    escalationPreferences: "Escalate territory exclusivity, credit terms, distributor margin disputes, complaints, legal language, and urgent stockout issues to Pratik.",
    restrictedClaims: [
      "Do not promise exclusive distributor territory without Pratik approval",
      "Do not confirm credit terms or discounts without human approval",
      "Do not guarantee exact delivery dates before stock confirmation"
    ],
    knowledgeBase:
      "Choritoes sells crunchy corn chips for retail stores, supermarkets, school and cafe canteens, event bulk packs, and distributors. Typical conversation goals are carton volume, city/market, outlet type, sample needs, margin/pricing fit, timeline, and decision maker. Pratik Choudhuri is the Sales Manager and owns high-value distributor and modern trade handoffs."
  });
  const model = modelForSeed();
  await updateAiWorkspaceSettings({
    ...scope,
    providerMode: "openrouter",
    remoteAiEnabled: true,
    costMode: "paid",
    monthlyBudgetInr: 10_000,
    temperature: 0.35,
    maxTokens: 650,
    responseStyle: "Speak as the Choritoes sales team. Answer direct product questions first, then ask one focused next question.",
    humanReviewThreshold: 0.74,
    escalationKeywords: ["human", "manager", "credit", "exclusive", "refund", "legal", "complaint", "stop"],
    blockedTopics: ["unapproved credit terms", "exclusive territory promises", "guaranteed delivery before stock check"],
    taskRouting: {
      "qualification-reply": { enabled: true, model },
      "message-draft": { enabled: true, model },
      "calendar-reply": { enabled: true, model },
      "lead-research-planner": { enabled: true, model },
      "lead-dossier": { enabled: true, model },
      "onboarding-options": { enabled: true, model }
    },
    promptTemplates: {
      "qualification-reply": "Represent Choritoes and ask one concrete sales qualification question.",
      "message-draft": "Draft a human-sounding Choritoes sales reply using current lead facts.",
      "calendar-reply": "Offer only Leadsy calendar slots for Choritoes meetings.",
      "lead-research-planner": "Plan low-cost research for snack/FMCG lead qualification.",
      "lead-dossier": "Summarize the Choritoes lead, objections, owner, and next action.",
      "onboarding-options": "Generate answer options for Choritoes workspace onboarding."
    }
  });
  await updateNotificationPreferences({
    ...scope,
    channels: { inApp: true, toast: true, badge: true, email: false },
    quietHours: { enabled: false, start: "21:00", end: "09:00", timezone: "Asia/Kolkata" },
    digestFrequency: "daily",
    priorityThreshold: "all",
    roleRouting: "all",
    notifyOnlyMyLeads: false
  });
  await updateQualificationProfile({
    ...scope,
    businessGoal: "Qualify snack retail, distributor, school/cafe, modern trade, and bulk event leads for Choritoes.",
    introBehavior: "educate_then_qualify",
    requiredFields: ["company", "need", "monthlyVolume", "budget", "timeline", "authority", "location"],
    questionOrder: ["company", "need", "monthlyVolume", "budget", "timeline", "authority", "location", "sampleRequirement"]
  });

  const credentials: SeedCredential[] = [];
  const qualification = await ensureDefaultQualificationAgent(scope);
  await updateTeamMember({
    ...scope,
    memberId: qualification.id,
    pipelineStages: ["new", "collecting"],
    behaviorInstructions: "Represent Choritoes, qualify new snack leads with one practical question per turn, and hand off when carton volume, city, timeline, and decision maker are clear.",
    autoReplyEnabled: true,
    escalationKeywords: ["human", "manager", "credit", "exclusive", "refund", "legal", "complaint"]
  });
  const updatedQualification = (await listTeamMembers(scope)).find((member) => member.id === qualification.id) ?? qualification;

  const distributorAi = await createProvisionedMember(scope, credentials, {
    id: "choritoes_tm_distributor_ai",
    type: "ai_agent_full",
    name: "Distributor Qualification AI",
    emailOrPhone: memberLogin(scope, "ai.distributor"),
    pipelineStages: ["distributor_review", "proposal_sent"],
    autoReplyEnabled: true,
    behaviorInstructions: "Handle distributor qualification for Choritoes. Ask about city, territory, outlets served, monthly carton capacity, margin expectations, and credit concerns."
  });
  const samplingAi = await createProvisionedMember(scope, credentials, {
    id: "choritoes_tm_sampling_ai",
    type: "ai_agent_assisted",
    name: "Retail Sampling AI",
    emailOrPhone: memberLogin(scope, "ai.sampling"),
    pipelineStages: ["sample_requested", "meeting_scheduled"],
    autoReplyEnabled: false,
    behaviorInstructions: "Draft retail sampling plans and queue them for approval. Do not externally send unapproved sample commitments."
  });
  const calendarAi = await createProvisionedMember(scope, credentials, {
    id: "choritoes_tm_calendar_ai",
    type: "ai_agent_assisted",
    name: "Calendar AI",
    emailOrPhone: memberLogin(scope, "ai.calendar"),
    pipelineStages: ["meeting_scheduled"],
    autoReplyEnabled: false,
    behaviorInstructions: "Help propose meeting slots only from Leadsy calendar data."
  });
  const pricingAi = await createProvisionedMember(scope, credentials, {
    id: "choritoes_tm_pricing_ai",
    type: "ai_agent_assisted",
    name: "Pricing Assistant AI",
    emailOrPhone: memberLogin(scope, "ai.pricing"),
    pipelineStages: ["proposal_sent", "distributor_review"],
    autoReplyEnabled: false,
    behaviorInstructions: "Prepare price and margin drafts for human approval. Never promise discounts or credit terms externally."
  });
  const pratik = await createTeamMember({
    ...scope,
    id: "choritoes_tm_pratik",
    type: "human",
    name: "Pratik Choudhuri",
    emailOrPhone: owner.emailOrPhone,
    authUserId: owner.id,
    role: "manager",
    pipelineStages: ["qualified", "distributor_review", "proposal_sent", "won", "human_review"],
    behaviorInstructions: "Sales Manager for Choritoes. Owns distributor negotiation, strategic accounts, pricing approvals, and sensitive escalations.",
    autoReplyEnabled: false
  });
  const sdr = await createProvisionedMember(scope, credentials, {
    id: "choritoes_tm_sdr",
    type: "human",
    name: "Ananya Sen",
    role: "agent",
    emailOrPhone: memberLogin(scope, "ananya.sdr"),
    pipelineStages: ["qualified", "meeting_scheduled"],
    behaviorInstructions: "Follow up with retailers, collect outlet details, and book Choritoes sampling calls."
  });
  const distributorManager = await createProvisionedMember(scope, credentials, {
    id: "choritoes_tm_distributor_manager",
    type: "human",
    name: "Raghav Rao",
    role: "manager",
    emailOrPhone: memberLogin(scope, "raghav.distributor"),
    pipelineStages: ["distributor_review", "proposal_sent"],
    behaviorInstructions: "Own distributor evaluation, territory discussion, and high-volume carton planning."
  });
  const fieldRep = await createProvisionedMember(scope, credentials, {
    id: "choritoes_tm_field_rep",
    type: "human",
    name: "Meera Kulkarni",
    role: "agent",
    emailOrPhone: memberLogin(scope, "meera.sampling"),
    pipelineStages: ["sample_requested", "meeting_scheduled"],
    behaviorInstructions: "Coordinate retail/cafe/school sampling, site visits, and hand-sampling notes."
  });
  const supportOwner = await createProvisionedMember(scope, credentials, {
    id: "choritoes_tm_support",
    type: "human",
    name: "Kabir Malhotra",
    role: "agent",
    emailOrPhone: memberLogin(scope, "kabir.support"),
    pipelineStages: ["human_review", "lost"],
    behaviorInstructions: "Own escalations, delivery concern reviews, and sensitive lead recovery."
  });

  for (let day = 0; day < 14; day += 1) {
    const startAt = new Date(Date.UTC(2026, 4, 20 + day, 4, 30, 0)).toISOString();
    const endAt = new Date(Date.UTC(2026, 4, 20 + day, 12, 30, 0)).toISOString();
    await createCalendarEvent({
      ...scope,
      memberId: [pratik, sdr, distributorManager, fieldRep][day % 4].id,
      title: `Choritoes sales availability ${day + 1}`,
      startAt,
      endAt,
      eventType: "availability",
      status: "available",
      attendees: [],
      notes: "Seeded availability through calendar event helper.",
      location: "Leadsy calendar"
    });
  }

  return {
    members: {
      qualification: updatedQualification,
      distributorAi,
      samplingAi,
      calendarAi,
      pricingAi,
      pratik,
      sdr,
      distributorManager,
      fieldRep,
      supportOwner
    },
    credentials
  };
}

type MemberSpec = {
  id: string;
  type: "human" | "ai_agent_full" | "ai_agent_assisted";
  name: string;
  emailOrPhone: string;
  role?: "owner" | "admin" | "manager" | "agent";
  pipelineStages: string[];
  behaviorInstructions: string;
  autoReplyEnabled?: boolean;
};

async function createProvisionedMember(scope: Scope, credentials: SeedCredential[], spec: MemberSpec) {
  const result = await createProvisionedTeamMember({
    ...scope,
    ...spec,
    role: spec.role ?? "agent",
    autoReplyEnabled: spec.autoReplyEnabled ?? false,
    escalationKeywords: ["human", "manager", "credit", "exclusive", "complaint", "refund", "legal"]
  });
  if (result.credentials) {
    credentials.push({
      memberId: result.member.id,
      userId: result.credentials.userId,
      name: result.member.name,
      login: result.credentials.login,
      temporaryPassword: result.credentials.temporaryPassword
    });
  }
  return result.member;
}

function buildScenarios(): ChoritoesScenario[] {
  const names = [
    "Aarav Mehta", "Devika Menon", "Rohan Kapoor", "Maya Iyer", "Vikram Shah", "Nisha Gupta", "Imran Khan", "Priya Saha", "Ankit Jain", "Samar Bose",
    "Kavya Rao", "Farhan Ali", "Ritika Dutta", "Manish Agarwal", "Sneha Pillai", "Aditya Sen", "Pooja Nair", "Harsh Vyas", "Leena Thomas", "Arjun Bedi",
    "Neeraj Soni", "Tanvi Ghosh", "Rahul Ahuja", "Zoya Khan", "Karan Mallick", "Ishita Roy", "Naveen Desai", "Megha Patil", "Omar Siddiqui", "Shreya Jain",
    "Veda Krishnan", "Yash Bansal", "Alisha Fernandes", "Sahil Chopra", "Mitali Das", "Kunal Thakur", "Ayesha Mirza", "Parth Trivedi", "Rhea Mukherjee", "Gaurav Saxena",
    "Jaya Raman", "Aman Verma", "Noor Sheikh", "Tarun Grover", "Esha Khanna", "Kabir Bose", "Tanya Wadhwa", "Siddharth Menon", "Anjali Prakash", "Dhruv Arora"
  ];
  const companies = [
    "Fresh Basket Supermarket", "LaunchLayer Events", "Nova Retail Foods", "Greenfield School Canteen", "Urban Cafe Collective",
    "Eastern Snacks Distributors", "MetroMart Mumbai", "TasteTrail Weddings", "BlueCart Kirana Network", "CanteenHub Pune",
    "DailyNeeds Koramangala", "SpiceRoute Distributor", "Happy Tiffin Schools", "QuickBite Cafes", "SnackShelf Delhi",
    "Star Bazaar Franchise", "CollegeEats Hostel Stores", "Kolkata Modern Trade", "MunchPoint Retail", "Cafe 27",
    "NorthEast FMCG Agency", "Aroma Tea Lounge", "CityMandi Retailers", "KidsFest Organizers", "FoodSquare Bengaluru",
    "MahaCanteen Services", "Prime Grocers", "EventCrate Planners", "CampusKart", "ValueMart Ahmedabad",
    "Guwahati Snack Supply", "Indore Retail Group", "Hyderabad Cafe Chain", "Patna School Meals", "Chennai Trade Desk",
    "Rajkot Distributors", "Jaipur Snack Bar", "Mumbai Wedding House", "Lucknow Superstore", "Nagpur FMCG Partners",
    "Kochi Cafe Market", "Delhi NCR Micro Market", "Surat Grocery Circle", "Noida Office Pantry", "Bhopal Snack Point",
    "Goa Event Snacks", "Ranchi Distributor Desk", "Kolkata College Fest", "Pune Sports Canteen", "Bengaluru Cloud Cafe"
  ];
  const segments = [
    {
      segment: "retail shop",
      need: "want Choritoes corn chips for a fast-moving retail shelf trial",
      volume: "60 cartons per month",
      budget: "₹75k monthly",
      assignmentKey: "sdr" as const
    },
    {
      segment: "distributor",
      need: "are evaluating Choritoes distribution for local kirana and supermarket outlets",
      volume: "400 cartons per month",
      budget: "₹4.5L monthly",
      assignmentKey: "distributorManager" as const
    },
    {
      segment: "school canteen",
      need: "need smaller Choritoes packs for student canteen counters",
      volume: "120 cartons per month",
      budget: "₹1.2L monthly",
      assignmentKey: "fieldRep" as const
    },
    {
      segment: "cafe chain",
      need: "want single-serve corn chip packs for combo meals",
      volume: "90 cartons per month",
      budget: "₹95k monthly",
      assignmentKey: "samplingAi" as const
    },
    {
      segment: "event bulk buyer",
      need: "need bulk snack packs for events and wedding hampers",
      volume: "220 cartons for the month",
      budget: "₹2.4L",
      assignmentKey: "pricingAi" as const
    },
    {
      segment: "modern trade",
      need: "want a Choritoes modern trade proposal with margin and shelf plan",
      volume: "800 cartons per month",
      budget: "₹9L monthly",
      assignmentKey: "pratik" as const
    },
    {
      segment: "support escalation",
      need: "need help with a delayed sample box before placing a larger order",
      volume: "40 cartons initially",
      budget: "₹45k",
      assignmentKey: "supportOwner" as const
    }
  ];
  const cities = ["Kolkata", "Bengaluru", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Ahmedabad", "Chennai", "Jaipur", "Kochi"];
  const timelines = ["this week", "next week", "within 10 days", "by month end", "before next Friday", "in two weeks"];
  const sources = ["WhatsApp Simulator", "Website form", "Retail referral", "Distributor event", "Email enquiry", "Call log"];
  return names.map((name, index) => {
    const segment = segments[index % segments.length];
    const city = cities[index % cities.length];
    const volume = index % 9 === 0 ? "1,000 cartons per month" : segment.volume;
    const extraInbound = index % 4 === 0
      ? `Also, we will need samples in ${city} before the first purchase order. Our owner can approve after tasting.`
      : index % 6 === 0
        ? `Can you share what pack sizes Choritoes offers for ${segment.segment} buyers?`
        : undefined;
    return {
      index,
      name,
      company: companies[index],
      phone: `+9198${String(11110000 + index).padStart(8, "0")}`,
      email: `${name.split(" ")[0].toLowerCase()}.${index + 1}@example-buyer.test`,
      city,
      segment: segment.segment,
      need: segment.need,
      volume,
      budget: segment.budget,
      timeline: timelines[index % timelines.length],
      authority: index % 5 === 0 ? "final approval is with our founder" : index % 3 === 0 ? "the purchase lead will approve" : "I can approve the first order",
      source: sources[index % sources.length],
      assignmentKey: segment.assignmentKey,
      meeting: index % 3 === 0 || segment.segment === "distributor" || segment.segment === "modern trade",
      emailActivity: index % 2 === 0,
      callActivity: index % 3 === 1,
      extraInbound,
      crmEvent: index % 11 === 0 ? "stale_needs_reply" : index % 13 === 0 ? "follow_up_due" : index % 17 === 0 ? "human_review_needed" : undefined
    };
  });
}

function daysAgo(index: number, hour = 5, minute = 0) {
  const dayOffset = index % 30;
  return new Date(Date.UTC(2026, 5, 8 - dayOffset, hour + (index % 8), minute, 0)).toISOString();
}

function addMinutes(iso: string, minutes: number) {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function leadInputBody(scenario: ChoritoesScenario) {
  return `Hi, I'm ${scenario.name} from ${scenario.company} in ${scenario.city}. We ${scenario.need}. Volume is around ${scenario.volume}; budget is around ${scenario.budget}. ${scenario.authority}, and we want to start ${scenario.timeline}.`;
}

async function aiUsageCount(scope: Scope) {
  return (await listAiUsageRuns(scope)).agentRuns.length;
}

async function requireOpenRouterUsageGrowth(scope: Scope, before: number, scenarioId: string) {
  const after = await aiUsageCount(scope);
  if (after <= before) throw new Error(`openrouter_generation_required:${scenarioId}`);
  return after;
}

export async function simulateWhatsappLeadScenario(scope: Scope, scenario: ChoritoesScenario) {
  let usageBefore = await aiUsageCount(scope);
  const receivedAt = daysAgo(scenario.index, 4, scenario.index % 55);
  const inbound = await saveSimulatedTwilioInboundMessage({
    ...scope,
    from: scenario.phone,
    profileName: scenario.name,
    body: leadInputBody(scenario),
    receivedAt
  });
  const trigger = inbound.saved[0];
  if (!trigger) throw new Error(`simulator_inbound_not_saved:${scenario.index}`);
  await routeCrmEventToTasks({
    ...scope,
    eventType: "inbound_message",
    leadId: inbound.lead.id,
    assigneeId: inbound.lead.assigneeId,
    source: "choritoes_whatsapp_input",
    reason: `${scenario.name} sent a WhatsApp enquiry to Choritoes.`
  });
  await runAgentForInboundLead({
    ...scope,
    leadId: inbound.lead.id,
    conversationId: inbound.conversation.id,
    triggerMessageId: trigger.id,
    now: addMinutes(receivedAt, 1)
  });
  usageBefore = await requireOpenRouterUsageGrowth(scope, usageBefore, `first:${scenario.index}`);

  let lead = (await listLeadKnowledgeRecords(scope)).find((record) => record.id === inbound.lead.id);
  if (!lead) throw new Error(`lead_missing_after_inbound:${scenario.index}`);

  if (scenario.extraInbound && lead.assigneeName === "Qualification AI") {
    const secondInbound = await saveSimulatedTwilioInboundMessage({
      ...scope,
      from: scenario.phone,
      profileName: scenario.name,
      body: scenario.extraInbound,
      receivedAt: addMinutes(receivedAt, 6)
    });
    const secondTrigger = secondInbound.saved[0];
    if (secondTrigger) {
      await routeCrmEventToTasks({
        ...scope,
        eventType: "inbound_message",
        leadId: secondInbound.lead.id,
        assigneeId: secondInbound.lead.assigneeId,
        source: "choritoes_whatsapp_input",
        reason: `${scenario.name} added more Choritoes buying context.`
      });
      await runAgentForInboundLead({
        ...scope,
        leadId: secondInbound.lead.id,
        conversationId: secondInbound.conversation.id,
        triggerMessageId: secondTrigger.id,
        now: addMinutes(receivedAt, 7)
      });
      await requireOpenRouterUsageGrowth(scope, usageBefore, `second:${scenario.index}`);
    }
    lead = (await listLeadKnowledgeRecords(scope)).find((record) => record.id === inbound.lead.id) ?? lead;
  }

  return lead;
}

export async function simulateEmailActivity(scope: Scope, leadId: string, scenario: ChoritoesScenario) {
  const record = await appendManualLeadMessage({
    ...scope,
    leadId,
    contact: { displayName: scenario.name, phone: scenario.phone, email: scenario.email },
    channel: "email",
    direction: "inbound",
    body: `Email from ${scenario.company}: please share Choritoes pack sizes, carton pricing, and sample steps for ${scenario.segment} in ${scenario.city}.`,
    occurredAt: addMinutes(daysAgo(scenario.index, 8), 12)
  });
  await routeCrmEventToTasks({
    ...scope,
    eventType: "inbound_message",
    leadId,
    assigneeId: record.assigneeId,
    source: "choritoes_email_input",
    reason: `${scenario.name} sent a Choritoes email enquiry.`
  });
  return record;
}

export async function simulateCallActivity(scope: Scope, leadId: string, scenario: ChoritoesScenario) {
  const record = await appendManualLeadMessage({
    ...scope,
    leadId,
    contact: { displayName: scenario.name, phone: scenario.phone, email: scenario.email },
    channel: "call",
    direction: "inbound",
    body: `Call log: ${scenario.name} asked whether Choritoes can support ${scenario.volume} for ${scenario.company}; asked for sample timing and distributor margin basics.`,
    occurredAt: addMinutes(daysAgo(scenario.index, 10), 18)
  });
  await routeCrmEventToTasks({
    ...scope,
    eventType: "inbound_message",
    leadId,
    assigneeId: record.assigneeId,
    source: "choritoes_call_input",
    reason: `${scenario.name} called about Choritoes supply.`
  });
  return record;
}

export async function createScenarioMeetingInput(scope: Scope, leadId: string, memberId: string | undefined, scenario: ChoritoesScenario, conversationId?: string) {
  const startAt = addMinutes(daysAgo(scenario.index, 13), 30 + (scenario.index % 6) * 15);
  const endAt = addMinutes(startAt, 30);
  const event = await createCalendarEvent({
    ...scope,
    memberId,
    leadId,
    conversationId,
    title: `Choritoes sales meeting - ${scenario.company}`,
    startAt,
    endAt,
    eventType: "meeting",
    status: scenario.index % 10 === 0 ? "proposed" : "confirmed",
    attendees: [scenario.email],
    notes: `Discuss ${scenario.segment}, ${scenario.volume}, sample needs, and ${scenario.budget} budget.`,
    location: scenario.index % 2 === 0 ? "Google Meet" : `${scenario.city} field visit`
  });
  await routeCrmEventToTasks({
    ...scope,
    eventType: "meeting_created",
    leadId,
    assigneeId: memberId,
    source: "calendar",
    reason: `Meeting input created for ${scenario.company}.`
  });
  return event;
}

async function assignScenarioOwner(scope: Scope, lead: LeadKnowledgeRecord, scenario: ChoritoesScenario, members: TeamMap) {
  const assignee = members[scenario.assignmentKey] ?? members.pratik;
  return assignLeadOwner({
    ...scope,
    leadId: lead.id,
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    method: "source_based",
    assignedById: members.qualification.id,
    assignedByName: members.qualification.name,
    reason: `Choritoes scenario route: ${scenario.segment} lead from ${scenario.city}.`
  });
}

async function runScenarioInputs(scope: Scope, members: TeamMap, scenario: ChoritoesScenario) {
  const lead = await simulateWhatsappLeadScenario(scope, scenario);
  if (scenario.emailActivity) await simulateEmailActivity(scope, lead.id, scenario);
  if (scenario.callActivity) await simulateCallActivity(scope, lead.id, scenario);
  const assigned = await assignScenarioOwner(scope, lead, scenario, members);
  const refreshed = (await listLeadKnowledgeRecords(scope)).find((record) => record.id === assigned.id) ?? assigned;
  const conversationId = refreshed.conversations.find((conversation) => conversation.channel === "whatsapp")?.id;
  if (scenario.meeting) {
    await createScenarioMeetingInput(scope, refreshed.id, refreshed.assigneeId, scenario, conversationId);
  }
  if (scenario.crmEvent) {
    await routeCrmEventToTasks({
      ...scope,
      eventType: scenario.crmEvent,
      leadId: refreshed.id,
      assigneeId: refreshed.assigneeId,
      source: "choritoes_crm_event_input",
      reason: `Choritoes scenario generated ${scenario.crmEvent.replace(/_/g, " ")} for ${scenario.company}.`
    });
  }
  return refreshed;
}

export async function seedChoritoesSimulationDemo(input: ChoritoesSeedInput) {
  const dataDir = activeDataDir(input.dataDir);
  const normalizedEmail = assertConfirmation(input);
  assertOpenRouterConfigured();
  const previousStrictRemoteAi = process.env.LEADSY_REQUIRE_REMOTE_AI;
  process.env.LEADSY_REQUIRE_REMOTE_AI = "true";
  try {
  const owner = await resolveOwner(dataDir, normalizedEmail);
  const scope = { tenantId: owner.tenantId, ownerId: owner.id };
  const backupDir = await backupStores(dataDir);
  await resetAccountWorkspaceData(scope, true, dataDir);
  const { members, credentials } = await configureChoritoesWorkspace(scope, owner);
  const scenarios = buildScenarios();
  const failedScenarios: Array<{ scenario: string; error: string }> = [];
  for (const scenario of scenarios) {
    try {
      await runScenarioInputs(scope, members, scenario);
    } catch (error) {
      failedScenarios.push({ scenario: `${scenario.index + 1}:${scenario.company}`, error: (error as Error).message });
    }
  }
  if (failedScenarios.length) {
    throw new Error(`choritoes_seed_failed:${JSON.stringify(failedScenarios.slice(0, 5))}`);
  }

  const [leads, tasks, aiTasks, calendarEvents, assignmentHistory, teamMembers, teamThreadMessages, notifications, aiUsage, receipt] = await Promise.all([
    listLeadKnowledgeRecords(scope),
    listCrmFollowUpTasks(scope, { destination: "human_tasks" }),
    listCrmFollowUpTasks(scope, { destination: "ai_approvals" }),
    listCalendarEvents(scope),
    listCrmAssignmentHistory(scope),
    listTeamMembers(scope),
    listTeamThreadMessages({ ...scope, threadScope: "workspace" }),
    listNotificationRecords(scope),
    listAiUsageRuns(scope),
    getCostReceipt(scope)
  ]);

  const allMessages = leads.flatMap((lead) => lead.messages);
  return {
    ok: true as const,
    backupDir,
    owner: {
      id: owner.id,
      tenantId: owner.tenantId,
      emailOrPhone: owner.emailOrPhone,
      name: owner.name
    },
    counts: {
      scenarios: scenarios.length,
      leads: leads.length,
      conversations: leads.reduce((total, lead) => total + lead.conversations.length, 0),
      whatsappConversations: leads.flatMap((lead) => lead.conversations).filter((conversation) => conversation.channel === "whatsapp").length,
      emailActivities: allMessages.filter((message) => message.channel === "email").length,
      callActivities: allMessages.filter((message) => message.channel === "call").length,
      whatsappMessages: allMessages.filter((message) => message.channel === "whatsapp").length,
      humanTasks: tasks.length,
      aiApprovalTasks: aiTasks.length,
      calendarEvents: calendarEvents.length,
      assignmentHistory: assignmentHistory.length,
      teamMembers: teamMembers.length,
      workspaceTeamEvents: teamThreadMessages.length,
      notifications: notifications.length,
      openRouterRequests: receipt.summary.openrouter.requests || aiUsage.agentRuns.length,
      openRouterCostInr: receipt.summary.openrouter.totalInr,
      projectedSimulatorMessages: receipt.summary.twilio.projectedSimulatorMessages,
      projectedSimulatorCostInr: receipt.summary.twilio.projectedSimulatorInr
    },
    credentials,
    failedScenarios
  };
  } finally {
    if (previousStrictRemoteAi === undefined) {
      delete process.env.LEADSY_REQUIRE_REMOTE_AI;
    } else {
      process.env.LEADSY_REQUIRE_REMOTE_AI = previousStrictRemoteAi;
    }
  }
}
