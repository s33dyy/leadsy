import { NextResponse, type NextRequest } from "next/server";
import { metaToWhatsAppWorkflow, runWorkflow } from "@leadsy/workflows";
import { withSpan } from "@leadsy/observability";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "workflow:run");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:workflow`, 30);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const run = await withSpan("workflow.run", () => runWorkflow(metaToWhatsAppWorkflow));
  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "workflow.run",
    resource: run.workflowId,
    metadata: { runId: run.id, status: run.status, steps: run.steps.length }
  });

  return NextResponse.json(run);
}
