import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { setLeadKnowledgeStatus, type LeadKnowledgeStatus } from "@/lib/lead-knowledge-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

function leadStatusFromValue(value: FormDataEntryValue | null): LeadKnowledgeStatus | null {
  return value === "lead" || value === "excluded" ? value : null;
}

function redirectToLead(request: NextRequest, leadId: string, notice: string) {
  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("contact", leadId);
  url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-status`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const form = await request.formData();
  const leadId = String(form.get("leadId") ?? "").trim();
  const leadStatus = leadStatusFromValue(form.get("leadStatus"));
  if (!leadId || !leadStatus) {
    return NextResponse.json({ error: "invalid_lead_status" }, { status: 400 });
  }

  const lead = await setLeadKnowledgeStatus({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId,
    leadStatus
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "leads.status.update",
    resource: lead.id,
    metadata: { leadStatus: lead.leadStatus }
  });

  return redirectToLead(request, lead.id, leadStatus === "excluded" ? "lead-excluded" : "lead-restored");
}
