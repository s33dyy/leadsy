import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { deleteCalendarEvent, updateCalendarEvent, type CalendarEventStatus, type CalendarEventType } from "@/lib/calendar-store";

export const runtime = "nodejs";

const eventTypes = new Set<CalendarEventType>(["availability", "meeting", "busy"]);
const eventStatuses = new Set<CalendarEventStatus>(["available", "held", "proposed", "confirmed", "cancelled"]);

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : undefined;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const { eventId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const eventType = typeof body.eventType === "string" && eventTypes.has(body.eventType as CalendarEventType)
    ? (body.eventType as CalendarEventType)
    : undefined;
  const status = typeof body.status === "string" && eventStatuses.has(body.status as CalendarEventStatus)
    ? (body.status as CalendarEventStatus)
    : undefined;

  try {
    const event = await updateCalendarEvent({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      eventId,
      memberId: typeof body.memberId === "string" ? body.memberId : undefined,
      leadId: typeof body.leadId === "string" ? body.leadId : undefined,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      startAt: typeof body.startAt === "string" ? body.startAt : undefined,
      endAt: typeof body.endAt === "string" ? body.endAt : undefined,
      eventType,
      status,
      attendees: stringArray(body.attendees),
      notes: typeof body.notes === "string" ? body.notes : undefined,
      location: typeof body.location === "string" ? body.location : undefined
    });

    audit({
      tenantId: auth.session.tenantId,
      actorId: auth.session.id,
      action: "calendar.event.update",
      resource: event.id,
      metadata: { status: event.status, eventType: event.eventType }
    });

    return NextResponse.json({ ok: true, event });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return NextResponse.json({ error: "calendar_event_not_found" }, { status: 404 });
    }
    if (error instanceof Error && /timestamp|endAt/i.test(error.message)) {
      return NextResponse.json({ error: "invalid_calendar_time_range" }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiSession(_request, "crm:write");
  if (!auth.ok) return auth.response;

  const { eventId } = await context.params;
  const deleted = await deleteCalendarEvent({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    eventId
  });
  if (!deleted) return NextResponse.json({ error: "calendar_event_not_found" }, { status: 404 });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "calendar.event.delete",
    resource: eventId
  });

  return NextResponse.json({ ok: true });
}
