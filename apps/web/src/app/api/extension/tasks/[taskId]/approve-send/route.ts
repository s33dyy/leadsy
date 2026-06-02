import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { approveExtensionTaskSend, rejectExtensionTaskSend } from "@/lib/extension-store";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["approve", "reject"]).default("approve"),
  resultSummary: z.string().trim().max(1000).optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-task-approve-send`, 180);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json().catch(() => ({})));
  const { taskId } = await context.params;
  const task =
    input.action === "reject"
      ? await rejectExtensionTaskSend({
          tenantId: auth.tenantId,
          ownerId: auth.ownerId,
          taskId,
          resultSummary: input.resultSummary
        })
      : await approveExtensionTaskSend({
          tenantId: auth.tenantId,
          ownerId: auth.ownerId,
          taskId
        });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: input.action === "reject" ? "extension.task.reject_send" : "extension.task.approve_send",
    resource: task.id,
    metadata: { status: task.status }
  });

  return NextResponse.json(task);
}
