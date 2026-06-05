import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { editLeadKnowledgeRecord, type LeadCrmStatus, type LeadQualificationStage } from "@/lib/lead-knowledge-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

function redirectToLead(request: NextRequest, leadId: string) {
  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("contact", leadId);
  url.searchParams.set("notice", "lead-edited");
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-edit`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const form = await request.formData();
  const leadId = String(form.get("leadId") ?? "").trim();
  if (!leadId) return NextResponse.json({ error: "invalid_lead" }, { status: 400 });

  const facts = String(form.get("facts") ?? "")
    .split(/\r?\n/)
    .map((fact) => fact.trim())
    .filter(Boolean);
  const crmStatus = crmStatusFromValue(form.get("crmStatus"));
  const qualificationStage = qualificationStageFromValue(form.get("qualificationStage"));
  const lead = await editLeadKnowledgeRecord({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId,
    contact: {
      displayName: String(form.get("displayName") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      handle: String(form.get("handle") ?? "").trim(),
      profileUrl: String(form.get("profileUrl") ?? "").trim()
    },
    summary: String(form.get("summary") ?? "").trim(),
    nextAction: String(form.get("nextAction") ?? "").trim(),
    facts,
    leadSource: String(form.get("leadSource") ?? "").trim(),
    campaignId: String(form.get("campaignId") ?? "").trim(),
    assigneeId: String(form.get("assigneeId") ?? "").trim(),
    assigneeName: String(form.get("assigneeName") ?? "").trim(),
    crmStatus,
    qualificationStage,
    qualificationFields: {
      name: String(form.get("qualificationName") ?? "").trim() || undefined,
      phone: String(form.get("qualificationPhone") ?? "").trim() || undefined,
      company: String(form.get("qualificationCompany") ?? "").trim() || undefined,
      need: String(form.get("qualificationNeed") ?? "").trim() || undefined,
      teamOrQueryVolume: String(form.get("qualificationVolume") ?? "").trim() || undefined,
      budget: String(form.get("qualificationBudget") ?? "").trim() || undefined,
      timeline: String(form.get("qualificationTimeline") ?? "").trim() || undefined
    }
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "leads.edit",
    resource: lead.id
  });

  return redirectToLead(request, lead.id);
}

function crmStatusFromValue(value: FormDataEntryValue | null): LeadCrmStatus | undefined {
  const clean = String(value ?? "").trim();
  if (clean === "new_lead" || clean === "interested" || clean === "needs_reply" || clean === "human_review") return clean;
  return undefined;
}

function qualificationStageFromValue(value: FormDataEntryValue | null): LeadQualificationStage | undefined {
  const clean = String(value ?? "").trim();
  if (clean === "new" || clean === "collecting" || clean === "qualified" || clean === "human_review") return clean;
  return undefined;
}
