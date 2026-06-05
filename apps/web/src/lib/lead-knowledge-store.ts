import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getDemoSession } from "@leadsy/security";
import { leadsyDataDir } from "./data-dir";
import type {
  ExtensionConversationContact,
  ExtensionConversationEvent,
  ExtensionConversationInsight,
  ExtensionCaptureSource,
  ExtensionMessageDirection,
  ExtensionMessageGeneratedBy,
  ExtensionPlatform,
  ExtensionTask
} from "./extension-store";

const knowledgeFile = join(leadsyDataDir, "lead-knowledge.json");

export type LeadKnowledgeChannel =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "whatsapp-web"
  | "instagram-web"
  | "facebook-web"
  | "generic-web-chat"
  | "email"
  | "call"
  | "manual";
export type LeadKnowledgeSource = "meta-webhook" | "extension" | "manual";
export type LeadKnowledgeDirection = "inbound" | "outbound" | "system" | "note";
export type LeadKnowledgeStatus = "lead" | "excluded";
export type LeadConversationKnowledgeStatus = "included" | "excluded";
export type LeadCrmStatus = "new_lead" | "interested" | "needs_reply" | "human_review";
export type LeadQualificationStage = "new" | "collecting" | "qualified" | "human_review";
export type LeadQualificationFieldKey = "name" | "phone" | "company" | "need" | "teamOrQueryVolume" | "budget" | "timeline";
export type LeadQualificationFields = Partial<Record<LeadQualificationFieldKey, string>>;

export type LeadKnowledgeContact = {
  displayName?: string;
  phone?: string;
  email?: string;
  handle?: string;
  profileUrl?: string;
  waId?: string;
};

export type LeadKnowledgeLead = {
  id: string;
  tenantId: string;
  ownerId: string;
  identityKeys: string[];
  contact: LeadKnowledgeContact;
  leadStatus: LeadKnowledgeStatus;
  crmStatus: LeadCrmStatus;
  leadSource?: string;
  campaignId?: string;
  assigneeId?: string;
  assigneeName?: string;
  qualificationFields: LeadQualificationFields;
  qualificationStage: LeadQualificationStage;
  excludedAt?: string;
  deletedAt?: string;
  summary?: string;
  nextAction?: string;
  facts: string[];
  createdAt: string;
  updatedAt: string;
};

export type LeadKnowledgeConversation = {
  id: string;
  tenantId: string;
  ownerId: string;
  leadId: string;
  channel: LeadKnowledgeChannel;
  source: LeadKnowledgeSource;
  externalKey: string;
  sourceUrl?: string;
  contact: LeadKnowledgeContact;
  knowledgeStatus: LeadConversationKnowledgeStatus;
  excludedAt?: string;
  messageCount: number;
  inboundCount: number;
  outboundCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  summary?: string;
  nextAction?: string;
  sentiment?: ExtensionConversationInsight["sentiment"];
  createdAt: string;
  updatedAt: string;
};

export type LeadKnowledgeMessage = {
  id: string;
  tenantId: string;
  ownerId: string;
  leadId: string;
  conversationId: string;
  source: LeadKnowledgeSource;
  channel: LeadKnowledgeChannel;
  externalId: string;
  direction: LeadKnowledgeDirection;
  body: string;
  messageType: string;
  sentAt: string;
  receivedAt: string;
  generatedBy?: ExtensionMessageGeneratedBy | "manual";
  hiddenAt?: string;
  raw?: unknown;
};

export type LeadKnowledgeRecord = LeadKnowledgeLead & {
  channels: LeadKnowledgeChannel[];
  conversations: LeadKnowledgeConversation[];
  messages: LeadKnowledgeMessage[];
  messageCount: number;
  inboundCount: number;
  outboundCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
};

export type LeadKnowledgeContext = {
  lead?: LeadKnowledgeRecord;
  conversations: LeadKnowledgeConversation[];
  messages: LeadKnowledgeMessage[];
  facts: string[];
  businessPrompt: string;
  supportNotes: string[];
  leadQualificationHints: string[];
};

type LeadKnowledgeState = {
  leads: LeadKnowledgeLead[];
  conversations: LeadKnowledgeConversation[];
  messages: LeadKnowledgeMessage[];
};

type Scope = {
  tenantId: string;
  ownerId: string;
};

type MetaNormalizedMessage = {
  channel: Extract<LeadKnowledgeChannel, "whatsapp" | "instagram" | "facebook">;
  externalConversationKey: string;
  sourceUrl?: string;
  contact: LeadKnowledgeContact;
  identityKeys: string[];
  externalId: string;
  direction: LeadKnowledgeDirection;
  body: string;
  messageType: string;
  sentAt: string;
  receivedAt: string;
  raw: unknown;
};

function emptyState(): LeadKnowledgeState {
  return { leads: [], conversations: [], messages: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function timestampToIso(timestamp: unknown, fallback: string) {
  const value = typeof timestamp === "number" ? String(timestamp) : asString(timestamp);
  if (!value) return fallback;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    return new Date(millis).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function cleanPreview(body: string) {
  return body.trim().replace(/\s+/g, " ").slice(0, 180);
}

function normalizedMessageBody(body: string) {
  return body.trim().replace(/\s+/g, " ").toLowerCase();
}

const qualificationFieldOrder: LeadQualificationFieldKey[] = ["name", "phone", "company", "need", "teamOrQueryVolume", "budget", "timeline"];
const qualificationQuestions: Record<LeadQualificationFieldKey, string> = {
  name: "Ask for the buyer's name before continuing qualification.",
  phone: "Confirm the preferred phone number for follow-up.",
  company: "Ask for the business or company name.",
  need: "Ask what they want to achieve with Leadsy or WhatsApp automation.",
  teamOrQueryVolume: "Ask how many queries, leads, or messages they handle each day.",
  budget: "Ask for budget range if the conversation is warm enough.",
  timeline: "Ask when they want to start or book the next conversation."
};
const humanReviewPattern = /\b(fuck|shit|angry|refund|legal|lawyer|complaint|human|agent|manager|stop|unsubscribe)\b/i;

function businessLikeName(value?: string) {
  return /\b(pvt|ltd|llp|inc|corp|company|business|mobility|solutions|technologies|tech|systems|agency|homestay|school|college|clinic|restaurant)\b/i.test(value ?? "");
}

function leadCrmDefaults(): Pick<LeadKnowledgeLead, "crmStatus" | "qualificationFields" | "qualificationStage"> {
  return {
    crmStatus: "new_lead",
    qualificationFields: {},
    qualificationStage: "new"
  };
}

function ensureLeadCrmDefaults(lead: LeadKnowledgeLead) {
  lead.crmStatus = lead.crmStatus ?? "new_lead";
  lead.qualificationFields = lead.qualificationFields ?? {};
  lead.qualificationStage = lead.qualificationStage ?? "new";
  return lead;
}

function channelFamily(channel: LeadKnowledgeChannel) {
  if (channel === "whatsapp" || channel === "whatsapp-web") return "whatsapp";
  if (channel === "instagram" || channel === "instagram-web") return "instagram";
  if (channel === "facebook" || channel === "facebook-web") return "facebook";
  return channel;
}

function timestampDeltaMs(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(leftTime - rightTime);
}

function messageLooksLikeDuplicate(left: LeadKnowledgeMessage, right: Omit<LeadKnowledgeMessage, "id" | "tenantId" | "ownerId">) {
  if (left.leadId !== right.leadId) return false;
  if (left.direction !== "inbound" && left.direction !== "outbound") return false;
  if (left.direction !== right.direction) {
    const leadsyOutboundEcho =
      left.direction === "outbound" &&
      left.generatedBy === "leadsy" &&
      right.direction === "inbound" &&
      timestampDeltaMs(left.sentAt, right.sentAt) <= 120_000;
    if (!leadsyOutboundEcho) return false;
  }
  if (channelFamily(left.channel) !== channelFamily(right.channel)) return false;
  if (normalizedMessageBody(left.body) !== normalizedMessageBody(right.body)) return false;
  return timestampDeltaMs(left.sentAt, right.sentAt) <= 120_000;
}

function scopeMatches(scope: Scope, item: Scope) {
  return item.tenantId === scope.tenantId && item.ownerId === scope.ownerId;
}

export function defaultWebhookScope(): Scope {
  const demo = getDemoSession();
  return {
    tenantId: process.env.LEADSY_META_TENANT_ID?.trim() || demo.tenantId,
    ownerId: process.env.LEADSY_META_OWNER_ID?.trim() || demo.id
  };
}

async function readState(): Promise<LeadKnowledgeState> {
  try {
    const raw = await readFile(knowledgeFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<LeadKnowledgeState>;
    return {
      leads: Array.isArray(parsed.leads) ? parsed.leads : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
      return emptyState();
    }
    throw error;
  }
}

async function writeState(state: LeadKnowledgeState) {
  await mkdir(dirname(knowledgeFile), { recursive: true });
  const tempFile = `${knowledgeFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, knowledgeFile);
}

function phoneKey(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 7 ? `phone:${digits}` : undefined;
}

function emailKey(value?: string) {
  return value ? `email:${value.trim().toLowerCase()}` : undefined;
}

function handleKey(channel: string, value?: string) {
  const clean = value?.trim().replace(/^@/, "").toLowerCase();
  return clean ? `${channel}:handle:${clean}` : undefined;
}

function profileKey(channel: string, value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.hash = "";
    return `${channel}:profile:${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
  } catch {
    return `${channel}:profile:${value.trim().toLowerCase()}`;
  }
}

function displayNameKey(channel: string, value?: string) {
  const clean = value?.trim().replace(/\s+/g, " ").toLowerCase();
  return clean ? `${channel}:display:${clean}` : undefined;
}

function cleanContact(contact: LeadKnowledgeContact = {}): LeadKnowledgeContact {
  return {
    displayName: contact.displayName?.trim() || undefined,
    phone: contact.phone?.trim() || undefined,
    email: contact.email?.trim() || undefined,
    handle: contact.handle?.trim() || undefined,
    profileUrl: contact.profileUrl?.trim() || undefined,
    waId: contact.waId?.trim() || undefined
  };
}

function identityKeysForContact(channel: string, contact: LeadKnowledgeContact) {
  return uniqueStrings([
    phoneKey(contact.phone),
    phoneKey(contact.waId),
    emailKey(contact.email),
    handleKey(channel, contact.handle),
    profileKey(channel, contact.profileUrl)
  ]);
}

function extensionIdentityKeysForContact(channel: string, contact: LeadKnowledgeContact) {
  return uniqueStrings([
    ...identityKeysForContact(channel, contact),
    displayNameKey(channel, contact.displayName)
  ]);
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function mergeContacts(current: LeadKnowledgeContact, incoming: LeadKnowledgeContact) {
  return cleanContact({
    displayName: current.displayName || incoming.displayName,
    phone: current.phone || incoming.phone,
    email: current.email || incoming.email,
    handle: current.handle || incoming.handle,
    profileUrl: current.profileUrl || incoming.profileUrl,
    waId: current.waId || incoming.waId
  });
}

function valueAfterLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`(?:^|\\n|\\b)${escaped}\\s*[:=-]\\s*([^\\n.]+)`, "i"));
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim().replace(/[?.!,;:]+$/, "");
  }
  return undefined;
}

function inferNeedFromText(text: string) {
  const explicit = valueAfterLabel(text, ["Need", "Reason", "Requirement", "Use case", "Goal"]);
  if (explicit) return explicit;
  return firstMatch(text, [
    /\b(?:i\s+want|want|need|looking\s+for|interested\s+in)\s+(?:a\s+|an\s+|to\s+)?([^.\n?]+?)(?:\s+for\s+\d|\s+this\s+week|$|[?.!])/i,
    /\b(whatsapp\s+(?:crm|automation|ai|follow[- ]?up)[^.\n?]*)/i
  ]);
}

function inferQualificationFields(input: {
  contact: LeadKnowledgeContact;
  existing?: LeadQualificationFields;
  facts?: string[];
  messages: LeadKnowledgeMessage[];
}) {
  const text = [
    ...(input.facts ?? []),
    ...input.messages.map((message) => message.body)
  ].join("\n");
  const displayName = input.contact.displayName;
  const fields: LeadQualificationFields = {
    ...(input.existing ?? {})
  };

  fields.name = fields.name || (displayName && !businessLikeName(displayName) ? displayName : undefined);
  fields.phone = fields.phone || input.contact.phone || input.contact.waId;
  fields.company = fields.company || valueAfterLabel(text, ["Company", "Business", "Business name", "Company name"]);
  fields.need = fields.need || inferNeedFromText(text);
  fields.teamOrQueryVolume =
    fields.teamOrQueryVolume ||
    valueAfterLabel(text, ["Queries per day", "Messages per day", "Team size", "Query volume"]) ||
    firstMatch(text, [
      /\b(\d+\s*-\s*\d+\s*(?:queries|messages|leads)(?:\s+per\s+day)?)/i,
      /\b(more\s+than\s+\d+\s*(?:queries|messages|leads)?)/i,
      /\b(\d+\s*(?:queries|messages|leads)\s+(?:per\s+day|daily))/i
    ]);
  fields.budget = fields.budget || valueAfterLabel(text, ["Budget", "Estimated budget"]) || firstMatch(text, [/\b(?:budget|price range)\s*(?:is|:)?\s*([₹$]?\s*[\d,]+(?:\s*(?:inr|rs|usd))?)/i]);
  fields.timeline = fields.timeline || valueAfterLabel(text, ["Timeline", "Start date"]) || firstMatch(text, [/\b(this week|next week|tomorrow|today|next month|as soon as possible)\b/i]);

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value?.trim())) as LeadQualificationFields;
}

function nextMissingQualificationField(fields: LeadQualificationFields) {
  return qualificationFieldOrder.find((field) => !fields[field]);
}

function defaultAssigneeForLeadSource(leadSource?: string) {
  if (!leadSource) return {};
  if (/meta|ctwa|whatsapp/i.test(leadSource)) {
    return { assigneeId: "meta-sales-owner", assigneeName: "Meta sales owner" };
  }
  if (/google|website|gads|organic/i.test(leadSource)) {
    return { assigneeId: "website-sales-owner", assigneeName: "Website sales owner" };
  }
  return {};
}

function qualificationDecisionForLead(input: {
  lead: LeadKnowledgeLead;
  messages: LeadKnowledgeMessage[];
}) {
  const messages = input.messages.filter((message) => !message.hiddenAt);
  const latest = messages.at(-1);
  const fields = inferQualificationFields({
    contact: input.lead.contact,
    existing: input.lead.qualificationFields,
    facts: input.lead.facts,
    messages
  });
  const coreQualified = Boolean(fields.company && fields.need && (fields.name || fields.phone));
  const missing = nextMissingQualificationField(fields);
  const latestText = latest?.body ?? "";

  if (input.lead.crmStatus === "human_review" || (latestText && humanReviewPattern.test(latestText))) {
    return {
      fields,
      crmStatus: "human_review" as const,
      qualificationStage: "human_review" as const,
      nextAction: "Human review needed before Leadsy or a worker replies again."
    };
  }

  if (coreQualified) {
    return {
      fields,
      crmStatus: "interested" as const,
      qualificationStage: "qualified" as const,
      nextAction: "Qualified lead. Assign owner and book the next sales conversation."
    };
  }

  if (latest?.direction === "inbound") {
    return {
      fields,
      crmStatus: "needs_reply" as const,
      qualificationStage: "collecting" as const,
      nextAction: missing ? qualificationQuestions[missing] : "Reply and continue qualifying this lead."
    };
  }

  return {
    fields,
    crmStatus: "new_lead" as const,
    qualificationStage: Object.keys(fields).length ? ("collecting" as const) : ("new" as const),
    nextAction: missing ? qualificationQuestions[missing] : "Review this lead and choose the next action."
  };
}

function findLeadByIdentity(state: LeadKnowledgeState, scope: Scope, identityKeys: string[]) {
  if (!identityKeys.length) return undefined;
  return state.leads.find(
    (lead) => scopeMatches(scope, lead) && identityKeys.some((identityKey) => lead.identityKeys.includes(identityKey))
  );
}

function findLeadById(state: LeadKnowledgeState, scope: Scope, leadId: string) {
  return state.leads.find((lead) => lead.id === leadId && scopeMatches(scope, lead));
}

function upsertLead(state: LeadKnowledgeState, scope: Scope, input: {
  identityKeys: string[];
  contact?: LeadKnowledgeContact;
  summary?: string;
  nextAction?: string;
  facts?: string[];
  leadId?: string;
  leadSource?: string;
  campaignId?: string;
  assigneeId?: string;
  assigneeName?: string;
  crmStatus?: LeadCrmStatus;
  qualificationFields?: LeadQualificationFields;
  qualificationStage?: LeadQualificationStage;
}) {
  const now = nowIso();
  const contact = cleanContact(input.contact);
  const identityKeys = uniqueStrings([...input.identityKeys, ...identityKeysForContact("generic", contact)]);
  const existing = input.leadId ? findLeadById(state, scope, input.leadId) : findLeadByIdentity(state, scope, identityKeys);

  if (existing) {
    ensureLeadCrmDefaults(existing);
    const defaultAssignee = defaultAssigneeForLeadSource(input.leadSource || existing.leadSource);
    existing.identityKeys = uniqueStrings([...existing.identityKeys, ...identityKeys]);
    existing.contact = mergeContacts(existing.contact, contact);
    existing.summary = input.summary || existing.summary;
    existing.nextAction = input.nextAction || existing.nextAction;
    existing.facts = uniqueStrings([...(input.facts ?? []), ...existing.facts]).slice(0, 30);
    existing.leadSource = input.leadSource || existing.leadSource;
    existing.campaignId = input.campaignId || existing.campaignId;
    existing.assigneeId = input.assigneeId || existing.assigneeId || defaultAssignee.assigneeId;
    existing.assigneeName = input.assigneeName || existing.assigneeName || defaultAssignee.assigneeName;
    existing.crmStatus = input.crmStatus || existing.crmStatus;
    existing.qualificationFields = { ...existing.qualificationFields, ...(input.qualificationFields ?? {}) };
    existing.qualificationStage = input.qualificationStage || existing.qualificationStage;
    existing.updatedAt = now;
    return existing;
  }

  const defaultAssignee = defaultAssigneeForLeadSource(input.leadSource);
  const lead: LeadKnowledgeLead = {
    id: input.leadId || `leadkb_${crypto.randomUUID()}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    identityKeys,
    contact,
    leadStatus: "lead",
    ...leadCrmDefaults(),
    crmStatus: input.crmStatus ?? "new_lead",
    leadSource: input.leadSource,
    campaignId: input.campaignId,
    assigneeId: input.assigneeId ?? defaultAssignee.assigneeId,
    assigneeName: input.assigneeName ?? defaultAssignee.assigneeName,
    qualificationFields: input.qualificationFields ?? {},
    qualificationStage: input.qualificationStage ?? "new",
    summary: input.summary,
    nextAction: input.nextAction,
    facts: uniqueStrings(input.facts ?? []).slice(0, 30),
    createdAt: now,
    updatedAt: now
  };
  state.leads.push(lead);
  return lead;
}

function upsertConversation(state: LeadKnowledgeState, scope: Scope, input: {
  leadId: string;
  channel: LeadKnowledgeChannel;
  source: LeadKnowledgeSource;
  externalKey: string;
  sourceUrl?: string;
  contact?: LeadKnowledgeContact;
  summary?: string;
  nextAction?: string;
  sentiment?: ExtensionConversationInsight["sentiment"];
}) {
  const now = nowIso();
  const existing = state.conversations.find(
    (conversation) => scopeMatches(scope, conversation) && conversation.source === input.source && conversation.externalKey === input.externalKey
  );

  if (existing) {
    existing.leadId = input.leadId;
    existing.channel = input.channel;
    existing.sourceUrl = input.sourceUrl || existing.sourceUrl;
    existing.contact = mergeContacts(existing.contact, cleanContact(input.contact));
    existing.summary = input.summary || existing.summary;
    existing.nextAction = input.nextAction || existing.nextAction;
    existing.sentiment = input.sentiment || existing.sentiment;
    existing.updatedAt = now;
    return existing;
  }

  const conversation: LeadKnowledgeConversation = {
    id: `leadconv_${crypto.randomUUID()}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    leadId: input.leadId,
    channel: input.channel,
    source: input.source,
    externalKey: input.externalKey,
    sourceUrl: input.sourceUrl,
    contact: cleanContact(input.contact),
    knowledgeStatus: "included",
    messageCount: 0,
    inboundCount: 0,
    outboundCount: 0,
    summary: input.summary,
    nextAction: input.nextAction,
    sentiment: input.sentiment,
    createdAt: now,
    updatedAt: now
  };
  state.conversations.push(conversation);
  return conversation;
}

function addMessage(state: LeadKnowledgeState, scope: Scope, input: Omit<LeadKnowledgeMessage, "id" | "tenantId" | "ownerId">) {
  const existing = state.messages.find(
    (message) =>
      scopeMatches(scope, message) &&
      (message.externalId === input.externalId || (message.conversationId === input.conversationId && message.externalId === input.externalId))
  );
  if (existing) return { saved: false, message: existing };

  const duplicate = state.messages.find((message) => scopeMatches(scope, message) && messageLooksLikeDuplicate(message, input));
  if (duplicate) return { saved: false, message: duplicate };

  const message: LeadKnowledgeMessage = {
    id: `leadmsg_${crypto.randomUUID()}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    ...input
  };
  state.messages.push(message);
  return { saved: true, message };
}

function recalculateConversation(state: LeadKnowledgeState, conversationId: string) {
  const conversation = state.conversations.find((candidate) => candidate.id === conversationId);
  if (!conversation) return;
  const messages = state.messages
    .filter((message) => message.conversationId === conversationId)
    .filter((message) => !message.hiddenAt)
    .sort((left, right) => left.sentAt.localeCompare(right.sentAt));
  const lastMessage = messages.at(-1);
  conversation.messageCount = messages.length;
  conversation.inboundCount = messages.filter((message) => message.direction === "inbound").length;
  conversation.outboundCount = messages.filter((message) => message.direction === "outbound").length;
  conversation.lastMessageAt = lastMessage?.sentAt;
  conversation.lastMessagePreview = lastMessage ? cleanPreview(lastMessage.body) : conversation.lastMessagePreview;
  conversation.updatedAt = nowIso();
}

function updateLeadFromConversation(state: LeadKnowledgeState, leadId: string, insight?: ExtensionConversationInsight) {
  const lead = state.leads.find((candidate) => candidate.id === leadId);
  if (!lead) return;
  ensureLeadCrmDefaults(lead);
  const conversations = state.conversations.filter((conversation) => conversation.leadId === leadId);
  const messages = state.messages
    .filter((message) => message.leadId === leadId)
    .filter((message) => !message.hiddenAt)
    .sort((left, right) => left.sentAt.localeCompare(right.sentAt));
  const lastMessage = messages.at(-1);
  const qualification = qualificationDecisionForLead({ lead, messages });
  lead.qualificationFields = qualification.fields;
  lead.crmStatus = qualification.crmStatus;
  lead.qualificationStage = qualification.qualificationStage;
  lead.summary = insight?.summary || lead.summary || (lastMessage ? `Latest message: ${cleanPreview(lastMessage.body)}` : undefined);
  lead.nextAction = insight?.nextAction || qualification.nextAction || nextActionForMessages(messages, lead.leadStatus);
  lead.facts = uniqueStrings([
    ...(insight?.qualification ? [insight.qualification] : []),
    ...(lead.facts ?? []),
    ...messages
      .slice(-6)
      .map((message) => cleanPreview(message.body))
      .filter(Boolean)
  ]).slice(0, 30);
  lead.updatedAt = conversations.map((conversation) => conversation.updatedAt).sort().at(-1) || nowIso();
}

function nextActionForMessages(messages: LeadKnowledgeMessage[], leadStatus: LeadKnowledgeStatus) {
  if (leadStatus === "excluded") return "Track only. No sales follow-up.";
  const latest = messages.at(-1);
  if (!latest) return "Log the next conversation update.";
  if (latest.direction === "inbound") return "Reply in Leadsy-approved channel and qualify intent.";
  if (latest.direction === "outbound") return "Wait for reply or log the next outcome.";
  return "Review the latest note and decide the next action.";
}

function textForWhatsAppMessage(message: Record<string, unknown>) {
  const text = asRecord(message.text);
  const button = asRecord(message.button);
  const interactive = asRecord(message.interactive);
  const image = asRecord(message.image);
  const document = asRecord(message.document);
  const video = asRecord(message.video);
  const audio = asRecord(message.audio);
  return (
    asString(text?.body) ||
    asString(button?.text) ||
    asString(asRecord(interactive?.button_reply)?.title) ||
    asString(asRecord(interactive?.list_reply)?.title) ||
    asString(image?.caption) ||
    asString(document?.caption) ||
    asString(video?.caption) ||
    (audio ? "Voice message" : undefined)
  );
}

function referralForWhatsApp(message: Record<string, unknown>) {
  const referral = asRecord(message.referral);
  if (!referral) return undefined;
  return {
    sourceType: asString(referral.source_type),
    sourceId: asString(referral.source_id),
    sourceUrl: asString(referral.source_url),
    headline: asString(referral.headline),
    body: asString(referral.body),
    ctwaClid: asString(referral.ctwa_clid)
  };
}

function crmMetaSource(normalized: MetaNormalizedMessage) {
  const raw = asRecord(normalized.raw);
  const referral = asRecord(raw?.referral);
  const referralSourceType = asString(referral?.sourceType);
  if (normalized.channel === "whatsapp" && referralSourceType === "ad") {
    return {
      leadSource: "Meta CTWA Ads",
      campaignId: asString(referral?.sourceId) || asString(referral?.ctwaClid)
    };
  }
  if (normalized.channel === "whatsapp") return { leadSource: "WhatsApp" };
  if (normalized.channel === "instagram") return { leadSource: "Instagram" };
  if (normalized.channel === "facebook") return { leadSource: "Facebook" };
  return {};
}

function contactForWhatsApp(contacts: unknown[], from?: string) {
  return (
    contacts.map(asRecord).find((contact) => {
      const waId = asString(contact?.wa_id);
      return waId && from && waId === from;
    }) ?? asRecord(contacts[0])
  );
}

function extractWhatsAppMessages(payload: unknown, receivedAt: string): MetaNormalizedMessage[] {
  const records: MetaNormalizedMessage[] = [];
  const root = asRecord(payload);
  const messageFields = new Set(["messages", "message_echoes", "smb_message_echoes"]);
  for (const entryValue of asArray(root?.entry)) {
    const entry = asRecord(entryValue);
    const whatsappBusinessAccountId = asString(entry?.id);
    for (const changeValue of asArray(entry?.changes)) {
      const change = asRecord(changeValue);
      const field = asString(change?.field);
      if (!field || !messageFields.has(field)) continue;
      const value = asRecord(change?.value);
      if (!value) continue;
      const metadata = asRecord(value.metadata);
      const contacts = asArray(value.contacts);
      for (const messageValue of asArray(value.messages)) {
        const message = asRecord(messageValue);
        const from = asString(message?.from);
        const recipientId = asString(message?.recipient_id) || asString(message?.to);
        const direction = field === "messages" ? "inbound" : "outbound";
        const contactId = direction === "outbound" ? recipientId || from : from;
        const externalId = asString(message?.id);
        if (!message || !contactId || !externalId) continue;
        const contact = contactForWhatsApp(contacts, contactId);
        const profile = asRecord(contact?.profile);
        const waId = asString(contact?.wa_id) || contactId;
        const body = textForWhatsAppMessage(message) || `${asString(message.type) ?? "unknown"} message`;
        const normalizedContact = cleanContact({
          displayName: asString(profile?.name),
          phone: contactId,
          waId
        });
        records.push({
          channel: "whatsapp",
          externalConversationKey: `meta:whatsapp:${contactId}`,
          sourceUrl: referralForWhatsApp(message)?.sourceUrl,
          contact: normalizedContact,
          identityKeys: uniqueStrings([phoneKey(contactId), phoneKey(waId)]),
          externalId,
          direction,
          body,
          messageType: asString(message.type) ?? "unknown",
          sentAt: timestampToIso(message.timestamp, receivedAt),
          receivedAt,
          raw: {
            whatsappBusinessAccountId,
            phoneNumberId: asString(metadata?.phone_number_id),
            displayPhoneNumber: asString(metadata?.display_phone_number),
            referral: referralForWhatsApp(message),
            message
          }
        });
      }
    }
  }
  return records;
}

function extractMessagingMessages(payload: unknown, receivedAt: string): MetaNormalizedMessage[] {
  const records: MetaNormalizedMessage[] = [];
  const root = asRecord(payload);
  const channel: Extract<LeadKnowledgeChannel, "instagram" | "facebook"> = asString(root?.object) === "instagram" ? "instagram" : "facebook";
  for (const entryValue of asArray(root?.entry)) {
    const entry = asRecord(entryValue);
    const pageOrAccountId = asString(entry?.id);
    for (const eventValue of asArray(entry?.messaging)) {
      const event = asRecord(eventValue);
      const message = asRecord(event?.message);
      const externalId = asString(message?.mid);
      if (!message || !externalId) continue;
      const sender = asRecord(event?.sender);
      const recipient = asRecord(event?.recipient);
      const isEcho = Boolean(message.is_echo);
      const contactId = isEcho ? asString(recipient?.id) : asString(sender?.id);
      if (!contactId) continue;
      const body =
        asString(message.text) ||
        asArray(message.attachments)
          .map(asRecord)
          .map((attachment) => asString(attachment?.type))
          .filter(Boolean)
          .join(", ") ||
        "Media message";
      records.push({
        channel,
        externalConversationKey: `meta:${channel}:${contactId}`,
        contact: {
          handle: contactId,
          profileUrl:
            channel === "instagram"
              ? `https://www.instagram.com/${contactId}`
              : `https://www.facebook.com/${contactId}`
        },
        identityKeys: uniqueStrings([handleKey(channel, contactId), profileKey(channel, contactId)]),
        externalId,
        direction: isEcho ? "outbound" : "inbound",
        body,
        messageType: "text",
        sentAt: timestampToIso(event?.timestamp, receivedAt),
        receivedAt,
        raw: {
          pageOrAccountId,
          event
        }
      });
    }
  }
  return records;
}

export function extractUnifiedMetaWebhookMessages(payload: unknown, receivedAt = nowIso()) {
  return [...extractWhatsAppMessages(payload, receivedAt), ...extractMessagingMessages(payload, receivedAt)];
}

export async function saveUnifiedMetaWebhookMessages(input: Scope & { payload: unknown; receivedAt?: string }) {
  const receivedAt = input.receivedAt ?? nowIso();
  const normalizedMessages = extractUnifiedMetaWebhookMessages(input.payload, receivedAt);
  if (!normalizedMessages.length) return { saved: [] as LeadKnowledgeMessage[], ignored: 0 };

  const state = await readState();
  const saved: LeadKnowledgeMessage[] = [];
  for (const normalized of normalizedMessages) {
    const crmSource = crmMetaSource(normalized);
    const lead = upsertLead(state, input, {
      identityKeys: normalized.identityKeys,
      contact: normalized.contact,
      facts: [normalized.body],
      nextAction: normalized.direction === "inbound" ? "Reply in Leadsy-approved channel and qualify intent." : undefined,
      ...crmSource
    });
    const conversation = upsertConversation(state, input, {
      leadId: lead.id,
      channel: normalized.channel,
      source: "meta-webhook",
      externalKey: normalized.externalConversationKey,
      sourceUrl: normalized.sourceUrl,
      contact: normalized.contact
    });
    const result = addMessage(state, input, {
      leadId: lead.id,
      conversationId: conversation.id,
      source: "meta-webhook",
      channel: normalized.channel,
      externalId: normalized.externalId,
      direction: normalized.direction,
      body: normalized.body,
      messageType: normalized.messageType,
      sentAt: normalized.sentAt,
      receivedAt: normalized.receivedAt,
      raw: normalized.raw
    });
    if (result.saved) saved.push(result.message);
    recalculateConversation(state, conversation.id);
    updateLeadFromConversation(state, lead.id);
  }
  if (saved.length) await writeState(state);
  return { saved, ignored: normalizedMessages.length - saved.length };
}

function channelForExtensionPlatform(platform: ExtensionPlatform): LeadKnowledgeChannel {
  return platform;
}

function channelLabelForSource(channel: LeadKnowledgeChannel) {
  if (channel === "whatsapp" || channel === "whatsapp-web") return "WhatsApp";
  if (channel === "instagram" || channel === "instagram-web") return "Instagram";
  if (channel === "facebook" || channel === "facebook-web") return "Facebook";
  if (channel === "generic-web-chat") return "Browser Chat";
  if (channel === "email") return "Email";
  if (channel === "call") return "Call Notes";
  return "Manual";
}

function extensionDirection(direction: ExtensionMessageDirection): LeadKnowledgeDirection {
  if (direction === "inbound") return "inbound";
  if (direction === "outbound") return "outbound";
  return "system";
}

function phoneFromTaskTargetUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.searchParams.get("phone") ?? undefined;
  } catch {
    return undefined;
  }
}

function profileUrlForExtensionTask(task: ExtensionTask, targetPhone?: string) {
  if (task.contact.profileUrl) return task.contact.profileUrl;
  if (task.platform === "whatsapp-web" && targetPhone) return undefined;
  return task.targetUrl;
}

function profileIdentityForExtensionTaskTarget(task: ExtensionTask, targetPhone?: string) {
  if (task.platform === "whatsapp-web" && targetPhone) return undefined;
  return profileKey(task.platform, task.targetUrl);
}

function extensionConversationTargetKey(input: {
  platform: ExtensionPlatform | string;
  chatFingerprint: string;
  sourceUrl?: string;
  contact?: LeadKnowledgeContact;
}) {
  const contact = cleanContact(input.contact);
  const phone = phoneKey(contact.phone) || phoneKey(phoneFromTaskTargetUrl(input.sourceUrl)) || phoneKey(phoneFromTaskTargetUrl(input.chatFingerprint));
  if (input.platform === "whatsapp-web" && phone) return phone;
  const email = emailKey(contact.email);
  if (email) return email;
  const handle = handleKey(input.platform, contact.handle);
  if (handle) return handle;
  const contactProfile = profileKey(input.platform, contact.profileUrl);
  if (contactProfile) return contactProfile;
  const displayName = displayNameKey(input.platform, contact.displayName);
  if (displayName) return displayName;
  const sourceProfile = profileKey(input.platform, input.sourceUrl);
  if (sourceProfile) return sourceProfile;
  return `fingerprint:${input.chatFingerprint}`;
}

function extensionConversationExternalKey(input: {
  platform: ExtensionPlatform | string;
  chatFingerprint: string;
  sourceUrl?: string;
  contact?: LeadKnowledgeContact;
}) {
  return `extension:${input.platform}:${extensionConversationTargetKey(input)}`;
}

function extensionConversationLegacyExternalKey(input: { platform: ExtensionPlatform | string; chatFingerprint: string }) {
  return `extension:${input.platform}:${input.chatFingerprint}`;
}

function migrateLegacyExtensionConversationKey(
  state: LeadKnowledgeState,
  scope: Scope,
  input: {
    platform: ExtensionPlatform | string;
    chatFingerprint: string;
    sourceUrl?: string;
    contact?: LeadKnowledgeContact;
  },
  externalKey: string
) {
  const legacyKey = extensionConversationLegacyExternalKey(input);
  const existing = state.conversations.find(
    (conversation) =>
      scopeMatches(scope, conversation) &&
      conversation.source === "extension" &&
      (conversation.externalKey === externalKey || conversation.externalKey === legacyKey)
  );
  if (existing) {
    existing.externalKey = externalKey;
  }
}

function nextActionForExtensionTask(task: ExtensionTask) {
  if (task.status === "sent" || task.status === "monitoring") return "Monitor for reply or log the next outcome.";
  if (task.status === "postponed") return task.postponedReason || "Task postponed. Review when it becomes due.";
  if (task.status === "blocked" || task.status === "failed") {
    return task.blockedReason || task.resultSummary || "Review the blocked worker task.";
  }
  if (task.status === "cancelled") return "Task cancelled. Keep the history for context.";
  return "Run or review the worker task from Leadsy.";
}

function bodyForExtensionTask(task: ExtensionTask) {
  return [
    `Worker task ${task.type.replace(/_/g, " ")} is ${task.status}.`,
    task.contextSummary,
    task.draftMessage ? `Draft: ${task.draftMessage}` : undefined,
    task.resultSummary ? `Result: ${task.resultSummary}` : undefined,
    task.blockedReason ? `Blocked: ${task.blockedReason}` : undefined,
    task.postponedReason ? `Postponed: ${task.postponedReason}` : undefined,
    task.targetUrl ? `Target: ${task.targetUrl}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
}

export async function syncLeadKnowledgeFromExtensionTasks(scope: Scope, tasks: ExtensionTask[]) {
  const state = await readState();
  const saved: LeadKnowledgeMessage[] = [];
  let changed = false;

  for (const task of tasks) {
    if (!scopeMatches(scope, task) || task.deletedAt) continue;

    const externalId = `extension-task:${task.id}:knowledge`;
    const targetPhone = phoneFromTaskTargetUrl(task.targetUrl);
    const contact = cleanContact({
      ...task.contact,
      phone: task.contact.phone || targetPhone,
      profileUrl: profileUrlForExtensionTask(task, targetPhone)
    });
    const channel = channelForExtensionPlatform(task.platform);
    const identityKeys = uniqueStrings([
      ...identityKeysForContact(task.platform, contact),
      phoneKey(targetPhone),
      profileIdentityForExtensionTaskTarget(task, targetPhone)
    ]);
    const lead = upsertLead(state, scope, {
      leadId: task.leadId,
      identityKeys,
      contact,
      summary: task.contextSummary || task.resultSummary,
      nextAction: nextActionForExtensionTask(task),
      facts: [task.contextSummary, task.resultSummary, task.blockedReason, task.postponedReason].filter(Boolean) as string[],
      leadSource: task.platform === "whatsapp-web" ? "WhatsApp Web" : task.platform.replace(/-/g, " ")
    });
    const conversationKey =
      task.conversationId ||
      task.targetUrl ||
      contact.phone ||
      contact.email ||
      contact.handle ||
      contact.profileUrl ||
      task.id;
    const externalKey = `extension-task:${task.platform}:${conversationKey}`;
    const previousConversation = state.conversations.find(
      (conversation) => scopeMatches(scope, conversation) && conversation.source === "extension" && conversation.externalKey === externalKey
    );
    const previousConversationLeadId = previousConversation?.leadId;
    const conversation = upsertConversation(state, scope, {
      leadId: lead.id,
      channel,
      source: "extension",
      externalKey,
      sourceUrl: task.targetUrl,
      contact,
      summary: task.contextSummary || task.resultSummary,
      nextAction: nextActionForExtensionTask(task)
    });
    if (previousConversationLeadId && previousConversationLeadId !== lead.id) {
      changed = true;
      updateLeadFromConversation(state, previousConversationLeadId);
    }
    const occurredAt = task.completedAt || task.updatedAt || task.createdAt || nowIso();
    const body = bodyForExtensionTask(task);
    const raw = {
      taskId: task.id,
      status: task.status,
      type: task.type,
      priority: task.priority
    };
    const existingMessage = state.messages.find((message) => scopeMatches(scope, message) && message.externalId === externalId);
    if (existingMessage) {
      const previousMessageLeadId = existingMessage.leadId;
      const previousMessageConversationId = existingMessage.conversationId;
      if (existingMessage.leadId !== lead.id) {
        existingMessage.leadId = lead.id;
        changed = true;
      }
      if (existingMessage.conversationId !== conversation.id) {
        existingMessage.conversationId = conversation.id;
        changed = true;
      }
      if (existingMessage.channel !== channel) {
        existingMessage.channel = channel;
        changed = true;
      }
      if (existingMessage.body !== body) {
        existingMessage.body = body;
        changed = true;
      }
      existingMessage.raw = raw;
      recalculateConversation(state, conversation.id);
      updateLeadFromConversation(state, lead.id);
      if (previousMessageConversationId !== conversation.id) recalculateConversation(state, previousMessageConversationId);
      if (previousMessageLeadId !== lead.id) updateLeadFromConversation(state, previousMessageLeadId);
    } else {
      const result = addMessage(state, scope, {
        leadId: lead.id,
        conversationId: conversation.id,
        source: "extension",
        channel,
        externalId,
        direction: "system",
        body,
        messageType: "worker-task",
        sentAt: occurredAt,
        receivedAt: occurredAt,
        raw
      });
      if (result.saved) {
        saved.push(result.message);
        recalculateConversation(state, conversation.id);
        updateLeadFromConversation(state, lead.id);
      }
    }
  }

  if (saved.length || changed) await writeState(state);
  return { saved };
}

export async function syncLeadsyExtensionConversation(input: Scope & {
  platform: ExtensionPlatform;
  sourceUrl: string;
  chatFingerprint: string;
  captureSource?: ExtensionCaptureSource;
  captureConfidence?: number;
  tabUrl?: string;
  observedAt?: string;
  profileId?: string;
  contact?: ExtensionConversationContact;
  messages?: Array<{
    externalId: string;
    direction: ExtensionMessageDirection;
    body: string;
    sentAt: string;
    generatedBy?: ExtensionMessageGeneratedBy;
  }>;
  events?: Array<{
    type: ExtensionConversationEvent["type"];
    summary: string;
    occurredAt: string;
  }>;
  insight?: ExtensionConversationInsight;
}) {
  const state = await readState();
  const contact = cleanContact(input.contact);
  const channel = channelForExtensionPlatform(input.platform);
  const identityKeys = extensionIdentityKeysForContact(input.platform, contact);
  const lead = upsertLead(state, input, {
    identityKeys,
    contact,
    summary: input.insight?.summary,
    nextAction: input.insight?.nextAction,
    facts: [input.insight?.qualification, input.insight?.summary].filter(Boolean) as string[],
    leadSource: input.platform === "whatsapp-web" ? "WhatsApp Web" : input.platform.replace(/-/g, " ")
  });
  const externalKey = extensionConversationExternalKey({
    platform: input.platform,
    chatFingerprint: input.chatFingerprint,
    sourceUrl: input.sourceUrl,
    contact
  });
  migrateLegacyExtensionConversationKey(state, input, {
    platform: input.platform,
    chatFingerprint: input.chatFingerprint,
    sourceUrl: input.sourceUrl,
    contact
  }, externalKey);
  const conversation = upsertConversation(state, input, {
    leadId: lead.id,
    channel,
    source: "extension",
    externalKey,
    sourceUrl: input.sourceUrl,
    contact,
    summary: input.insight?.summary,
    nextAction: input.insight?.nextAction,
    sentiment: input.insight?.sentiment
  });
  const saved: LeadKnowledgeMessage[] = [];
  for (const message of input.messages ?? []) {
    const result = addMessage(state, input, {
      leadId: lead.id,
      conversationId: conversation.id,
      source: "extension",
      channel,
      externalId: message.externalId,
      direction: extensionDirection(message.direction),
      body: message.body,
      messageType: "text",
      sentAt: message.sentAt,
      receivedAt: message.sentAt,
      generatedBy: message.generatedBy,
      raw: {
        captureSource: input.captureSource,
        captureConfidence: input.captureConfidence,
        tabUrl: input.tabUrl,
        observedAt: input.observedAt,
        profileId: input.profileId
      }
    });
    if (result.saved) saved.push(result.message);
  }
  lead.facts = uniqueStrings([
    ...(input.events ?? []).map((event) => event.summary),
    ...lead.facts
  ]).slice(0, 30);
  recalculateConversation(state, conversation.id);
  updateLeadFromConversation(state, lead.id, input.insight);
  await writeState(state);
  return {
    lead: recordForLead(state, input, lead.id),
    conversation,
    messages: state.messages.filter((message) => message.conversationId === conversation.id)
  };
}

export async function appendManualLeadMessage(input: Scope & {
  leadId?: string;
  contact?: LeadKnowledgeContact;
  channel?: LeadKnowledgeChannel;
  direction: Extract<LeadKnowledgeDirection, "inbound" | "outbound" | "note">;
  body: string;
  occurredAt?: string;
  sourceUrl?: string;
}) {
  const state = await readState();
  const occurredAt = input.occurredAt ?? nowIso();
  const contact = cleanContact(input.contact);
  const channel = input.channel ?? "manual";
  const lead = upsertLead(state, input, {
    leadId: input.leadId,
    identityKeys: identityKeysForContact(channel, contact),
    contact,
    facts: [input.body],
    leadSource: channel === "manual" ? "Manual" : channelLabelForSource(channel)
  });
  const conversation = upsertConversation(state, input, {
    leadId: lead.id,
    channel,
    source: "manual",
    externalKey: `manual:${lead.id}:${channel}`,
    sourceUrl: input.sourceUrl,
    contact
  });
  addMessage(state, input, {
    leadId: lead.id,
    conversationId: conversation.id,
    source: "manual",
    channel,
    externalId: `manual:${crypto.randomUUID()}`,
    direction: input.direction,
    body: input.body,
    messageType: "manual",
    sentAt: occurredAt,
    receivedAt: occurredAt,
    generatedBy: "manual"
  });
  recalculateConversation(state, conversation.id);
  updateLeadFromConversation(state, lead.id);
  await writeState(state);
  return recordForLead(state, input, lead.id);
}

function recordForLead(state: LeadKnowledgeState, scope: Scope, leadId: string): LeadKnowledgeRecord {
  const lead = findLeadById(state, scope, leadId);
  if (!lead) {
    throw new Error("Lead knowledge record was not found.");
  }
  ensureLeadCrmDefaults(lead);
  const conversations = state.conversations
    .filter((conversation) => conversation.leadId === lead.id && scopeMatches(scope, conversation))
    .sort((left, right) => (right.lastMessageAt ?? right.updatedAt).localeCompare(left.lastMessageAt ?? left.updatedAt));
  const messages = state.messages
    .filter((message) => message.leadId === lead.id && scopeMatches(scope, message))
    .filter((message) => !message.hiddenAt)
    .sort((left, right) => left.sentAt.localeCompare(right.sentAt));
  const lastMessage = messages.at(-1);
  return {
    ...lead,
    channels: uniqueStrings(conversations.map((conversation) => conversation.channel)) as LeadKnowledgeChannel[],
    conversations,
    messages,
    messageCount: messages.length,
    inboundCount: messages.filter((message) => message.direction === "inbound").length,
    outboundCount: messages.filter((message) => message.direction === "outbound").length,
    lastMessageAt: lastMessage?.sentAt,
    lastMessagePreview: lastMessage ? cleanPreview(lastMessage.body) : undefined
  };
}

export async function listLeadKnowledgeRecords(scope: Scope) {
  const state = await readState();
  return state.leads
    .filter((lead) => scopeMatches(scope, lead) && !lead.deletedAt)
    .map((lead) => recordForLead(state, scope, lead.id))
    .sort((left, right) => (right.lastMessageAt ?? right.updatedAt).localeCompare(left.lastMessageAt ?? left.updatedAt));
}

export async function summarizeLeadKnowledgeHealth() {
  const state = await readState();
  const records = state.leads
    .filter((lead) => !lead.deletedAt)
    .map((lead) => recordForLead(state, { tenantId: lead.tenantId, ownerId: lead.ownerId }, lead.id));
  const needsReply = records.filter((lead) => lead.leadStatus === "lead" && lead.messages.at(-1)?.direction === "inbound").length;
  const statusPipeline = {
    new_lead: records.filter((lead) => lead.crmStatus === "new_lead").length,
    interested: records.filter((lead) => lead.crmStatus === "interested").length,
    needs_reply: records.filter((lead) => lead.crmStatus === "needs_reply").length,
    human_review: records.filter((lead) => lead.crmStatus === "human_review").length
  };
  const assigneeWorkload = records.reduce<Record<string, number>>((totals, lead) => {
    const assignee = lead.assigneeName || "Unassigned";
    totals[assignee] = (totals[assignee] ?? 0) + 1;
    return totals;
  }, {});
  return {
    records: records.length,
    activeLeads: records.filter((lead) => lead.leadStatus === "lead").length,
    excludedLeads: records.filter((lead) => lead.leadStatus === "excluded").length,
    needsReply,
    interestedLeads: statusPipeline.interested,
    humanReviewLeads: statusPipeline.human_review,
    statusPipeline,
    assigneeWorkload,
    conversations: records.reduce((total, lead) => total + lead.conversations.length, 0),
    messages: records.reduce((total, lead) => total + lead.messages.length, 0),
    metaSourced: records.filter((lead) => lead.channels.some((channel) => channel === "whatsapp" || channel === "instagram" || channel === "facebook")).length,
    extensionSourced: records.filter((lead) => lead.channels.some((channel) => channel.endsWith("-web") || channel === "generic-web-chat")).length,
    manualSourced: records.filter((lead) => lead.channels.includes("manual") || lead.channels.includes("email") || lead.channels.includes("call")).length
  };
}

function normalizedKeepTerm(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function recordTextMatches(value: unknown, keepTerms: string[]) {
  if (!keepTerms.length) return false;
  const text = JSON.stringify(value ?? "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return keepTerms.some((term) => text.includes(term));
}

export async function pruneLeadKnowledgeToTargets(input: Scope & {
  keepTerms: string[];
  tenantWide?: boolean;
  dryRun?: boolean;
}) {
  const state = await readState();
  const keepTerms = input.keepTerms.map(normalizedKeepTerm).filter(Boolean);
  if (!keepTerms.length) throw new Error("At least one keep term is required.");
  const inScope = (item: Scope) => item.tenantId === input.tenantId && (input.tenantWide || item.ownerId === input.ownerId);

  const keptLeadIds = new Set<string>();
  const keptConversationIds = new Set<string>();

  for (const lead of state.leads) {
    if (inScope(lead) && recordTextMatches(lead, keepTerms)) {
      keptLeadIds.add(lead.id);
    }
  }
  for (const conversation of state.conversations) {
    if (inScope(conversation) && recordTextMatches(conversation, keepTerms)) {
      keptConversationIds.add(conversation.id);
      keptLeadIds.add(conversation.leadId);
    }
  }
  for (const message of state.messages) {
    if (inScope(message) && recordTextMatches(message, keepTerms)) {
      keptLeadIds.add(message.leadId);
      keptConversationIds.add(message.conversationId);
    }
  }

  const nextLeads = state.leads.filter((lead) => !inScope(lead) || keptLeadIds.has(lead.id));
  const nextConversations = state.conversations.filter(
    (conversation) => !inScope(conversation) || keptLeadIds.has(conversation.leadId) || keptConversationIds.has(conversation.id)
  );
  const nextConversationIds = new Set(nextConversations.map((conversation) => conversation.id));
  const nextLeadIds = new Set(nextLeads.map((lead) => lead.id));
  const nextMessages = state.messages.filter(
    (message) => !inScope(message) || nextLeadIds.has(message.leadId) || nextConversationIds.has(message.conversationId)
  );

  const result = {
    dryRun: Boolean(input.dryRun),
    kept: {
      leads: nextLeads.filter(inScope).length,
      conversations: nextConversations.filter(inScope).length,
      messages: nextMessages.filter(inScope).length
    },
    removed: {
      leads: state.leads.length - nextLeads.length,
      conversations: state.conversations.length - nextConversations.length,
      messages: state.messages.length - nextMessages.length
    }
  };

  if (!input.dryRun && (result.removed.leads || result.removed.conversations || result.removed.messages)) {
    await writeState({ leads: nextLeads, conversations: nextConversations, messages: nextMessages });
  }

  return result;
}

export async function editLeadKnowledgeRecord(input: Scope & {
  leadId: string;
  contact?: LeadKnowledgeContact;
  summary?: string;
  nextAction?: string;
  facts?: string[];
  crmStatus?: LeadCrmStatus;
  leadSource?: string;
  campaignId?: string;
  assigneeId?: string;
  assigneeName?: string;
  qualificationFields?: LeadQualificationFields;
  qualificationStage?: LeadQualificationStage;
}) {
  const state = await readState();
  const lead = findLeadById(state, input, input.leadId);
  if (!lead) throw new Error("Lead knowledge record was not found.");
  ensureLeadCrmDefaults(lead);
  const contact = cleanContact(input.contact);
  lead.contact = mergeContacts(contact, lead.contact);
  lead.identityKeys = uniqueStrings([
    ...lead.identityKeys,
    ...identityKeysForContact("generic", contact),
    ...state.conversations
      .filter((conversation) => conversation.leadId === lead.id && scopeMatches(input, conversation))
      .flatMap((conversation) => identityKeysForContact(conversation.channel, contact))
  ]);
  lead.summary = input.summary?.trim() || undefined;
  lead.nextAction = input.nextAction?.trim() || undefined;
  lead.facts = uniqueStrings(input.facts ?? []).slice(0, 30);
  lead.leadSource = input.leadSource?.trim() || lead.leadSource;
  lead.campaignId = input.campaignId?.trim() || lead.campaignId;
  const defaultAssignee = defaultAssigneeForLeadSource(lead.leadSource);
  lead.assigneeId = input.assigneeId?.trim() || lead.assigneeId || defaultAssignee.assigneeId;
  lead.assigneeName = input.assigneeName?.trim() || lead.assigneeName || defaultAssignee.assigneeName;
  lead.qualificationFields = inferQualificationFields({
    contact: lead.contact,
    existing: { ...lead.qualificationFields, ...(input.qualificationFields ?? {}) },
    facts: lead.facts,
    messages: state.messages
      .filter((message) => message.leadId === lead.id && scopeMatches(input, message))
      .filter((message) => !message.hiddenAt)
      .sort((left, right) => left.sentAt.localeCompare(right.sentAt))
  });
  const qualification = qualificationDecisionForLead({
    lead,
    messages: state.messages
      .filter((message) => message.leadId === lead.id && scopeMatches(input, message))
      .filter((message) => !message.hiddenAt)
      .sort((left, right) => left.sentAt.localeCompare(right.sentAt))
  });
  lead.crmStatus = input.crmStatus ?? qualification.crmStatus;
  lead.qualificationStage = input.qualificationStage ?? qualification.qualificationStage;
  lead.nextAction = input.nextAction?.trim() || qualification.nextAction;
  lead.updatedAt = nowIso();
  await writeState(state);
  return recordForLead(state, input, lead.id);
}

export async function archiveLeadKnowledgeRecord(input: Scope & { leadId: string }) {
  const state = await readState();
  const lead = findLeadById(state, input, input.leadId);
  if (!lead) throw new Error("Lead knowledge record was not found.");
  lead.deletedAt = nowIso();
  lead.updatedAt = lead.deletedAt;
  await writeState(state);
  return { ...lead };
}

export async function setLeadMessageHiddenStatus(input: Scope & {
  messageId: string;
  hidden: boolean;
}) {
  const state = await readState();
  const message = state.messages.find((candidate) => candidate.id === input.messageId && scopeMatches(input, candidate));
  if (!message) throw new Error("Lead message was not found.");
  message.hiddenAt = input.hidden ? nowIso() : undefined;
  const conversation = state.conversations.find((candidate) => candidate.id === message.conversationId && scopeMatches(input, candidate));
  if (conversation) {
    recalculateConversation(state, conversation.id);
    updateLeadFromConversation(state, conversation.leadId);
  }
  await writeState(state);
  return message;
}

export async function setLeadKnowledgeStatus(input: Scope & { leadId: string; leadStatus: LeadKnowledgeStatus }) {
  const state = await readState();
  const lead = findLeadById(state, input, input.leadId);
  if (!lead) throw new Error("Lead knowledge record was not found.");
  lead.leadStatus = input.leadStatus;
  lead.excludedAt = input.leadStatus === "excluded" ? nowIso() : undefined;
  lead.nextAction = nextActionForMessages(
    state.messages.filter((message) => message.leadId === lead.id).sort((left, right) => left.sentAt.localeCompare(right.sentAt)),
    lead.leadStatus
  );
  lead.updatedAt = nowIso();
  await writeState(state);
  return recordForLead(state, input, lead.id);
}

export async function setLeadConversationKnowledgeStatus(input: Scope & {
  conversationId: string;
  knowledgeStatus: LeadConversationKnowledgeStatus;
}) {
  const state = await readState();
  const conversation = state.conversations.find(
    (candidate) => candidate.id === input.conversationId && scopeMatches(input, candidate)
  );
  if (!conversation) throw new Error("Lead conversation was not found.");
  conversation.knowledgeStatus = input.knowledgeStatus;
  conversation.excludedAt = input.knowledgeStatus === "excluded" ? nowIso() : undefined;
  conversation.updatedAt = nowIso();
  await writeState(state);
  return conversation;
}

function leadMatchForContext(state: LeadKnowledgeState, scope: Scope, input: {
  platform?: string;
  chatFingerprint?: string;
  contact?: LeadKnowledgeContact;
}) {
  if (input.platform && input.chatFingerprint) {
    const externalKeys = new Set([
      extensionConversationExternalKey({
        platform: input.platform,
        chatFingerprint: input.chatFingerprint,
        contact: input.contact
      }),
      extensionConversationLegacyExternalKey({
        platform: input.platform,
        chatFingerprint: input.chatFingerprint
      })
    ]);
    const conversation = state.conversations.find(
      (candidate) =>
        scopeMatches(scope, candidate) &&
        candidate.source === "extension" &&
        externalKeys.has(candidate.externalKey)
    );
    if (conversation) return findLeadById(state, scope, conversation.leadId);
  }
  const contact = cleanContact(input.contact);
  const keys = identityKeysForContact(input.platform ?? "generic", contact);
  return findLeadByIdentity(state, scope, keys);
}

export async function buildLeadKnowledgeContext(input: Scope & {
  platform?: string;
  chatFingerprint?: string;
  contact?: LeadKnowledgeContact;
}) {
  const state = await readState();
  const lead = leadMatchForContext(state, input, input);
  const record = lead ? recordForLead(state, input, lead.id) : undefined;
  const includedConversations = record
    ? record.conversations.filter((conversation) => conversation.knowledgeStatus === "included")
    : [];
  const includedConversationIds = new Set(includedConversations.map((conversation) => conversation.id));
  const messages =
    record?.leadStatus === "excluded"
      ? []
      : (record?.messages ?? [])
          .filter((message) => includedConversationIds.has(message.conversationId))
          .filter((message) => message.direction !== "system")
          .slice(-40);
  const facts = record?.leadStatus === "excluded" ? [] : record?.facts ?? [];
  return {
    lead: record,
    conversations: includedConversations,
    messages,
    facts,
    businessPrompt:
      "Use Leadsy's unified knowledge base. Answer from the recorded conversation history and ask one concise qualification question when needed.",
    supportNotes: [
      record?.summary ? `Lead summary: ${record.summary}` : "No lead summary yet.",
      record?.nextAction ? `Next action: ${record.nextAction}` : "No next action yet.",
      `Included conversations: ${includedConversations.length}`
    ],
    leadQualificationHints: [
      "Use recent inbound messages before older notes.",
      "Do not use excluded conversations or excluded leads as AI context.",
      "Keep replies short and move toward a clear next action."
    ]
  } satisfies LeadKnowledgeContext;
}
