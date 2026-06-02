import { FileText, Palette, ShieldCheck } from "lucide-react";
import { listAgencyClients } from "@/lib/agency-client-store";
import { ClientWorkspaceManager } from "@/components/client-workspace-manager";
import { Panel, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await listAgencyClients();

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Agency multi-client architecture" title="Operate many SMB clients without mixing leads, reports, or automations" />
        </div>
        <div className="mt-6">
          <ClientWorkspaceManager initialClients={clients} />
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Client isolation", detail: "Every lead, conversation, campaign, and audit event is scoped to a client workspace." },
          { icon: FileText, title: "AI reporting", detail: "Generate client-ready summaries around spend, CPL, speed-to-lead, bookings, and conversion blockers." },
          { icon: Palette, title: "White-label readiness", detail: "Agency-branded portals and exported reports can sit on the same multitenant core." }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Panel key={item.title} className="p-5">
              <Icon size={19} className="text-[var(--teal)]" />
              <div className="mt-4 text-base font-semibold text-white">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{item.detail}</p>
            </Panel>
          );
        })}
      </section>
    </div>
  );
}
