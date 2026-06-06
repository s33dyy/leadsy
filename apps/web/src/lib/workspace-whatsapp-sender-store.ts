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

function senderMatchesScope(sender: WorkspaceWhatsAppSender, scope: { tenantId: string; ownerId: string }) {
  return sender.tenantId === scope.tenantId && sender.ownerId === scope.ownerId;
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

export async function provisionWorkspaceWhatsAppSender(input: {
  tenantId: string;
  ownerId: string;
  businessName?: string;
}) {
  return mutateState((state) => {
    const now = nowIso();
    const existing = state.senders.find((sender) => senderMatchesScope(sender, input));
    if (existing?.status === "approved" || existing?.status === "number_reserved" || existing?.status === "sender_registration_pending" || existing?.status === "pending_verification") {
      return { result: existing };
    }

    const used = new Set(state.senders.map((sender) => sender.twilioFrom).filter(Boolean));
    const poolNumber = configuredSenderPool().find((sender) => !used.has(sender.twilioFrom));
    const sender: WorkspaceWhatsAppSender = poolNumber
      ? {
          tenantId: input.tenantId,
          ownerId: input.ownerId,
          businessName: input.businessName?.trim() || existing?.businessName,
          assignedPhoneNumber: poolNumber.assignedPhoneNumber,
          twilioFrom: poolNumber.twilioFrom,
          status: "number_reserved",
          statusReason: "Leadsy reserved this platform WhatsApp number. Twilio sender registration or approval is still pending.",
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        }
      : {
          tenantId: input.tenantId,
          ownerId: input.ownerId,
          businessName: input.businessName?.trim() || existing?.businessName,
          status: "sender_registration_pending",
          statusReason: "No platform sender is currently available in the assignment pool. Leadsy operations must provision one in Twilio.",
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
