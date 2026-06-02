import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { setMetaWhatsAppContactLeadStatus, type MetaWhatsAppLeadStatus } from "@/lib/meta-whatsapp-webhook-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

function leadsRedirect(request: NextRequest, notice: string) {
  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

function leadStatusFromValue(value: FormDataEntryValue | null): MetaWhatsAppLeadStatus | null {
  return value === "lead" || value === "excluded" ? value : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return auth.response;
  }

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:meta-whatsapp-lead-status`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const form = await request.formData();
  const contactId = String(form.get("contactId") ?? "").trim();
  const leadStatus = leadStatusFromValue(form.get("leadStatus"));
  if (!contactId || !leadStatus) {
    return NextResponse.json({ error: "invalid_contact_status" }, { status: 400 });
  }

  const status = await setMetaWhatsAppContactLeadStatus({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    contactId,
    leadStatus
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "integrations.meta.whatsapp.contact_status",
    resource: contactId,
    metadata: { leadStatus: status.leadStatus }
  });

  return leadsRedirect(request, leadStatus === "excluded" ? "contact-excluded" : "contact-restored");
}
