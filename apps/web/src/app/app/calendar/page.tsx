import { CalendarConsole } from "@/components/calendar-console";
import { getCurrentSession } from "@/lib/auth";
import { listCalendarEvents } from "@/lib/calendar-store";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { listTeamMembers } from "@/lib/teamspace-store";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  const [events, members, leads] = scope
    ? await Promise.all([listCalendarEvents(scope), listTeamMembers(scope), listLeadKnowledgeRecords(scope)])
    : [[], [], []];

  return (
    <CalendarConsole
      initialEvents={events}
      members={members.map((member) => ({ id: member.id, name: member.name }))}
      leads={leads.map((lead) => ({ id: lead.id, contact: { displayName: lead.contact.displayName, phone: lead.contact.phone } }))}
    />
  );
}
