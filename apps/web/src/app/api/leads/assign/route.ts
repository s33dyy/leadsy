import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { assignLeadOwner } from "@/lib/crm-store";
import { getTeamMember } from "@/lib/teamspace-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json") || request.headers.get("content-type")?.includes("application/json");
}

async function assignmentInput(request: NextRequest) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      leadId: typeof body.leadId === "string" ? body.leadId.trim() : "",
      assigneeId: typeof body.assigneeId === "string" ? body.assigneeId.trim() : ""
    };
  }
  const form = await request.formData();
  return {
    leadId: String(form.get("leadId") ?? "").trim(),
    assigneeId: String(form.get("assigneeId") ?? "").trim()
  };
}

function leadRedirect(request: NextRequest, leadId: string, notice: string) {
  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("contact", leadId);
  url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

function errorResponse(request: NextRequest, leadId: string, error: string, status: number) {
  if (wantsJson(request)) return NextResponse.json({ error }, { status });
  return leadRedirect(request, leadId, error);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-assign`, 120, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const { leadId, assigneeId } = await assignmentInput(request);
  if (!leadId) return errorResponse(request, leadId, "lead_required", 400);
  if (!assigneeId) return errorResponse(request, leadId, "assignee_required", 400);

  const member = await getTeamMember({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    memberId: assigneeId
  });
  if (!member) return errorResponse(request, leadId, "team_member_not_found", 404);

  try {
    const lead = await assignLeadOwner({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      leadId,
      assigneeId: member.id,
      assigneeName: member.name,
      assignedById: auth.session.id,
      assignedByName: auth.session.name,
      reason: "Manual owner selected from Leads page"
    });

    audit({
      tenantId: auth.session.tenantId,
      actorId: auth.session.id,
      action: "leads.assign",
      resource: lead.id,
      metadata: { assigneeId: member.id, assigneeType: member.type }
    });

    if (wantsJson(request)) return NextResponse.json({ ok: true, lead });
    return leadRedirect(request, lead.id, "lead-assigned");
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return errorResponse(request, leadId, "lead_not_found", 404);
    }
    throw error;
  }
}
