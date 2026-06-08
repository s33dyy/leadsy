import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { createCalendarEvent, listCalendarEvents, type CalendarEventStatus, type CalendarEventType } from "@/lib/calendar-store";
import { routeCrmEventToTasks } from "@/lib/crm-store";

export const runtime = "nodejs";

const eventTypes = new Set<CalendarEventType>(["availability", "meeting", "busy"]);
const eventStatuses = new Set<CalendarEventStatus>(["available", "held", "proposed", "confirmed", "cancelled"]);

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const events = await listCalendarEvents({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    memberId: url.searchParams.get("memberId") || undefined,
    leadId: url.searchParams.get("leadId") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined
  });

  return NextResponse.json({ ok: true, events });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:calendar:create`, 60, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const startAt = typeof body.startAt === "string" ? body.startAt.trim() : "";
  const endAt = typeof body.endAt === "string" ? body.endAt.trim() : "";
  const eventType = typeof body.eventType === "string" && eventTypes.has(body.eventType as CalendarEventType)
    ? (body.eventType as CalendarEventType)
    : "meeting";
  const status = typeof body.status === "string" && eventStatuses.has(body.status as CalendarEventStatus)
    ? (body.status as CalendarEventStatus)
    : undefined;

  if (!title) return NextResponse.json({ error: "calendar_title_required" }, { status: 400 });
  if (!startAt || !endAt) return NextResponse.json({ error: "calendar_time_range_required" }, { status: 400 });

  try {
    const event = await createCalendarEvent({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      memberId: typeof body.memberId === "string" ? body.memberId : undefined,
      leadId: typeof body.leadId === "string" ? body.leadId : undefined,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      title,
      startAt,
      endAt,
      eventType,
      status,
      attendees: stringArray(body.attendees),
      notes: typeof body.notes === "string" ? body.notes : undefined,
      location: typeof body.location === "string" ? body.location : undefined
    });

    audit({
      tenantId: auth.session.tenantId,
      actorId: auth.session.id,
      action: "calendar.event.create",
      resource: event.id,
      metadata: { eventType: event.eventType, status: event.status, leadId: event.leadId }
    });

    if (event.leadId) {
      await routeCrmEventToTasks({
        tenantId: auth.session.tenantId,
        ownerId: auth.session.id,
        eventType: "meeting_created",
        leadId: event.leadId,
        assigneeId: event.memberId,
        source: "calendar",
        reason: `Meeting created: ${event.title}`
      });
    }

    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /timestamp|endAt/i.test(error.message)) {
      return NextResponse.json({ error: "invalid_calendar_time_range" }, { status: 400 });
    }
    throw error;
  }
}
