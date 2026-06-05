import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getInfrastructureStatus } from "@/lib/infrastructure-status";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "analytics:read");
  if (!auth.ok) return auth.response;

  const infrastructure = await getInfrastructureStatus();
  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "infrastructure.health.read",
    resource: "infrastructure:overview",
    metadata: { serviceCount: infrastructure.services.length }
  });

  return NextResponse.json(infrastructure);
}
