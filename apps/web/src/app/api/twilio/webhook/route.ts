import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import {
  resolveTwilioInboundScopeFromForm,
  saveTwilioInboundFromForm,
  TwilioWorkspaceSenderError,
  twilioParamsFromBody,
  verifyTwilioSignature
} from "@/lib/twilio-transport";
import { runAgentForInboundLead } from "@/lib/agent-runtime";
import { routeCrmEventToTasks } from "@/lib/crm-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const limiter = rateLimit("twilio:webhook", 600);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const rawBody = await request.text();
  const form = twilioParamsFromBody(rawBody);
  const signatureUrl = process.env.TWILIO_WEBHOOK_URL?.trim() || request.url;
  const signature = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature({ url: signatureUrl, params: form, signature, authToken: process.env.TWILIO_AUTH_TOKEN })) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    const scope = await resolveTwilioInboundScopeFromForm(form);
    const result = await saveTwilioInboundFromForm({ tenantId: scope.tenantId, ownerId: scope.ownerId, form });
    const message = result.saved[0];
    if (message && "lead" in result && "conversation" in result) {
      await runAgentForInboundLead({
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        leadId: result.lead.id,
        conversationId: result.conversation.id,
        triggerMessageId: message.id
      });
      await routeCrmEventToTasks({
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        eventType: "inbound_message",
        leadId: result.lead.id,
        assigneeId: result.lead.assigneeId,
        source: "twilio",
        reason: "New WhatsApp inbound message needs CRM handling."
      });
    }
  } catch (error) {
    if (error instanceof TwilioWorkspaceSenderError) {
      return NextResponse.json({ error: error.code }, { status: error.code === "unknown_whatsapp_sender" ? 400 : 409 });
    }
    throw error;
  }
  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "content-type": "text/xml" }
  });
}
