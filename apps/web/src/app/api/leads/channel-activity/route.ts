import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { appendManualLeadMessage, type LeadKnowledgeChannel } from "@/lib/lead-knowledge-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

function channelFromValue(value: FormDataEntryValue | null): Extract<LeadKnowledgeChannel, "email" | "call"> | undefined {
  const clean = String(value ?? "").trim();
  if (clean === "email" || clean === "call") return clean;
  return undefined;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-channel-activity`, 120);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const form = await request.formData();
  const leadId = String(form.get("leadId") ?? "").trim();
  const channel = channelFromValue(form.get("channel"));
  const body = String(form.get("body") ?? "").trim();
  if (!leadId || !channel || !body) {
    return NextResponse.json({ error: "invalid_channel_activity" }, { status: 400 });
  }

  const lead = await appendManualLeadMessage({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId,
    channel,
    direction: "inbound",
    body,
    occurredAt: new Date().toISOString()
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "lead.channel_activity.create",
    resource: lead.id,
    metadata: { channel }
  });

  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("contact", lead.id);
  url.searchParams.set("tab", "comms");
  url.searchParams.set("channel", channel);
  return NextResponse.redirect(url, 303);
}
