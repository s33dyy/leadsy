"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Pencil, Search, Trash2, X } from "lucide-react";
import type { CalendarEvent, CalendarEventStatus, CalendarEventType } from "@/lib/calendar-store";

type CalendarConsoleProps = {
  initialEvents: CalendarEvent[];
  members: Array<{ id: string; name: string }>;
  leads: Array<{ id: string; contact: { displayName?: string; phone?: string } }>;
};

type CalendarMode = "Day" | "Week" | "Month" | "Year";

type EventForm = {
  id?: string;
  title: string;
  startAt: string;
  endAt: string;
  eventType: CalendarEventType;
  status: CalendarEventStatus;
  memberId: string;
  leadId: string;
  location: string;
  notes: string;
  attendees: string;
};

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const modes: CalendarMode[] = ["Day", "Week", "Month", "Year"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromInput(value: string) {
  return new Date(value).toISOString();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function monthGridDays(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function weekGridDays(anchor: Date) {
  const start = addDays(startOfDay(anchor), -anchor.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function eventDay(event: CalendarEvent) {
  return startOfDay(new Date(event.startAt));
}

function eventTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date);
}

function defaultForm(anchor = new Date()): EventForm {
  const start = new Date(anchor);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);
  return {
    title: "New meeting",
    startAt: localInputValue(start),
    endAt: localInputValue(end),
    eventType: "meeting",
    status: "confirmed",
    memberId: "",
    leadId: "",
    location: "",
    notes: "",
    attendees: ""
  };
}

function formFromEvent(event: CalendarEvent): EventForm {
  return {
    id: event.id,
    title: event.title,
    startAt: localInputValue(new Date(event.startAt)),
    endAt: localInputValue(new Date(event.endAt)),
    eventType: event.eventType,
    status: event.status,
    memberId: event.memberId ?? "",
    leadId: event.leadId ?? "",
    location: event.location ?? "",
    notes: event.notes ?? "",
    attendees: event.attendees.join("\n")
  };
}

function dayNumberClass(day: Date, anchor: Date) {
  if (sameDay(day, new Date())) return "bg-primary text-primary-foreground";
  if (day.getMonth() !== anchor.getMonth()) return "text-muted-foreground/50";
  return "text-muted-foreground";
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function CalendarConsole({ initialEvents, members, leads }: CalendarConsoleProps) {
  const [events, setEvents] = useState(initialEvents);
  const [mode, setMode] = useState<CalendarMode>("Month");
  const [anchor, setAnchor] = useState(new Date());
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<EventForm>(() => defaultForm());
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [status, setStatus] = useState("");
  const eventSearchRef = useRef<HTMLInputElement>(null);
  const leadNameById = useMemo(
    () => new Map(leads.map((lead) => [lead.id, lead.contact.displayName || lead.contact.phone || lead.id])),
    [leads]
  );
  const memberNameById = useMemo(() => new Map(members.map((member) => [member.id, member.name])), [members]);

  const filteredEvents = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return events;
    return events.filter((event) => [
      event.title,
      event.location,
      event.notes,
      event.status,
      event.eventType,
      event.memberId ? memberNameById.get(event.memberId) : undefined,
      event.leadId ? leadNameById.get(event.leadId) : undefined,
      ...event.attendees
    ].filter(Boolean).join(" ").toLowerCase().includes(clean));
  }, [events, leadNameById, memberNameById, query]);

  function visibleEventsForDay(day: Date) {
    return filteredEvents.filter((event) => sameDay(eventDay(event), day)).sort((left, right) => left.startAt.localeCompare(right.startAt));
  }

  function move(delta: number) {
    if (mode === "Day") setAnchor(addDays(anchor, delta));
    if (mode === "Week") setAnchor(addDays(anchor, delta * 7));
    if (mode === "Month") setAnchor(addMonths(anchor, delta));
    if (mode === "Year") setAnchor(addMonths(anchor, delta * 12));
  }

  async function refresh() {
    const response = await fetch("/api/calendar/events", { headers: { accept: "application/json" } });
    const payload = (await response.json().catch(() => ({}))) as { events?: CalendarEvent[] };
    if (response.ok && Array.isArray(payload.events)) setEvents(payload.events);
  }

  const openCreateEvent = useCallback(() => {
    setForm(defaultForm(anchor));
    setStatus("");
    setEventModalOpen(true);
  }, [anchor]);

  const openEditEvent = useCallback((event: CalendarEvent) => {
    setForm(formFromEvent(event));
    setStatus("");
    setEventModalOpen(true);
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = {
      title: form.title,
      startAt: fromInput(form.startAt),
      endAt: fromInput(form.endAt),
      eventType: form.eventType,
      status: form.status,
      memberId: form.memberId || undefined,
      leadId: form.leadId || undefined,
      location: form.location,
      notes: form.notes,
      attendees: form.attendees.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
    };
    const response = await fetch(form.id ? `/api/calendar/events/${form.id}` : "/api/calendar/events", {
      method: form.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const data = (await response.json().catch(() => ({}))) as { event?: CalendarEvent; error?: string };
    if (!response.ok || !data.event) {
      setStatus(data.error || "calendar_save_failed");
      return;
    }
    setForm(defaultForm(anchor));
    setStatus(form.id ? "Event updated." : "Event created.");
    setEventModalOpen(false);
    await refresh();
  }

  async function remove(eventId: string) {
    const response = await fetch(`/api/calendar/events/${eventId}`, { method: "DELETE", headers: { accept: "application/json" } });
    if (!response.ok) {
      setStatus("Could not delete event.");
      return;
    }
    setStatus("Event deleted.");
    await refresh();
  }

  useEffect(() => {
    function handleCalendarShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isEditableShortcutTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "/") {
        event.preventDefault();
        eventSearchRef.current?.focus();
      }
      if (key === "e") {
        event.preventDefault();
        openCreateEvent();
      }
      if (key === "d") {
        event.preventDefault();
        setMode("Day");
      }
      if (key === "w") {
        event.preventDefault();
        setMode("Week");
      }
      if (key === "m") {
        event.preventDefault();
        setMode("Month");
      }
      if (key === "y") {
        event.preventDefault();
        setMode("Year");
      }
      if (key === "t") {
        event.preventDefault();
        setAnchor(new Date());
      }
    }

    window.addEventListener("keydown", handleCalendarShortcut);
    return () => window.removeEventListener("keydown", handleCalendarShortcut);
  }, [openCreateEvent]);

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="space-y-5 p-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{mode === "Year" ? anchor.getFullYear() : monthLabel(anchor)}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 items-center gap-1 rounded-[999px] border border-border bg-surface-2 p-1">
              {modes.map((item) => (
                <button key={item} type="button" onClick={() => setMode(item)} className={`h-7 rounded-[999px] px-3 text-sm ${mode === item ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {item}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => move(-1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2 hover:bg-surface-3"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setAnchor(new Date())} className="h-9 rounded-full border border-border bg-surface-2 px-3 text-sm hover:bg-surface-3">Today</button>
            <button type="button" onClick={() => move(1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2 hover:bg-surface-3"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </header>

        <div>
          <section className="min-w-0 overflow-hidden rounded-[8px] border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
              <div className="flex h-9 min-w-[220px] items-center gap-2 rounded-[6px] border border-border bg-background px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input ref={eventSearchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                <span className="kbd">/</span>
              </div>
              <button type="button" onClick={openCreateEvent} className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <CalendarPlus className="h-4 w-4" /> New event
                <span className="kbd border-primary-foreground/40 text-primary-foreground">E</span>
              </button>
            </div>
            {mode === "Month" ? <MonthGrid anchor={anchor} days={monthGridDays(anchor)} visibleEventsForDay={visibleEventsForDay} edit={openEditEvent} remove={remove} /> : null}
            {mode === "Week" ? <WeekGrid days={weekGridDays(anchor)} visibleEventsForDay={visibleEventsForDay} edit={openEditEvent} remove={remove} /> : null}
            {mode === "Day" ? <DayView day={anchor} events={visibleEventsForDay(anchor)} edit={openEditEvent} remove={remove} /> : null}
            {mode === "Year" ? <YearView anchor={anchor} events={filteredEvents} setAnchor={setAnchor} setMode={setMode} /> : null}
          </section>
        </div>
      </div>
      {eventModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={form.id ? "Edit event" : "Create event"}>
          <form onSubmit={save} className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-[8px] border border-border bg-background p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <h2 className="text-sm font-semibold">{form.id ? "Edit event" : "Create event"}</h2>
              <button type="button" aria-label="Close event form" onClick={() => setEventModalOpen(false)} className="grid h-8 w-8 place-items-center rounded-[6px] border border-border bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Title"><input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><input type="datetime-local" className={inputClass} value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} /></Field>
                <Field label="End"><input type="datetime-local" className={inputClass} value={form.endAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select className={inputClass} value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value as CalendarEventType })}>
                    <option value="meeting">Meeting</option>
                    <option value="availability">Availability</option>
                    <option value="busy">Busy block</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CalendarEventStatus })}>
                    <option value="available">Available</option>
                    <option value="held">Held</option>
                    <option value="proposed">Proposed</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
              </div>
              <Field label="Owner">
                <select className={inputClass} value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}>
                  <option value="">Workspace</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </Field>
              <Field label="Linked lead">
                <select className={inputClass} value={form.leadId} onChange={(event) => setForm({ ...form, leadId: event.target.value })}>
                  <option value="">No linked lead</option>
                  {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.contact.displayName || lead.contact.phone || lead.id}</option>)}
                </select>
              </Field>
              <Field label="Location / link"><input className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
              <Field label="Attendees"><textarea className={textAreaClass} value={form.attendees} onChange={(event) => setForm({ ...form, attendees: event.target.value })} /></Field>
              <Field label="Notes"><textarea className={textAreaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
              <button type="submit" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <CalendarPlus className="h-4 w-4" /> {form.id ? "Update event" : "Create event"}
              </button>
              <div className="min-h-5 text-xs text-muted-foreground">{status}</div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

const inputClass = "h-10 w-full rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-primary";
const textAreaClass = "min-h-20 w-full rounded-[6px] border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="caption">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function EventPill({ event, edit, remove }: { event: CalendarEvent; edit: (event: CalendarEvent) => void; remove: (eventId: string) => void }) {
  const tone = event.eventType === "availability" ? "bg-teal-300/20 text-teal-100" : event.status === "cancelled" ? "bg-rose-300/15 text-rose-100" : "bg-violet-300/20 text-violet-100";
  return (
    <div className={`group flex items-center gap-1 rounded-[5px] px-1.5 py-1 text-[11px] ${tone}`}>
      <span className="min-w-0 flex-1 truncate">{eventTime(event.startAt)} {event.title}</span>
      <button type="button" aria-label="Edit event" onClick={() => edit(event)} className="opacity-0 group-hover:opacity-100"><Pencil className="h-3 w-3" /></button>
      <button type="button" aria-label="Delete event" onClick={() => remove(event.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
    </div>
  );
}

function MonthGrid({ anchor, days, visibleEventsForDay, edit, remove }: { anchor: Date; days: Date[]; visibleEventsForDay: (day: Date) => CalendarEvent[]; edit: (event: CalendarEvent) => void; remove: (eventId: string) => void }) {
  return (
    <div className="calendar-month-grid">
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((day) => <div key={day} className="p-3 text-right text-sm text-muted-foreground">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const events = visibleEventsForDay(day);
          return (
            <div key={day.toISOString()} className="min-h-[132px] border-b border-r border-border p-2">
              <div className={`ml-auto grid h-6 w-6 place-items-center rounded-full text-sm ${dayNumberClass(day, anchor)}`}>{day.getDate()}</div>
              <div className="mt-2 space-y-1">
                {events.slice(0, 4).map((event) => <EventPill key={event.id} event={event} edit={edit} remove={remove} />)}
                {events.length > 4 ? <div className="font-mono text-[10px] text-muted-foreground">+{events.length - 4} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ days, visibleEventsForDay, edit, remove }: { days: Date[]; visibleEventsForDay: (day: Date) => CalendarEvent[]; edit: (event: CalendarEvent) => void; remove: (eventId: string) => void }) {
  return (
    <div className="grid grid-cols-7">
      {days.map((day) => (
        <div key={day.toISOString()} className="min-h-[520px] border-r border-border p-3">
          <div className="text-sm font-medium">{weekDays[day.getDay()]} {day.getDate()}</div>
          <div className="mt-3 space-y-2">
            {visibleEventsForDay(day).map((event) => <EventPill key={event.id} event={event} edit={edit} remove={remove} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayView({ day, events, edit, remove }: { day: Date; events: CalendarEvent[]; edit: (event: CalendarEvent) => void; remove: (eventId: string) => void }) {
  return (
    <div className="min-h-[520px] divide-y divide-border">
      <div className="p-4 text-sm font-semibold">{weekDays[day.getDay()]} {day.toLocaleDateString("en-IN")}</div>
      {events.length ? events.map((event) => (
        <div key={event.id} className="grid gap-3 p-4 md:grid-cols-[120px_1fr_auto]">
          <div className="font-mono text-xs text-muted-foreground">{eventTime(event.startAt)} - {eventTime(event.endAt)}</div>
          <div>
            <div className="text-sm font-medium">{event.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{event.location || event.status}</div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => edit(event)} className="grid h-8 w-8 place-items-center rounded-[6px] border border-border"><Pencil className="h-4 w-4" /></button>
            <button type="button" onClick={() => remove(event.id)} className="grid h-8 w-8 place-items-center rounded-[6px] border border-border"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      )) : <div className="p-8 text-center text-sm text-muted-foreground">No events for this day.</div>}
    </div>
  );
}

function YearView({ anchor, events, setAnchor, setMode }: { anchor: Date; events: CalendarEvent[]; setAnchor: (date: Date) => void; setMode: (mode: CalendarMode) => void }) {
  return (
    <div className="grid gap-px bg-border p-px md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, month) => {
        const date = new Date(anchor.getFullYear(), month, 1);
        const count = events.filter((event) => new Date(event.startAt).getFullYear() === anchor.getFullYear() && new Date(event.startAt).getMonth() === month).length;
        return (
          <button key={month} type="button" onClick={() => { setAnchor(date); setMode("Month"); }} className="min-h-[120px] bg-background p-4 text-left hover:bg-surface-2">
            <div className="text-sm font-semibold">{date.toLocaleDateString("en-IN", { month: "long" })}</div>
            <div className="mt-6 font-mono text-xs text-muted-foreground">{count} events</div>
          </button>
        );
      })}
    </div>
  );
}
