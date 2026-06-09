import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const twilioSettingsFile = join(leadsyDataDir, "twilio-settings.json");

export type WorkspaceTwilioSettings = {
  tenantId: string;
  ownerId: string;
  enabled: boolean;
  accountSid: string;
  authToken: string;
  whatsappFrom: string;
  webhookUrl?: string;
  statusCallbackUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceTwilioSettingsSummary = {
  configured: boolean;
  enabled: boolean;
  accountSid?: string;
  maskedAuthToken?: string;
  whatsappFrom?: string;
  webhookUrl?: string;
  statusCallbackUrl?: string;
  updatedAt?: string;
};

type TwilioSettingsState = {
  workspaces: WorkspaceTwilioSettings[];
};

type Scope = {
  tenantId: string;
  ownerId: string;
};

function emptyState(): TwilioSettingsState {
  return { workspaces: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function scopeKey(scope: Scope) {
  return `${scope.tenantId}:${scope.ownerId}`;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  const clean = text(value);
  return clean || undefined;
}

function normalizeWhatsAppFrom(value: unknown) {
  const clean = text(value);
  if (!clean) return "";
  if (clean.startsWith("whatsapp:+")) return clean;
  const digits = clean.replace(/\D/g, "");
  return digits ? `whatsapp:+${digits}` : clean;
}

function normalizeStoredSettings(value: WorkspaceTwilioSettings): WorkspaceTwilioSettings {
  return {
    tenantId: text(value.tenantId),
    ownerId: text(value.ownerId),
    enabled: value.enabled === true,
    accountSid: text(value.accountSid),
    authToken: text(value.authToken),
    whatsappFrom: normalizeWhatsAppFrom(value.whatsappFrom),
    webhookUrl: optionalText(value.webhookUrl),
    statusCallbackUrl: optionalText(value.statusCallbackUrl),
    createdAt: text(value.createdAt) || nowIso(),
    updatedAt: text(value.updatedAt) || nowIso()
  };
}

async function readState(): Promise<TwilioSettingsState> {
  try {
    const raw = await readFile(twilioSettingsFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<TwilioSettingsState>;
    return {
      workspaces: Array.isArray(parsed.workspaces)
        ? parsed.workspaces.map((workspace) => normalizeStoredSettings(workspace as WorkspaceTwilioSettings))
        : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return emptyState();
    throw error;
  }
}

async function writeState(state: TwilioSettingsState) {
  await mkdir(dirname(twilioSettingsFile), { recursive: true });
  const tempFile = `${twilioSettingsFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, twilioSettingsFile);
}

let settingsMutationQueue = Promise.resolve();

async function mutateState<T>(updater: (state: TwilioSettingsState) => { result: T; state?: TwilioSettingsState } | Promise<{ result: T; state?: TwilioSettingsState }>) {
  const operation = settingsMutationQueue.then(async () => {
    const state = await readState();
    const next = await updater(state);
    if (next.state) await writeState(next.state);
    return next.result;
  });
  settingsMutationQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

function maskSid(value: string) {
  if (!value) return undefined;
  return value.length <= 8 ? `${value.slice(0, 2)}...` : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function maskToken(value: string) {
  return value ? "saved" : undefined;
}

export function maskWorkspaceTwilioConfig(config?: WorkspaceTwilioSettings): WorkspaceTwilioSettingsSummary {
  return {
    configured: Boolean(config?.accountSid && config.authToken && config.whatsappFrom),
    enabled: Boolean(config?.enabled && config.accountSid && config.authToken && config.whatsappFrom),
    accountSid: config?.accountSid ? maskSid(config.accountSid) : undefined,
    maskedAuthToken: config?.authToken ? maskToken(config.authToken) : undefined,
    whatsappFrom: config?.whatsappFrom,
    webhookUrl: config?.webhookUrl,
    statusCallbackUrl: config?.statusCallbackUrl,
    updatedAt: config?.updatedAt
  };
}

export async function getWorkspaceTwilioSettings(scope: Scope) {
  const state = await readState();
  return state.workspaces.find((workspace) => scopeKey(workspace) === scopeKey(scope));
}

export async function getWorkspaceTwilioSettingsSummary(scope: Scope) {
  return maskWorkspaceTwilioConfig(await getWorkspaceTwilioSettings(scope));
}

export async function updateWorkspaceTwilioSettings(input: Scope & {
  enabled?: boolean;
  accountSid?: unknown;
  authToken?: unknown;
  whatsappFrom?: unknown;
  webhookUrl?: unknown;
  statusCallbackUrl?: unknown;
}) {
  return mutateState((state) => {
    const now = nowIso();
    const existing = state.workspaces.find((workspace) => scopeKey(workspace) === scopeKey(input));
    const next: WorkspaceTwilioSettings = normalizeStoredSettings({
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      enabled: input.enabled ?? existing?.enabled ?? false,
      accountSid: text(input.accountSid) || existing?.accountSid || "",
      authToken: text(input.authToken) || existing?.authToken || "",
      whatsappFrom: normalizeWhatsAppFrom(input.whatsappFrom) || existing?.whatsappFrom || "",
      webhookUrl: input.webhookUrl === "" ? undefined : optionalText(input.webhookUrl) ?? existing?.webhookUrl,
      statusCallbackUrl: input.statusCallbackUrl === "" ? undefined : optionalText(input.statusCallbackUrl) ?? existing?.statusCallbackUrl,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
    return {
      state: {
        workspaces: existing
          ? state.workspaces.map((workspace) => (scopeKey(workspace) === scopeKey(input) ? next : workspace))
          : [...state.workspaces, next]
      },
      result: next
    };
  });
}

export async function clearWorkspaceTwilioSettings(scope: Scope) {
  return mutateState((state) => {
    return {
      state: {
        workspaces: state.workspaces.filter((workspace) => scopeKey(workspace) !== scopeKey(scope))
      },
      result: maskWorkspaceTwilioConfig(undefined)
    };
  });
}
