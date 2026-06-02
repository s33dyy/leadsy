import { Bot, CheckCircle2, DatabaseZap, Fingerprint, Radar, ShieldCheck, Split } from "lucide-react";
import { accounts, leads } from "@leadsy/domain";
import { EnrichmentLab } from "@/components/enrichment-lab";
import { Badge, EmptyState, Panel, ProgressBar, SectionTitle } from "@/components/ui";

const providers = [
  { name: "Company graph", icon: DatabaseZap },
  { name: "Contact waterfall", icon: Fingerprint },
  { name: "Intent cooperative", icon: Radar },
  { name: "Verification mesh", icon: ShieldCheck },
  { name: "Duplicate resolver", icon: Split },
  { name: "Lead summary agent", icon: Bot }
];

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="AI Lead Intelligence Engine" title="Enrichment, scoring, and buying signal detection" />
          <Badge tone="teal">{leads.length} live leads</Badge>
        </div>
        <div className="mt-6">
          <EnrichmentLab />
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="p-5">
          <SectionTitle eyebrow="signal model" title="Account scoring matrix" />
          {accounts.length ? (
          <div className="mt-5 space-y-4">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{account.name}</div>
                    <div className="text-xs text-[var(--muted)]">{account.technologies.join(" · ")}</div>
                  </div>
                  <Badge tone={account.intent > 90 ? "lime" : "teal"}>{account.tier}</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                      <span>ICP</span>
                      <span>{account.icpFit}</span>
                    </div>
                    <ProgressBar value={account.icpFit} tone="lime" />
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                      <span>Intent</span>
                      <span>{account.intent}</span>
                    </div>
                    <ProgressBar value={account.intent} tone="teal" />
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                      <span>Health</span>
                      <span>{account.health}</span>
                    </div>
                    <ProgressBar value={account.health} tone={account.health < 60 ? "rose" : "sky"} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {account.activeSignals.map((signal) => (
                    <Badge key={signal} tone="amber">
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={Radar}
                title="No accounts to score"
                detail="The scoring matrix is empty. Import CRM accounts or connect lead sources to score real buying signals."
              />
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="provider abstraction" title="Waterfall health" />
          <div className="mt-5 grid gap-3">
            {providers.map((provider) => {
              const Icon = provider.icon;
              return (
                <div key={provider.name} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Icon size={17} className="text-[var(--teal)]" />
                      <span className="text-sm font-semibold text-white">{provider.name}</span>
                    </div>
                    <span className="mono text-xs text-[var(--muted-2)]">not connected</span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={0} tone="teal" />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>

      <Panel className="p-5">
        <SectionTitle eyebrow="dedupe and compliance" title="Contact verification pipeline" />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ["Normalize", "domain, email, social handles"],
            ["Verify", "email, phone, disposable status"],
            ["Resolve", "account match and open opportunity check"],
            ["Explain", "AI summary and route rationale"]
          ].map(([title, detail], index) => (
            <div key={title} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-teal-300/10 text-sm text-teal-100">
                <CheckCircle2 size={16} />
              </div>
              <div className="mt-3 text-sm font-semibold text-white">{index + 1}. {title}</div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{detail}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
