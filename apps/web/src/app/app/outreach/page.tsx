import { AtSign, BarChart3, Mail, MessageCircle, Phone, RadioTower, ShieldAlert, UserRoundSearch } from "lucide-react";
import { campaigns } from "@leadsy/domain";
import { Badge, EmptyState, Panel, ProgressBar, SectionTitle } from "@/components/ui";

const cadence = [
  { day: "D1", channel: "email", title: "AI-personalized business event opener", icon: Mail },
  { day: "D2", channel: "linkedin", title: "Profile view and contextual connect", icon: UserRoundSearch },
  { day: "D4", channel: "phone", title: "Call task with account summary", icon: Phone },
  { day: "D6", channel: "whatsapp", title: "Approved mobile follow-up branch", icon: MessageCircle },
  { day: "D8", channel: "email", title: "Proof-point reply bump", icon: AtSign }
];

export default function OutreachPage() {
  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="AI Outreach Engine" title="Multi-channel cadences with deliverability controls" />
          <Badge tone="amber">{campaigns.length} active campaigns</Badge>
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <RadioTower size={17} className="text-[var(--amber)]" />
              Cadence builder
            </div>
            <div className="space-y-3">
              {cadence.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={`${step.day}-${step.channel}`} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-amber-300/10 text-amber-100">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="mono text-[11px] uppercase text-[var(--muted)]">{step.day} · {step.channel}</span>
                          <span className="mono text-[11px] text-[var(--muted-2)]">template</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">{step.title}</div>
                        <div className="mt-3">
                          <ProgressBar value={0} tone="teal" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

            <div className="grid gap-4">
            {campaigns.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {campaigns.map((campaign) => (
                <article key={campaign.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={campaign.status === "active" ? "teal" : "amber"}>{campaign.status}</Badge>
                    <span className="mono text-xs text-[var(--muted)]">{campaign.leads} leads</span>
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">{campaign.name}</div>
                  <p className="mt-2 min-h-[64px] text-sm leading-6 text-[var(--muted-2)]">{campaign.audience}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-semibold text-white">{campaign.replyRate}%</div>
                      <div className="mono text-[10px] uppercase text-[var(--muted)]">reply</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white">{campaign.meetings}</div>
                      <div className="mono text-[10px] uppercase text-[var(--muted)]">meetings</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white">{campaign.deliverability}</div>
                      <div className="mono text-[10px] uppercase text-[var(--muted)]">deliver</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            ) : (
              <EmptyState
                icon={RadioTower}
                title="No campaigns"
                detail="Campaigns are empty. Create a real campaign after connecting contacts, WhatsApp, email, or LinkedIn workflows."
              />
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldAlert size={17} className="text-[var(--rose)]" />
                  Deliverability model
                </div>
                {[
                  ["Inbox rotation", 0],
                  ["Warm-up reputation", 0],
                  ["Bounce protection", 0],
                  ["Spam language risk", 0]
                ].map(([label, value]) => (
                  <div key={label} className="mb-4">
                    <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                    <ProgressBar value={Number(value)} tone={Number(value) < 80 ? "amber" : "teal"} />
                  </div>
                ))}
              </div>
              <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                  <BarChart3 size={17} className="text-[var(--teal)]" />
                  Branch analytics
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["AI copy lift", "0"],
                    ["LinkedIn lift", "0"],
                    ["Call connects", "0"],
                    ["Meetings held", "0"]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                      <div className="text-xl font-semibold text-white">{value}</div>
                      <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
