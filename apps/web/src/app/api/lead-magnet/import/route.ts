import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildManualLeadDossiers } from "@leadsy/ai";
import type { LeadResearchEvent, LeadSourceRun } from "@leadsy/domain";
import { eventBus } from "@leadsy/events";
import { audit, rateLimit } from "@leadsy/security";
import { getLeadMagnetWorkspace, saveLeadMagnetResults } from "@/lib/lead-magnet-store";
import { requireApiSession } from "@/lib/api-auth";
import { sourceHealth } from "@/lib/source-health";

const schema = z.object({
  rawText: z.string().trim().min(2).max(250_000),
  scenarioLabel: z.string().trim().max(120).optional(),
  runLabel: z.enum(["Live Campaign", "QA Scenario", "Worst Case"]).optional()
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-import`, 40);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  if (!workspace.brief) {
    return NextResponse.json(
      { error: "missing_brief", message: "Save your lead brief before importing leads." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "The import payload could not be read. Try again." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "invalid_import",
        message: `Please check ${String(issue?.path[0] ?? "import")}: ${issue?.message ?? "this field needs attention."}`
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const leads = buildManualLeadDossiers({
    tenantId: session.tenantId,
    ownerId: session.id,
    brief: workspace.brief,
    rawText: input.rawText
  });
  const now = new Date().toISOString();
  const qualityCounts = {
    savedGood: leads.filter((lead) => lead.qualityDecision.status === "good").length,
    needsProof: leads.filter((lead) => lead.qualityDecision.status === "needs-proof").length,
    rejected: 0,
    updatedDuplicates: 0
  };
  const events: LeadResearchEvent[] = leads.map((lead) => ({
    id: `evt_${crypto.randomUUID()}`,
    runId: "",
    tenantId: session.tenantId,
    ownerId: session.id,
    type: lead.qualityDecision.status === "good" ? "saved" : "quarantined",
    status: lead.qualityDecision.status === "good" ? "completed" : "needs-proof",
    title: lead.qualityDecision.status === "good" ? "Saved imported lead" : "Imported lead needs proof",
    summary: `${lead.businessName}: ${lead.qualityDecision.summary}`,
    businessName: lead.businessName,
    leadId: lead.id,
    location: lead.location.evidence,
    rejectionReason: lead.qualityDecision.reason,
    createdAt: now
  }));

  const run: LeadSourceRun = {
    id: `run_${crypto.randomUUID()}`,
    tenantId: session.tenantId,
    ownerId: session.id,
    campaignId: `campaign_${crypto.randomUUID()}`,
    scenarioLabel: input.scenarioLabel,
    runLabel: input.runLabel ?? (input.scenarioLabel ? "QA Scenario" : "Live Campaign"),
    inputSnapshot: {
      service: workspace.brief.service,
      idealCustomers: workspace.brief.idealCustomers,
      searchLocations: workspace.brief.searchLocations,
      leadGoal: workspace.brief.leadGoal,
      researchMode: workspace.brief.researchMode,
      sources: workspace.brief.sources,
      aiAction: workspace.brief.aiAction,
      excludedLeads: workspace.brief.excludedLeads
    },
    status: leads.length ? "completed" : "failed",
    sourcesRequested: ["manual-import"],
    sourcesUsed: leads.length ? ["manual-import"] : [],
    found: qualityCounts.savedGood,
    qualified: leads.filter((lead) => lead.qualityDecision.status === "good" && lead.score.status === "high-confidence").length,
    needsReview: qualityCounts.needsProof,
    blocked: 0,
    events,
    qualityCounts,
    recommendation: leads.length
      ? "Imported real records. Review evidence and draft messages for approval."
      : "Nothing usable was imported. Add one business per line with a name and any public contact/source detail.",
    connectionMessages: [],
    startedAt: now,
    completedAt: now
  };
  run.events = run.events.map((event) => ({ ...event, runId: run.id }));

  const saved = await saveLeadMagnetResults({
    tenantId: session.tenantId,
    ownerId: session.id,
    leads,
    run,
    brief: workspace.brief,
    agentRuns: [
      {
        id: `agent_${crypto.randomUUID()}`,
        tenantId: session.tenantId,
        ownerId: session.id,
        agent: "lead-finder",
        provider: "local",
        inputSummary: "Manual lead import",
        outputSummary: `Imported ${leads.length} lead${leads.length === 1 ? "" : "s"}.`,
        status: leads.length ? "completed" : "failed",
        createdAt: now
      }
    ]
  });

  await eventBus.publish({
    tenantId: session.tenantId,
    name: "leadmagnet.discovery.completed",
    payload: { runId: run.id, found: run.found, qualified: run.qualified, needsReview: run.needsReview, blocked: 0 }
  });

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "leadmagnet.import",
    resource: run.id,
    metadata: { found: run.found, qualified: run.qualified, needsReview: run.needsReview }
  });

  return NextResponse.json({ ...saved, latestRun: run, sourceHealth: sourceHealth() });
}
