import { Blocks, Bot, GitBranch, Mail, Route, Split } from "lucide-react";
import { WorkflowCanvas } from "@/components/workflow-canvas";
import { Badge, Panel, SectionTitle } from "@/components/ui";

const nodes = [
  { icon: GitBranch, label: "Triggers", detail: "Meta webhook, WhatsApp reply, missed call, form submit" },
  { icon: Split, label: "Conditions", detail: "budget, location, timeline, spam risk, SLA" },
  { icon: Bot, label: "AI actions", detail: "qualification, language detection, summaries, reply drafts" },
  { icon: Route, label: "CRM actions", detail: "create lead, update status, assign owner, book visit" },
  { icon: Mail, label: "Messaging", detail: "WhatsApp templates, AI replies, reminders, handoffs" },
  { icon: Blocks, label: "Enrichment", detail: "client mapping, phone cleanup, dedupe, attribution" }
];

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Automation Builder" title="Meta lead to WhatsApp conversion orchestration" />
          <Badge tone="teal">event-driven</Badge>
        </div>
        <div className="mt-6">
          <WorkflowCanvas />
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionTitle eyebrow="node library" title="Composable building blocks" />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {nodes.map((node) => {
            const Icon = node.icon;
            return (
              <div key={node.label} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                <Icon size={18} className="text-[var(--teal)]" />
                <div className="mt-3 text-sm font-semibold text-white">{node.label}</div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{node.detail}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
