import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { runAgentForInboundLead } from "@/lib/agent-runtime";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:agents:handle-inbound`, 60, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  const triggerMessageId = typeof body.triggerMessageId === "string" ? body.triggerMessageId.trim() : "";
  if (!leadId || !conversationId || !triggerMessageId) {
    return NextResponse.json({ error: "agent_inbound_context_required" }, { status: 400 });
  }

  const result = await runAgentForInboundLead({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId,
    conversationId,
    triggerMessageId
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "agent.inbound.handle",
    resource: leadId,
    metadata: { conversationId, triggerMessageId, action: result.action, memberId: result.memberId }
  });

  return NextResponse.json({ ok: true, result });
}
