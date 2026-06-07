import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { appendManualLeadMessage, type LeadKnowledgeChannel, type LeadKnowledgeDirection } from "@/lib/lead-knowledge-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

function redirectToLead(request: NextRequest, leadId: string) {
  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("contact", leadId);
  url.searchParams.set("tab", "conversation");
  url.searchParams.set("notice", "manual-message-added");
  return NextResponse.redirect(url, 303);
}

function directionFromValue(value: FormDataEntryValue | null): Extract<LeadKnowledgeDirection, "inbound" | "outbound" | "note"> {
  return value === "inbound" || value === "outbound" || value === "note" ? value : "note";
}

function channelFromValue(value: FormDataEntryValue | null): LeadKnowledgeChannel {
  const channel = String(value ?? "manual");
  if (
    channel === "whatsapp" ||
    channel === "email" ||
    channel === "call" ||
    channel === "manual"
  ) {
    return channel;
  }
  return "manual";
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:manual-message`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const form = await request.formData();
  const leadId = String(form.get("leadId") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!leadId || !body) {
    return NextResponse.json({ error: "invalid_manual_message" }, { status: 400 });
  }

  const lead = await appendManualLeadMessage({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId,
    direction: directionFromValue(form.get("direction")),
    channel: channelFromValue(form.get("channel")),
    body,
    occurredAt: new Date().toISOString()
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "leads.manual_message.create",
    resource: lead.id,
    metadata: { direction: form.get("direction") ?? "note" }
  });

  return redirectToLead(request, lead.id);
}
