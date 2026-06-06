import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import { defaultWebhookScope } from "@/lib/lead-knowledge-store";
import {
  saveTwilioInboundFromForm,
  twilioParamsFromBody,
  verifyTwilioSignature
} from "@/lib/twilio-transport";

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

  await saveTwilioInboundFromForm({ ...defaultWebhookScope(), form });
  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "content-type": "text/xml" }
  });
}
