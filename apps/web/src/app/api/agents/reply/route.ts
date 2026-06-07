import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { appendTwilioOutboundMessage, listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { getTeamMember, postTeamThreadMessage } from "@/lib/teamspace-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:agents:reply`, 40, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  if (!memberId || !leadId || !bodyText) return NextResponse.json({ error: "agent_reply_context_required" }, { status: 400 });

  const member = await getTeamMember({ tenantId: auth.session.tenantId, ownerId: auth.session.id, memberId });
  if (!member || !member.type.startsWith("ai_agent")) {
    return NextResponse.json({ error: "ai_agent_required" }, { status: 404 });
  }
  if (!member.autoReplyEnabled || member.status !== "active") {
    return NextResponse.json({ error: "ai_agent_auto_reply_disabled" }, { status: 409 });
  }

  const lead = (await listLeadKnowledgeRecords({ tenantId: auth.session.tenantId, ownerId: auth.session.id })).find((record) => record.id === leadId);
  if (!lead) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });
  const to = lead.contact.phone || lead.contact.waId;
  if (!to) return NextResponse.json({ error: "lead_whatsapp_phone_required" }, { status: 409 });

  const result = await appendTwilioOutboundMessage({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId,
    messageSid: `SIMAGENT_${crypto.randomUUID()}`,
    to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    from: member.simulatorSenderHandle ?? "whatsapp:leadsy-agent-simulator",
    body: bodyText,
    source: "twilio_simulator",
    deliveryStatus: "simulated_delivered",
    contact: lead.contact,
    raw: { agentMemberId: member.id, transportMode: "simulator" }
  });

  await postTeamThreadMessage({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId,
    conversationId: result.conversation.id,
    authorMemberId: member.id,
    authorType: "ai_agent",
    body: `Agent sent a simulated WhatsApp reply: ${bodyText}`,
    eventType: "handoff_summary",
    triggerId: `agent-reply:${result.message.id}`
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "agent.reply.send",
    resource: leadId,
    metadata: { memberId: member.id, messageId: result.message.id, transportMode: "simulator" }
  });

  return NextResponse.json({
    ok: true,
    leadId,
    conversationId: result.conversation.id,
    messageId: result.message.id,
    providerMessageSid: result.message.providerMessageSid,
    deliveryStatus: result.message.deliveryStatus,
    transportMode: "simulator"
  });
}
