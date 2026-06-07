import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { provisionTeamMemberSender } from "@/lib/teamspace-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiSession(request, "admin:manage");
  if (!auth.ok) return auth.response;

  const { memberId } = await context.params;
  try {
    const result = await provisionTeamMemberSender({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      memberId
    });

    audit({
      tenantId: auth.session.tenantId,
      actorId: auth.session.id,
      action: "teamspace.member.sender.provision",
      resource: memberId,
      metadata: { transportMode: result.sender.transportMode, simulatorHandle: result.sender.simulatorHandle }
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return NextResponse.json({ error: "team_member_not_found" }, { status: 404 });
    }
    throw error;
  }
}
