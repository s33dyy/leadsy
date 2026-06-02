import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const inboundFile = join(leadsyDataDir, "meta-whatsapp-inbound.json");

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

type InboundState = {
  messages: MetaWhatsAppInboundMessage[];
};

function emptyState(): InboundState {
  return { messages: [] };
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
  return (
    asString(text?.body) ||
    asString(button?.text) ||
    asString(interactive?.button_reply && asRecord(interactive.button_reply)?.title) ||
    asString(interactive?.list_reply && asRecord(interactive.list_reply)?.title)
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
    return { messages: Array.isArray(parsed.messages) ? parsed.messages : [] };
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
      if (asString(change?.field) !== "messages") continue;
      const value = asRecord(change?.value);
      if (!value) continue;
      const metadata = asRecord(value.metadata);
      const phoneNumberId = asString(metadata?.phone_number_id);
      const displayPhoneNumber = asString(metadata?.display_phone_number);
      const contacts = asArray(value.contacts);
      for (const messageValue of asArray(value.messages)) {
        const message = asRecord(messageValue);
        const from = asString(message?.from);
        const messageId = asString(message?.id);
        if (!message || !from || !messageId) continue;
        const contact = contactForMessage(contacts, from);
        const profile = asRecord(contact?.profile);
        records.push({
          id: `mwa_${randomUUID().slice(0, 12)}`,
          whatsappBusinessAccountId,
          phoneNumberId,
          displayPhoneNumber,
          from,
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
