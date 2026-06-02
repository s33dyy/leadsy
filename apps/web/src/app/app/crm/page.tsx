import { Activity, Filter, Network, NotebookPen, Plus, Search, Users } from "lucide-react";
import { accounts, activities, contacts, deals, formatCurrency } from "@leadsy/domain";
import { PipelineBoard } from "@/components/pipeline-board";
import { RelationshipGraph } from "@/components/relationship-graph";
import { Badge, EmptyState, Panel, ProgressBar, SectionTitle } from "@/components/ui";

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionTitle eyebrow="CRM system" title="Pipeline workspace" />
          <div className="flex flex-wrap gap-2">
            <a href="/app/crm?view=search" className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 text-sm text-[var(--muted-2)] hover:text-white">
              <Search size={16} />
              Smart search
            </a>
            <a href="/app/crm?filter=hot-fit" className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 text-sm text-[var(--muted-2)] hover:text-white">
              <Filter size={16} />
              Filters
            </a>
            <a href="/app/crm?new=deal" className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/10 px-3 text-sm text-teal-100 hover:bg-teal-300/15">
              <Plus size={16} />
              Deal
            </a>
          </div>
        </div>
        <div className="mt-6">
          <PipelineBoard />
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="p-5">
          <SectionTitle eyebrow="relationship graph" title="Buying committee" />
          <div className="mt-5">
            <RelationshipGraph />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="accounts" title="Smart account list" />
          {accounts.length ? (
          <div className="mt-5 space-y-3">
            {accounts.map((account) => {
              const accountDeals = deals.filter((deal) => deal.accountId === account.id);
              return (
                <div key={account.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">{account.name}</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">{account.industry} · {account.region} · {account.employees.toLocaleString()} employees</div>
                    </div>
                    <Badge tone={account.tier === "strategic" ? "lime" : "sky"}>{account.tier}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">{account.summary}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="mb-2 flex justify-between text-xs text-[var(--muted)]">
                        <span>Health</span>
                        <span>{account.health}</span>
                      </div>
                      <ProgressBar value={account.health} tone={account.health < 60 ? "rose" : "teal"} />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-xs text-[var(--muted)]">
                        <span>Intent</span>
                        <span>{account.intent}</span>
                      </div>
                      <ProgressBar value={account.intent} tone="amber" />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-xs text-[var(--muted)]">
                        <span>Open value</span>
                        <span>{formatCurrency(accountDeals.reduce((sum, deal) => sum + deal.value, 0))}</span>
                      </div>
                      <ProgressBar value={account.icpFit} tone="lime" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={Search}
                title="No accounts"
                detail="CRM accounts are empty. Import real accounts or connect a CRM before using account intelligence."
              />
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel className="p-5 xl:col-span-2">
          <SectionTitle eyebrow="timeline" title="Activities and notes" />
          {activities.length ? (
          <div className="mt-5 space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3 rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-white/[0.05] text-[var(--teal)]">
                  <Activity size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{activity.title}</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted-2)]">{activity.detail}</p>
                  <div className="mono mt-2 text-[11px] text-[var(--muted)]">{activity.actor}</div>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={Activity}
                title="No timeline activity"
                detail="Notes, calls, meetings, and automation events will appear here once real records enter the CRM."
              />
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="contacts" title="Relationship map" />
          {contacts.length ? (
          <div className="mt-5 space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-sky-300/10 text-sky-100">
                    <Users size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{contact.name}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{contact.title}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge tone={contact.persona === "economic-buyer" ? "lime" : "neutral"}>{contact.persona}</Badge>
                  <span className="mono text-xs text-[var(--muted-2)]">{contact.relationshipStrength}</span>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={Users}
                title="No contacts"
                detail="Import real contacts or let enrichment create contacts from captured leads."
              />
            </div>
          )}
        </Panel>
      </section>

      <Panel className="p-5">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: Network, title: "Realtime updates", value: "event bus ready" },
            { icon: NotebookPen, title: "Notes", value: "account-scoped" },
            { icon: Filter, title: "Smart filters", value: "AI generated" }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                <Icon size={18} className="text-[var(--teal)]" />
                <div className="mt-3 text-sm font-semibold text-white">{item.title}</div>
                <div className="mono mt-1 text-xs text-[var(--muted)]">{item.value}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
