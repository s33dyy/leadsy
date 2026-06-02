import { Cable, ShieldCheck } from "lucide-react";
import { ExtensionTaskBoard } from "@/components/extension-task-board";
import { ExtensionPairing } from "@/components/extension-pairing";
import { Badge, Panel, SectionTitle } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionConversations, listExtensionTaskEvents, listExtensionTasks, listExtensionTokens } from "@/lib/extension-store";

export const dynamic = "force-dynamic";

export default async function WorkerPage() {
  const session = await getCurrentSession();
  const tokens = session ? await listExtensionTokens(session.tenantId, session.id) : [];
  const conversations = session ? await listExtensionConversations(session.tenantId, session.id) : [];
  const tasks = session ? await listExtensionTasks(session.tenantId, session.id) : [];
  const taskEvents = session ? await listExtensionTaskEvents(session.tenantId, session.id) : [];

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Leadsy Worker" title="Pair browser workers and monitor field conversations" />
          <Badge tone="teal">{conversations.length} synced conversations</Badge>
        </div>
        <div className="mt-6">
          <ExtensionPairing initialTokens={tokens} />
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Operations center" title="Queue tasks and monitor worker execution" />
          <Badge tone="teal">{tasks.length} tasks</Badge>
        </div>
        <div className="mt-6">
          <ExtensionTaskBoard initialTasks={tasks} initialEvents={taskEvents} />
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2">
        <Panel className="p-4">
          <Cable size={18} className="text-[var(--teal)]" />
          <div className="mt-4 text-sm font-semibold text-white">Worker role</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
            The extension handles the active browser conversation and reports messages, pauses, errors, and decisions back to Leadsy.
          </p>
        </Panel>
        <Panel className="p-4">
          <ShieldCheck size={18} className="text-[var(--teal)]" />
          <div className="mt-4 text-sm font-semibold text-white">Leadsy role</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
            Leadsy receives official incoming WhatsApp identity from Meta webhooks and keeps worker execution visible.
          </p>
        </Panel>
      </section>
    </div>
  );
}
