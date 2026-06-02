import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAgencyClient, updateAgencyClientProfile } from "@/lib/agency-client-store";
import { audit, rateLimit } from "@leadsy/security";
import { canAccessClient, requireApiSession } from "@/lib/api-auth";

export const runtime = "nodejs";

const schema = z.object({
  targetAudience: z.string().trim().min(5),
  primaryOffer: z.string().trim().min(3),
  leadLocation: z.string().trim().min(2),
  monthlyLeadGoal: z.coerce.number().int().min(1).max(100000)
});

export async function GET(request: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  const auth = await requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { clientId } = await context.params;
  if (!canAccessClient(auth.session, clientId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const client = await getAgencyClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }
  return NextResponse.json({ client });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  const auth = await requireApiSession(request);
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  if (session.role !== "client") {
    return NextResponse.json({ error: "client_session_required" }, { status: 403 });
  }

  const limiter = rateLimit(`${session.tenantId}:${session.id}:client-profile`, 60);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const { clientId } = await context.params;
  if (session.clientId !== clientId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const input = schema.parse(await request.json());
  const client = await updateAgencyClientProfile(clientId, input);

  if (!client) {
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "client.profile.update",
    resource: client.id,
    metadata: {
      targetAudience: client.targetAudience,
      primaryOffer: client.primaryOffer,
      leadLocation: client.leadLocation,
      monthlyLeadGoal: client.monthlyLeadGoal
    }
  });

  return NextResponse.json({ client });
}
