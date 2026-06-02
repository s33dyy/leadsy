import { AlertTriangle, BarChart3, Brain, CalendarCheck, IndianRupee, MessageCircle, MousePointerClick, UsersRound } from "lucide-react";
import { agencyClients, formatInr, metaLeads, whatsappConversations } from "@leadsy/domain";
import { Badge, EmptyState, MiniBars, Panel, ProgressBar, SectionTitle } from "@/components/ui";

export default function AnalyticsPage() {
  const totalSpend = agencyClients.reduce((sum, client) => sum + client.monthlyAdSpend, 0);
  const totalLeads = agencyClients.reduce((sum, client) => sum + client.monthlyLeads, 0);

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Campaign analytics" title="CPL, qualification, WhatsApp conversion, and booking economics" />
          <Badge tone="teal">client-report ready</Badge>
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BarChart3 size={17} className="text-[var(--teal)]" />
              Spend to booking curve
            </div>
            <div className="mt-6">
              <MiniBars values={[0, 0, 0, 0, 0, 0, 0, 0]} />
              <div className="mt-3 grid grid-cols-4 gap-2">
                {agencyClients.length ? agencyClients.map((client) => (
                  <div key={client.id} className="rounded-[6px] border border-[var(--line)] bg-white/[0.03] p-3">
                    <div className="mono text-[10px] uppercase text-[var(--muted)]">{client.city}</div>
                    <div className="mt-2 text-lg font-semibold text-white">{formatInr(client.costPerLead)}</div>
                    <div className="text-xs text-[var(--muted)]">{client.bookingRate}% bookings</div>
                  </div>
                )) : (
                  <div className="col-span-4 rounded-[8px] border border-dashed border-[var(--line)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--muted-2)]">
                    No client spend or booking data yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Brain size={17} className="text-[var(--violet)]" />
              AI operator watch
            </div>
            <div className="mt-5 space-y-3">
              <EmptyState
                icon={AlertTriangle}
                title="No anomalies"
                detail="AI operator watch is empty because there is no real campaign, inbox, or booking data yet."
              />
            </div>
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <SectionTitle eyebrow="cohort analysis" title="Lead source quality" />
          <div className="mt-5">
            <EmptyState
              icon={BarChart3}
              title="No cohort data"
              detail="Cohorts will be calculated from real source, campaign, and conversion events after integrations are connected."
            />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="conversion funnel" title="Lead lifecycle" />
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              { icon: MousePointerClick, label: "Meta leads", value: totalLeads.toLocaleString("en-IN"), progress: totalLeads ? 100 : 0 },
              { icon: MessageCircle, label: "AI contacted", value: "0", progress: 0 },
              { icon: UsersRound, label: "Qualified", value: "0", progress: 0 },
              { icon: CalendarCheck, label: "Booked", value: "0", progress: 0 }
            ].map((stage) => {
              const Icon = stage.icon;
              return (
                <div key={stage.label} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                  <Icon size={18} className="text-[var(--teal)]" />
                  <div className="mt-4 text-2xl font-semibold text-white">{stage.value}</div>
                  <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">{stage.label}</div>
                  <div className="mt-4">
                    <ProgressBar value={stage.progress} tone="teal" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { icon: IndianRupee, label: "Spend", value: formatInr(totalSpend) },
              { icon: MessageCircle, label: "Conversations", value: whatsappConversations.length.toString() },
              { icon: MousePointerClick, label: "Meta leads", value: metaLeads.length.toString() }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <Icon size={16} className="text-[var(--teal)]" />
                  <div className="mt-2 text-sm font-semibold text-white">{item.value}</div>
                  <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">{item.label}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
    </div>
  );
}
