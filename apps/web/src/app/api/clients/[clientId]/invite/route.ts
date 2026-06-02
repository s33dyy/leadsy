import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { regenerateAgencyClientInvite } from "@/lib/agency-client-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return auth.response;
  }

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:client-invite`, 30);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const { clientId } = await context.params;
  const result = await regenerateAgencyClientInvite(clientId);
  if (!result) {
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "client.invite.regenerate",
    resource: result.client.id,
    metadata: { inviteCode: result.client.inviteCode }
  });

  return NextResponse.json({ client: result.client });
}
