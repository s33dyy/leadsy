import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { ensureWorkspaceWhatsAppSender, getWorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:twilio:sender`, 120, 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const sender =
    (await getWorkspaceWhatsAppSender({ tenantId: auth.session.tenantId, ownerId: auth.session.id })) ??
    (await ensureWorkspaceWhatsAppSender({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id
    }));

  return NextResponse.json({ ok: true, sender });
}
