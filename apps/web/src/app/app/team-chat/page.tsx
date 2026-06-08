import { TeamChatConsole } from "@/components/team-chat-console";
import { getCurrentSession } from "@/lib/auth";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { ensureDefaultQualificationAgent, listTeamMembers, listTeamThreadMessages } from "@/lib/teamspace-store";

export const dynamic = "force-dynamic";

export default async function TeamChatPage() {
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  if (scope) await ensureDefaultQualificationAgent(scope);
  const [messages, members, leads] = scope
    ? await Promise.all([
        listTeamThreadMessages({ ...scope, threadScope: "workspace" }),
        listTeamMembers(scope),
        listLeadKnowledgeRecords(scope)
      ])
    : [[], [], []];

  return <TeamChatConsole initialMessages={messages} members={members} leads={leads} />;
}
