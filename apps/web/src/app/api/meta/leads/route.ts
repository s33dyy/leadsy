import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { tenantId, type MetaLead } from "@leadsy/domain";
import { eventBus } from "@leadsy/events";
import { metaToWhatsAppWorkflow, runWorkflow } from "@leadsy/workflows";
import { withSpan } from "@leadsy/observability";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";

const schema = z.object({
  clientId: z.string().min(1),
  platform: z.enum(["instagram", "facebook"]).default("instagram"),
  fullName: z.string().min(1),
  phone: z.string().min(6),
  campaignName: z.string().min(1),
  budget: z.string().default("unknown"),
  preferredLocation: z.string().default("unknown"),
  timeline: z.enum(["immediate", "this-month", "1-3-months", "researching"]).default("researching")
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:meta-ingest`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const lead: MetaLead = {
    id: `meta_${crypto.randomUUID().slice(0, 8)}`,
    tenantId,
    clientId: input.clientId,
    platform: input.platform,
    fullName: input.fullName,
    phone: input.phone,
    campaignName: input.campaignName,
    adSetName: "incoming-webhook",
    creative: "incoming-webhook",
    city: "unknown",
    propertyType: "unknown" as const,
    rawQuality: "medium" as const,
    costPerLead: 0,
    budget: input.budget,
    preferredLocation: input.preferredLocation,
    timeline: input.timeline,
    receivedAt: new Date().toISOString(),
    status: "ai-contacted" as const
  };

  const workflowRun = await withSpan("meta.ingest", () => runWorkflow(metaToWhatsAppWorkflow, { metaLead: lead }), {
    leadId: lead.id,
    platform: lead.platform
  });

  await eventBus.publish({
    tenantId: session.tenantId,
    name: "meta.lead.ingested",
    payload: { leadId: lead.id, clientId: lead.clientId, platform: lead.platform }
  });

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "meta.lead.ingest",
    resource: lead.id,
    metadata: { workflowRunId: workflowRun.id, clientId: lead.clientId }
  });

  return NextResponse.json({
    lead,
    workflowRun,
    firstResponseSlaSeconds: 38,
    nextAction: "AI WhatsApp qualifier queued"
  });
}
