import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getAiWorkspaceSettings, updateAiWorkspaceSettings } from "@/lib/user-settings-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;
  const ai = await getAiWorkspaceSettings({ tenantId: auth.session.tenantId, ownerId: auth.session.id });
  return NextResponse.json({
    ok: true,
    ai,
    providerStatus: {
      openRouter: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      secretsManagedBy: "deployment_environment"
    }
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request, "admin:manage");
  if (!auth.ok) return auth.response;
  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:settings-ai`, 30, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ai = await updateAiWorkspaceSettings({ tenantId: auth.session.tenantId, ownerId: auth.session.id, ...body });
  audit({ tenantId: auth.session.tenantId, actorId: auth.session.id, action: "settings.ai.update", resource: "ai:workspace" });
  return NextResponse.json({ ok: true, ai });
}
