import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import {
  saveMetaWhatsAppInboundMessages,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature
} from "@/lib/meta-whatsapp-webhook-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const challenge = verifyMetaWebhookChallenge({
    mode: searchParams.get("hub.mode"),
    token: searchParams.get("hub.verify_token"),
    challenge: searchParams.get("hub.challenge")
  });

  if (!challenge) {
    return NextResponse.json({ error: "invalid_webhook_challenge" }, { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain" }
  });
}

export async function POST(request: NextRequest) {
  const limiter = rateLimit("meta:whatsapp:webhook", 600);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaWebhookSignature(rawBody, signature, process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await saveMetaWhatsAppInboundMessages(payload);
  return NextResponse.json({
    ok: true,
    saved: result.saved.length,
    ignored: result.ignored
  });
}
