import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { listCrmAssignmentRules, upsertCrmAssignmentRule } from "@/lib/crm-store";
import type { LeadCrmStatus } from "@/lib/lead-knowledge-store";

export const runtime = "nodejs";

type AssignmentRulePayload = {
  id?: string;
  title?: string;
  sourceIncludes?: string;
  campaignIncludes?: string;
  statusEquals?: string;
  assigneeId?: string;
  assigneeName?: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:assignment-rules-read`, 240);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const rules = await listCrmAssignmentRules({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id
  });

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:assignment-rules-write`, 60);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const payload = await readPayload(request);
  const title = payload.title?.trim();
  const assigneeName = payload.assigneeName?.trim();
  if (!title || !assigneeName) {
    return NextResponse.json({ error: "invalid_assignment_rule" }, { status: 400 });
  }

  const rule = await upsertCrmAssignmentRule({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    id: payload.id?.trim() || undefined,
    title,
    sourceIncludes: payload.sourceIncludes?.trim() || undefined,
    campaignIncludes: payload.campaignIncludes?.trim() || undefined,
    statusEquals: crmStatusFromValue(payload.statusEquals),
    assigneeId: payload.assigneeId?.trim() || assigneeName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    assigneeName
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "crm.assignment_rule.upsert",
    resource: rule.id
  });

  return NextResponse.json({ rule });
}

async function readPayload(request: NextRequest): Promise<AssignmentRulePayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as AssignmentRulePayload;
  }
  const form = await request.formData();
  return {
    id: text(form.get("id")),
    title: text(form.get("title")),
    sourceIncludes: text(form.get("sourceIncludes")),
    campaignIncludes: text(form.get("campaignIncludes")),
    statusEquals: text(form.get("statusEquals")),
    assigneeId: text(form.get("assigneeId")),
    assigneeName: text(form.get("assigneeName"))
  };
}

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim() || undefined;
}

function crmStatusFromValue(value?: string): LeadCrmStatus | undefined {
  if (value === "new_lead" || value === "interested" || value === "needs_reply" || value === "human_review") return value;
  return undefined;
}
