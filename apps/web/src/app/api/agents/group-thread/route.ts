import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { listTeamThreadMessages, postTeamThreadMessage, type TeamThreadAuthorType, type TeamThreadEventType } from "@/lib/teamspace-store";

export const runtime = "nodejs";

const authorTypes = new Set<TeamThreadAuthorType>(["human", "ai_agent", "system"]);
const eventTypes = new Set<TeamThreadEventType>([
  "internal_note",
  "task_assignment",
  "handoff_summary",
  "calendar_proposal",
  "agent_guard",
  "assignment_changed",
  "ai_mention",
  "task_generated",
  "task_approved"
]);

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:agents:group-thread`, 120, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const threadScope = body.threadScope === "workspace" ? "workspace" : "lead";
  const messageBody = typeof body.body === "string" ? body.body.trim() : "";
  if (threadScope === "lead" && !leadId) return NextResponse.json({ error: "lead_id_required" }, { status: 400 });

  if (body.action === "list") {
    const messages = await listTeamThreadMessages({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      threadScope,
      leadId: leadId || undefined,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined
    });
    return NextResponse.json({ ok: true, messages });
  }

  if (!messageBody) return NextResponse.json({ error: "internal_message_body_required" }, { status: 400 });

  const authorType = typeof body.authorType === "string" && authorTypes.has(body.authorType as TeamThreadAuthorType)
    ? (body.authorType as TeamThreadAuthorType)
    : "human";
  const eventType = typeof body.eventType === "string" && eventTypes.has(body.eventType as TeamThreadEventType)
    ? (body.eventType as TeamThreadEventType)
    : "internal_note";

  const message = await postTeamThreadMessage({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    threadScope,
    leadId: leadId || undefined,
    conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
    authorMemberId: typeof body.authorMemberId === "string" ? body.authorMemberId : auth.session.id,
    authorType,
    body: messageBody,
    eventType,
    triggerId: typeof body.triggerId === "string" ? body.triggerId : undefined
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "agent.group_thread.post",
    resource: leadId || "workspace",
    metadata: { messageId: message.id, eventType: message.eventType, visibility: message.visibility }
  });

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
