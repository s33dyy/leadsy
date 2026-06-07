import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { automationWorkflowDefinitions } from "@/lib/automation-workflows";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "analytics:read");
  if (!auth.ok) return auth.response;

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "infrastructure.automation.workflows.read",
    resource: "automation:workflows",
    metadata: { workflowCount: automationWorkflowDefinitions.length }
  });

  return NextResponse.json({
    workflows: automationWorkflowDefinitions
  });
}
