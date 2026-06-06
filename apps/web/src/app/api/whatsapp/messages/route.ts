import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { sendAndStoreWhatsAppMessage } from "@/lib/whatsapp-transport";
import { TwilioWorkspaceSenderError } from "@/lib/twilio-transport";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:whatsapp:send`, 60, 60_000);
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

  let result: Awaited<ReturnType<typeof sendAndStoreWhatsAppMessage>>;
  try {
    result = await sendAndStoreWhatsAppMessage({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      leadId: typeof body.leadId === "string" ? body.leadId : undefined,
      to,
      body: typeof body.body === "string" ? body.body : undefined,
      contentSid: typeof body.contentSid === "string" ? body.contentSid : undefined,
      contentVariables
    });
  } catch (error) {
    if (error instanceof TwilioWorkspaceSenderError) {
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    throw error;
  }

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "whatsapp.message.send",
    resource: result.leadId,
    metadata: {
      messageSid: result.providerMessageSid,
      deliveryStatus: result.deliveryStatus,
      transportMode: result.transportMode
    }
  });

  return NextResponse.json(result);
}
