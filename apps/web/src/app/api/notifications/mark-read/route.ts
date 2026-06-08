import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { markAllNotificationsRead } from "@/lib/user-settings-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;
  const notifications = await markAllNotificationsRead({ tenantId: auth.session.tenantId, ownerId: auth.session.id });
  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "notifications.mark_all_read",
    resource: "notifications:center",
    metadata: { count: notifications.length }
  });
  return NextResponse.json({ ok: true, notifications });
}
