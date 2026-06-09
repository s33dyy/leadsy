import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import {
  clearWorkspaceTwilioSettings,
  getWorkspaceTwilioSettings,
  maskWorkspaceTwilioConfig,
  updateWorkspaceTwilioSettings
} from "@/lib/twilio-settings-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;
  const config = await getWorkspaceTwilioSettings({ tenantId: auth.session.tenantId, ownerId: auth.session.id });
  return NextResponse.json({ ok: true, twilio: maskWorkspaceTwilioConfig(config) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;
  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:settings-twilio`, 30, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.clear === true) {
    const twilio = await clearWorkspaceTwilioSettings({ tenantId: auth.session.tenantId, ownerId: auth.session.id });
    audit({ tenantId: auth.session.tenantId, actorId: auth.session.id, action: "settings.twilio.clear", resource: auth.session.id });
    return NextResponse.json({ ok: true, twilio });
  }
  const saved = await updateWorkspaceTwilioSettings({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    accountSid: body.accountSid,
    authToken: body.authToken,
    whatsappFrom: body.whatsappFrom,
    webhookUrl: body.webhookUrl,
    statusCallbackUrl: body.statusCallbackUrl
  });
  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "settings.twilio.update",
    resource: auth.session.id,
    metadata: { enabled: saved.enabled, configured: Boolean(saved.accountSid && saved.authToken && saved.whatsappFrom) }
  });
  return NextResponse.json({ ok: true, twilio: maskWorkspaceTwilioConfig(saved) });
}
