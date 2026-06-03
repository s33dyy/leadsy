import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { listExtensionTasks } from "@/lib/extension-store";

export const runtime = "nodejs";

const activeWorkerStatuses = ["queued", "approved", "in_progress", "awaiting_send_approval", "monitoring", "blocked", "failed"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-tasks`, 240);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const tasks = await listExtensionTasks(auth.tenantId, auth.ownerId, {
    statuses: [...activeWorkerStatuses]
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.tasks.list",
    resource: "extension-tasks",
    metadata: { count: tasks.length }
  });

  return NextResponse.json({ tasks });
}
