import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { tenantId } from "@leadsy/domain";
import { leadsyDataDir } from "./data-dir";

const authFile = join(leadsyDataDir, "auth.json");
const sessionTtlMs = 1000 * 60 * 60 * 24 * 14;
const scryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export type AuthRole = "owner" | "admin" | "client";

export type AuthUser = {
  id: string;
  tenantId: string;
  clientId?: string;
  name: string;
  emailOrPhone: string;
  normalizedLogin: string;
  passwordHash: string;
  role: AuthRole;
  createdAt: string;
  lastLoginAt?: string;
};

type StoredAuthSession = {
  id: string;
  tenantId: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
};

type AuthState = {
  users: AuthUser[];
  sessions: StoredAuthSession[];
};

function emptyState(): AuthState {
  return {
    users: [],
    sessions: []
  };
}

export function normalizeLogin(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function derivePasswordKey(password: string, salt: string, keyLength: number, options: typeof scryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

async function readAuthState(): Promise<AuthState> {
  try {
    const raw = await readFile(authFile, "utf8");
    if (!raw.trim()) {
      return emptyState();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return emptyState();
    }
    const state = parsed as Partial<AuthState>;
    return {
      users: Array.isArray(state.users) ? state.users : [],
      sessions: Array.isArray(state.sessions) ? state.sessions : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyState();
    }
    if (error instanceof SyntaxError) {
      return emptyState();
    }
    throw error;
  }
}

async function writeAuthState(state: AuthState) {
  await mkdir(dirname(authFile), { recursive: true });
  const tempFile = `${authFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, authFile);
}

async function cleanExpiredSessions(state: AuthState) {
  const now = Date.now();
  const activeSessions = state.sessions.filter((session) => Date.parse(session.expiresAt) > now);
  if (activeSessions.length !== state.sessions.length) {
    state.sessions = activeSessions;
    await writeAuthState(state);
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await derivePasswordKey(password, salt, 64, scryptOptions);
  return `scrypt$${scryptOptions.N}$${scryptOptions.r}$${scryptOptions.p}$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, n, r, p, salt, expectedHash] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !expectedHash) {
    return false;
  }

  const expected = Buffer.from(expectedHash, "base64url");
  const derived = await derivePasswordKey(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024
  });

  if (expected.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(expected, derived);
}

export async function hasOwnerUser() {
  const state = await readAuthState();
  return state.users.some((user) => user.role === "owner");
}

export async function listAuthUsers() {
  const state = await readAuthState();
  return state.users;
}

export async function getAuthUserById(userId: string) {
  const state = await readAuthState();
  return state.users.find((user) => user.id === userId) ?? null;
}

export async function getAuthUserByLogin(emailOrPhone: string) {
  const state = await readAuthState();
  const normalizedLogin = normalizeLogin(emailOrPhone);
  return state.users.find((user) => user.normalizedLogin === normalizedLogin) ?? null;
}

export async function createOwnerUser(input: { name: string; emailOrPhone: string; password: string }) {
  const state = await readAuthState();
  if (state.users.some((user) => user.role === "owner")) {
    return { ok: false as const, reason: "owner_exists" as const };
  }

  const normalizedLogin = normalizeLogin(input.emailOrPhone);
  if (state.users.some((user) => user.normalizedLogin === normalizedLogin)) {
    return { ok: false as const, reason: "login_exists" as const };
  }

  const user: AuthUser = {
    id: `usr_${crypto.randomUUID().slice(0, 12)}`,
    tenantId,
    name: input.name.trim(),
    emailOrPhone: input.emailOrPhone.trim(),
    normalizedLogin,
    passwordHash: await hashPassword(input.password),
    role: "owner",
    createdAt: new Date().toISOString()
  };

  await writeAuthState({ ...state, users: [...state.users, user] });
  return { ok: true as const, user };
}

export async function createClientUser(input: {
  clientId: string;
  name: string;
  emailOrPhone: string;
  password: string;
}) {
  const state = await readAuthState();
  const normalizedLogin = normalizeLogin(input.emailOrPhone);
  if (state.users.some((user) => user.normalizedLogin === normalizedLogin)) {
    return { ok: false as const, reason: "login_exists" as const };
  }

  const user: AuthUser = {
    id: `usr_${crypto.randomUUID().slice(0, 12)}`,
    tenantId,
    clientId: input.clientId,
    name: input.name.trim(),
    emailOrPhone: input.emailOrPhone.trim(),
    normalizedLogin,
    passwordHash: await hashPassword(input.password),
    role: "client",
    createdAt: new Date().toISOString()
  };

  await writeAuthState({ ...state, users: [...state.users, user] });
  return { ok: true as const, user };
}

export async function deleteAuthUser(userId: string) {
  const state = await readAuthState();
  await writeAuthState({
    users: state.users.filter((user) => user.id !== userId),
    sessions: state.sessions.filter((session) => session.userId !== userId)
  });
}

export async function authenticateUser(emailOrPhone: string, password: string) {
  const state = await readAuthState();
  const normalizedLogin = normalizeLogin(emailOrPhone);
  const user = state.users.find((candidate) => candidate.normalizedLogin === normalizedLogin);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  const updatedUser = { ...user, lastLoginAt: new Date().toISOString() };
  await writeAuthState({
    ...state,
    users: state.users.map((candidate) => (candidate.id === user.id ? updatedUser : candidate))
  });
  return updatedUser;
}

export async function createAuthSession(user: AuthUser) {
  const state = await readAuthState();
  const id = `ses_${crypto.randomUUID().slice(0, 18)}`;
  const secret = randomBytes(32).toString("base64url");
  const token = `${id}.${secret}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTtlMs);

  const session: StoredAuthSession = {
    id,
    tenantId: user.tenantId,
    userId: user.id,
    tokenHash: sha256(token),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastSeenAt: now.toISOString()
  };

  const sessions = state.sessions.filter((candidate) => Date.parse(candidate.expiresAt) > now.getTime());
  sessions.push(session);
  await writeAuthState({ ...state, sessions });
  return { token, expiresAt };
}

export async function resolveAuthSession(token: string) {
  const state = await readAuthState();
  await cleanExpiredSessions(state);

  const [sessionId] = token.split(".");
  const session = state.sessions.find((candidate) => candidate.id === sessionId && candidate.tokenHash === sha256(token));
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    return null;
  }

  const user = state.users.find((candidate) => candidate.id === session.userId);
  if (!user) {
    return null;
  }

  session.lastSeenAt = new Date().toISOString();
  await writeAuthState(state);
  return { session, user };
}

export async function deleteAuthSession(token: string) {
  const state = await readAuthState();
  const [sessionId] = token.split(".");
  await writeAuthState({
    ...state,
    sessions: state.sessions.filter((candidate) => candidate.id !== sessionId)
  });
}
