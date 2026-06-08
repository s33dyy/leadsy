import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getOperatorProfileSettings, updateOperatorProfileSettings } from "@/lib/user-settings-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;
  const profile = await getOperatorProfileSettings({ tenantId: auth.session.tenantId, ownerId: auth.session.id });
  return NextResponse.json({ ok: true, profile });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;
  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:settings-profile`, 40, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const profile = await updateOperatorProfileSettings({ tenantId: auth.session.tenantId, ownerId: auth.session.id, ...body });
  audit({ tenantId: auth.session.tenantId, actorId: auth.session.id, action: "settings.profile.update", resource: auth.session.id });
  return NextResponse.json({ ok: true, profile });
}
