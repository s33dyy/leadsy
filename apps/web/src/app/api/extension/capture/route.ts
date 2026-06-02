import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildManualLeadDossiers } from "@leadsy/ai";
import type { LeadResearchEvent, LeadSourceRun } from "@leadsy/domain";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { getLeadMagnetWorkspace, saveLeadMagnetResults } from "@/lib/lead-magnet-store";
import { sourceHealth } from "@/lib/source-health";

const schema = z.object({
  url: z.string().trim().min(1).max(1000),
  title: z.string().trim().max(300).optional(),
  selectedText: z.string().trim().max(5000).optional(),
  visibleText: z.string().trim().max(10000).optional(),
  emails: z.array(z.string().trim().max(160)).default([]),
  phones: z.array(z.string().trim().max(80)).default([]),
  socialLinks: z.array(z.string().trim().max(1000)).default([])
});

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-capture`, 40);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const workspace = await getLeadMagnetWorkspace(auth.tenantId, auth.ownerId);
  if (!workspace.brief) {
    return NextResponse.json(
      { error: "missing_brief", message: "Save a Lead Magnet brief in Leadsy before capturing page leads." },
      { status: 400 }
    );
  }

  const rawText = [
    input.title || new URL(input.url).hostname,
    input.phones[0] ?? "",
    input.emails[0] ?? "",
    input.url,
    input.socialLinks[0] ?? "",
    input.selectedText || input.visibleText?.slice(0, 600) || ""
  ]
    .filter(Boolean)
    .join(", ");
  const leads = buildManualLeadDossiers({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    brief: workspace.brief,
    rawText
  });
  const now = new Date().toISOString();
  const events: LeadResearchEvent[] = leads.map((lead) => ({
    id: `evt_${crypto.randomUUID()}`,
    runId: "",
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    type: lead.qualityDecision.status === "good" ? "saved" : "quarantined",
    status: lead.qualityDecision.status === "good" ? "completed" : "needs-proof",
    title: "Captured from browser extension",
    summary: `${lead.businessName}: ${lead.qualityDecision.summary}`,
    businessName: lead.businessName,
    leadId: lead.id,
    url: input.url,
    sourceType: "manual-import",
    createdAt: now
  }));
  const run: LeadSourceRun = {
    id: `run_${crypto.randomUUID()}`,
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    campaignId: `campaign_${crypto.randomUUID()}`,
    runLabel: "Live Campaign",
    inputSnapshot: {
      service: workspace.brief.service,
      idealCustomers: workspace.brief.idealCustomers,
      searchLocations: workspace.brief.searchLocations,
      leadGoal: workspace.brief.leadGoal,
      researchMode: workspace.brief.researchMode,
      sources: workspace.brief.sources,
      aiAction: workspace.brief.aiAction,
      excludedLeads: workspace.brief.excludedLeads,
      ownerWebsiteUrl: workspace.brief.ownerWebsiteUrl
    },
    status: leads.length ? "completed" : "failed",
    sourcesRequested: ["manual-import"],
    sourcesUsed: leads.length ? ["manual-import"] : [],
    found: leads.filter((lead) => lead.qualityDecision.status === "good").length,
    qualified: leads.filter((lead) => lead.score.status === "high-confidence").length,
    needsReview: leads.filter((lead) => lead.qualityDecision.status === "needs-proof").length,
    blocked: 0,
    events,
    qualityCounts: {
      savedGood: leads.filter((lead) => lead.qualityDecision.status === "good").length,
      needsProof: leads.filter((lead) => lead.qualityDecision.status === "needs-proof").length,
      rejected: 0,
      updatedDuplicates: 0
    },
    recommendation: leads.length
      ? "Captured browser context. Review the lead evidence before outreach."
      : "No usable lead was captured from this page.",
    connectionMessages: [],
    startedAt: now,
    completedAt: now
  };
  run.events = run.events.map((event) => ({ ...event, runId: run.id }));
  const saved = await saveLeadMagnetResults({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    brief: workspace.brief,
    leads,
    run,
    agentRuns: [
      {
        id: `agent_${crypto.randomUUID()}`,
        tenantId: auth.tenantId,
        ownerId: auth.ownerId,
        agent: "page-extractor",
        provider: "browser-worker",
        inputSummary: input.url,
        outputSummary: `Captured ${leads.length} lead${leads.length === 1 ? "" : "s"} from browser context.`,
        status: leads.length ? "completed" : "failed",
        createdAt: now
      }
    ]
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.capture",
    resource: run.id,
    metadata: { url: input.url, leads: leads.length }
  });

  return NextResponse.json({ ...saved, latestRun: run, sourceHealth: sourceHealth() });
}
