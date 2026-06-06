import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { provisionWorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "admin:manage");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:twilio:sender:provision`, 12, 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const sender = await provisionWorkspaceWhatsAppSender({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    businessName: typeof body.businessName === "string" ? body.businessName : undefined
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "twilio.whatsapp_sender.provision",
    resource: sender.twilioFrom ?? `${auth.session.tenantId}:${auth.session.id}`,
    metadata: {
      status: sender.status,
      assignedPhoneNumber: sender.assignedPhoneNumber
    }
  });

  return NextResponse.json({ ok: true, sender });
}
