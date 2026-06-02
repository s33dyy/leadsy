import { NextResponse, type NextRequest } from "next/server";
import { buildResearchPlanPreview } from "@leadsy/ai";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getLeadMagnetWorkspace } from "@/lib/lead-magnet-store";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-plan-preview`, 80);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  if (!workspace.brief) {
    return NextResponse.json(
      {
        error: "missing_brief",
        message: "Save the lead brief first, then Leadsy can prepare a search plan."
      },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { budgetCapInr?: unknown; fullRun?: unknown };
  const budgetCapInr = typeof body.budgetCapInr === "number" && Number.isFinite(body.budgetCapInr) ? body.budgetCapInr : undefined;
  const preview = buildResearchPlanPreview({
    tenantId: session.tenantId,
    ownerId: session.id,
    brief: workspace.brief,
    existingLeads: workspace.leads,
    previousRuns: workspace.runs,
    budgetCapInr,
    fullRun: body.fullRun === true
  });

  return NextResponse.json({ preview });
}
