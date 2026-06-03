import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { editExtensionTask, softDeleteExtensionTask } from "@/lib/extension-store";

export const runtime = "nodejs";

const patchSchema = z.object({
  draftMessage: z.string().trim().min(1).max(5000).optional(),
  contextSummary: z.string().trim().min(1).max(2000).optional(),
  targetUrl: z.string().trim().max(1000).optional(),
  leadId: z.string().trim().max(160).optional(),
  conversationId: z.string().trim().max(160).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  dueAt: z.string().trim().max(80).optional(),
  contact: z
    .object({
      displayName: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(80).optional(),
      email: z.string().trim().max(200).optional(),
      handle: z.string().trim().max(200).optional(),
      profileUrl: z.string().trim().max(1000).optional()
    })
    .optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:extension-task-edit`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = patchSchema.parse(await request.json().catch(() => ({})));
  const { taskId } = await context.params;
  const task = await editExtensionTask({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    taskId,
    ...input
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "extension.task.edit",
    resource: task.id,
    metadata: { status: task.status }
  });

  return NextResponse.json(task);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:extension-task-delete`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const { taskId } = await context.params;
  const task = await softDeleteExtensionTask({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    taskId,
    resultSummary: "Task deleted in Leadsy."
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "extension.task.delete",
    resource: task.id,
    metadata: { status: task.status }
  });

  return NextResponse.json(task);
}
