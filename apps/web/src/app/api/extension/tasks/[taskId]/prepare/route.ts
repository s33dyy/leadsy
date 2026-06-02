import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { prepareExtensionTask } from "@/lib/extension-store";

export const runtime = "nodejs";

const schema = z.object({
  draftMessage: z.string().trim().min(1).max(5000).optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-task-prepare`, 240);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json().catch(() => ({})));
  const { taskId } = await context.params;
  const task = await prepareExtensionTask({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    taskId,
    draftMessage: input.draftMessage
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.task.prepare",
    resource: task.id,
    metadata: { status: task.status }
  });

  return NextResponse.json(task);
}
