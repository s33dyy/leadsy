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
    action: "infrastructure.automation.executions.read",
    resource: "automation:executions",
    metadata: { configured: automation.configured }
  });

  return NextResponse.json({
    executions: [],
    detail: "No durable n8n execution metadata has been recorded by Leadsy yet.",
    n8nExecutionsUrl: automation.publicUrl ? `${automation.publicUrl}/executions` : undefined
  });
}
