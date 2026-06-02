import { NextResponse, type NextRequest } from "next/server";
import { runLeadResearch } from "@leadsy/ai";
import { eventBus } from "@leadsy/events";
import { withSpan } from "@leadsy/observability";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { hasMinimumBrief, magnetRedirect, parseLeadBriefForm } from "@/lib/lead-magnet-form";
import { getLeadMagnetWorkspace, saveLeadMagnetResults, upsertLeadBrief } from "@/lib/lead-magnet-store";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return NextResponse.redirect(new URL("/login?next=/app/magnet", request.url), 303);
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-discover-form`, 40);
  if (!limiter.ok) {
    return NextResponse.redirect(magnetRedirect(request, { error: "rate-limited" }), 303);
  }

  const { input } = parseLeadBriefForm(await request.formData());
  if (!hasMinimumBrief(input)) {
    return NextResponse.redirect(magnetRedirect(request, { error: "missing-brief" }), 303);
  }

  try {
    const brief = await upsertLeadBrief(session.tenantId, session.id, input);
    const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
    const result = await withSpan("leadmagnet.discover.form", () =>
      runLeadResearch({
        tenantId: session.tenantId,
        ownerId: session.id,
        brief,
        existingLeads: workspace.leads,
        previousRuns: workspace.runs
      })
    );

    await saveLeadMagnetResults({
      tenantId: session.tenantId,
      ownerId: session.id,
      leads: result.leads,
      run: result.run,
      agentRuns: result.agentRuns,
      brief
    });

    await eventBus.publish({
      tenantId: session.tenantId,
      name: "leadmagnet.discovery.completed",
      payload: {
        runId: result.run.id,
        found: result.run.found,
        qualified: result.run.qualified,
        needsReview: result.run.needsReview,
        blocked: result.run.blocked
      }
    });

    audit({
      tenantId: session.tenantId,
      actorId: session.id,
      action: "leadmagnet.discover.form",
      resource: result.run.id,
      metadata: {
        found: result.run.found,
        qualified: result.run.qualified,
        needsReview: result.run.needsReview,
        blocked: result.run.blocked
      }
    });

    return NextResponse.redirect(
      magnetRedirect(request, { notice: result.run.found ? "discovery-complete" : "discovery-needs-source" }),
      303
    );
  } catch {
    return NextResponse.redirect(magnetRedirect(request, { error: "discovery-failed" }), 303);
  }
}
