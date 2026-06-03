import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { setLeadMessageHiddenStatus } from "@/lib/lead-knowledge-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-message-status`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const form = await request.formData();
  const leadId = String(form.get("leadId") ?? "").trim();
  const messageId = String(form.get("messageId") ?? "").trim();
  const hidden = String(form.get("hidden") ?? "true") === "true";
  if (!leadId || !messageId) return NextResponse.json({ error: "invalid_message_status" }, { status: 400 });

  const message = await setLeadMessageHiddenStatus({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    messageId,
    hidden
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: hidden ? "leads.message.hide" : "leads.message.restore",
    resource: message.id
  });

  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("contact", leadId);
  url.searchParams.set("tab", "comms");
  url.searchParams.set("notice", hidden ? "message-hidden" : "message-restored");
  return NextResponse.redirect(url, 303);
}
