import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getWorkspaceBusinessSettings, updateWorkspaceBusinessSettings } from "@/lib/user-settings-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;
  const workspace = await getWorkspaceBusinessSettings({ tenantId: auth.session.tenantId, ownerId: auth.session.id });
  return NextResponse.json({ ok: true, workspace });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;
  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:settings-workspace`, 40, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspace = await updateWorkspaceBusinessSettings({ tenantId: auth.session.tenantId, ownerId: auth.session.id, ...body });
  audit({ tenantId: auth.session.tenantId, actorId: auth.session.id, action: "settings.workspace.update", resource: auth.session.tenantId });
  return NextResponse.json({ ok: true, workspace });
}
