import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { listNotificationRecords } from "@/lib/user-settings-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;
  const notifications = await listNotificationRecords({ tenantId: auth.session.tenantId, ownerId: auth.session.id });
  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "notifications.read",
    resource: "notifications:center",
    metadata: { count: notifications.length }
  });
  return NextResponse.json({ ok: true, notifications });
}
