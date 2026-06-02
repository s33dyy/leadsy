import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildResearchPlanPreview, planLeadResearch, previewWithStrategy } from "@leadsy/ai";
import { LEAD_MAGNET_MAX_LEAD_GOAL } from "@leadsy/domain";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { createLeadSearchSession, getLeadMagnetWorkspace, upsertLeadBrief } from "@/lib/lead-magnet-store";
import { sourceHealth } from "@/lib/source-health";

const sourceSchema = z.enum([
  "openrouter-web-search",
  "directory-osint",
  "social-osint",
  "website-contact-osint",
  "review-reputation-osint",
  "content-gap-osint",
  "hiring-news-osint",
  "competitor-osint",
  "browser-public-page",
  "manual-import"
]);

const briefSchema = z.object({
  service: z.string().trim().min(2).max(240),
  ownerWebsiteUrl: z.string().trim().max(300).default(""),
  idealCustomers: z.string().trim().min(2).max(500),
  searchLocations: z.string().trim().min(2).max(240),
  leadGoal: z.coerce.number().int().min(1).max(LEAD_MAGNET_MAX_LEAD_GOAL),
  researchMode: z.enum(["broad", "focused"]).optional(),
  sources: z.array(sourceSchema).min(1),
  aiAction: z.enum(["draft-only", "follow-up-plan"]).default("draft-only"),
  excludedLeads: z.string().trim().max(500).default("")
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-search-start`, 40);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = briefSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] ? String(issue.path[0]) : "brief";
    return NextResponse.json(
      {
        error: "invalid_brief",
        message: `Please check ${field}: ${issue?.message ?? "this field needs attention."}`
      },
      { status: 400 }
    );
  }

  const brief = await upsertLeadBrief(session.tenantId, session.id, parsed.data);
  const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  const planned = await planLeadResearch({
    tenantId: session.tenantId,
    ownerId: session.id,
    brief,
    ownerSearchMemory: workspace.ownerSearchMemory
  });
  const preview = previewWithStrategy(
    buildResearchPlanPreview({
      tenantId: session.tenantId,
      ownerId: session.id,
      brief,
      existingLeads: workspace.leads,
      previousRuns: workspace.runs,
      budgetCapInr: 100,
      fullRun: true
    }),
    planned.strategy
  );
  const searchSession = await createLeadSearchSession({
    tenantId: session.tenantId,
    ownerId: session.id,
    brief,
    strategy: planned.strategy,
    planPreview: preview
  });
  const nextWorkspace = await getLeadMagnetWorkspace(session.tenantId, session.id);

  return NextResponse.json({
    ...nextWorkspace,
    brief,
    searchSession,
    sourceHealth: sourceHealth()
  });
}
