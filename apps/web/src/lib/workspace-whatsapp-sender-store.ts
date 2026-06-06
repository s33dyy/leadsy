import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const senderFile = join(leadsyDataDir, "workspace-whatsapp-senders.json");

export type WorkspaceWhatsAppSenderStatus = "approved" | "pending" | "disabled";

export type WorkspaceWhatsAppSender = {
  tenantId: string;
  ownerId: string;
  businessName?: string;
  countryCode: string;
  whatsappNumber: string;
  twilioFrom: string;
  status: WorkspaceWhatsAppSenderStatus;
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
    return { senders: Array.isArray(parsed.senders) ? parsed.senders : [] };
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
    whatsappNumber: `+${normalizedDigits}`,
    twilioFrom: `whatsapp:+${normalizedDigits}`
  };
}

export async function upsertWorkspaceWhatsAppSender(input: {
  tenantId: string;
  ownerId: string;
  businessName?: string;
  countryCode?: string;
  whatsappNumber: string;
  status?: WorkspaceWhatsAppSenderStatus;
}) {
  const normalized = normalizeWorkspaceWhatsAppNumber(input);
  if (!normalized) return undefined;
  return mutateState((state) => {
    const now = nowIso();
    const existing = state.senders.find((sender) => sender.tenantId === input.tenantId && sender.ownerId === input.ownerId);
    const sender: WorkspaceWhatsAppSender = {
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      businessName: input.businessName?.trim() || existing?.businessName,
      countryCode: normalized.countryCode,
      whatsappNumber: normalized.whatsappNumber,
      twilioFrom: normalized.twilioFrom,
      status: input.status ?? existing?.status ?? "approved",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    return {
      state: {
        senders: existing
          ? state.senders.map((candidate) => (candidate.tenantId === input.tenantId && candidate.ownerId === input.ownerId ? sender : candidate))
          : [...state.senders, sender]
      },
      result: sender
    };
  });
}

export async function getWorkspaceWhatsAppSender(scope: { tenantId: string; ownerId: string }) {
  const state = await readState();
  return state.senders.find((sender) => sender.tenantId === scope.tenantId && sender.ownerId === scope.ownerId);
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
