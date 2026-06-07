import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { findCalendarFreeSlots } from "@/lib/calendar-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:calendar:free-slots`, 120, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const from = typeof body.from === "string" ? body.from.trim() : "";
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const slotMinutes = typeof body.slotMinutes === "number" ? body.slotMinutes : undefined;
  if (!from || !to) return NextResponse.json({ error: "calendar_window_required" }, { status: 400 });

  try {
    const slots = await findCalendarFreeSlots({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      memberId: typeof body.memberId === "string" ? body.memberId : undefined,
      from,
      to,
      slotMinutes
    });
    return NextResponse.json({ ok: true, slots });
  } catch (error) {
    if (error instanceof Error && /timestamp/i.test(error.message)) {
      return NextResponse.json({ error: "invalid_calendar_window" }, { status: 400 });
    }
    throw error;
  }
}
