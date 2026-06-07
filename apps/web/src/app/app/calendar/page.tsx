import { CalendarDays, Clock, ListChecks, Plus } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listCalendarEvents } from "@/lib/calendar-store";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { listTeamMembers } from "@/lib/teamspace-store";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default async function CalendarPage() {
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  const [events, members, leads] = scope
    ? await Promise.all([listCalendarEvents(scope), listTeamMembers(scope), listLeadKnowledgeRecords(scope)])
    : [[], [], []];

  const meetings = events.filter((event) => event.eventType === "meeting" && event.status !== "cancelled");
  const availability = events.filter((event) => event.eventType === "availability");

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="caption">Leadsy / Calendar</div>
            <h1 className="mt-2 text-2xl font-semibold">Calendar</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Native availability, busy blocks, and meetings that AI agents can use before proposing times.
            </p>
          </div>
          <button className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" /> New event
          </button>
        </header>

        <section className="rounded-[8px] border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" />
              Calendar view
            </div>
            <div className="flex flex-wrap gap-1">
              {["Month", "Week", "Day", "List"].map((label) => (
                <span key={label} className="rounded-[5px] border border-border bg-background px-2 py-1 font-mono text-xs text-muted-foreground">
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-px bg-border md:grid-cols-4">
            <Metric label="Meetings" value={meetings.length} />
            <Metric label="Availability" value={availability.length} />
            <Metric label="Team members" value={members.length} />
            <Metric label="Linked leads" value={events.filter((event) => event.leadId).length} />
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-[8px] border border-border bg-surface">
            <div className="border-b border-border p-4">
              <div className="caption">Meetings</div>
            </div>
            {meetings.length ? (
              <div className="divide-y divide-border">
                {meetings.map((event) => {
                  const owner = members.find((member) => member.id === event.memberId);
                  const lead = leads.find((candidate) => candidate.id === event.leadId);
                  return (
                    <article key={event.id} className="grid gap-3 p-4 md:grid-cols-[120px_1fr_auto]">
                      <div className="font-mono text-xs text-muted-foreground">
                        <div>{formatDate(event.startAt)}</div>
                        <div>{formatTime(event.startAt)} - {formatTime(event.endAt)}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{event.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {lead?.contact.displayName || lead?.contact.phone || "No linked lead"} · {owner?.name || "Unassigned"}
                        </div>
                      </div>
                      <Badge tone={event.status === "confirmed" ? "teal" : "neutral"}>{event.status}</Badge>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No meetings yet.</div>
            )}
          </section>

          <section className="rounded-[8px] border border-border bg-surface">
            <div className="border-b border-border p-4">
              <div className="caption">Availability</div>
            </div>
            {availability.length ? (
              <div className="divide-y divide-border">
                {availability.map((event) => {
                  const owner = members.find((member) => member.id === event.memberId);
                  return (
                    <article key={event.id} className="p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        {event.title}
                      </div>
                      <div className="mt-2 font-mono text-xs text-muted-foreground">
                        {formatDate(event.startAt)} · {formatTime(event.startAt)} - {formatTime(event.endAt)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{owner?.name || "Workspace-wide"}</div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-sm leading-6 text-muted-foreground">
                Add availability windows so AI agents can propose only real free times.
              </div>
            )}
          </section>
        </div>

        <section className="rounded-[8px] border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="h-4 w-4 text-primary" />
            Agent scheduling rules
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Agents can find free slots, hold a proposed slot, create meetings, reschedule, and cancel only through this database-backed calendar.
          </p>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface p-4">
      <div className="caption">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
