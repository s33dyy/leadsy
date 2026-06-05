import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getAiCostDashboard } from "@/lib/infrastructure-status";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "analytics:read");
  if (!auth.ok) return auth.response;

  const costs = await getAiCostDashboard();
  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "ai.costs.read",
    resource: "ai:cost-dashboard",
    metadata: { workflowCount: costs.workflows.length, requests: costs.totals.requests }
  });

  return NextResponse.json(costs);
}
