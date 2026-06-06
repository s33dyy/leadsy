import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { sendAndStoreTwilioWhatsAppMessage } from "@/lib/twilio-transport";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:twilio:send`, 60, 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to.startsWith("whatsapp:+")) {
    return NextResponse.json({ error: "valid_whatsapp_to_required" }, { status: 400 });
  }

  const contentVariables = body.contentVariables && typeof body.contentVariables === "object" && !Array.isArray(body.contentVariables)
    ? Object.fromEntries(
        Object.entries(body.contentVariables as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      )
    : undefined;
  const result = await sendAndStoreTwilioWhatsAppMessage({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId: typeof body.leadId === "string" ? body.leadId : undefined,
    to,
    body: typeof body.body === "string" ? body.body : undefined,
    contentSid: typeof body.contentSid === "string" ? body.contentSid : undefined,
    contentVariables
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "twilio.whatsapp.send",
    resource: result.message.leadId,
    metadata: {
      messageSid: result.message.providerMessageSid,
      deliveryStatus: result.message.deliveryStatus
    }
  });

  return NextResponse.json({
    ok: true,
    messageSid: result.message.providerMessageSid,
    deliveryStatus: result.message.deliveryStatus,
    leadId: result.message.leadId,
    conversationId: result.message.conversationId
  });
}
