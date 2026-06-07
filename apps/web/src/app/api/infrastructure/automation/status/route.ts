import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getAutomationStatus } from "@/lib/infrastructure-status";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "analytics:read");
  if (!auth.ok) return auth.response;

  const automation = await getAutomationStatus();
  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "infrastructure.automation.status.read",
    resource: "automation:leadsy",
    metadata: { configured: automation.configured, health: automation.health }
  });

  return NextResponse.json({ automation });
}
