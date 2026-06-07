import { Bot, MessageSquareText, Users2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { TeamspaceConsole } from "@/components/teamspace-console";
import { getCurrentSession } from "@/lib/auth";
import { ensureDefaultQualificationAgent, listTeamMembers, summarizeTeamspaceHealth } from "@/lib/teamspace-store";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getCurrentSession();
  if (session) {
    await ensureDefaultQualificationAgent({ tenantId: session.tenantId, ownerId: session.id });
  }
  const members = session ? await listTeamMembers({ tenantId: session.tenantId, ownerId: session.id }) : [];
  const health = await summarizeTeamspaceHealth();

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-[8px] border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users2 className="h-4 w-4 text-primary" />
            Teamspace
          </div>
          <h1 className="mt-2 text-xl font-semibold">Humans, AI agents, routing, and handoffs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Configure who owns each pipeline stage. Initial WhatsApp qualification can be handled by an AI agent with guarded auto-replies, then handed to a human or assisted AI owner.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="teal">AI qualification</Badge>
            <Badge tone="neutral">Human handoff</Badge>
            <Badge tone="amber">Simulator sender provisioning</Badge>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <Metric icon={<Users2 className="h-4 w-4 text-primary" />} label="Team members" value={String(members.length)} />
          <Metric icon={<Bot className="h-4 w-4 text-primary" />} label="AI agents" value={String(members.filter((member) => member.type.startsWith("ai_agent")).length || health.aiAgents)} />
          <Metric icon={<MessageSquareText className="h-4 w-4 text-primary" />} label="Internal thread events" value={String(health.internalThreadMessages)} />
        </section>

        <TeamspaceConsole initialMembers={members} />
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
