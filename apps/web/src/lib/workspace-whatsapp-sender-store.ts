import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const senderFile = join(leadsyDataDir, "workspace-whatsapp-senders.json");

export type WorkspaceWhatsAppSenderStatus =
  | "not_started"
  | "number_reserved"
  | "sender_registration_pending"
  | "pending_verification"
  | "approved"
  | "failed"
  | "disabled";

export type WorkspaceWhatsAppSender = {
  tenantId: string;
  ownerId: string;
  businessName?: string;
  assignedPhoneNumber?: string;
  twilioFrom?: string;
  twilioPhoneNumberSid?: string;
  twilioSenderSid?: string;
  status: WorkspaceWhatsAppSenderStatus;
  statusReason?: string;
  createdAt: string;
  updatedAt: string;
};

type SenderState = {
  senders: WorkspaceWhatsAppSender[];
};

type WorkspaceWhatsAppSenderScope = {
  tenantId: string;
  ownerId: string;
};

type WorkspaceWhatsAppSenderProfile = {
  businessName?: string;
  industry?: string;
  website?: string;
};

type TwilioOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: WorkspaceWhatsAppSenderStatus; reason: string };

type TwilioNumberSearchResult = {
  phoneNumber: string;
  countryCode: string;
  numberType: "Mobile" | "Local";
};

function emptyState(): SenderState {
  return { senders: [] };
}

function nowIso() {
  return new Date().toISOString();
}

async function readState(): Promise<SenderState> {
  try {
    const raw = await readFile(senderFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<SenderState>;
    return { senders: Array.isArray(parsed.senders) ? parsed.senders.map(normalizeStoredSender) : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return emptyState();
    throw error;
  }
}

async function writeState(state: SenderState) {
  await mkdir(dirname(senderFile), { recursive: true });
  const tempFile = `${senderFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, senderFile);
}

let senderMutationQueue = Promise.resolve();

async function mutateState<T>(updater: (state: SenderState) => Promise<{ result: T; state?: SenderState }> | { result: T; state?: SenderState }) {
  const operation = senderMutationQueue.then(async () => {
    const state = await readState();
    const next = await updater(state);
    if (next.state) await writeState(next.state);
    return next.result;
  });
  senderMutationQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

function normalizeCountryCode(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits ? `+${digits}` : "+91";
}

export function normalizeWorkspaceWhatsAppNumber(input: { whatsappNumber: string; countryCode?: string }) {
  const raw = input.whatsappNumber.trim();
  const withoutPrefix = raw.replace(/^whatsapp:/i, "").trim();
  const countryCode = normalizeCountryCode(input.countryCode);
  const digits = withoutPrefix.replace(/\D/g, "");
  if (!digits) return undefined;
  const normalizedDigits = withoutPrefix.startsWith("+") ? digits : `${countryCode.replace(/\D/g, "")}${digits}`;
  return {
    countryCode: withoutPrefix.startsWith("+") ? `+${digits.slice(0, Math.max(1, digits.length - 10))}` : countryCode,
    assignedPhoneNumber: `+${normalizedDigits}`,
    twilioFrom: `whatsapp:+${normalizedDigits}`
  };
}

function normalizeStoredSender(sender: WorkspaceWhatsAppSender & { whatsappNumber?: string; countryCode?: string }) {
  const legacyNumber = sender.assignedPhoneNumber ?? sender.whatsappNumber;
  const normalized = legacyNumber ? normalizeWorkspaceWhatsAppNumber({ whatsappNumber: legacyNumber, countryCode: sender.countryCode }) : undefined;
  return {
    ...sender,
    assignedPhoneNumber: normalized?.assignedPhoneNumber ?? sender.assignedPhoneNumber,
    twilioFrom: normalized?.twilioFrom ?? sender.twilioFrom,
    status: sender.status ?? "not_started"
  };
}

function configuredSenderPool() {
  const raw = process.env.LEADSY_TWILIO_WHATSAPP_SENDER_POOL?.trim() || process.env.LEADSY_ASSIGNED_WHATSAPP_POOL?.trim() || "";
  return raw
    .split(/[,\n]/)
    .map((entry) => normalizeWorkspaceWhatsAppNumber({ whatsappNumber: entry }))
    .filter((entry): entry is NonNullable<ReturnType<typeof normalizeWorkspaceWhatsAppNumber>> => Boolean(entry));
}

function fallbackInventoryCountries() {
  const defaultCountries = ["US", "GB", "CA", "AU", "IE", "NL", "DE", "FR", "ES", "IT"];
  const configuredCountries = process.env.LEADSY_TWILIO_FALLBACK_COUNTRIES?.trim()
    .split(/[,\n]/)
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean) ?? [];
  return [...new Set(
    [...configuredCountries, ...defaultCountries]
      .filter((country) => /^[A-Z]{2}$/.test(country) && country !== "IN")
  )];
}

function senderMatchesScope(sender: WorkspaceWhatsAppSender, scope: WorkspaceWhatsAppSenderScope) {
  return sender.tenantId === scope.tenantId && sender.ownerId === scope.ownerId;
}

function twilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  return accountSid && authToken ? { accountSid, authToken } : undefined;
}

function twilioAuthorizationHeader(credentials: { accountSid: string; authToken: string }) {
  return `Basic ${Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")}`;
}

function safeTwilioReason(prefix: string, payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : typeof record.detail === "string" ? record.detail : "";
    if (message.trim()) return `${prefix}: ${message.trim().slice(0, 220)}`;
  }
  return `${prefix}: ${fallback}`;
}

async function twilioJsonRequest<T>(url: string, init?: RequestInit): Promise<TwilioOperationResult<T>> {
  const credentials = twilioCredentials();
  if (!credentials) {
    return {
      ok: false,
      status: "sender_registration_pending",
      reason: "Twilio credentials are not configured for live WhatsApp sender provisioning."
    };
  }
  const headers = new Headers(init?.headers);
  headers.set("Authorization", twilioAuthorizationHeader(credentials));
  const response = await fetch(url, { ...init, headers });
  const payload = (await response.json().catch(() => undefined)) as T | undefined;
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status >= 500 ? "sender_registration_pending" : "failed",
      reason: safeTwilioReason("Twilio provisioning failed", payload, `HTTP ${response.status}`)
    };
  }
  return { ok: true, value: payload };
}

function twilioApiBase(credentials: { accountSid: string }) {
  return `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}`;
}

function webhookCallbackUrl() {
  const configured = process.env.TWILIO_WEBHOOK_URL?.trim();
  if (configured) return configured;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  return appUrl ? `${appUrl.replace(/\/$/, "")}/api/twilio/webhook` : "https://leadsy.up.railway.app/api/twilio/webhook";
}

function sanitizeProfileName(value?: string) {
  return (value?.trim() || "Leadsy Workspace").slice(0, 80);
}

function sanitizeWebsite(value?: string) {
  const trimmed = value?.trim();
  return trimmed && /^https?:\/\/.+\..+/.test(trimmed) ? trimmed : undefined;
}

function statusFromTwilioSenderStatus(status?: string): WorkspaceWhatsAppSenderStatus {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (["approved", "online", "active", "connected"].includes(normalized)) return "approved";
  if (["failed", "rejected", "disabled"].includes(normalized)) return "failed";
  return "pending_verification";
}

async function searchTwilioNumberInventory(input: {
  countries: string[];
  numberTypes: Array<"Mobile" | "Local">;
  reasonLabel: string;
}): Promise<TwilioOperationResult<TwilioNumberSearchResult>> {
  const credentials = twilioCredentials();
  if (!credentials) {
    return {
      ok: false,
      status: "sender_registration_pending",
      reason: `Twilio credentials are not configured for ${input.reasonLabel}.`
    };
  }
  const errors: string[] = [];
  for (const countryCode of input.countries) {
    for (const numberType of input.numberTypes) {
      const url = new URL(`${twilioApiBase(credentials)}/AvailablePhoneNumbers/${countryCode}/${numberType}.json`);
      url.searchParams.set("SmsEnabled", "true");
      url.searchParams.set("Limit", "1");
      const result = await twilioJsonRequest<{ available_phone_numbers?: Array<{ phone_number?: string }> }>(url.toString(), { method: "GET" });
      if (!result.ok) {
        errors.push(`${countryCode}/${numberType}: ${result.reason}`);
        continue;
      }
      const phoneNumber = result.value.available_phone_numbers?.find((item) => typeof item.phone_number === "string")?.phone_number;
      if (phoneNumber) return { ok: true, value: { phoneNumber, countryCode, numberType } };
    }
  }
  return {
    ok: false,
    status: "sender_registration_pending",
    reason: errors.length > 0
      ? `${input.reasonLabel} did not return an available SMS-capable number. ${errors.slice(0, 3).join(" ")}`
      : `${input.reasonLabel} did not return an available SMS-capable number.`
  };
}

export async function searchIndianTwilioNumber(): Promise<TwilioOperationResult<TwilioNumberSearchResult>> {
  return searchTwilioNumberInventory({
    countries: ["IN"],
    numberTypes: ["Mobile", "Local"],
    reasonLabel: "Twilio India number search"
  });
}

export async function searchFallbackTwilioNumber(): Promise<TwilioOperationResult<TwilioNumberSearchResult>> {
  return searchTwilioNumberInventory({
    countries: fallbackInventoryCountries(),
    numberTypes: ["Local", "Mobile"],
    reasonLabel: "Twilio fallback number search"
  });
}

export async function buyTwilioPhoneNumber(phoneNumber: string): Promise<TwilioOperationResult<{ phoneNumber: string; sid: string }>> {
  const credentials = twilioCredentials();
  if (!credentials) {
    return {
      ok: false,
      status: "sender_registration_pending",
      reason: "Twilio credentials are not configured for number purchase."
    };
  }
  const body = new URLSearchParams({ PhoneNumber: phoneNumber });
  const result = await twilioJsonRequest<{ sid?: string; phone_number?: string }>(`${twilioApiBase(credentials)}/IncomingPhoneNumbers.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!result.ok) return result;
  if (!result.value.sid) {
    return {
      ok: false,
      status: "failed",
      reason: "Twilio purchased the number but did not return an IncomingPhoneNumber SID."
    };
  }
  return { ok: true, value: { sid: result.value.sid, phoneNumber: result.value.phone_number ?? phoneNumber } };
}

export async function registerTwilioWhatsAppSender(
  sender: WorkspaceWhatsAppSender,
  profile: WorkspaceWhatsAppSenderProfile = {}
): Promise<TwilioOperationResult<{ sid: string; status: WorkspaceWhatsAppSenderStatus; reason: string }>> {
  if (!sender.twilioFrom) {
    return {
      ok: false,
      status: "failed",
      reason: "A Twilio WhatsApp From number is required before sender registration."
    };
  }
  const website = sanitizeWebsite(profile.website);
  const body = {
    sender_id: sender.twilioFrom,
    configuration: {
      verification_method: "sms"
    },
    profile: {
      name: sanitizeProfileName(profile.businessName ?? sender.businessName),
      vertical: profile.industry?.trim() || "Other",
      about: "Lead conversations managed by Leadsy.",
      description: "Leadsy-managed WhatsApp number for inbound lead conversations and human-approved replies.",
      websites: website ? [website] : ["https://leadsy.up.railway.app"]
    },
    webhook: {
      callback_method: "POST",
      callback_url: webhookCallbackUrl()
    }
  };
  const result = await twilioJsonRequest<{ sid?: string; status?: string }>("https://messaging.twilio.com/v2/Channels/Senders", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  });
  if (!result.ok) {
    return {
      ok: false,
      status: result.status === "failed" ? "failed" : "pending_verification",
      reason: result.reason
    };
  }
  if (!result.value.sid) {
    return {
      ok: false,
      status: "pending_verification",
      reason: "Twilio accepted the sender registration request but did not return a sender SID."
    };
  }
  const status = statusFromTwilioSenderStatus(result.value.status);
  return {
    ok: true,
    value: {
      sid: result.value.sid,
      status,
      reason: status === "approved" ? "Twilio reported the WhatsApp sender as approved." : `Twilio sender registration is ${result.value.status ?? "pending"}.`
    }
  };
}

async function reserveWorkspaceSenderFromPool(
  input: WorkspaceWhatsAppSenderScope & { businessName?: string },
  statusReason: string
) {
  return mutateState((state) => {
    const now = nowIso();
    const existing = state.senders.find((sender) => senderMatchesScope(sender, input));
    const used = new Set(state.senders.map((sender) => sender.twilioFrom).filter(Boolean));
    const poolNumber = configuredSenderPool().find((sender) => !used.has(sender.twilioFrom) || existing?.twilioFrom === sender.twilioFrom);
    const sender: WorkspaceWhatsAppSender = poolNumber
      ? {
          tenantId: input.tenantId,
          ownerId: input.ownerId,
          businessName: input.businessName?.trim() || existing?.businessName,
          assignedPhoneNumber: poolNumber.assignedPhoneNumber,
          twilioFrom: poolNumber.twilioFrom,
          twilioPhoneNumberSid: existing?.twilioPhoneNumberSid,
          twilioSenderSid: existing?.twilioSenderSid,
          status: "number_reserved",
          statusReason,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        }
      : {
          tenantId: input.tenantId,
          ownerId: input.ownerId,
          businessName: input.businessName?.trim() || existing?.businessName,
          status: "sender_registration_pending",
          statusReason: "Live India provisioning is unavailable and no fallback platform sender is currently available in the assignment pool.",
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        };
    return {
      state: {
        senders: existing
          ? state.senders.map((candidate) => (senderMatchesScope(candidate, input) ? sender : candidate))
          : [...state.senders, sender]
      },
      result: sender
    };
  });
}

export async function ensureWorkspaceWhatsAppSender(input: {
  tenantId: string;
  ownerId: string;
  businessName?: string;
}) {
  return mutateState((state) => {
    const now = nowIso();
    const existing = state.senders.find((sender) => senderMatchesScope(sender, input));
    if (existing) {
      const updated: WorkspaceWhatsAppSender = {
        ...existing,
        businessName: input.businessName?.trim() || existing.businessName,
        updatedAt: now
      };
      return {
        state: {
          senders: state.senders.map((sender) => (senderMatchesScope(sender, input) ? updated : sender))
        },
        result: updated
      };
    }
    const sender: WorkspaceWhatsAppSender = {
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      businessName: input.businessName?.trim() || undefined,
      status: "not_started",
      statusReason: "Leadsy will assign a dedicated WhatsApp sender after workspace setup.",
      createdAt: now,
      updatedAt: now
    };
    return { state: { senders: [...state.senders, sender] }, result: sender };
  });
}

export async function upsertWorkspaceWhatsAppSender(input: {
  tenantId: string;
  ownerId: string;
  businessName?: string;
  countryCode?: string;
  whatsappNumber?: string;
  assignedPhoneNumber?: string;
  twilioPhoneNumberSid?: string;
  twilioSenderSid?: string;
  status?: WorkspaceWhatsAppSenderStatus;
  statusReason?: string;
}) {
  const normalized = input.assignedPhoneNumber || input.whatsappNumber
    ? normalizeWorkspaceWhatsAppNumber({ whatsappNumber: input.assignedPhoneNumber ?? input.whatsappNumber ?? "", countryCode: input.countryCode })
    : undefined;
  return mutateState((state) => {
    const now = nowIso();
    const existing = state.senders.find((sender) => senderMatchesScope(sender, input));
    const sender: WorkspaceWhatsAppSender = {
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      businessName: input.businessName?.trim() || existing?.businessName,
      assignedPhoneNumber: normalized?.assignedPhoneNumber ?? existing?.assignedPhoneNumber,
      twilioFrom: normalized?.twilioFrom ?? existing?.twilioFrom,
      twilioPhoneNumberSid: input.twilioPhoneNumberSid ?? existing?.twilioPhoneNumberSid,
      twilioSenderSid: input.twilioSenderSid ?? existing?.twilioSenderSid,
      status: input.status ?? existing?.status ?? (normalized ? "number_reserved" : "not_started"),
      statusReason: input.statusReason ?? existing?.statusReason,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    return {
      state: {
        senders: existing
          ? state.senders.map((candidate) => (senderMatchesScope(candidate, input) ? sender : candidate))
          : [...state.senders, sender]
      },
      result: sender
    };
  });
}

export async function provisionLeadsyAssignedWhatsAppSender(
  scope: WorkspaceWhatsAppSenderScope,
  profile: WorkspaceWhatsAppSenderProfile = {}
) {
  const businessName = profile.businessName?.trim();
  const existing = await getWorkspaceWhatsAppSender(scope);
  if (
    existing?.assignedPhoneNumber &&
    (existing.status === "approved" || existing.status === "number_reserved" || existing.status === "pending_verification")
  ) {
    return businessName && businessName !== existing.businessName
      ? upsertWorkspaceWhatsAppSender({ ...scope, businessName, status: existing.status, statusReason: existing.statusReason })
      : existing;
  }

  await ensureWorkspaceWhatsAppSender({ ...scope, businessName });
  const search = await searchIndianTwilioNumber();
  const fallbackSearch = search.ok ? undefined : await searchFallbackTwilioNumber();
  const selectedSearch = search.ok ? search : fallbackSearch;
  if (!selectedSearch?.ok) {
    return reserveWorkspaceSenderFromPool(
      { ...scope, businessName },
      `Live Twilio provisioning fallback: ${search.ok ? "" : search.reason}${fallbackSearch?.ok ? "" : ` ${fallbackSearch?.reason ?? ""}`}`.trim()
    );
  }

  const purchase = await buyTwilioPhoneNumber(selectedSearch.value.phoneNumber);
  if (!purchase.ok) {
    return reserveWorkspaceSenderFromPool(
      { ...scope, businessName },
      `Live Twilio provisioning fallback: ${purchase.reason}`
    );
  }

  const reserved = await upsertWorkspaceWhatsAppSender({
    ...scope,
    businessName,
    assignedPhoneNumber: purchase.value.phoneNumber,
    twilioPhoneNumberSid: purchase.value.sid,
    status: "number_reserved",
    statusReason: selectedSearch.value.countryCode === "IN"
      ? "Leadsy purchased this Twilio India number. WhatsApp sender registration is starting."
      : `Leadsy purchased this Twilio ${selectedSearch.value.countryCode} number because India inventory was unavailable. WhatsApp sender registration is starting.`
  });

  const registration = await registerTwilioWhatsAppSender(reserved, profile);
  if (!registration.ok) {
    return upsertWorkspaceWhatsAppSender({
      ...scope,
      businessName,
      assignedPhoneNumber: purchase.value.phoneNumber,
      twilioPhoneNumberSid: purchase.value.sid,
      status: registration.status === "failed" ? "failed" : "pending_verification",
      statusReason: registration.reason
    });
  }

  return upsertWorkspaceWhatsAppSender({
    ...scope,
    businessName,
    assignedPhoneNumber: purchase.value.phoneNumber,
    twilioPhoneNumberSid: purchase.value.sid,
    twilioSenderSid: registration.value.sid,
    status: registration.value.status,
    statusReason: registration.value.reason
  });
}

export async function provisionWorkspaceWhatsAppSender(input: WorkspaceWhatsAppSenderScope & { businessName?: string }) {
  return provisionLeadsyAssignedWhatsAppSender(input, { businessName: input.businessName });
}

export async function getWorkspaceWhatsAppSender(scope: { tenantId: string; ownerId: string }) {
  const state = await readState();
  return state.senders.find((sender) => senderMatchesScope(sender, scope));
}

export async function resolveWorkspaceWhatsAppSenderByTwilioTo(to?: string) {
  const normalized = to ? normalizeWorkspaceWhatsAppNumber({ whatsappNumber: to }) : undefined;
  if (!normalized) return undefined;
  const state = await readState();
  return state.senders.find((sender) => sender.twilioFrom === normalized.twilioFrom);
}

export async function listWorkspaceWhatsAppSenders() {
  const state = await readState();
  return state.senders;
}
