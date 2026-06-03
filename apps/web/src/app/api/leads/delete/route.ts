import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { archiveLeadKnowledgeRecord } from "@/lib/lead-knowledge-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-delete`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const form = await request.formData();
  const leadId = String(form.get("leadId") ?? "").trim();
  if (!leadId) return NextResponse.json({ error: "invalid_lead" }, { status: 400 });

  const lead = await archiveLeadKnowledgeRecord({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "leads.archive",
    resource: lead.id
  });

  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("notice", "lead-archived");
  return NextResponse.redirect(url, 303);
}
