import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getDemoSession } from "@leadsy/security";
import { leadsyDataDir } from "./data-dir";
import type {
  ExtensionConversationContact,
  ExtensionConversationEvent,
  ExtensionConversationInsight,
  ExtensionMessageDirection,
  ExtensionMessageGeneratedBy,
  ExtensionPlatform
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
  excludedAt?: string;
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
}) {
  const now = nowIso();
  const contact = cleanContact(input.contact);
  const identityKeys = uniqueStrings([...input.identityKeys, ...identityKeysForContact("generic", contact)]);
  const existing =
    (input.leadId ? findLeadById(state, scope, input.leadId) : undefined) ?? findLeadByIdentity(state, scope, identityKeys);

  if (existing) {
    existing.identityKeys = uniqueStrings([...existing.identityKeys, ...identityKeys]);
    existing.contact = mergeContacts(existing.contact, contact);
    existing.summary = input.summary || existing.summary;
    existing.nextAction = input.nextAction || existing.nextAction;
    existing.facts = uniqueStrings([...(input.facts ?? []), ...existing.facts]).slice(0, 30);
    existing.updatedAt = now;
    return existing;
  }

  const lead: LeadKnowledgeLead = {
    id: input.leadId || `leadkb_${crypto.randomUUID()}`,
    tenantId: scope.tenantId,
    ownerId: scope.ownerId,
    identityKeys,
    contact,
    leadStatus: "lead",
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
  const conversations = state.conversations.filter((conversation) => conversation.leadId === leadId);
  const messages = state.messages
    .filter((message) => message.leadId === leadId)
    .sort((left, right) => left.sentAt.localeCompare(right.sentAt));
  const lastMessage = messages.at(-1);
  lead.summary = insight?.summary || lead.summary || (lastMessage ? `Latest message: ${cleanPreview(lastMessage.body)}` : undefined);
  lead.nextAction = insight?.nextAction || nextActionForMessages(messages, lead.leadStatus);
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
    const lead = upsertLead(state, input, {
      identityKeys: normalized.identityKeys,
      contact: normalized.contact,
      facts: [normalized.body],
      nextAction: normalized.direction === "inbound" ? "Reply in Leadsy-approved channel and qualify intent." : undefined
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

function extensionDirection(direction: ExtensionMessageDirection): LeadKnowledgeDirection {
  if (direction === "inbound") return "inbound";
  if (direction === "outbound") return "outbound";
  return "system";
}

export async function syncLeadsyExtensionConversation(input: Scope & {
  platform: ExtensionPlatform;
  sourceUrl: string;
  chatFingerprint: string;
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
  const identityKeys = identityKeysForContact(input.platform, contact);
  const lead = upsertLead(state, input, {
    identityKeys,
    contact,
    summary: input.insight?.summary,
    nextAction: input.insight?.nextAction,
    facts: [input.insight?.qualification, input.insight?.summary].filter(Boolean) as string[]
  });
  const conversation = upsertConversation(state, input, {
    leadId: lead.id,
    channel,
    source: "extension",
    externalKey: `extension:${input.platform}:${input.chatFingerprint}`,
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
      generatedBy: message.generatedBy
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
    facts: [input.body]
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
  const conversations = state.conversations
    .filter((conversation) => conversation.leadId === lead.id && scopeMatches(scope, conversation))
    .sort((left, right) => (right.lastMessageAt ?? right.updatedAt).localeCompare(left.lastMessageAt ?? left.updatedAt));
  const messages = state.messages
    .filter((message) => message.leadId === lead.id && scopeMatches(scope, message))
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
    .filter((lead) => scopeMatches(scope, lead))
    .map((lead) => recordForLead(state, scope, lead.id))
    .sort((left, right) => (right.lastMessageAt ?? right.updatedAt).localeCompare(left.lastMessageAt ?? left.updatedAt));
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
    const conversation = state.conversations.find(
      (candidate) =>
        scopeMatches(scope, candidate) &&
        candidate.source === "extension" &&
        candidate.externalKey === `extension:${input.platform}:${input.chatFingerprint}`
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
