import "server-only";

export type N8nGatewayValidation =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: 400 | 401 | 503; error: string; missingFields?: string[] };

export type N8nExecutionReceipt = {
  ok: true;
  accepted: true;
  workflowKey: string;
  n8nExecutionId: string;
  status: string;
  stateBoundary: "leadsy-postgres-via-next-api";
  recordedAt: string;
};

export type N8nAgentReceipt = {
  ok: true;
  accepted: true;
  workflowKey: string;
  n8nExecutionId: string;
  idempotencyKey: string;
  actionCount: number;
  providerConfigMissing: string[];
  stateBoundary: "leadsy-postgres-via-next-api";
  recordedAt: string;
};

function configuredSecret() {
  return process.env.LEADSY_N8N_WEBHOOK_SECRET?.trim();
}

function bearerToken(request: Request) {
  const value = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim();
}

function isNonEmpty(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

export async function validateN8nAutomationRequest(
  request: Request,
  requiredFields: string[]
): Promise<N8nGatewayValidation> {
  const secret = configuredSecret();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "LEADSY_N8N_WEBHOOK_SECRET is not configured on the web service."
    };
  }

  if (bearerToken(request) !== secret) {
    return {
      ok: false,
      status: 401,
      error: "n8n bearer token is missing or invalid."
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Request body must be valid JSON."
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      error: "Request body must be a JSON object."
    };
  }

  const record = body as Record<string, unknown>;
  const missingFields = requiredFields.filter((field) => !isNonEmpty(record[field]));
  if (missingFields.length) {
    return {
      ok: false,
      status: 400,
      error: "Missing required n8n automation fields.",
      missingFields
    };
  }

  return { ok: true, body: record };
}

export function buildN8nExecutionReceipt(
  body: Record<string, unknown>,
  now = new Date()
): N8nExecutionReceipt {
  return {
    ok: true,
    accepted: true,
    workflowKey: String(body.workflowKey),
    n8nExecutionId: String(body.n8nExecutionId),
    status: String(body.status),
    stateBoundary: "leadsy-postgres-via-next-api",
    recordedAt: now.toISOString()
  };
}

export function buildN8nAgentReceipt(body: Record<string, unknown>, now = new Date()): N8nAgentReceipt {
  const n8nLogicPlan = body.n8nLogicPlan && typeof body.n8nLogicPlan === "object" ? body.n8nLogicPlan : {};
  const actionQueue = Array.isArray((n8nLogicPlan as { actionQueue?: unknown }).actionQueue)
    ? (n8nLogicPlan as { actionQueue: unknown[] }).actionQueue
    : [];
  const providerConfigMissing = Array.isArray(body.providerConfigMissing)
    ? body.providerConfigMissing.map((item) => String(item))
    : [];

  return {
    ok: true,
    accepted: true,
    workflowKey: String(body.workflowKey),
    n8nExecutionId: String(body.n8nExecutionId),
    idempotencyKey: String(body.idempotencyKey),
    actionCount: actionQueue.length,
    providerConfigMissing,
    stateBoundary: "leadsy-postgres-via-next-api",
    recordedAt: now.toISOString()
  };
}
