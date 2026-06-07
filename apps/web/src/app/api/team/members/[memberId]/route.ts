import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { updateTeamMember, type TeamMemberRole, type TeamMemberStatus } from "@/lib/teamspace-store";

export const runtime = "nodejs";

const memberRoles = new Set<TeamMemberRole>(["owner", "admin", "manager", "agent"]);
const memberStatuses = new Set<TeamMemberStatus>(["active", "paused", "invited"]);

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : undefined;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiSession(request, "admin:manage");
  if (!auth.ok) return auth.response;

  const { memberId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const role = typeof body.role === "string" && memberRoles.has(body.role as TeamMemberRole) ? (body.role as TeamMemberRole) : undefined;
  const status = typeof body.status === "string" && memberStatuses.has(body.status as TeamMemberStatus) ? (body.status as TeamMemberStatus) : undefined;

  try {
    const member = await updateTeamMember({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      memberId,
      name: typeof body.name === "string" ? body.name : undefined,
      emailOrPhone: typeof body.emailOrPhone === "string" ? body.emailOrPhone : undefined,
      role,
      status,
      pipelineStages: stringArray(body.pipelineStages),
      behaviorInstructions: typeof body.behaviorInstructions === "string" ? body.behaviorInstructions : undefined,
      autoReplyEnabled: typeof body.autoReplyEnabled === "boolean" ? body.autoReplyEnabled : undefined,
      escalationKeywords: stringArray(body.escalationKeywords)
    });

    audit({
      tenantId: auth.session.tenantId,
      actorId: auth.session.id,
      action: "teamspace.member.update",
      resource: member.id,
      metadata: { status: member.status, autoReplyEnabled: member.autoReplyEnabled }
    });

    return NextResponse.json({ ok: true, member });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return NextResponse.json({ error: "team_member_not_found" }, { status: 404 });
    }
    throw error;
  }
}
