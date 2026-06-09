import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { handleTeamChatAssignmentCommand, looksLikeTeamChatAssignmentCommand } from "@/lib/team-chat-commands";
import { listTeamThreadMessages, postTeamThreadMessage, runMentionedAgentOnce } from "@/lib/teamspace-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:team-chat-read`, 240);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const messages = await listTeamThreadMessages({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    threadScope: "workspace"
  });

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:team-chat-write`, 120);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const isJson = (request.headers.get("content-type") ?? "").includes("application/json");
  const payload = await readPayload(request);
  const body = payload.body?.trim();
  if (!body) return NextResponse.json({ error: "team_chat_body_required" }, { status: 400 });

  const isAssignmentCommand = looksLikeTeamChatAssignmentCommand(body);
  const message = await postTeamThreadMessage({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    threadScope: "workspace",
    leadId: payload.leadId,
    authorType: "human",
    authorMemberId: auth.session.id,
    body,
    eventType: isAssignmentCommand ? "task_assignment" : body.includes("@") ? "ai_mention" : "internal_note"
  });
  const assignmentResult = await handleTeamChatAssignmentCommand({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    body,
    leadId: payload.leadId,
    assignedById: auth.session.id,
    assignedByName: auth.session.name
  });
  const aiResult = assignmentResult.action === "not_assignment"
    ? await runMentionedAgentOnce({
        tenantId: auth.session.tenantId,
        ownerId: auth.session.id,
        messageId: message.id
      })
    : { action: "assignment_command" as const };
  const messages = await listTeamThreadMessages({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    threadScope: "workspace"
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "team_chat.message.post",
    resource: message.id,
    metadata: { aiAction: aiResult.action, assignmentAction: assignmentResult.action }
  });

  if (isJson) return NextResponse.json({ ok: true, message, aiResult, assignmentResult, messages }, { status: 201 });
  return NextResponse.redirect(urlForRequestHost(request, "/app/team-chat"), 303);
}

async function readPayload(request: NextRequest): Promise<{ body?: string; leadId?: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      body: typeof payload.body === "string" ? payload.body : undefined,
      leadId: typeof payload.leadId === "string" ? payload.leadId : undefined
    };
  }
  const form = await request.formData();
  return {
    body: String(form.get("body") ?? ""),
    leadId: String(form.get("leadId") ?? "").trim() || undefined
  };
}
