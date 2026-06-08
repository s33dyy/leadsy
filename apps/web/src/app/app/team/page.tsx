import { Bot, MessageSquareText, Users2 } from "lucide-react";
import type { ReactNode } from "react";
import { TeamspaceConsole } from "@/components/teamspace-console";
import { getCurrentSession } from "@/lib/auth";
import { ensureDefaultQualificationAgent, listTeamMembers, summarizeTeamspaceHealth } from "@/lib/teamspace-store";
import { getWorkspaceBusinessSettings } from "@/lib/user-settings-store";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getCurrentSession();
  if (session) {
    await ensureDefaultQualificationAgent({ tenantId: session.tenantId, ownerId: session.id });
  }
  const members = session ? await listTeamMembers({ tenantId: session.tenantId, ownerId: session.id }) : [];
  const workspaceSettings = session ? await getWorkspaceBusinessSettings({ tenantId: session.tenantId, ownerId: session.id }) : undefined;
  const health = await summarizeTeamspaceHealth();

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="grid gap-3 md:grid-cols-3">
          <Metric icon={<Users2 className="h-4 w-4 text-primary" />} label="Team members" value={String(members.length)} />
          <Metric icon={<Bot className="h-4 w-4 text-primary" />} label="AI agents" value={String(members.filter((member) => member.type.startsWith("ai_agent")).length || health.aiAgents)} />
          <Metric icon={<MessageSquareText className="h-4 w-4 text-primary" />} label="Internal thread events" value={String(health.internalThreadMessages)} />
        </section>

        <TeamspaceConsole initialMembers={members} pipelineStageOptions={workspaceSettings?.pipelineStages ?? ["new", "collecting", "qualified", "meeting", "won"]} />
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="caption">{label}</span>
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
