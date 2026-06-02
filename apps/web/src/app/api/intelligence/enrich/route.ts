import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { enrichLead } from "@leadsy/ai";
import { eventBus } from "@leadsy/events";
import { withSpan } from "@leadsy/observability";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";

const schema = z.object({
  leadId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:enrich`, 60);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const result = await withSpan("lead.enrich", () => enrichLead(input.leadId), { leadId: input.leadId });

  await eventBus.publish({
    tenantId: session.tenantId,
    name: "lead.enriched",
    payload: { leadId: result.leadId, confidence: result.confidence }
  });

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "lead.enrich",
    resource: result.leadId,
    metadata: { confidence: result.confidence, route: result.recommendedRoute }
  });

  return NextResponse.json(result);
}
