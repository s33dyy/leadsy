import { Bot, CalendarCheck, ClipboardList, Globe2, MessageSquareText, Route, ScanEye } from "lucide-react";
import { captureFlows, routingRules } from "@leadsy/domain";
import { Badge, EmptyState, Panel, SectionTitle } from "@/components/ui";

const widgets = [
  { icon: ClipboardList, title: "Embedded forms", value: "progressive fields" },
  { icon: MessageSquareText, title: "Conversational widget", value: "qualification flows" },
  { icon: Bot, title: "AI chat widget", value: "account-aware answers" },
  { icon: ScanEye, title: "Visitor intelligence", value: "deanonymization layer" },
  { icon: CalendarCheck, title: "Meeting booking", value: "owner-aware calendars" },
  { icon: Route, title: "Routing rules", value: "territory and SLA logic" }
];

export default function CapturePage() {
  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Lead Capture System" title="Forms, chat, visitor intelligence, qualification, and routing" />
          <Badge tone="sky">edge-ready embed</Badge>
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Globe2 size={17} className="text-[var(--teal)]" />
              Website capture surface
            </div>
            <div className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface-2)] p-4">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
                <div>
                  <div className="text-sm font-semibold text-white">AI Concierge</div>
                  <div className="mono mt-1 text-[11px] text-[var(--muted)]">no visitor connected</div>
                </div>
                <Badge tone="neutral">inactive</Badge>
              </div>
              <div className="mt-4 space-y-3">
                <div className="mr-10 rounded-[8px] border border-[var(--line)] bg-white/[0.04] p-3 text-sm leading-6 text-[var(--muted-2)]">
                  Capture widget preview. Connect a real form, chat widget, or website script to receive visitor messages.
                </div>
                <div className="ml-10 rounded-[8px] border border-teal-300/25 bg-teal-300/10 p-3 text-sm leading-6 text-teal-50">
                  No live visitor conversation yet.
                </div>
                <div className="mr-10 rounded-[8px] border border-[var(--line)] bg-white/[0.04] p-3 text-sm leading-6 text-[var(--muted-2)]">
                  AI qualification starts after a real visitor submits data.
                </div>
              </div>
              <a href="/app/capture?setup=widget" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] text-sm font-medium text-teal-100">
                <CalendarCheck size={16} />
                Configure widget
              </a>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {widgets.map((widget) => {
              const Icon = widget.icon;
              return (
                <div key={widget.title} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                  <Icon size={18} className="text-[var(--teal)]" />
                  <div className="mt-4 text-sm font-semibold text-white">{widget.title}</div>
                  <div className="mono mt-2 text-[11px] text-[var(--muted)]">{widget.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-5">
          <SectionTitle eyebrow="qualification flows" title="Capture playbooks" />
          {captureFlows.length ? (
          <div className="mt-5 space-y-4">
            {captureFlows.map((flow) => (
              <div key={flow.name} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-base font-semibold text-white">{flow.name}</div>
                  <Badge tone="teal">active</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="mono text-[10px] uppercase text-[var(--muted)]">trigger</div>
                    <div className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{flow.trigger}</div>
                  </div>
                  <div>
                    <div className="mono text-[10px] uppercase text-[var(--muted)]">qualification</div>
                    <div className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{flow.qualification}</div>
                  </div>
                  <div>
                    <div className="mono text-[10px] uppercase text-[var(--muted)]">action</div>
                    <div className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{flow.action}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={ClipboardList}
                title="No capture playbooks"
                detail="Capture flows are empty. Create real qualification flows after deciding the source, offer, and routing policy."
              />
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="routing" title="Assignment policy" />
          {routingRules.length ? (
          <div className="mt-5 space-y-3">
            {routingRules.map((rule, index) => (
              <div key={rule} className="flex gap-3 rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-sky-300/10 text-xs text-sky-100">
                  {index + 1}
                </div>
                <div className="text-sm leading-6 text-[var(--muted-2)]">{rule}</div>
              </div>
            ))}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={Route}
                title="No routing rules"
                detail="Routing policies are empty. Add rules for owner assignment, SLA, consent, escalation, and client workspace isolation."
              />
            </div>
          )}
        </Panel>
      </section>

      <Panel className="p-5">
        <SectionTitle eyebrow="embed architecture" title="Capture SDK contract" />
        <div className="mt-5 rounded-[8px] border border-[var(--line)] bg-black/30 p-4">
          <pre className="scrollbar-dark overflow-x-auto text-xs leading-6 text-[var(--muted-2)]">
{`<script async src="https://cdn.leadsy.ai/widget.js" data-tenant="tenant_northstar" data-flow="enterprise-fast-lane"></script>`}
          </pre>
        </div>
      </Panel>
    </div>
  );
}
