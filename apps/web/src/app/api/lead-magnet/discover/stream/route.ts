import { NextResponse, type NextRequest } from "next/server";
import { eventBus } from "@leadsy/events";
import { withSpan } from "@leadsy/observability";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { runLeadMagnetDiscoveryCampaign } from "@/lib/lead-magnet-campaign";
import { getLeadMagnetWorkspace } from "@/lib/lead-magnet-store";
import { sourceHealth } from "@/lib/source-health";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-discover-stream`, 40);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  if (!workspace.brief) {
    return NextResponse.json(
      {
        error: "missing_brief",
        message: "Tell Leadsy what you sell, who to find, and where to search before running discovery."
      },
      { status: 400 }
    );
  }
  const body = (await request.json().catch(() => ({}))) as {
    budgetCapInr?: unknown;
    fullRun?: unknown;
    scenarioLabel?: unknown;
    runLabel?: unknown;
  };
  const budgetCapInr = typeof body.budgetCapInr === "number" && Number.isFinite(body.budgetCapInr) ? body.budgetCapInr : undefined;
  const scenarioLabel = typeof body.scenarioLabel === "string" && body.scenarioLabel.trim() ? body.scenarioLabel.trim().slice(0, 120) : undefined;
  const runLabel = body.runLabel === "QA Scenario" || body.runLabel === "Worst Case" || body.runLabel === "Live Campaign" ? body.runLabel : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      void (async () => {
        try {
          const campaign = await withSpan("leadmagnet.discover.stream", () =>
            runLeadMagnetDiscoveryCampaign({
              tenantId: session.tenantId,
              ownerId: session.id,
              workspace,
              budgetCapInr,
              fullRun: body.fullRun === true,
              scenarioLabel,
              runLabel,
              onEvent: (event) => send("progress", event)
            })
          );

          for (const run of campaign.batchRuns) {
            await eventBus.publish({
              tenantId: session.tenantId,
              name: "leadmagnet.discovery.completed",
              payload: {
                runId: run.id,
                campaignId: run.campaignId,
                found: run.found,
                qualified: run.qualified,
                needsReview: run.needsReview,
                blocked: run.blocked
              }
            });
          }

          const latestRun = campaign.latestRun;

          audit({
            tenantId: session.tenantId,
            actorId: session.id,
            action: "leadmagnet.discover.stream",
            resource: latestRun?.id ?? campaign.campaignId,
            metadata: {
              campaignId: campaign.campaignId,
              batches: campaign.batchRuns.length,
              found: latestRun?.found ?? 0,
              qualified: latestRun?.qualified ?? 0,
              needsReview: latestRun?.needsReview ?? 0,
              blocked: latestRun?.blocked ?? 0,
              costInr: latestRun?.cost?.costInr
            }
          });

          send("final", { ...campaign.workspace, latestRun, sourceHealth: sourceHealth() });
        } catch (error) {
          send("error", {
            error: "discovery_failed",
            message: (error as Error).message || "Discovery failed."
          });
        } finally {
          controller.close();
        }
      })();
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}
