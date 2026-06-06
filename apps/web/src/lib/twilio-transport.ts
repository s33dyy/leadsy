import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";
import {
  appendTwilioOutboundMessage,
  saveTwilioInboundMessage,
  updateTwilioMessageDeliveryStatus,
  type LeadKnowledgeContact
} from "./lead-knowledge-store";
import {
  getWorkspaceWhatsAppSender,
  resolveWorkspaceWhatsAppSenderByTwilioTo,
  type WorkspaceWhatsAppSender
} from "./workspace-whatsapp-sender-store";

const twilioStateFile = join(leadsyDataDir, "twilio-integration.json");

type Scope = {
  tenantId: string;
  ownerId: string;
};

type TwilioIntegrationState = {
  lastWebhookAt?: string;
  lastWebhookMessageSid?: string;
  lastDeliveryCallbackAt?: string;
  lastDeliveryMessageSid?: string;
  lastDeliveryStatus?: string;
};

export class TwilioWorkspaceSenderError extends Error {
  constructor(
    public readonly code: "workspace_whatsapp_sender_required" | "workspace_whatsapp_sender_not_approved" | "unknown_whatsapp_sender",
    message: string
  ) {
    super(message);
  }
}

export type TwilioIntegrationStatus = {
  connected: boolean;
  accountSid?: string;
  whatsappNumber?: string;
  lastWebhook?: { at?: string; messageSid?: string };
  lastDeliveryCallback?: { at?: string; messageSid?: string; status?: string };
};

function nowIso() {
  return new Date().toISOString();
}

function value(form: URLSearchParams, key: string) {
  return form.get(key)?.trim() || undefined;
}

function requiredEnv(name: string) {
  const found = process.env[name]?.trim();
  if (!found) throw new Error(`${name} is required for Twilio integration.`);
  return found;
}

async function readTwilioState(): Promise<TwilioIntegrationState> {
  try {
    const raw = await readFile(twilioStateFile, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as TwilioIntegrationState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return {};
    throw error;
  }
}

async function writeTwilioState(state: TwilioIntegrationState) {
  await mkdir(dirname(twilioStateFile), { recursive: true });
  const tempFile = `${twilioStateFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, twilioStateFile);
}

async function recordWebhook(messageSid?: string, receivedAt = nowIso()) {
  const state = await readTwilioState();
  state.lastWebhookAt = receivedAt;
  state.lastWebhookMessageSid = messageSid;
  await writeTwilioState(state);
}

async function recordDeliveryCallback(input: { messageSid?: string; status?: string; receivedAt?: string }) {
  const state = await readTwilioState();
  state.lastDeliveryCallbackAt = input.receivedAt ?? nowIso();
  state.lastDeliveryMessageSid = input.messageSid;
  state.lastDeliveryStatus = input.status;
  await writeTwilioState(state);
}

export function createTwilioSignature(url: string, params: URLSearchParams, authToken: string) {
  const payload = [...new Set([...params.keys()])]
    .sort()
    .reduce((acc, key) => `${acc}${key}${params.getAll(key).join("")}`, url);
  return createHmac("sha1", authToken).update(payload).digest("base64");
}

export function verifyTwilioSignature(input: {
  url: string;
  params: URLSearchParams;
  signature: string | null | undefined;
  authToken?: string;
}) {
  const token = input.authToken?.trim();
  if (!token) return true;
  const expected = createTwilioSignature(input.url, input.params, token);
  const left = Buffer.from(input.signature ?? "");
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function twilioParamsFromBody(rawBody: string) {
  return new URLSearchParams(rawBody);
}

export async function saveTwilioInboundFromForm(input: Scope & {
  form: URLSearchParams;
  receivedAt?: string;
}) {
  const messageSid = value(input.form, "MessageSid") || value(input.form, "SmsMessageSid");
  const from = value(input.form, "From");
  const to = value(input.form, "To");
  const body = value(input.form, "Body") ?? "";
  if (!messageSid || !from || !to) return { saved: [], ignored: 1 };

  const receivedAt = input.receivedAt ?? nowIso();
  await recordWebhook(messageSid, receivedAt);
  return saveTwilioInboundMessage({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    messageSid,
    from,
    to,
    body,
    profileName: value(input.form, "ProfileName"),
    waId: value(input.form, "WaId"),
    receivedAt,
    deliveryStatus: value(input.form, "MessageStatus") || value(input.form, "SmsStatus") || "received",
    raw: Object.fromEntries(input.form.entries())
  });
}

export async function resolveTwilioInboundScopeFromForm(form: URLSearchParams) {
  const to = value(form, "To");
  const sender = await resolveWorkspaceWhatsAppSenderByTwilioTo(to);
  if (!sender) {
    throw new TwilioWorkspaceSenderError("unknown_whatsapp_sender", "No Leadsy workspace sender is registered for this Twilio recipient.");
  }
  if (sender.status !== "approved") {
    throw new TwilioWorkspaceSenderError("workspace_whatsapp_sender_not_approved", "The workspace WhatsApp sender is not approved.");
  }
  return {
    tenantId: sender.tenantId,
    ownerId: sender.ownerId,
    sender
  };
}

export async function sendTwilioWhatsAppMessage(input: {
  to: string;
  body?: string;
  from?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  statusCallback?: string;
}) {
  const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
  const from = input.from?.trim() || requiredEnv("TWILIO_WHATSAPP_FROM");
  const body = new URLSearchParams();
  body.set("From", from);
  body.set("To", input.to);
  if (input.body?.trim()) body.set("Body", input.body.trim());
  if (input.contentSid?.trim()) body.set("ContentSid", input.contentSid.trim());
  if (input.contentVariables) body.set("ContentVariables", JSON.stringify(input.contentVariables));
  const statusCallback = input.statusCallback?.trim() || process.env.TWILIO_STATUS_CALLBACK_URL?.trim();
  if (statusCallback) body.set("StatusCallback", statusCallback);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: new Headers({
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }),
    body
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.message === "string" ? payload.message : "Twilio message send failed.");
  }
  return {
    sid: typeof payload.sid === "string" ? payload.sid : "",
    status: typeof payload.status === "string" ? payload.status : "queued",
    from: typeof payload.from === "string" ? payload.from : from,
    to: typeof payload.to === "string" ? payload.to : input.to,
    body: typeof payload.body === "string" ? payload.body : input.body,
    dateCreated: typeof payload.date_created === "string" ? payload.date_created : undefined,
    raw: payload
  };
}

export async function sendAndStoreTwilioWhatsAppMessage(input: Scope & {
  to: string;
  leadId?: string;
  body?: string;
  contact?: LeadKnowledgeContact;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}) {
  const sender = await resolveOutboundSender(input);
  const twilio = await sendTwilioWhatsAppMessage({
    to: input.to,
    from: sender.twilioFrom,
    body: input.body,
    contentSid: input.contentSid || process.env.TWILIO_CONTENT_SID?.trim(),
    contentVariables: input.contentVariables
  });
  const stored = await appendTwilioOutboundMessage({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: input.leadId,
    messageSid: twilio.sid,
    to: twilio.to,
    from: twilio.from,
    body: input.body || twilio.body,
    contact: input.contact,
    deliveryStatus: twilio.status,
    contentSid: input.contentSid || process.env.TWILIO_CONTENT_SID?.trim(),
    contentVariables: input.contentVariables,
    raw: twilio.raw
  });
  return { twilio, ...stored };
}

async function resolveOutboundSender(scope: Scope): Promise<WorkspaceWhatsAppSender> {
  const sender = await getWorkspaceWhatsAppSender(scope);
  if (!sender) {
    throw new TwilioWorkspaceSenderError("workspace_whatsapp_sender_required", "A workspace WhatsApp sender is required before replying through Twilio.");
  }
  if (sender.status !== "approved") {
    throw new TwilioWorkspaceSenderError("workspace_whatsapp_sender_not_approved", "The workspace WhatsApp sender is not approved for outbound replies.");
  }
  return sender;
}

export async function updateTwilioDeliveryStatusFromForm(input: {
  form: URLSearchParams;
  receivedAt?: string;
}) {
  const messageSid = value(input.form, "MessageSid") || value(input.form, "SmsSid");
  const deliveryStatus = value(input.form, "MessageStatus") || value(input.form, "SmsStatus");
  const receivedAt = input.receivedAt ?? nowIso();
  await recordDeliveryCallback({ messageSid, status: deliveryStatus, receivedAt });
  if (!messageSid || !deliveryStatus) return { updated: false, message: undefined };
  return updateTwilioMessageDeliveryStatus({
    messageSid,
    deliveryStatus,
    statusUpdatedAt: receivedAt,
    raw: Object.fromEntries(input.form.entries())
  });
}

export async function getTwilioIntegrationStatus(): Promise<TwilioIntegrationStatus> {
  const state = await readTwilioState();
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const whatsappNumber = process.env.TWILIO_WHATSAPP_FROM?.trim();
  return {
    connected: Boolean(accountSid && authToken && whatsappNumber),
    accountSid,
    whatsappNumber,
    lastWebhook: {
      at: state.lastWebhookAt,
      messageSid: state.lastWebhookMessageSid
    },
    lastDeliveryCallback: {
      at: state.lastDeliveryCallbackAt,
      messageSid: state.lastDeliveryMessageSid,
      status: state.lastDeliveryStatus
    }
  };
}
