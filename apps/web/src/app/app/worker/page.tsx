import Link from "next/link";
import { Activity, Bot, CalendarClock, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listCalendarEvents } from "@/lib/calendar-store";
import { listCrmFollowUpTasks } from "@/lib/crm-store";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { listTeamMembers } from "@/lib/teamspace-store";

export const dynamic = "force-dynamic";

const nativeRoutes = [
  {
    name: "follow-up scheduler",
    icon: CalendarClock,
    purpose: "Schedules follow-up tasks against Leadsy-owned lead and calendar data.",
    status: "Leadsy scheduler"
  },
  {
    name: "reminder generator",
    icon: Activity,
    purpose: "Creates operator reminders from due dates, handoffs, and stale conversations.",
    status: "Leadsy event"
  },
  {
    name: "task creator",
    icon: ListChecks,
    purpose: "Creates call, WhatsApp follow-up, meeting, site visit, review lead, and custom tasks.",
    status: "Leadsy task"
  },
  {
    name: "escalation rules",
    icon: ShieldCheck,
    purpose: "Stops AI auto-replies and routes sensitive leads to a human owner.",
    status: "Guarded"
  }
];

export default async function WorkerPage() {
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  const [members, tasks, events, leads] = scope
    ? await Promise.all([
        listTeamMembers(scope),
        listCrmFollowUpTasks(scope, { includeClosed: true }),
        listCalendarEvents(scope),
        listLeadKnowledgeRecords(scope)
      ])
    : [[], [], [], []];
  const aiAgents = members.filter((member) => member.type.startsWith("ai_agent"));
  const autoReplyAgents = aiAgents.filter((member) => member.autoReplyEnabled);
  const humanReviewLeads = leads.filter((lead) => lead.crmStatus === "human_review");

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="caption">Leadsy / Automations</div>
            <h1 className="mt-2 text-2xl font-semibold">Leadsy-native automations</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Follow-ups, reminders, task creation, escalation rules, and AI qualification run inside Leadsy using the app database as source of truth.
            </p>
          </div>
          <Link href="/app/team" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Bot className="h-4 w-4" /> Manage agents
          </Link>
        </header>

        <section className="grid gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-4">
          <Metric label="AI agents" value={aiAgents.length} />
          <Metric label="Auto-reply on" value={autoReplyAgents.length} />
          <Metric label="Open tasks" value={tasks.filter((task) => task.status !== "done").length} />
          <Metric label="Human review" value={humanReviewLeads.length} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {nativeRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <article key={route.name} className="rounded-[8px] border border-border bg-surface p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">{route.name}</h2>
                  <Badge tone="teal">{route.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{route.purpose}</p>
              </article>
            );
          })}
        </section>

        <section className="rounded-[8px] border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              AI guardrails
            </div>
            <Badge tone="neutral">No infinite loops</Badge>
          </div>
          <div className="grid gap-px bg-border md:grid-cols-3">
            <Guardrail title="External message boundary" detail="Only inbound and outbound WhatsApp messages are stored in conversations." />
            <Guardrail title="Internal team thread" detail="AI handoffs, notes, task assignments, and calendar proposals stay internal." />
            <Guardrail title="Loop controls" detail="One agent turn per trigger, duplicate trigger dedupe, cooldowns, and escalation keywords." />
          </div>
        </section>

        <section className="rounded-[8px] border border-border bg-surface p-4">
          <div className="caption">Calendar-backed scheduling</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Agents can offer meeting times only from the native calendar. Current calendar records: {events.length}.
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

function Guardrail({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="bg-surface p-4">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}
