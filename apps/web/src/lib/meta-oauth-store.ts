import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const metaOAuthFile = join(leadsyDataDir, "meta-oauth.json");
const metaOAuthEndpoint = "https://graph.facebook.com/oauth/access_token";

export type MetaOAuthTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type MetaOAuthExchangeResult =
  | { ok: true; token: MetaOAuthTokenResponse }
  | { ok: false; reason: "unconfigured" | "exchange_failed"; error?: string };

type MetaOAuthConnectionRecord = {
  id: string;
  tenantId: string;
  ownerId: string;
  accessToken: string;
  tokenPreview: string;
  tokenType?: string;
  expiresAt?: string;
  businessId?: string;
  whatsappBusinessAccountId?: string;
  phoneNumberId?: string;
  facebookPageId?: string;
  instagramBusinessAccountId?: string;
  channels: MetaOAuthChannelReadiness;
  rawQuery: Record<string, string>;
  connectedAt: string;
  updatedAt: string;
};

export type MetaOAuthConnectionSummary = Omit<MetaOAuthConnectionRecord, "accessToken"> & {
  accessToken?: never;
};

export type MetaOAuthChannelReadiness = {
  whatsapp: { status: "connected" | "needs_asset"; assetId?: string; phoneNumberId?: string };
  instagram: { status: "connected" | "needs_asset"; assetId?: string };
  facebook: { status: "connected" | "needs_asset"; assetId?: string };
};

export type MetaOAuthAssetLookup = {
  whatsappBusinessAccountId?: string;
  phoneNumberId?: string;
  facebookPageId?: string;
  instagramBusinessAccountId?: string;
};

export type MetaOAuthAssetLookupResult =
  | { ok: true; connection: MetaOAuthConnectionSummary }
  | { ok: false; reason: "no_assets" | "not_found" | "ambiguous"; matches?: MetaOAuthConnectionSummary[] };

type MetaOAuthState = {
  connections: MetaOAuthConnectionRecord[];
};

function emptyState(): MetaOAuthState {
  return { connections: [] };
}

async function readState(): Promise<MetaOAuthState> {
  try {
    const raw = await readFile(metaOAuthFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<MetaOAuthState>;
    return { connections: Array.isArray(parsed.connections) ? parsed.connections : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) {
      return emptyState();
    }
    throw error;
  }
}

async function writeState(state: MetaOAuthState) {
  await mkdir(dirname(metaOAuthFile), { recursive: true });
  const tempFile = `${metaOAuthFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, metaOAuthFile);
}

function metaAppConfig() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  return appId && appSecret ? { appId, appSecret } : null;
}

function tokenPreview(token: string) {
  return token ? `...${token.slice(-4)}` : "";
}

function cleanQuery(query: Record<string, string | null | undefined>) {
  const blocked = new Set(["code", "access_token", "client_secret"]);
  return Object.fromEntries(
    Object.entries(query)
      .filter(([key, value]) => value && !blocked.has(key.toLowerCase()))
      .map(([key, value]) => [key, String(value)])
  );
}

function summary(record: MetaOAuthConnectionRecord): MetaOAuthConnectionSummary {
  const safe: Partial<MetaOAuthConnectionRecord> = { ...record };
  delete safe.accessToken;
  return safe as MetaOAuthConnectionSummary;
}

function channelReadiness(input: {
  whatsappBusinessAccountId?: string;
  phoneNumberId?: string;
  facebookPageId?: string;
  instagramBusinessAccountId?: string;
}): MetaOAuthChannelReadiness {
  return {
    whatsapp: {
      status: input.whatsappBusinessAccountId || input.phoneNumberId ? "connected" : "needs_asset",
      assetId: input.whatsappBusinessAccountId,
      phoneNumberId: input.phoneNumberId
    },
    instagram: {
      status: input.instagramBusinessAccountId ? "connected" : "needs_asset",
      assetId: input.instagramBusinessAccountId
    },
    facebook: {
      status: input.facebookPageId ? "connected" : "needs_asset",
      assetId: input.facebookPageId
    }
  };
}

function connectionMatchesAssets(connection: MetaOAuthConnectionRecord, input: MetaOAuthAssetLookup) {
  if (input.phoneNumberId) return connection.phoneNumberId === input.phoneNumberId;
  if (input.facebookPageId) return connection.facebookPageId === input.facebookPageId;
  if (input.instagramBusinessAccountId) return connection.instagramBusinessAccountId === input.instagramBusinessAccountId;
  if (input.whatsappBusinessAccountId) return connection.whatsappBusinessAccountId === input.whatsappBusinessAccountId;
  return false;
}

function hasAnyAsset(input: MetaOAuthAssetLookup) {
  return Boolean(input.whatsappBusinessAccountId || input.phoneNumberId || input.facebookPageId || input.instagramBusinessAccountId);
}

export async function exchangeMetaOAuthCode(input: {
  code: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaOAuthExchangeResult> {
  const config = metaAppConfig();
  if (!config) {
    return { ok: false, reason: "unconfigured" };
  }

  const url = new URL(metaOAuthEndpoint);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("code", input.code);
  url.searchParams.set("redirect_uri", input.redirectUri);

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(url.toString());
  if (!response.ok) {
    return { ok: false, reason: "exchange_failed", error: await response.text().catch(() => response.statusText) };
  }

  const token = (await response.json()) as Partial<MetaOAuthTokenResponse>;
  if (!token.access_token) {
    return { ok: false, reason: "exchange_failed", error: "Meta did not return an access token." };
  }

  return {
    ok: true,
    token: {
      access_token: token.access_token,
      token_type: token.token_type,
      expires_in: token.expires_in
    }
  };
}

export async function saveMetaOAuthConnection(input: {
  tenantId: string;
  ownerId: string;
  token: MetaOAuthTokenResponse;
  query?: Record<string, string | null | undefined>;
}) {
  const state = await readState();
  const now = new Date();
  const scoped = (record: Pick<MetaOAuthConnectionRecord, "tenantId" | "ownerId">) =>
    record.tenantId === input.tenantId && record.ownerId === input.ownerId;
  const existing = state.connections.find(scoped);
  const rawQuery = cleanQuery(input.query ?? {});
  const whatsappBusinessAccountId = rawQuery.waba_id ?? rawQuery.whatsapp_business_account_id;
  const phoneNumberId = rawQuery.phone_number_id;
  const facebookPageId = rawQuery.page_id ?? rawQuery.facebook_page_id;
  const instagramBusinessAccountId = rawQuery.instagram_business_account_id ?? rawQuery.ig_business_account_id;
  const record: MetaOAuthConnectionRecord = {
    id: existing?.id ?? `metaoauth_${crypto.randomUUID()}`,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    accessToken: input.token.access_token,
    tokenPreview: tokenPreview(input.token.access_token),
    tokenType: input.token.token_type,
    expiresAt: input.token.expires_in ? new Date(now.getTime() + input.token.expires_in * 1000).toISOString() : undefined,
    businessId: rawQuery.business_id,
    whatsappBusinessAccountId,
    phoneNumberId,
    facebookPageId,
    instagramBusinessAccountId,
    channels: channelReadiness({ whatsappBusinessAccountId, phoneNumberId, facebookPageId, instagramBusinessAccountId }),
    rawQuery,
    connectedAt: existing?.connectedAt ?? now.toISOString(),
    updatedAt: now.toISOString()
  };

  state.connections = [record, ...state.connections.filter((connection) => !scoped(connection))].slice(0, 50);
  await writeState(state);
  return summary(record);
}

export async function listMetaOAuthConnections(tenantId: string, ownerId: string) {
  const state = await readState();
  return state.connections
    .filter((connection) => connection.tenantId === tenantId && connection.ownerId === ownerId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(summary);
}

export async function findMetaOAuthConnectionForAssets(input: MetaOAuthAssetLookup): Promise<MetaOAuthAssetLookupResult> {
  if (!hasAnyAsset(input)) return { ok: false, reason: "no_assets" };

  const state = await readState();
  const matches = state.connections
    .filter((connection) => connectionMatchesAssets(connection, input))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  if (!matches.length) return { ok: false, reason: "not_found" };

  const ownerKeys = new Set(matches.map((connection) => `${connection.tenantId}:${connection.ownerId}`));
  if (ownerKeys.size > 1) {
    return { ok: false, reason: "ambiguous", matches: matches.map(summary) };
  }

  return { ok: true, connection: summary(matches[0]) };
}
