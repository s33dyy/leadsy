import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { requireExtensionToken } from "@/lib/extension-auth";
import { approveExtensionTaskSend, rejectExtensionTaskSend } from "@/lib/extension-store";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["approve", "reject"]).default("approve"),
  resultSummary: z.string().trim().max(1000).optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const extensionAuth = await requireExtensionToken(request);
  let scope: { tenantId: string; ownerId: string; actorId: string };
  if (extensionAuth.ok) {
    scope = { tenantId: extensionAuth.tenantId, ownerId: extensionAuth.ownerId, actorId: extensionAuth.ownerId };
  } else {
    const apiAuth = await requireApiSession(request, "crm:write");
    if (!apiAuth.ok) return apiAuth.response;
    scope = { tenantId: apiAuth.session.tenantId, ownerId: apiAuth.session.id, actorId: apiAuth.session.id };
  }

  const limiter = rateLimit(`${scope.tenantId}:${scope.ownerId}:extension-task-approve-send`, 180);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json().catch(() => ({})));
  const { taskId } = await context.params;
  const task =
    input.action === "reject"
      ? await rejectExtensionTaskSend({
          tenantId: scope.tenantId,
          ownerId: scope.ownerId,
          taskId,
          resultSummary: input.resultSummary
        })
      : await approveExtensionTaskSend({
          tenantId: scope.tenantId,
          ownerId: scope.ownerId,
          taskId
        });

  audit({
    tenantId: scope.tenantId,
    actorId: scope.actorId,
    action: input.action === "reject" ? "extension.task.reject_send" : "extension.task.approve_send",
    resource: task.id,
    metadata: { status: task.status }
  });

  return NextResponse.json(task);
}
