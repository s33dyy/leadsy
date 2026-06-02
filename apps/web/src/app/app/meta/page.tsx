import { Blocks, Camera, MessageCircle, ShieldCheck, Webhook } from "lucide-react";
import { metaQualificationWorkflowNodes } from "@leadsy/domain";
import { MetaLeadLab } from "@/components/meta-lead-lab";
import { Badge, Panel, SectionTitle } from "@/components/ui";

export default function MetaPage() {
  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Meta lead ingestion" title="Camera and Facebook leads routed into AI WhatsApp qualification" />
          <Badge tone="rose">webhook-ready</Badge>
        </div>
        <div className="mt-6">
          <MetaLeadLab />
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          { icon: Webhook, title: "Webhook receiver", detail: "Verifies payload, campaign, client, duplicate state, and phone quality." },
          { icon: Camera, title: "Campaign mapping", detail: "Preserves creative, ad set, source form, CPL, and client attribution." },
          { icon: MessageCircle, title: "WhatsApp activation", detail: "Queues instant AI opener and follow-up state machine." },
          { icon: ShieldCheck, title: "Spam control", detail: "Scores low-quality leads without wasting human closer time." }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Panel key={item.title} className="p-4">
              <Icon size={18} className="text-[var(--teal)]" />
              <div className="mt-4 text-sm font-semibold text-white">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{item.detail}</p>
            </Panel>
          );
        })}
      </section>

      <Panel className="p-5">
        <SectionTitle eyebrow="conversion workflow" title="Default Meta to WhatsApp automation" />
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {metaQualificationWorkflowNodes.map((node, index) => (
            <div key={node.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <Blocks size={17} className="text-[var(--teal)]" />
                <span className="mono text-[11px] text-[var(--muted)]">{index + 1}</span>
              </div>
              <div className="mt-4 text-sm font-semibold text-white">{node.label}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{node.description}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
