import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const inboundFile = join(leadsyDataDir, "meta-whatsapp-inbound.json");
const messageFields = new Set(["messages", "message_echoes", "smb_message_echoes"]);

export type MetaWhatsAppReferral = {
  sourceType?: string;
  sourceId?: string;
  sourceUrl?: string;
  headline?: string;
  body?: string;
  ctwaClid?: string;
};

export type MetaWhatsAppInboundMessage = {
  id: string;
  whatsappBusinessAccountId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  contactId: string;
  direction: "inbound" | "outbound";
  from: string;
  waId?: string;
  profileName?: string;
  messageId: string;
  messageType: string;
  messageText?: string;
  sentAt: string;
  receivedAt: string;
  referral?: MetaWhatsAppReferral;
  raw: unknown;
};

export type MetaWhatsAppLeadStatus = "lead" | "excluded";

export type MetaWhatsAppContactLeadStatus = {
  tenantId: string;
  ownerId: string;
  contactId: string;
  leadStatus: MetaWhatsAppLeadStatus;
  excludedAt?: string;
  updatedAt: string;
};

export type MetaWhatsAppConversation = {
  contactId: string;
  leadStatus: MetaWhatsAppLeadStatus;
  excludedAt?: string;
  whatsappUrl: string;
  profileName?: string;
  waId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  whatsappBusinessAccountId?: string;
  messageCount: number;
  inboundCount: number;
  outboundCount: number;
  adOriginated: boolean;
  lastMessageAt: string;
  lastMessageText?: string;
  lastMessageType: string;
  messages: MetaWhatsAppInboundMessage[];
};

type MetaWhatsAppConversationScope = {
  tenantId: string;
  ownerId: string;
  whatsappBusinessAccountId?: string;
  phoneNumberId?: string;
};

type InboundState = {
  messages: MetaWhatsAppInboundMessage[];
  contactStatuses: MetaWhatsAppContactLeadStatus[];
};

function emptyState(): InboundState {
  return { messages: [], contactStatuses: [] };
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
  const value = asString(timestamp);
  if (!value) return fallback;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function contactForMessage(contacts: unknown[], from?: string) {
  return contacts
    .map(asRecord)
    .find((contact) => {
      const waId = asString(contact?.wa_id);
      return waId && from && waId === from;
    }) ?? asRecord(contacts[0]);
}

function textForMessage(message: Record<string, unknown>) {
  const text = asRecord(message.text);
  const button = asRecord(message.button);
  const interactive = asRecord(message.interactive);
  const image = asRecord(message.image);
  const document = asRecord(message.document);
  const video = asRecord(message.video);
  return (
    asString(text?.body) ||
    asString(button?.text) ||
    asString(interactive?.button_reply && asRecord(interactive.button_reply)?.title) ||
    asString(interactive?.list_reply && asRecord(interactive.list_reply)?.title) ||
    asString(image?.caption) ||
    asString(document?.caption) ||
    asString(video?.caption)
  );
}

function referralForMessage(message: Record<string, unknown>): MetaWhatsAppReferral | undefined {
  const referral = asRecord(message.referral);
  if (!referral) return undefined;
  const normalized: MetaWhatsAppReferral = {
    sourceType: asString(referral.source_type),
    sourceId: asString(referral.source_id),
    sourceUrl: asString(referral.source_url),
    headline: asString(referral.headline),
    body: asString(referral.body),
    ctwaClid: asString(referral.ctwa_clid)
  };
  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}

async function readState(): Promise<InboundState> {
  try {
    const raw = await readFile(inboundFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<InboundState>;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages.map(normalizeMessage) : [],
      contactStatuses: Array.isArray(parsed.contactStatuses) ? parsed.contactStatuses : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
      return emptyState();
    }
    throw error;
  }
}

async function writeState(state: InboundState) {
  await mkdir(dirname(inboundFile), { recursive: true });
  const tempFile = `${inboundFile}.${randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, inboundFile);
}

function normalizeMessage(message: MetaWhatsAppInboundMessage): MetaWhatsAppInboundMessage {
  const contactId = message.contactId || message.from || message.waId || "unknown";
  return {
    ...message,
    contactId,
    from: message.from || contactId,
    direction: message.direction ?? "inbound"
  };
}

function statusKey(input: Pick<MetaWhatsAppContactLeadStatus, "tenantId" | "ownerId" | "contactId">) {
  return `${input.tenantId}:${input.ownerId}:${input.contactId}`;
}

function cleanPhoneForWhatsApp(value: string) {
  return value.replace(/\D/g, "");
}

function messageMatchesConversationScope(message: MetaWhatsAppInboundMessage, input: MetaWhatsAppConversationScope) {
  if (!input.whatsappBusinessAccountId && !input.phoneNumberId) return false;
  if (input.phoneNumberId && message.phoneNumberId !== input.phoneNumberId) return false;
  if (input.whatsappBusinessAccountId && message.whatsappBusinessAccountId !== input.whatsappBusinessAccountId) return false;
  return true;
}

export function whatsappConversationUrl(contactId: string) {
  const phone = cleanPhoneForWhatsApp(contactId);
  return phone ? `https://web.whatsapp.com/send?phone=${phone}` : "https://web.whatsapp.com/";
}

export function verifyMetaWebhookChallenge(input: {
  mode: string | null | undefined;
  token: string | null | undefined;
  challenge: string | null | undefined;
}) {
  const expectedToken = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!expectedToken || input.mode !== "subscribe" || input.token !== expectedToken || !input.challenge) {
    return null;
  }
  return input.challenge;
}

export function verifyMetaWebhookSignature(rawBody: string, signature: string | null | undefined, appSecret?: string) {
  const secret = appSecret?.trim();
  if (!secret) return true;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const left = Buffer.from(signature ?? "");
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function extractMetaWhatsAppInboundMessages(payload: unknown, receivedAt = new Date().toISOString()) {
  const records: MetaWhatsAppInboundMessage[] = [];
  const root = asRecord(payload);
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
      const phoneNumberId = asString(metadata?.phone_number_id);
      const displayPhoneNumber = asString(metadata?.display_phone_number);
      const contacts = asArray(value.contacts);
      for (const messageValue of asArray(value.messages)) {
        const message = asRecord(messageValue);
        const from = asString(message?.from);
        const recipientId = asString(message?.recipient_id) || asString(message?.to);
        const direction = field === "messages" ? "inbound" : "outbound";
        const contactId = direction === "outbound" ? recipientId || from : from;
        const messageId = asString(message?.id);
        if (!message || !contactId || !messageId) continue;
        const contact = contactForMessage(contacts, contactId);
        const profile = asRecord(contact?.profile);
        records.push({
          id: `mwa_${randomUUID().slice(0, 12)}`,
          whatsappBusinessAccountId,
          phoneNumberId,
          displayPhoneNumber,
          contactId,
          direction,
          from: contactId,
          waId: asString(contact?.wa_id),
          profileName: asString(profile?.name),
          messageId,
          messageType: asString(message.type) ?? "unknown",
          messageText: textForMessage(message),
          sentAt: timestampToIso(message.timestamp, receivedAt),
          receivedAt,
          referral: referralForMessage(message),
          raw: message
        });
      }
    }
  }
  return records;
}

export async function saveMetaWhatsAppInboundMessages(payload: unknown, receivedAt = new Date().toISOString()) {
  const incoming = extractMetaWhatsAppInboundMessages(payload, receivedAt);
  if (!incoming.length) return { saved: [], ignored: 0 };
  const state = await readState();
  const seen = new Set(state.messages.map((message) => message.messageId));
  const saved = incoming.filter((message) => !seen.has(message.messageId));
  if (saved.length) {
    state.messages = [...state.messages, ...saved].sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
    await writeState(state);
  }
  return { saved, ignored: incoming.length - saved.length };
}

export async function listMetaWhatsAppInboundMessages() {
  return (await readState()).messages;
}

export async function setMetaWhatsAppContactLeadStatus(input: {
  tenantId: string;
  ownerId: string;
  contactId: string;
  leadStatus: MetaWhatsAppLeadStatus;
}) {
  const state = await readState();
  const now = new Date().toISOString();
  const cleanContactId = input.contactId.trim();
  const nextStatus: MetaWhatsAppContactLeadStatus = {
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    contactId: cleanContactId,
    leadStatus: input.leadStatus,
    excludedAt: input.leadStatus === "excluded" ? now : undefined,
    updatedAt: now
  };
  const key = statusKey(nextStatus);
  state.contactStatuses = [nextStatus, ...state.contactStatuses.filter((status) => statusKey(status) !== key)].slice(0, 5000);
  await writeState(state);
  return nextStatus;
}

export async function listMetaWhatsAppConversations(input: MetaWhatsAppConversationScope) {
  const state = await readState();
  const statuses = new Map(
    state.contactStatuses
      .filter((status) => status.tenantId === input.tenantId && status.ownerId === input.ownerId)
      .map((status) => [status.contactId, status])
  );
  const grouped = new Map<string, MetaWhatsAppInboundMessage[]>();

  for (const message of state.messages.filter((candidate) => messageMatchesConversationScope(candidate, input))) {
    const contactId = message.contactId || message.from || message.waId;
    if (!contactId) continue;
    grouped.set(contactId, [...(grouped.get(contactId) ?? []), normalizeMessage({ ...message, contactId })]);
  }

  return [...grouped.entries()]
    .map(([contactId, messages]): MetaWhatsAppConversation => {
      const sortedMessages = messages.sort((left, right) => left.sentAt.localeCompare(right.sentAt));
      const lastMessage = sortedMessages.at(-1);
      const latestProfile = [...sortedMessages].reverse().find((message) => message.profileName);
      const latestWaId = [...sortedMessages].reverse().find((message) => message.waId);
      const latestPhone = [...sortedMessages].reverse().find((message) => message.phoneNumberId || message.displayPhoneNumber);
      const latestWaba = [...sortedMessages].reverse().find((message) => message.whatsappBusinessAccountId);
      const status = statuses.get(contactId);
      return {
        contactId,
        leadStatus: status?.leadStatus ?? "lead",
        excludedAt: status?.excludedAt,
        whatsappUrl: whatsappConversationUrl(contactId),
        profileName: latestProfile?.profileName,
        waId: latestWaId?.waId,
        phoneNumberId: latestPhone?.phoneNumberId,
        displayPhoneNumber: latestPhone?.displayPhoneNumber,
        whatsappBusinessAccountId: latestWaba?.whatsappBusinessAccountId,
        messageCount: sortedMessages.length,
        inboundCount: sortedMessages.filter((message) => message.direction === "inbound").length,
        outboundCount: sortedMessages.filter((message) => message.direction === "outbound").length,
        adOriginated: sortedMessages.some((message) => message.referral?.sourceType === "ad" || Boolean(message.referral?.ctwaClid || message.referral?.sourceId)),
        lastMessageAt: lastMessage?.receivedAt ?? lastMessage?.sentAt ?? new Date(0).toISOString(),
        lastMessageText: lastMessage?.messageText,
        lastMessageType: lastMessage?.messageType ?? "unknown",
        messages: sortedMessages
      };
    })
    .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
}
