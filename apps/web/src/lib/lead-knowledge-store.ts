import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getDemoSession } from "@leadsy/security";
import { leadsyDataDir } from "./data-dir";
import { conversationMessages, internalNotes, latestConversationMessage } from "./conversation-contract";
import { ensureDefaultQualificationAgent } from "./teamspace-store";
export { conversationMessages, internalNotes, systemEvents } from "./conversation-contract";

const knowledgeFile = join(leadsyDataDir, "lead-knowledge.json");

export type LeadKnowledgeChannel =
  | "whatsapp"
  | "email"
  | "call"
  | "manual";
export type LeadKnowledgeSource = "twilio" | "twilio_simulator" | "manual";
export type LeadKnowledgeDirection = "inbound" | "outbound" | "system" | "note";
export type LeadKnowledgeStatus = "lead" | "excluded";
export type LeadConversationKnowledgeStatus = "included" | "excluded";
export type LeadCrmStatus = "new_lead" | "interested" | "needs_reply" | "human_review";
export type LeadQualificationStage = "new" | "collecting" | "qualified" | "human_review";
export type LeadProductPipelineStatus = "new" | "qualified" | "interested" | "contacted" | "won" | "lost";
export type LeadQualificationFieldKey =
  | "name"
  | "phone"
  | "company"
  | "need"
  | "teamOrQueryVolume"
  | "budget"
  | "timeline"
  | "authority"
  | "location"
  | "serviceInterest"
  | "intent"
  | "risk"
  | "recommendedAction";
export type LeadQualificationFields = Partial<Record<LeadQualificationFieldKey, string>>;

export const leadProductPipelineStatuses: ReadonlyArray<{ id: LeadProductPipelineStatus; label: string }> = [
  { id: "new", label: "New" },
  { id: "qualified", label: "Qualified" },
  { id: "interested", label: "Interested" },
  { id: "contacted", label: "Contacted" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" }
];

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
  productPipelineStatus?: LeadProductPipelineStatus;
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
  sentiment?: "positive" | "neutral" | "negative" | "unknown";
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
  providerMessageSid?: string;
  direction: LeadKnowledgeDirection;
  body: string;
  messageType: string;
  sentAt: string;
  receivedAt: string;
  generatedBy?: "leadsy" | "manual" | "ai_agent";
  deliveryStatus?: string;
  statusUpdatedAt?: string;
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

function emptyState(): LeadKnowledgeState {
  return { leads: [], conversations: [], messages: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function cleanPreview(body: string) {
  return body.trim().replace(/\s+/g, " ").slice(0, 180);
}

function normalizedMessageBody(body: string) {
  return body.trim().replace(/\s+/g, " ").toLowerCase();
}

const qualificationFieldOrder: LeadQualificationFieldKey[] = ["name", "phone", "company", "need", "teamOrQueryVolume", "budget", "timeline", "authority", "location", "serviceInterest"];
const qualificationQuestions: Partial<Record<LeadQualificationFieldKey, string>> = {
  name: "Ask for the buyer's name before continuing qualification.",
  phone: "Confirm the preferred phone number for follow-up.",
  company: "Ask for the business or company name.",
  need: "Ask what they want to achieve with Leadsy or WhatsApp automation.",
  teamOrQueryVolume: "Ask how many queries, leads, or messages they handle each day.",
  budget: "Ask for budget range if the conversation is warm enough.",
  timeline: "Ask when they want to start or book the next conversation.",
  authority: "Ask whether they are the decision maker or who else must approve.",
  location: "Ask which location or market this lead is buying for.",
  serviceInterest: "Ask which service or package they are evaluating."
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

export function productPipelineStatusFromValue(value: unknown): LeadProductPipelineStatus | undefined {
  const clean = typeof value === "string" ? value.trim().toLowerCase() : "";
  return leadProductPipelineStatuses.some((status) => status.id === clean) ? (clean as LeadProductPipelineStatus) : undefined;
}

export function productPipelineStatusLabel(status: LeadProductPipelineStatus) {
  return leadProductPipelineStatuses.find((candidate) => candidate.id === status)?.label ?? "New";
}

export function productPipelineStatusForLead(lead: {
  productPipelineStatus?: unknown;
  crmStatus?: LeadCrmStatus;
  qualificationStage?: LeadQualificationStage;
  outboundCount?: number;
  messages?: Array<{ direction?: LeadKnowledgeDirection }>;
}) {
  const explicitStatus = productPipelineStatusFromValue(lead.productPipelineStatus);
  if (explicitStatus) return explicitStatus;
  if (lead.qualificationStage === "qualified") return "qualified";
  if (lead.crmStatus === "interested") return "interested";
  if (lead.crmStatus === "needs_reply" || lead.crmStatus === "human_review") return "contacted";
  if ((lead.outboundCount ?? 0) > 0 || lead.messages?.some((message) => message.direction === "outbound")) return "contacted";
  return "new";
}

function ensureLeadCrmDefaults(lead: LeadKnowledgeLead) {
  lead.crmStatus = lead.crmStatus ?? "new_lead";
  lead.qualificationFields = lead.qualificationFields ?? {};
  lead.qualificationStage = lead.qualificationStage ?? "new";
  lead.productPipelineStatus = productPipelineStatusFromValue(lead.productPipelineStatus);
  return lead;
}

function channelFamily(channel: LeadKnowledgeChannel) {
  return channel;
}

function channelLabelForSource(channel: LeadKnowledgeChannel) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "Email";
  if (channel === "call") return "Call";
  return "Manual";
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
    tenantId: demo.tenantId,
    ownerId: demo.id
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

function hasAssignedOwner(lead: Pick<LeadKnowledgeLead, "assigneeId" | "assigneeName">) {
  const assigneeName = lead.assigneeName?.trim().toLowerCase();
  return Boolean(lead.assigneeId?.trim() || (assigneeName && assigneeName !== "unassigned"));
}

async function backfillUnassignedLeadsToDefaultQualificationAgent(scope?: Scope) {
  const state = await readState();
  const agents = new Map<string, { id: string; name: string }>();
  const now = nowIso();
  let changed = false;

  for (const lead of state.leads) {
    if (lead.deletedAt || hasAssignedOwner(lead)) continue;
    if (scope && !scopeMatches(scope, lead)) continue;

    const key = `${lead.tenantId}:${lead.ownerId}`;
    let agent = agents.get(key);
    if (!agent) {
      agent = await ensureDefaultQualificationAgent({
        tenantId: lead.tenantId,
        ownerId: lead.ownerId
      });
      agents.set(key, agent);
    }

    lead.assigneeId = agent.id;
    lead.assigneeName = agent.name;
    lead.updatedAt = now;
    changed = true;
  }

  if (changed) {
    await writeState(state);
  }
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
  fields.timeline = fields.timeline || valueAfterLabel(text, ["Timeline", "Start date"]) || firstMatch(text, [/\b(this week|next week|tomorrow|today|next month|as soon as possible|\d+\s*days?)\b/i]);
  fields.authority =
    fields.authority ||
    valueAfterLabel(text, ["Authority", "Decision maker", "Approver"]) ||
    firstMatch(text, [/\b(i am (?:the )?(?:owner|founder|decision maker|approver))\b/i, /\b((?:owner|founder|manager|director)\s+will\s+approve)\b/i]);
  fields.location = fields.location || valueAfterLabel(text, ["Location", "City", "Market"]) || firstMatch(text, [/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s|$|[.,!?])/]);
  fields.serviceInterest = fields.serviceInterest || valueAfterLabel(text, ["Service Interest", "Service", "Package", "Plan"]) || fields.need;
  fields.intent =
    fields.intent ||
    valueAfterLabel(text, ["Intent", "Intent level"]) ||
    (fields.budget && fields.timeline && fields.authority ? "Very High Intent" : fields.need && (fields.budget || fields.timeline) ? "High Intent" : fields.need ? "Medium Intent" : undefined);
  fields.risk =
    fields.risk ||
    valueAfterLabel(text, ["Risk", "Concern", "Objection"]) ||
    firstMatch(text, [/\b(price is high|too expensive|not sure|need to compare|competitor|refund|complaint|legal)\b/i]);

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value?.trim())) as LeadQualificationFields;
}

function nextMissingQualificationField(fields: LeadQualificationFields) {
  return qualificationFieldOrder.find((field) => !fields[field]);
}

function defaultAssigneeForLeadSource(): { assigneeId?: string; assigneeName?: string } {
  return {};
}

async function defaultQualificationAssignee(scope: Scope) {
  const agent = await ensureDefaultQualificationAgent(scope);
  return { assigneeId: agent.id, assigneeName: agent.name };
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
      nextAction: missing ? qualificationQuestions[missing] ?? "Reply and continue qualifying this lead." : "Reply and continue qualifying this lead."
    };
  }

  return {
    fields,
    crmStatus: "new_lead" as const,
    qualificationStage: Object.keys(fields).length ? ("collecting" as const) : ("new" as const),
    nextAction: missing ? qualificationQuestions[missing] ?? "Review this lead and choose the next action." : "Review this lead and choose the next action."
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
  productPipelineStatus?: LeadProductPipelineStatus;
  qualificationFields?: LeadQualificationFields;
  qualificationStage?: LeadQualificationStage;
}) {
  const now = nowIso();
  const contact = cleanContact(input.contact);
  const identityKeys = uniqueStrings([...input.identityKeys, ...identityKeysForContact("generic", contact)]);
  const existing = input.leadId ? findLeadById(state, scope, input.leadId) : findLeadByIdentity(state, scope, identityKeys);

  if (existing) {
    ensureLeadCrmDefaults(existing);
    const defaultAssignee = defaultAssigneeForLeadSource();
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
    existing.productPipelineStatus = input.productPipelineStatus || existing.productPipelineStatus;
    existing.qualificationFields = { ...existing.qualificationFields, ...(input.qualificationFields ?? {}) };
    existing.qualificationStage = input.qualificationStage || existing.qualificationStage;
    existing.updatedAt = now;
    return existing;
  }

  const defaultAssignee = defaultAssigneeForLeadSource();
  const lead: LeadKnowledgeLead = {
    id: input.leadId || `leadkb_${crypto.randomUUID()}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    identityKeys,
    contact,
    leadStatus: "lead",
    ...leadCrmDefaults(),
    crmStatus: input.crmStatus ?? "new_lead",
    productPipelineStatus: input.productPipelineStatus,
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
  sentiment?: LeadKnowledgeConversation["sentiment"];
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
  const messages = conversationMessages(state.messages.filter((message) => message.conversationId === conversationId));
  const lastMessage = latestConversationMessage(messages);
  conversation.messageCount = messages.length;
  conversation.inboundCount = messages.filter((message) => message.direction === "inbound").length;
  conversation.outboundCount = messages.filter((message) => message.direction === "outbound").length;
  conversation.lastMessageAt = lastMessage?.sentAt;
  conversation.lastMessagePreview = lastMessage ? cleanPreview(lastMessage.body) : conversation.lastMessagePreview;
  conversation.updatedAt = nowIso();
}

function updateLeadFromConversation(state: LeadKnowledgeState, leadId: string, insight?: { summary?: string; nextAction?: string; qualification?: string }) {
  const lead = state.leads.find((candidate) => candidate.id === leadId);
  if (!lead) return;
  ensureLeadCrmDefaults(lead);
  const conversations = state.conversations.filter((conversation) => conversation.leadId === leadId);
  const messages = conversationMessages(state.messages.filter((message) => message.leadId === leadId));
  const lastMessage = latestConversationMessage(messages);
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

export async function appendManualLeadMessage(input: Scope & {
  leadId?: string;
  contact?: LeadKnowledgeContact;
  channel?: LeadKnowledgeChannel;
  direction: Extract<LeadKnowledgeDirection, "inbound" | "outbound" | "note">;
  body: string;
  occurredAt?: string;
  sourceUrl?: string;
}) {
  const defaultAssignee = await defaultQualificationAssignee(input);
  const state = await readState();
  const occurredAt = input.occurredAt ?? nowIso();
  const contact = cleanContact(input.contact);
  const channel = input.channel ?? "manual";
  const lead = upsertLead(state, input, {
    leadId: input.leadId,
    identityKeys: identityKeysForContact(channel, contact),
    contact,
    facts: [input.body],
    leadSource: channel === "manual" ? "Manual" : channelLabelForSource(channel),
    assigneeId: defaultAssignee.assigneeId,
    assigneeName: defaultAssignee.assigneeName
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

export async function saveTwilioInboundMessage(input: Scope & {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  source?: Extract<LeadKnowledgeSource, "twilio" | "twilio_simulator">;
  leadSource?: string;
  profileName?: string;
  waId?: string;
  sentAt?: string;
  receivedAt?: string;
  deliveryStatus?: string;
  raw?: unknown;
}) {
  const defaultAssignee = await defaultQualificationAssignee(input);
  const state = await readState();
  const receivedAt = input.receivedAt ?? nowIso();
  const sentAt = input.sentAt ?? receivedAt;
  const source = input.source ?? "twilio";
  const phone = input.waId || input.from.replace(/^whatsapp:/i, "");
  const contact = cleanContact({
    displayName: input.profileName,
    phone,
    waId: input.waId
  });
  const lead = upsertLead(state, input, {
    identityKeys: identityKeysForContact("whatsapp", contact),
    contact,
    facts: [input.body],
    nextAction: "Reply in Leadsy-approved channel and qualify intent.",
    leadSource: input.leadSource ?? (source === "twilio_simulator" ? "Twilio Simulator" : "Twilio WhatsApp"),
    assigneeId: defaultAssignee.assigneeId,
    assigneeName: defaultAssignee.assigneeName
  });
  const conversation = upsertConversation(state, input, {
    leadId: lead.id,
    channel: "whatsapp",
    source,
    externalKey: phoneKey(contact.phone) || input.from,
    contact
  });
  const result = addMessage(state, input, {
    leadId: lead.id,
    conversationId: conversation.id,
    source,
    channel: "whatsapp",
    externalId: input.messageSid,
    providerMessageSid: input.messageSid,
    direction: "inbound",
    body: input.body,
    messageType: "text",
    sentAt,
    receivedAt,
    deliveryStatus: input.deliveryStatus ?? "received",
    statusUpdatedAt: receivedAt,
    raw: input.raw
  });
  recalculateConversation(state, conversation.id);
  updateLeadFromConversation(state, lead.id);
  if (result.saved) await writeState(state);
  return {
    saved: result.saved ? [result.message] : [],
    ignored: result.saved ? 0 : 1,
    lead: recordForLead(state, input, lead.id),
    conversation
  };
}

export async function appendTwilioOutboundMessage(input: Scope & {
  messageSid: string;
  to: string;
  from: string;
  body?: string;
  source?: Extract<LeadKnowledgeSource, "twilio" | "twilio_simulator">;
  leadSource?: string;
  leadId?: string;
  contact?: LeadKnowledgeContact;
  sentAt?: string;
  receivedAt?: string;
  deliveryStatus?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  raw?: unknown;
}) {
  const defaultAssignee = await defaultQualificationAssignee(input);
  const state = await readState();
  const receivedAt = input.receivedAt ?? nowIso();
  const sentAt = input.sentAt ?? receivedAt;
  const source = input.source ?? "twilio";
  const phone = input.to.replace(/^whatsapp:/i, "");
  const contact = cleanContact({ ...input.contact, phone: input.contact?.phone || phone });
  const messageBody = input.body?.trim() || (input.contentSid ? `Twilio template ${input.contentSid}` : "Twilio WhatsApp message");
  const lead = upsertLead(state, input, {
    leadId: input.leadId,
    identityKeys: identityKeysForContact("whatsapp", contact),
    contact,
    leadSource: input.leadSource ?? (source === "twilio_simulator" ? "Twilio Simulator" : "Twilio WhatsApp"),
    assigneeId: defaultAssignee.assigneeId,
    assigneeName: defaultAssignee.assigneeName
  });
  const conversation = upsertConversation(state, input, {
    leadId: lead.id,
    channel: "whatsapp",
    source,
    externalKey: phoneKey(contact.phone) || input.to,
    contact
  });
  const result = addMessage(state, input, {
    leadId: lead.id,
    conversationId: conversation.id,
    source,
    channel: "whatsapp",
    externalId: input.messageSid,
    providerMessageSid: input.messageSid,
    direction: "outbound",
    body: messageBody,
    messageType: input.contentSid ? "template" : "text",
    sentAt,
    receivedAt,
    deliveryStatus: input.deliveryStatus ?? "queued",
    statusUpdatedAt: receivedAt,
    raw: {
      contentSid: input.contentSid,
      contentVariables: input.contentVariables,
      twilio: input.raw
    }
  });
  recalculateConversation(state, conversation.id);
  updateLeadFromConversation(state, lead.id);
  if (result.saved) await writeState(state);
  return {
    message: result.message,
    saved: result.saved,
    lead: recordForLead(state, input, lead.id),
    conversation
  };
}

export async function updateTwilioMessageDeliveryStatus(input: {
  messageSid: string;
  deliveryStatus: string;
  statusUpdatedAt?: string;
  raw?: unknown;
}) {
  const state = await readState();
  const message = state.messages.find(
    (candidate) =>
      candidate.source === "twilio" &&
      (candidate.providerMessageSid === input.messageSid || candidate.externalId === input.messageSid)
  );
  if (!message) return { updated: false, message: undefined as LeadKnowledgeMessage | undefined };

  message.deliveryStatus = input.deliveryStatus;
  message.statusUpdatedAt = input.statusUpdatedAt ?? nowIso();
  message.raw = {
    ...(message.raw && typeof message.raw === "object" && !Array.isArray(message.raw) ? (message.raw as Record<string, unknown>) : {}),
    deliveryCallback: input.raw
  };
  await writeState(state);
  return { updated: true, message };
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
  const messages = [
    ...conversationMessages(state.messages.filter((message) => message.leadId === lead.id && scopeMatches(scope, message))),
    ...internalNotes(state.messages.filter((message) => message.leadId === lead.id && scopeMatches(scope, message)))
  ].sort((left, right) => left.sentAt.localeCompare(right.sentAt) || left.id.localeCompare(right.id));
  const lastMessage = latestConversationMessage(messages);
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
  await backfillUnassignedLeadsToDefaultQualificationAgent(scope);
  const state = await readState();
  return state.leads
    .filter((lead) => scopeMatches(scope, lead) && !lead.deletedAt)
    .map((lead) => recordForLead(state, scope, lead.id))
    .sort((left, right) => (right.lastMessageAt ?? right.updatedAt).localeCompare(left.lastMessageAt ?? left.updatedAt));
}

export type QualificationInputAuditRow = {
  field: Extract<LeadQualificationFieldKey, "need" | "budget" | "timeline" | "authority" | "location" | "company" | "serviceInterest" | "intent">;
  value: string;
  state: "Collected" | "Missing" | "Uncertain";
  sourceMessage?: string;
  messageId?: string;
  confidence: "high" | "medium" | "low" | "none";
  extractionMethod: "deterministic-label" | "deterministic-pattern" | "derived-from-conversation" | "not-traced";
  valid: boolean;
};

const qualificationAuditFields: QualificationInputAuditRow["field"][] = ["need", "budget", "timeline", "authority", "location", "company", "serviceInterest", "intent"];

function normalizedTraceText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function messageSupportsField(field: QualificationInputAuditRow["field"], value: string, message: LeadKnowledgeMessage) {
  const body = normalizedTraceText(message.body);
  const cleanValue = normalizedTraceText(value);
  if (cleanValue && body.includes(cleanValue)) return true;
  if (field === "intent") {
    return /\b(need|want|looking for|interested|budget|timeline|owner|decision maker|today|tomorrow|week|month|days?)\b/i.test(message.body);
  }
  if (field === "serviceInterest") {
    return Boolean(cleanValue && body.includes(cleanValue)) || /\b(service|package|plan|automation|crm|qualification|whatsapp)\b/i.test(message.body);
  }
  if (field === "authority") return /\b(owner|founder|decision maker|approver|approve|manager|director)\b/i.test(message.body);
  if (field === "location") return new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(message.body);
  return false;
}

function extractionMethodForField(field: QualificationInputAuditRow["field"], value: string, source?: LeadKnowledgeMessage): QualificationInputAuditRow["extractionMethod"] {
  if (!source) return "not-traced";
  if (new RegExp(`\\b${field.replace(/[A-Z]/g, (char) => ` ${char.toLowerCase()}`)}\\s*[:=-]`, "i").test(source.body)) return "deterministic-label";
  if (source.body.toLowerCase().includes(value.toLowerCase())) return "deterministic-pattern";
  return "derived-from-conversation";
}

export function buildQualificationInputAudit(lead: LeadKnowledgeRecord) {
  const messages = conversationMessages(lead.messages);
  const fields = qualificationAuditFields.map((field): QualificationInputAuditRow => {
    const value = lead.qualificationFields[field]?.trim();
    if (!value) {
      return {
        field,
        value: "Not Yet Collected",
        state: "Missing",
        confidence: "none",
        extractionMethod: "not-traced",
        valid: false
      };
    }
    const source = messages.find((message) => messageSupportsField(field, value, message));
    return {
      field,
      value,
      state: source ? "Collected" : "Uncertain",
      sourceMessage: source?.body,
      messageId: source?.id,
      confidence: source ? (extractionMethodForField(field, value, source) === "derived-from-conversation" ? "medium" : "high") : "none",
      extractionMethod: extractionMethodForField(field, value, source),
      valid: Boolean(source)
    };
  });
  return { leadId: lead.id, fields };
}

export async function summarizeLeadKnowledgeHealth() {
  await backfillUnassignedLeadsToDefaultQualificationAgent();
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
  const productStatusPipeline = Object.fromEntries(
    leadProductPipelineStatuses.map((status) => [
      status.id,
      records.filter((lead) => lead.leadStatus === "lead" && productPipelineStatusForLead(lead) === status.id).length
    ])
  ) as Record<LeadProductPipelineStatus, number>;
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
    productStatusPipeline,
    assigneeWorkload,
    conversations: records.reduce((total, lead) => total + lead.conversations.length, 0),
    messages: records.reduce((total, lead) => total + lead.messages.length, 0),
    whatsappSourced: records.filter((lead) => lead.channels.includes("whatsapp")).length,
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
  productPipelineStatus?: LeadProductPipelineStatus;
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
  const defaultAssignee = defaultAssigneeForLeadSource();
  lead.assigneeId = input.assigneeId?.trim() || lead.assigneeId || defaultAssignee.assigneeId;
  lead.assigneeName = input.assigneeName?.trim() || lead.assigneeName || defaultAssignee.assigneeName;
  lead.productPipelineStatus = input.productPipelineStatus ?? lead.productPipelineStatus;
  const qualificationMessages = conversationMessages(state.messages.filter((message) => message.leadId === lead.id && scopeMatches(input, message)));
  lead.qualificationFields = inferQualificationFields({
    contact: lead.contact,
    existing: { ...lead.qualificationFields, ...(input.qualificationFields ?? {}) },
    facts: lead.facts,
    messages: qualificationMessages
  });
  const qualification = qualificationDecisionForLead({
    lead,
    messages: qualificationMessages
  });
  const preserveInternalStatusForProductUpdate = Boolean(input.productPipelineStatus && input.crmStatus === undefined && input.qualificationStage === undefined);
  lead.crmStatus = input.crmStatus ?? (preserveInternalStatusForProductUpdate ? lead.crmStatus : qualification.crmStatus);
  lead.qualificationStage = input.qualificationStage ?? (preserveInternalStatusForProductUpdate ? lead.qualificationStage : qualification.qualificationStage);
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
    conversationMessages(state.messages.filter((message) => message.leadId === lead.id)),
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
  contact?: LeadKnowledgeContact;
}) {
  const contact = cleanContact(input.contact);
  const keys = identityKeysForContact("generic", contact);
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
