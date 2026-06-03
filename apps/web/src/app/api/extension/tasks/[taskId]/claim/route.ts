import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { claimExtensionTask } from "@/lib/extension-store";

export const runtime = "nodejs";

const schema = z.object({
  runBatchId: z.string().trim().max(160).optional(),
  runMode: z.enum(["manual", "selected_batch"]).optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-task-claim`, 180);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const { taskId } = await context.params;
  const input = schema.parse(await request.json().catch(() => ({})));
  const task = await claimExtensionTask({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    taskId,
    runBatchId: input.runBatchId,
    runMode: input.runMode
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.task.claim",
    resource: task.id,
    metadata: { status: task.status }
  });

  return NextResponse.json(task);
}
