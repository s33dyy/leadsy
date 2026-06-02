import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getLeadMagnetWorkspace, stopLeadSearchSession } from "@/lib/lead-magnet-store";
import { sourceHealth } from "@/lib/source-health";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-search-stop`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { sessionId?: unknown };
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session", message: "No active search session was provided." }, { status: 400 });
  }

  const searchSession = await stopLeadSearchSession(session.tenantId, session.id, sessionId);
  const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  return NextResponse.json({ ...workspace, searchSession, sourceHealth: sourceHealth() });
}
