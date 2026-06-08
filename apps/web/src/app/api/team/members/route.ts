import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { createProvisionedTeamMember, listTeamMembers, type TeamMemberRole, type TeamMemberType } from "@/lib/teamspace-store";

export const runtime = "nodejs";

const memberTypes = new Set<TeamMemberType>(["human", "ai_agent_full", "ai_agent_assisted"]);
const memberRoles = new Set<TeamMemberRole>(["owner", "admin", "manager", "agent"]);

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const members = await listTeamMembers({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id
  });
  return NextResponse.json({ ok: true, members });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "admin:manage");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:team-members:create`, 20, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const type = typeof body.type === "string" && memberTypes.has(body.type as TeamMemberType) ? (body.type as TeamMemberType) : undefined;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = typeof body.role === "string" && memberRoles.has(body.role as TeamMemberRole) ? (body.role as TeamMemberRole) : undefined;

  if (!type) return NextResponse.json({ error: "team_member_type_required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "team_member_name_required" }, { status: 400 });

  let result;
  try {
    result = await createProvisionedTeamMember({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      type,
      name,
      emailOrPhone: typeof body.emailOrPhone === "string" ? body.emailOrPhone : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
      role,
      pipelineStages: stringArray(body.pipelineStages),
      behaviorInstructions: typeof body.behaviorInstructions === "string" ? body.behaviorInstructions : undefined,
      autoReplyEnabled: typeof body.autoReplyEnabled === "boolean" ? body.autoReplyEnabled : undefined,
      escalationKeywords: stringArray(body.escalationKeywords)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "team_member_create_failed";
    if (message === "team_member_login_required") return NextResponse.json({ error: message }, { status: 400 });
    if (message === "team_member_login_exists") return NextResponse.json({ error: message }, { status: 409 });
    throw error;
  }
  const { member, credentials } = result;

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "teamspace.member.create",
    resource: member.id,
    metadata: { type: member.type, autoReplyEnabled: member.autoReplyEnabled }
  });

  return NextResponse.json({ ok: true, member, credentials }, { status: 201 });
}
