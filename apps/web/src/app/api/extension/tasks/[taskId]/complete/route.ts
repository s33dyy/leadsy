import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { completeExtensionTask } from "@/lib/extension-store";

export const runtime = "nodejs";

const schema = z.object({
  status: z.enum(["sent", "monitoring", "postponed", "blocked", "failed"]),
  resultSummary: z.string().trim().min(1).max(1000),
  reason: z.string().trim().min(1).max(120).optional(),
  postponedUntil: z.string().trim().min(1).max(80).optional(),
  outboundMessage: z
    .object({
      externalId: z.string().trim().min(1).max(300),
      body: z.string().trim().min(1).max(5000),
      sentAt: z.string().trim().min(1).max(80)
    })
    .optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-task-complete`, 240);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const { taskId } = await context.params;
  const task = await completeExtensionTask({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    taskId,
    ...input
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.task.complete",
    resource: task.id,
    metadata: { status: task.status }
  });

  return NextResponse.json(task);
}
