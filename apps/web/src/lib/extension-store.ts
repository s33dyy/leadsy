import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const extensionFile = join(leadsyDataDir, "extension.json");
const tokenTtlMs = 1000 * 60 * 60 * 24 * 365;

export type ExtensionTokenRecord = {
  id: string;
  tenantId: string;
  ownerId: string;
  label: string;
  tokenHash: string;
  tokenPreview: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type ExtensionPlatform =
  | "whatsapp-web"
  | "instagram-web"
  | "facebook-web"
  | "generic-web-chat";

export type ExtensionConversationContact = {
  displayName?: string;
  phone?: string;
  email?: string;
  handle?: string;
  profileUrl?: string;
};

export type ExtensionMessageDirection = "inbound" | "outbound" | "system";
export type ExtensionMessageGeneratedBy = "leadsy" | "fallback" | "human";

export type ExtensionConversationMessage = {
  id: string;
  externalId: string;
  direction: ExtensionMessageDirection;
  body: string;
  sentAt: string;
  generatedBy?: ExtensionMessageGeneratedBy;
};

export type ExtensionConversationEvent = {
  id: string;
  type:
    | "detected"
    | "inbound-synced"
    | "reply-generated"
    | "reply-sent"
    | "reply-paused"
    | "fallback-used"
    | "error";
  summary: string;
  occurredAt: string;
};

export type ExtensionConversationInsight = {
  summary: string;
  qualification?: string;
  nextAction?: string;
  sentiment?: "positive" | "neutral" | "hesitant" | "negative";
};

export type ExtensionConversation = {
  id: string;
  tenantId: string;
  ownerId: string;
  platform: ExtensionPlatform;
  sourceUrl: string;
  chatFingerprint: string;
  contact: ExtensionConversationContact;
  leadId?: string;
  leadSource?: "lead-magnet" | "manual-import" | "unknown";
  status: "active" | "paused" | "needs-human" | "closed";
  messageCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  summary?: string;
  qualification?: string;
  nextAction?: string;
  sentiment?: ExtensionConversationInsight["sentiment"];
  createdAt: string;
  updatedAt: string;
};

export type ExtensionConversationBundle = {
  conversation: ExtensionConversation;
  messages: ExtensionConversationMessage[];
  events: ExtensionConversationEvent[];
};

export type SyncExtensionConversationInput = {
  tenantId: string;
  ownerId: string;
  platform: ExtensionPlatform;
  sourceUrl: string;
  chatFingerprint: string;
  contact?: ExtensionConversationContact;
  leadId?: string;
  leadSource?: ExtensionConversation["leadSource"];
  status?: ExtensionConversation["status"];
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
};

type ExtensionState = {
  tokens: ExtensionTokenRecord[];
  conversations: ExtensionConversation[];
  messages: ExtensionConversationMessage[];
  events: ExtensionConversationEvent[];
};

function emptyState(): ExtensionState {
  return {
    tokens: [],
    conversations: [],
    messages: [],
    events: []
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function readState(): Promise<ExtensionState> {
  try {
    const raw = await readFile(extensionFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ExtensionState>;
    return {
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      events: Array.isArray(parsed.events) ? parsed.events : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
      return emptyState();
    }
    throw error;
  }
}

async function writeState(state: ExtensionState) {
  await mkdir(dirname(extensionFile), { recursive: true });
  const tempFile = `${extensionFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, extensionFile);
}

function scopeKey(tenantId: string, ownerId: string) {
  return `${tenantId}:${ownerId}`;
}

function conversationKey(input: Pick<ExtensionConversation, "tenantId" | "ownerId" | "platform" | "chatFingerprint">) {
  return `${scopeKey(input.tenantId, input.ownerId)}:${input.platform}:${input.chatFingerprint}`;
}

function cleanPreview(body: string) {
  return body.trim().replace(/\s+/g, " ").slice(0, 180);
}

function tokenFromBearer(authorization: string) {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function createExtensionToken(input: {
  tenantId: string;
  ownerId: string;
  label?: string;
}) {
  const state = await readState();
  const secret = randomBytes(32).toString("base64url");
  const token = `lext_${secret}`;
  const now = new Date();
  const record: ExtensionTokenRecord = {
    id: `exttok_${crypto.randomUUID()}`,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    label: input.label?.trim() || "Leadsy browser extension",
    tokenHash: sha256(token),
    tokenPreview: `...${token.slice(-4)}`,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + tokenTtlMs).toISOString()
  };

  state.tokens = [record, ...state.tokens].slice(0, 20);
  await writeState(state);
  return { token, record };
}

export async function resolveExtensionBearerToken(authorization: string) {
  const token = tokenFromBearer(authorization);
  if (!token) return null;

  const state = await readState();
  const tokenHash = sha256(token);
  const now = Date.now();
  const record = state.tokens.find(
    (candidate) =>
      !candidate.revokedAt &&
      Date.parse(candidate.expiresAt) > now &&
      safeEqual(candidate.tokenHash, tokenHash)
  );
  if (!record) return null;

  record.lastUsedAt = new Date().toISOString();
  await writeState(state);
  return {
    tenantId: record.tenantId,
    ownerId: record.ownerId,
    tokenId: record.id,
    label: record.label
  };
}

export async function listExtensionTokens(tenantId: string, ownerId: string) {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  return state.tokens
    .filter((token) => scopeKey(token.tenantId, token.ownerId) === scoped)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((token) => ({
      id: token.id,
      tenantId: token.tenantId,
      ownerId: token.ownerId,
      label: token.label,
      tokenPreview: token.tokenPreview,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      revokedAt: token.revokedAt
    }));
}

export async function syncExtensionConversation(input: SyncExtensionConversationInput): Promise<ExtensionConversationBundle> {
  const state = await readState();
  const now = new Date().toISOString();
  const key = conversationKey(input);
  const existingIndex = state.conversations.findIndex((conversation) => conversationKey(conversation) === key);
  const existing = existingIndex >= 0 ? state.conversations[existingIndex] : null;
  const conversationId = existing?.id ?? `extconv_${crypto.randomUUID()}`;
  const existingMessages = state.messages.filter((message) => message.id.startsWith(`${conversationId}:`));
  const messagesByExternalId = new Map(existingMessages.map((message) => [message.externalId, message]));

  for (const message of input.messages ?? []) {
    const current = messagesByExternalId.get(message.externalId);
    const nextMessage: ExtensionConversationMessage = {
      id: current?.id ?? `${conversationId}:msg_${crypto.randomUUID()}`,
      externalId: message.externalId,
      direction: message.direction,
      body: message.body,
      sentAt: message.sentAt,
      generatedBy: message.generatedBy
    };
    messagesByExternalId.set(message.externalId, nextMessage);
  }

  const messages = [...messagesByExternalId.values()].sort((left, right) => left.sentAt.localeCompare(right.sentAt));
  const lastMessage = messages.at(-1);
  const conversation: ExtensionConversation = {
    id: conversationId,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    platform: input.platform,
    sourceUrl: input.sourceUrl,
    chatFingerprint: input.chatFingerprint,
    contact: { ...(existing?.contact ?? {}), ...(input.contact ?? {}) },
    leadId: input.leadId ?? existing?.leadId,
    leadSource: input.leadSource ?? existing?.leadSource,
    status: input.status ?? existing?.status ?? "active",
    messageCount: messages.length,
    lastMessageAt: lastMessage?.sentAt ?? existing?.lastMessageAt,
    lastMessagePreview: lastMessage ? cleanPreview(lastMessage.body) : existing?.lastMessagePreview,
    summary: input.insight?.summary ?? existing?.summary,
    qualification: input.insight?.qualification ?? existing?.qualification,
    nextAction: input.insight?.nextAction ?? existing?.nextAction,
    sentiment: input.insight?.sentiment ?? existing?.sentiment,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    state.conversations[existingIndex] = conversation;
  } else {
    state.conversations.push(conversation);
  }

  const outsideConversationMessages = state.messages.filter((message) => !message.id.startsWith(`${conversationId}:`));
  state.messages = [...outsideConversationMessages, ...messages];

  const newEvents = (input.events ?? []).map((event): ExtensionConversationEvent => ({
    id: `${conversationId}:evt_${crypto.randomUUID()}`,
    type: event.type,
    summary: event.summary,
    occurredAt: event.occurredAt
  }));
  state.events = [...state.events, ...newEvents].slice(-1000);

  await writeState(state);
  return {
    conversation,
    messages,
    events: state.events.filter((event) => event.id.startsWith(`${conversationId}:`))
  };
}

export async function listExtensionConversations(tenantId: string, ownerId: string): Promise<ExtensionConversationBundle[]> {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  return state.conversations
    .filter((conversation) => scopeKey(conversation.tenantId, conversation.ownerId) === scoped)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((conversation) => ({
      conversation,
      messages: state.messages
        .filter((message) => message.id.startsWith(`${conversation.id}:`))
        .sort((left, right) => left.sentAt.localeCompare(right.sentAt)),
      events: state.events
        .filter((event) => event.id.startsWith(`${conversation.id}:`))
        .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    }));
}
