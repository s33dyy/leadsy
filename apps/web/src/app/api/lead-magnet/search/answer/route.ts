import { NextResponse, type NextRequest } from "next/server";
import { buildResearchPlanPreview, planLeadResearch, previewWithStrategy } from "@leadsy/ai";
import { leadBriefFingerprint } from "@leadsy/domain";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getLeadMagnetWorkspace, getLeadSearchSession, updateLeadSearchSession } from "@/lib/lead-magnet-store";
import { sourceHealth } from "@/lib/source-health";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-search-answer`, 80);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { sessionId?: unknown; answers?: unknown };
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const answers =
    body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? Object.fromEntries(
          Object.entries(body.answers as Record<string, unknown>)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(([key, value]) => [key, value.slice(0, 100)])
        )
      : {};
  const searchSession = sessionId ? await getLeadSearchSession(session.tenantId, session.id, sessionId) : null;
  const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  if (!searchSession || !workspace.brief) {
    return NextResponse.json({ error: "missing_session", message: "Start a new search first." }, { status: 404 });
  }
  const currentFingerprint = leadBriefFingerprint(searchSession.briefSnapshot);
  const savedFingerprint = leadBriefFingerprint({
    service: workspace.brief.service,
    idealCustomers: workspace.brief.idealCustomers,
    searchLocations: workspace.brief.searchLocations,
    leadGoal: workspace.brief.leadGoal,
    researchMode: workspace.brief.researchMode,
    sources: workspace.brief.sources,
    aiAction: workspace.brief.aiAction,
    excludedLeads: workspace.brief.excludedLeads,
    ownerWebsiteUrl: workspace.brief.ownerWebsiteUrl
  });
  if (currentFingerprint !== savedFingerprint) {
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

  const planned = await planLeadResearch({
    tenantId: session.tenantId,
    ownerId: session.id,
    brief: workspace.brief,
    answers,
    ownerSearchMemory: workspace.ownerSearchMemory
  });
  const answeredQuestions = planned.strategy.questions.map((question) => ({
    ...question,
    answeredOptionId: answers[question.id] ?? question.defaultOptionId
  }));
  const strategy = { ...planned.strategy, questions: answeredQuestions };
  const preview = previewWithStrategy(
    buildResearchPlanPreview({
      tenantId: session.tenantId,
      ownerId: session.id,
      brief: workspace.brief,
      existingLeads: workspace.leads,
      previousRuns: workspace.runs,
      budgetCapInr: 100,
      fullRun: true
    }),
    strategy
  );

  const updated = await updateLeadSearchSession(session.tenantId, session.id, searchSession.id, {
    answers,
    strategy,
    planPreview: preview,
    status: "ready"
  });
  const nextWorkspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  return NextResponse.json({ ...nextWorkspace, searchSession: updated, sourceHealth: sourceHealth() });
}
