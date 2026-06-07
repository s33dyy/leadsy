import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import {
  ensureWorkspaceTwilioSimulator,
  normalizeSimulatorWhatsAppAddress,
  saveSimulatedTwilioInboundMessage
} from "@/lib/twilio-simulator";
import { runAgentForInboundLead } from "@/lib/agent-runtime";

export const runtime = "nodejs";

function stringField(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:simulate-twilio:inbound`, 30, 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const from = stringField(body, ["from", "phone", "whatsappPhone"]);
  const messageBody = stringField(body, ["body", "message"]);
  if (!normalizeSimulatorWhatsAppAddress(from)) {
    return NextResponse.json({ error: "valid_whatsapp_from_required" }, { status: 400 });
  }
  if (!messageBody) {
    return NextResponse.json({ error: "message_body_required" }, { status: 400 });
  }

  await ensureWorkspaceTwilioSimulator({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    businessName: typeof auth.session.onboardingProfile?.businessName === "string" ? auth.session.onboardingProfile.businessName : undefined
  });

  const result = await saveSimulatedTwilioInboundMessage({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    from,
    profileName: stringField(body, ["profileName", "leadName", "name"]) || undefined,
    body: messageBody
  });

  const message = result.saved[0];
  const agent =
    message
      ? await runAgentForInboundLead({
          tenantId: auth.session.tenantId,
          ownerId: auth.session.id,
          leadId: result.lead.id,
          conversationId: result.conversation.id,
          triggerMessageId: message.id
        })
      : { action: "skipped_loop_guard" as const, reason: "Inbound message was already stored." };
  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "twilio_simulator.inbound.create",
    resource: result.lead.id,
    metadata: {
      messageId: message?.id,
      providerMessageSid: message?.providerMessageSid,
      conversationId: result.conversation.id,
      agentAction: agent.action
    }
  });

  return NextResponse.json({
    ok: true,
    leadId: result.lead.id,
    conversationId: result.conversation.id,
    messageId: message?.id,
    providerMessageSid: message?.providerMessageSid,
    deliveryStatus: message?.deliveryStatus ?? "received",
    transportMode: "simulator",
    agent
  });
}
