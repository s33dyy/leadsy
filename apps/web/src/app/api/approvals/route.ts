import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { setLeadKnowledgeStatus } from "@/lib/lead-knowledge-store";
import { updateCrmFollowUpTask } from "@/lib/crm-store";

export const runtime = "nodejs";

type ApprovalPayload = {
  id: string;
  kind: "Task" | "Research" | "Draft" | "Outreach" | "Note";
  action: "approve" | "reject";
};

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:approvals-write`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const payload = (await request.json().catch(() => ({}))) as Partial<ApprovalPayload>;
  const id = payload.id?.trim();
  const kind = payload.kind;
  const action = payload.action;

  if (!id || !kind || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "invalid_approval_request" }, { status: 400 });
  }

  if (kind === "Task") {
    const task = await updateCrmFollowUpTask({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      taskId: id,
      closedAt: action === "approve" || action === "reject" ? new Date().toISOString() : undefined
    });

    audit({
      tenantId: auth.session.tenantId,
      actorId: auth.session.id,
      action: "crm.follow_up_task.closed",
      resource: id,
      metadata: { action, kind }
    });

    return NextResponse.json({ success: true, task });
  }

  if (kind === "Research") {
    const lead = await setLeadKnowledgeStatus({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      leadId: id,
      leadStatus: action === "approve" ? "lead" : "excluded"
    });

    audit({
      tenantId: auth.session.tenantId,
      actorId: auth.session.id,
      action: "leads.status.update",
      resource: id,
      metadata: { action, kind, leadStatus: lead.leadStatus }
    });

    return NextResponse.json({ success: true, lead });
  }

  return NextResponse.json({ error: "unsupported_approval_kind" }, { status: 400 });
}
