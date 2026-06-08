import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { markNotificationRead } from "@/lib/user-settings-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;
  const { notificationId } = await context.params;
  const notification = await markNotificationRead({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    notificationId
  });
  if (!notification) return NextResponse.json({ error: "notification_not_found" }, { status: 404 });
  audit({ tenantId: auth.session.tenantId, actorId: auth.session.id, action: "notifications.mark_read", resource: notification.id });
  return NextResponse.json({ ok: true, notification });
}
