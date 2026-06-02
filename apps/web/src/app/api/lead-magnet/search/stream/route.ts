import { NextResponse, type NextRequest } from "next/server";
import { eventBus } from "@leadsy/events";
import { followUpQuestionsForResearchRun } from "@leadsy/ai";
import { withSpan } from "@leadsy/observability";
import { leadBriefFingerprint } from "@leadsy/domain";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { runLeadMagnetDiscoveryCampaign } from "@/lib/lead-magnet-campaign";
import { getLeadMagnetWorkspace, getLeadSearchSession, updateLeadSearchSession } from "@/lib/lead-magnet-store";
import { sourceHealth } from "@/lib/source-health";

function briefFingerprint(brief: NonNullable<Awaited<ReturnType<typeof getLeadMagnetWorkspace>>["brief"]>) {
  return leadBriefFingerprint({
    service: brief.service,
    idealCustomers: brief.idealCustomers,
    searchLocations: brief.searchLocations,
    leadGoal: brief.leadGoal,
    researchMode: brief.researchMode,
    sources: brief.sources,
    aiAction: brief.aiAction,
    excludedLeads: brief.excludedLeads,
    ownerWebsiteUrl: brief.ownerWebsiteUrl
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-search-stream`, 40);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  const searchSession = sessionId ? await getLeadSearchSession(session.tenantId, session.id, sessionId) : null;
  const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  if (!searchSession || !workspace.brief) {
    return NextResponse.json({ error: "missing_session", message: "Start a new search first." }, { status: 404 });
  }
  const brief = workspace.brief;
  if (searchSession.status === "stopped" || searchSession.status === "stale") {
    return NextResponse.json({ error: "inactive_session", message: "This search session is no longer active." }, { status: 409 });
  }
  if (searchSession.briefFingerprint !== briefFingerprint(brief)) {
    await updateLeadSearchSession(session.tenantId, session.id, searchSession.id, {
      status: "stale",
      error: "The brief changed after this search was created."
    });
    return NextResponse.json(
      {
        error: "stale_session",
        message: "The brief changed after this search was created. Start a new search with the current brief."
      },
      { status: 409 }
    );
  }

  await updateLeadSearchSession(session.tenantId, session.id, searchSession.id, { status: "running" });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      void (async () => {
        try {
          send("session", { ...searchSession, status: "running" });
          const campaign = await withSpan("leadmagnet.search.stream", () =>
            runLeadMagnetDiscoveryCampaign({
              tenantId: session.tenantId,
              ownerId: session.id,
              workspace,
              budgetCapInr: searchSession.planPreview?.spendGuard.capInr ?? 100,
              fullRun: true,
              runLabel: "Live Campaign",
              planPreview: searchSession.planPreview,
              shouldStop: async () => {
                const current = await getLeadSearchSession(session.tenantId, session.id, searchSession.id);
                return current?.status === "stopping" || current?.status === "stopped" || current?.status === "stale";
              },
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
          const current = await getLeadSearchSession(session.tenantId, session.id, searchSession.id);
          const followUpQuestions =
            latestRun && current?.status !== "stopping"
              ? followUpQuestionsForResearchRun({
                  brief,
                  strategy: current?.strategy ?? searchSession.strategy,
                  run: latestRun
                }).slice(0, 1)
              : [];
          const finalStatus = current?.status === "stopping" ? "stopped" : followUpQuestions.length ? "needs-input" : "completed";
          await updateLeadSearchSession(session.tenantId, session.id, searchSession.id, {
            status: finalStatus,
            strategy: followUpQuestions.length
              ? {
                  ...(current?.strategy ?? searchSession.strategy),
                  questions: followUpQuestions
                }
              : current?.strategy ?? searchSession.strategy,
            latestRunId: latestRun?.id
          });

          audit({
            tenantId: session.tenantId,
            actorId: session.id,
            action: "leadmagnet.search.stream",
            resource: latestRun?.id ?? campaign.campaignId,
            metadata: {
              searchSessionId: searchSession.id,
              campaignId: campaign.campaignId,
              batches: campaign.batchRuns.length,
              found: latestRun?.found ?? 0,
              qualified: latestRun?.qualified ?? 0,
              needsReview: latestRun?.needsReview ?? 0,
              blocked: latestRun?.blocked ?? 0,
              costInr: latestRun?.cost?.costInr
            }
          });

          const nextWorkspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
          send("final", { ...nextWorkspace, latestRun, sourceHealth: sourceHealth() });
        } catch (error) {
          await updateLeadSearchSession(session.tenantId, session.id, searchSession.id, {
            status: (error as Error).message.startsWith("stale_session") ? "stale" : "failed",
            error: (error as Error).message || "Search failed."
          });
          send("error", {
            error: (error as Error).message.startsWith("stale_session") ? "stale_session" : "search_failed",
            message: (error as Error).message || "Search failed."
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
