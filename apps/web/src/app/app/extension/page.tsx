import { Cable, ShieldCheck } from "lucide-react";
import { ExtensionPairing } from "@/components/extension-pairing";
import { Badge, Panel, SectionTitle } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionConversations, listExtensionTokens } from "@/lib/extension-store";

export const dynamic = "force-dynamic";

export default async function ExtensionPage() {
  const session = await getCurrentSession();
  const tokens = session ? await listExtensionTokens(session.tenantId, session.id) : [];
  const conversations = session ? await listExtensionConversations(session.tenantId, session.id) : [];

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

      <section className="grid gap-4 md:grid-cols-2">
        <Panel className="p-4">
          <Cable size={18} className="text-[var(--teal)]" />
          <div className="mt-4 text-sm font-semibold text-white">Worker role</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
            The extension operates chats and reports every decision, message, pause, and error back to Leadsy.
          </p>
        </Panel>
        <Panel className="p-4">
          <ShieldCheck size={18} className="text-[var(--teal)]" />
          <div className="mt-4 text-sm font-semibold text-white">Control role</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
            Leadsy owns context, routing, qualification, summaries, and agency-owner insight.
          </p>
        </Panel>
      </section>
    </div>
  );
}
