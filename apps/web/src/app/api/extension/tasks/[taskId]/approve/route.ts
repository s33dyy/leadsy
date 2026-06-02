import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { approveExtensionTask, cancelExtensionTask } from "@/lib/extension-store";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["approve", "cancel"]).default("approve"),
  draftMessage: z.string().trim().max(5000).optional(),
  resultSummary: z.string().trim().max(1000).optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:extension-task-approve`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json().catch(() => ({})));
  const { taskId } = await context.params;
  const task =
    input.action === "cancel"
      ? await cancelExtensionTask({
          tenantId: auth.session.tenantId,
          ownerId: auth.session.id,
          taskId,
          resultSummary: input.resultSummary ?? "Cancelled by owner."
        })
      : await approveExtensionTask({
          tenantId: auth.session.tenantId,
          ownerId: auth.session.id,
          taskId,
          draftMessage: input.draftMessage
        });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: input.action === "cancel" ? "extension.task.cancel" : "extension.task.approve",
    resource: task.id,
    metadata: { status: task.status }
  });

  return NextResponse.json(task);
}
