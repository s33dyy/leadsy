import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { logExtensionTaskEvent } from "@/lib/extension-store";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum([
    "worker_opened",
    "worker_prepared",
    "send_approved",
    "send_rejected",
    "worker_sent",
    "worker_blocked",
    "worker_failed",
    "monitoring_event",
    "inbound_issue"
  ]),
  summary: z.string().trim().min(1).max(1000),
  reason: z.string().trim().min(1).max(120).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-task-events`, 300);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const { taskId } = await context.params;
  const event = await logExtensionTaskEvent({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    taskId,
    ...input
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.task.event",
    resource: taskId,
    metadata: { type: event.type, reason: event.reason }
  });

  return NextResponse.json(event);
}
