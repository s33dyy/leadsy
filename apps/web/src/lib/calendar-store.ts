import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leadsyDataDir } from "./data-dir";

const calendarFile = join(leadsyDataDir, "calendar.json");

export type CalendarEventType = "availability" | "meeting" | "busy";
export type CalendarEventStatus = "available" | "held" | "proposed" | "confirmed" | "cancelled";

export type CalendarEvent = {
  id: string;
  tenantId: string;
  ownerId: string;
  memberId?: string;
  leadId?: string;
  conversationId?: string;
  title: string;
  startAt: string;
  endAt: string;
  eventType: CalendarEventType;
  status: CalendarEventStatus;
  attendees: string[];
  notes?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
};

export type CalendarFreeSlot = {
  memberId?: string;
  startAt: string;
  endAt: string;
};

type Scope = {
  tenantId: string;
  ownerId: string;
};

type CalendarState = {
  events: CalendarEvent[];
};

type CreateCalendarEventInput = Scope & {
  memberId?: string;
  leadId?: string;
  conversationId?: string;
  title: string;
  startAt: string;
  endAt: string;
  eventType: CalendarEventType;
  status?: CalendarEventStatus;
  attendees?: string[];
  notes?: string;
  location?: string;
};

type UpdateCalendarEventInput = Scope & {
  eventId: string;
  memberId?: string;
  leadId?: string;
  conversationId?: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  eventType?: CalendarEventType;
  status?: CalendarEventStatus;
  attendees?: string[];
  notes?: string;
  location?: string;
};

type FindFreeSlotsInput = Scope & {
  memberId?: string;
  from: string;
  to: string;
  slotMinutes?: number;
};

function emptyState(): CalendarState {
  return { events: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function scopeMatches(scope: Scope, item: Scope) {
  return item.tenantId === scope.tenantId && item.ownerId === scope.ownerId;
}

function uniqueStrings(values: string[] = []) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toMillis(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`Invalid calendar timestamp: ${value}`);
  return time;
}

function normalizeEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    eventType: event.eventType ?? "meeting",
    status: event.status ?? (event.eventType === "availability" ? "available" : "confirmed"),
    attendees: uniqueStrings(event.attendees ?? []),
    notes: event.notes,
    location: event.location
  };
}

async function readState(): Promise<CalendarState> {
  try {
    const raw = await readFile(calendarFile, "utf8");
    if (!raw.trim()) return emptyState();
    const parsed = JSON.parse(raw) as Partial<CalendarState>;
    return { events: Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent) : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return emptyState();
    throw error;
  }
}

async function writeState(state: CalendarState) {
  await mkdir(dirname(calendarFile), { recursive: true });
  const tempFile = `${calendarFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, calendarFile);
}

let calendarMutationQueue = Promise.resolve();

async function mutateState<T>(updater: (state: CalendarState) => { result: T; state?: CalendarState } | Promise<{ result: T; state?: CalendarState }>) {
  const operation = calendarMutationQueue.then(async () => {
    const state = await readState();
    const next = await updater(state);
    if (next.state) await writeState(next.state);
    return next.result;
  });
  calendarMutationQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

function assertTimeRange(startAt: string, endAt: string) {
  if (toMillis(endAt) <= toMillis(startAt)) throw new Error("Calendar event endAt must be after startAt.");
}

export async function createCalendarEvent(input: CreateCalendarEventInput) {
  assertTimeRange(input.startAt, input.endAt);
  return mutateState((state) => {
    const now = nowIso();
    const event: CalendarEvent = {
      id: `calev_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      memberId: input.memberId,
      leadId: input.leadId,
      conversationId: input.conversationId,
      title: input.title.trim(),
      startAt: input.startAt,
      endAt: input.endAt,
      eventType: input.eventType,
      status: input.status ?? (input.eventType === "availability" ? "available" : "confirmed"),
      attendees: uniqueStrings(input.attendees ?? []),
      notes: input.notes?.trim() || undefined,
      location: input.location?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    };
    return { state: { events: [...state.events, event] }, result: event };
  });
}

export async function updateCalendarEvent(input: UpdateCalendarEventInput) {
  if (input.startAt && input.endAt) assertTimeRange(input.startAt, input.endAt);
  return mutateState((state) => {
    const existing = state.events.find((event) => event.id === input.eventId && scopeMatches(input, event));
    if (!existing) throw new Error("Calendar event was not found.");
    const updated = normalizeEvent({
      ...existing,
      memberId: input.memberId ?? existing.memberId,
      leadId: input.leadId ?? existing.leadId,
      conversationId: input.conversationId ?? existing.conversationId,
      title: input.title?.trim() || existing.title,
      startAt: input.startAt ?? existing.startAt,
      endAt: input.endAt ?? existing.endAt,
      eventType: input.eventType ?? existing.eventType,
      status: input.status ?? existing.status,
      attendees: input.attendees ? uniqueStrings(input.attendees) : existing.attendees,
      notes: input.notes !== undefined ? input.notes.trim() || undefined : existing.notes,
      location: input.location !== undefined ? input.location.trim() || undefined : existing.location,
      updatedAt: nowIso()
    });
    assertTimeRange(updated.startAt, updated.endAt);
    return {
      state: { events: state.events.map((event) => (event.id === existing.id ? updated : event)) },
      result: updated
    };
  });
}

export async function deleteCalendarEvent(input: Scope & { eventId: string }) {
  return mutateState((state) => {
    const existing = state.events.find((event) => event.id === input.eventId && scopeMatches(input, event));
    if (!existing) return { result: false };
    return {
      state: { events: state.events.filter((event) => event.id !== existing.id) },
      result: true
    };
  });
}

export async function listCalendarEvents(input: Scope & { memberId?: string; leadId?: string; from?: string; to?: string }) {
  const from = input.from ? toMillis(input.from) : Number.NEGATIVE_INFINITY;
  const to = input.to ? toMillis(input.to) : Number.POSITIVE_INFINITY;
  const state = await readState();
  return state.events
    .filter((event) => scopeMatches(input, event))
    .filter((event) => !input.memberId || event.memberId === input.memberId)
    .filter((event) => !input.leadId || event.leadId === input.leadId)
    .filter((event) => toMillis(event.endAt) > from && toMillis(event.startAt) < to)
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
}

function overlaps(left: { startAt: string; endAt: string }, right: { startAt: string; endAt: string }) {
  return toMillis(left.startAt) < toMillis(right.endAt) && toMillis(left.endAt) > toMillis(right.startAt);
}

export async function findCalendarFreeSlots(input: FindFreeSlotsInput) {
  const slotMs = Math.max(15, input.slotMinutes ?? 30) * 60 * 1000;
  const from = toMillis(input.from);
  const to = toMillis(input.to);
  if (to <= from) return [];
  const events = await listCalendarEvents({ ...input, from: input.from, to: input.to });
  const blockingEvents = events.filter((event) => event.status !== "cancelled" && event.eventType !== "availability");
  const slots: CalendarFreeSlot[] = [];
  for (let cursor = from; cursor + slotMs <= to; cursor += slotMs) {
    const candidate = {
      memberId: input.memberId,
      startAt: new Date(cursor).toISOString(),
      endAt: new Date(cursor + slotMs).toISOString()
    };
    if (!blockingEvents.some((event) => overlaps(candidate, event))) {
      slots.push(candidate);
    }
  }
  return slots;
}

export async function summarizeCalendarHealth() {
  const state = await readState();
  return {
    events: state.events.length,
    meetings: state.events.filter((event) => event.eventType === "meeting" && event.status !== "cancelled").length,
    availabilityBlocks: state.events.filter((event) => event.eventType === "availability").length
  };
}
