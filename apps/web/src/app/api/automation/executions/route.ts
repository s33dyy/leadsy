import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { buildN8nExecutionReceipt, validateN8nAutomationRequest } from "@/lib/n8n-automation-gateway";

export async function POST(request: NextRequest) {
  const validation = await validateN8nAutomationRequest(request, ["workflowKey", "n8nExecutionId", "status"]);
  if (!validation.ok) {
    return NextResponse.json(validation, { status: validation.status });
  }

  const receipt = buildN8nExecutionReceipt(validation.body);
  audit({
    tenantId: String(validation.body.tenantId ?? "n8n"),
    actorId: "n8n",
    action: "automation.execution.record",
    resource: `automation:${receipt.workflowKey}`,
    metadata: {
      n8nExecutionId: receipt.n8nExecutionId,
      status: receipt.status,
      stateBoundary: receipt.stateBoundary
    }
  });

  return NextResponse.json(receipt, { status: 202 });
}
