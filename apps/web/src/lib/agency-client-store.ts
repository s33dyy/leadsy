import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { agencyClients, tenantId, type AgencyClient, type ClientVertical } from "@leadsy/domain";
import { leadsyDataDir } from "./data-dir";

type ClientInput = {
  name: string;
  city: string;
  businessType: string;
};

type ClientProfileInput = {
  targetAudience: string;
  primaryOffer: string;
  leadLocation: string;
  monthlyLeadGoal: number;
};

const dataFile = join(leadsyDataDir, "agency-clients.json");

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function invitePrefix(value: string) {
  const cleaned = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return (cleaned || "CLNT").padEnd(4, "X").slice(0, 4);
}

function createInviteCode(clientName: string, takenCodes: Set<string>) {
  let inviteCode = "";
  do {
    inviteCode = `${invitePrefix(clientName)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  } while (takenCodes.has(inviteCode));
  takenCodes.add(inviteCode);
  return inviteCode;
}

function ensureClientInvites(clients: AgencyClient[]) {
  const takenCodes = new Set(
    clients
      .map((client) => client.inviteCode)
      .filter((inviteCode): inviteCode is string => Boolean(inviteCode))
      .map((inviteCode) => inviteCode.toUpperCase())
  );
  let changed = false;

  const hydratedClients = clients.map((client) => {
    if (client.inviteCode) {
      return client;
    }

    changed = true;
    return {
      ...client,
      inviteCode: createInviteCode(client.name, takenCodes),
      inviteGeneratedAt: new Date().toISOString()
    };
  });

  return { clients: hydratedClients, changed };
}

function inferVertical(businessType: string): ClientVertical {
  const normalized = businessType.toLowerCase();
  if (normalized.includes("real estate") || normalized.includes("property") || normalized.includes("builder")) {
    return "real-estate";
  }
  if (normalized.includes("education") || normalized.includes("coaching") || normalized.includes("admission")) {
    return "education";
  }
  if (normalized.includes("clinic") || normalized.includes("doctor") || normalized.includes("health")) {
    return "clinic";
  }
  if (normalized.includes("service") || normalized.includes("salon") || normalized.includes("local")) {
    return "local-services";
  }
  return "agency";
}

async function readStoredClients() {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AgencyClient[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeStoredClients(clients: AgencyClient[]) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(clients, null, 2)}\n`);
}

export async function listAgencyClients() {
  const storedClients = await readStoredClients();
  const hydrated = ensureClientInvites(storedClients);
  if (hydrated.changed) {
    await writeStoredClients(hydrated.clients);
  }

  const byId = new Map<string, AgencyClient>();
  for (const client of [...agencyClients, ...hydrated.clients]) {
    byId.set(client.id, client);
  }
  return [...byId.values()];
}

export async function createAgencyClient(input: ClientInput) {
  const clients = await readStoredClients();
  const client: AgencyClient = {
    id: `client_${slugify(input.name || input.businessType || "workspace")}_${crypto.randomUUID().slice(0, 8)}`,
    tenantId,
    name: input.name.trim(),
    vertical: inferVertical(input.businessType),
    businessType: input.businessType.trim(),
    inviteCode: createInviteCode(input.name || input.businessType || "client", new Set(clients.map((client) => client.inviteCode ?? ""))),
    inviteGeneratedAt: new Date().toISOString(),
    city: input.city.trim(),
    plan: "starter",
    monthlyAdSpend: 0,
    monthlyLeads: 0,
    costPerLead: 0,
    responseSlaSeconds: 0,
    qualificationRate: 0,
    bookingRate: 0,
    conversionRate: 0,
    status: "watch",
    owner: "Workspace Owner"
  };
  await writeStoredClients([...clients, client]);
  return client;
}

export async function getAgencyClient(clientId: string) {
  return (await listAgencyClients()).find((client) => client.id === clientId);
}

export async function getAgencyClientByInviteCode(inviteCode: string) {
  const normalizedInviteCode = inviteCode.trim().toUpperCase();
  return (await listAgencyClients()).find((client) => client.inviteCode?.toUpperCase() === normalizedInviteCode) ?? null;
}

export async function markAgencyClientRegistered(clientId: string, userId: string) {
  const clients = await readStoredClients();
  const hydrated = ensureClientInvites(clients);
  const index = hydrated.clients.findIndex((client) => client.id === clientId);
  if (index === -1 || hydrated.clients[index].clientRegisteredAt) {
    return null;
  }

  const updated: AgencyClient = {
    ...hydrated.clients[index],
    clientUserId: userId,
    clientRegisteredAt: new Date().toISOString()
  };

  hydrated.clients[index] = updated;
  await writeStoredClients(hydrated.clients);
  return updated;
}

export async function regenerateAgencyClientInvite(clientId: string) {
  const clients = await readStoredClients();
  const hydrated = ensureClientInvites(clients);
  const index = hydrated.clients.findIndex((client) => client.id === clientId);
  if (index === -1) {
    return null;
  }

  if (hydrated.clients[index].clientRegisteredAt) {
    return { error: "already_registered" as const };
  }

  const takenCodes = new Set(
    hydrated.clients
      .filter((client) => client.id !== clientId)
      .map((client) => client.inviteCode)
      .filter((inviteCode): inviteCode is string => Boolean(inviteCode))
      .map((inviteCode) => inviteCode.toUpperCase())
  );

  const updated: AgencyClient = {
    ...hydrated.clients[index],
    inviteCode: createInviteCode(hydrated.clients[index].name, takenCodes),
    inviteGeneratedAt: new Date().toISOString()
  };

  hydrated.clients[index] = updated;
  await writeStoredClients(hydrated.clients);
  return { client: updated };
}

export async function updateAgencyClientProfile(clientId: string, input: ClientProfileInput) {
  const storedClients = await readStoredClients();
  const hydrated = ensureClientInvites(storedClients);
  const index = hydrated.clients.findIndex((client) => client.id === clientId);
  if (index === -1) {
    return null;
  }

  const updated: AgencyClient = {
    ...hydrated.clients[index],
    targetAudience: input.targetAudience.trim(),
    primaryOffer: input.primaryOffer.trim(),
    leadLocation: input.leadLocation.trim(),
    monthlyLeadGoal: input.monthlyLeadGoal,
    onboardingCompletedAt: new Date().toISOString()
  };

  hydrated.clients[index] = updated;
  await writeStoredClients(hydrated.clients);
  return updated;
}
