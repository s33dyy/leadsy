export type Role = "owner" | "admin" | "revops" | "manager" | "sdr" | "viewer" | "client";

export type Permission =
  | "crm:read"
  | "crm:write"
  | "ai:invoke"
  | "workflow:run"
  | "workflow:write"
  | "analytics:read"
  | "admin:manage";

export type SessionUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  clientId?: string;
  onboardingCompletedAt?: string;
  onboardingProfile?: Record<string, unknown>;
};

const rolePermissions: Record<Role, Permission[]> = {
  owner: ["crm:read", "crm:write", "ai:invoke", "workflow:run", "workflow:write", "analytics:read", "admin:manage"],
  admin: ["crm:read", "crm:write", "ai:invoke", "workflow:run", "workflow:write", "analytics:read", "admin:manage"],
  revops: ["crm:read", "crm:write", "ai:invoke", "workflow:run", "workflow:write", "analytics:read"],
  manager: ["crm:read", "crm:write", "ai:invoke", "workflow:run", "analytics:read"],
  sdr: ["crm:read", "crm:write", "ai:invoke", "workflow:run"],
  viewer: ["crm:read", "analytics:read"],
  client: []
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export function getDemoSession(): SessionUser {
  return {
    id: "usr_local_owner",
    tenantId: "tenant_northstar",
    name: "Workspace Owner",
    email: "owner@leadsy.local",
    role: "owner"
  };
}

export function can(user: SessionUser, permission: Permission) {
  return rolePermissions[user.role].includes(permission);
}

export function assertPermission(user: SessionUser, permission: Permission) {
  if (!can(user, permission)) {
    throw new Error(`User ${user.id} does not have ${permission}`);
  }
}

export function enforceTenant<T extends { tenantId: string }>(user: SessionUser, rows: T[]) {
  return rows.filter((row) => row.tenantId === user.tenantId);
}

export function rateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { ok: true, remaining: limit - current.count, resetAt: current.resetAt };
}

export function audit(event: {
  tenantId: string;
  actorId: string;
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
}) {
  const entry = {
    ...event,
    occurredAt: new Date().toISOString(),
    requestId: crypto.randomUUID()
  };
  console.info(JSON.stringify({ level: "info", type: "audit", ...entry }));
  return entry;
}
