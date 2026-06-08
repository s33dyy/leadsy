import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import {
  twilioParamsFromBody,
  updateTwilioDeliveryStatusFromForm,
  verifyTwilioSignature
} from "@/lib/twilio-transport";
import { routeCrmEventToTasks } from "@/lib/crm-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const limiter = rateLimit("twilio:status", 1200);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const rawBody = await request.text();
  const form = twilioParamsFromBody(rawBody);
  const signatureUrl = process.env.TWILIO_STATUS_CALLBACK_URL?.trim() || request.url;
  const signature = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature({ url: signatureUrl, params: form, signature, authToken: process.env.TWILIO_AUTH_TOKEN })) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const result = await updateTwilioDeliveryStatusFromForm({ form });
  if (result.message && /failed|undelivered/i.test(result.message.deliveryStatus ?? "")) {
    await routeCrmEventToTasks({
      tenantId: result.message.tenantId,
      ownerId: result.message.ownerId,
      eventType: "delivery_failed",
      leadId: result.message.leadId,
      source: "twilio_status",
      reason: `WhatsApp delivery status: ${result.message.deliveryStatus}`
    });
  }
  return NextResponse.json({ ok: true, updated: result.updated });
}
