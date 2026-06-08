import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/user-settings-store";

export const runtime = "nodejs";

function emailConfigured() {
  return Boolean(process.env.SMTP_HOST || process.env.EMAIL_SERVER || process.env.RESEND_API_KEY || process.env.POSTMARK_SERVER_TOKEN);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;
  const notifications = await getNotificationPreferences({ tenantId: auth.session.tenantId, ownerId: auth.session.id });
  return NextResponse.json({ ok: true, notifications, emailConfigured: emailConfigured() });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;
  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:settings-notifications`, 40, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const notifications = await updateNotificationPreferences({ tenantId: auth.session.tenantId, ownerId: auth.session.id, ...body });
  audit({ tenantId: auth.session.tenantId, actorId: auth.session.id, action: "settings.notifications.update", resource: auth.session.id });
  return NextResponse.json({ ok: true, notifications, emailConfigured: emailConfigured() });
}
