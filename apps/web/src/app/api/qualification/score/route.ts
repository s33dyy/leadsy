import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { qualifyMetaLead } from "@leadsy/ai";
import { eventBus } from "@leadsy/events";
import { withSpan } from "@leadsy/observability";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";

const schema = z.object({
  leadId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:qualification`, 100);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const result = await withSpan("qualification.score", () => qualifyMetaLead(input.leadId), { leadId: input.leadId });

  await eventBus.publish({
    tenantId: session.tenantId,
    name: "qualification.scored",
    payload: { leadId: result.leadId, score: result.score, route: result.route }
  });

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "qualification.score",
    resource: result.leadId,
    metadata: { score: result.score, route: result.route }
  });

  return NextResponse.json(result);
}
