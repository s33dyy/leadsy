import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { listCalendarEvents } from "@/lib/calendar-store";
import { buildCommandSearchResults } from "@/lib/command-search";
import { listCrmFollowUpTasks } from "@/lib/crm-store";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { listTeamMembers } from "@/lib/teamspace-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:command-search-read`, 180);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const scope = { tenantId: auth.session.tenantId, ownerId: auth.session.id };
  const [leads, teamMembers, calendarEvents, tasks] = await Promise.all([
    listLeadKnowledgeRecords(scope),
    listTeamMembers(scope),
    listCalendarEvents(scope),
    listCrmFollowUpTasks(scope, { includeClosed: true })
  ]);

  return NextResponse.json({
    results: buildCommandSearchResults({ query, leads, teamMembers, calendarEvents, tasks })
  });
}
