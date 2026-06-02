import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  Clock,
  IndianRupee,
  Camera,
  Magnet,
  MessageCircle,
  Target,
  Users
} from "lucide-react";
import {
  followUpTasks,
  formatInr,
  metaLeads,
  whatsappConversations
} from "@leadsy/domain";
import { listAgencyClients } from "@/lib/agency-client-store";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionConversations } from "@/lib/extension-store";
import { getLeadMagnetWorkspace } from "@/lib/lead-magnet-store";
import { Badge, EmptyState, MetricCard, MiniBars, Panel, ProgressBar, SectionTitle } from "@/components/ui";

const leadFunnel = [
  { label: "Meta leads", value: metaLeads.length, progress: metaLeads.length ? 100 : 0 },
  { label: "AI contacted", value: metaLeads.filter((lead) => lead.status === "ai-contacted").length, progress: 0 },
  { label: "Qualified", value: metaLeads.filter((lead) => ["qualified", "booked", "site-visit", "won"].includes(lead.status)).length, progress: 0 },
  { label: "Booked", value: metaLeads.filter((lead) => lead.status === "booked").length, progress: 0 }
];

const sourceBars = [0, 0, 0, 0, 0, 0, 0, 0];

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const session = await getCurrentSession();
  const agencyClients = await listAgencyClients();
  const leadWorkspace = session
    ? await getLeadMagnetWorkspace(session.tenantId, session.id)
    : { brief: null, leads: [], runs: [], drafts: [], agentRuns: [] };
  const workerConversations = session ? await listExtensionConversations(session.tenantId, session.id) : [];
  const totalAdSpend = agencyClients.reduce((sum, client) => sum + client.monthlyAdSpend, 0);
  const totalLeads = agencyClients.reduce((sum, client) => sum + client.monthlyLeads, 0);
  const blendedCpl = totalLeads ? Math.round(totalAdSpend / totalLeads) : 0;
  const hotConversations = whatsappConversations.filter((conversation) => conversation.qualification.escalate);
  const outreachReady = leadWorkspace.leads.filter((lead) => lead.qualityDecision?.status === "good" && lead.score.status === "high-confidence");
  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.32fr_0.68fr]">
        <Panel className="overflow-hidden p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="teal">AI Lead Operating System</Badge>
              <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-5xl">
                Find, qualify, message, and convert leads with an AI sales operator.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted-2)]">
                Built for agencies and Indian SMBs where prospect discovery, CPL, speed-to-lead, appointment booking, and follow-up discipline matter more than enterprise ceremony.
              </p>
            </div>
            <div className="panel-quiet min-w-[230px] p-4">
              <div className="mono text-[11px] uppercase text-[var(--muted)]">Blended CPL</div>
              <div className="mt-2 text-3xl font-semibold text-white">{formatInr(blendedCpl)}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-teal-200">
                <ArrowUpRight size={15} />
                AI replies are effectively free vs. paid lead cost
              </div>
            </div>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Meta CPL" value={formatInr(blendedCpl)} delta="no spend yet" tone="flat" />
            <MetricCard label="Speed To Lead" value="0s" delta="no leads yet" tone="flat" />
            <MetricCard label="Qualified Leads" value="0" delta="no records" tone="flat" />
            <MetricCard label="Bookings" value="0" delta="no meetings" tone="flat" />
            <MetricCard
              label="Worker Chats"
              value={workerConversations.length.toLocaleString("en-IN")}
              delta={workerConversations.length ? "synced" : "none yet"}
              tone={workerConversations.length ? "good" : "flat"}
            />
            <MetricCard label="Dead Lead Drift" value="0" delta="no drift" tone="flat" />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="AI ops brief" title="What to do now" />
          <div className="mt-5 space-y-3">
            {[
              "Open Find Leads and save your agency lead brief.",
              "Connect OpenRouter or paste a real list.",
              "Run discovery and review evidence-backed lead dossiers.",
              "Approve AI-drafted WhatsApp, DM, or email messages manually."
            ].map((insight, index) => (
              <div key={insight} className="flex gap-3 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-teal-300/10 text-xs text-teal-100">
                  {index + 1}
                </div>
                <p className="text-sm leading-6 text-[var(--muted-2)]">{insight}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Panel className="p-5">
          <SectionTitle eyebrow="Meta -> AI -> WhatsApp" title="Conversion flow" />
          <div className="mt-5 space-y-4">
            {leadFunnel.map((stage, index) => (
              <div key={stage.label} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-teal-300/10 text-sm text-teal-100">
                      {index + 1}
                    </div>
                    <span className="text-sm font-semibold text-white">{stage.label}</span>
                  </div>
                  <span className="mono text-sm text-[var(--muted-2)]">{stage.value.toLocaleString("en-IN")}</span>
                </div>
                <div className="mt-3">
                  <ProgressBar value={stage.progress} tone={index < 2 ? "teal" : "lime"} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="live lead room" title="WhatsApp priority queue" />
          {whatsappConversations.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {whatsappConversations.map((conversation) => {
              const client = agencyClients.find((candidate) => candidate.id === conversation.clientId);
              return (
                <article key={conversation.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={conversation.qualification.escalate ? "rose" : "teal"}>
                      {conversation.status}
                    </Badge>
                    <span className="mono text-xs text-[var(--muted)]">{conversation.unread} unread</span>
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">{conversation.contactName}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{client?.name} · {conversation.qualification.language}</div>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-[var(--muted-2)]">{conversation.aiSummary}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="mono text-xs text-teal-200">intent {conversation.qualification.intentScore}</span>
                    <a href="/app/inbox" className="text-xs font-medium text-white hover:text-teal-100">
                      Open
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={MessageCircle}
                title="No WhatsApp leads"
                detail="Connect WhatsApp or ingest real Meta leads to populate the priority queue."
              />
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel className="p-5">
          <SectionTitle eyebrow="lead magnet" title="Autonomous prospecting queue" />
          {leadWorkspace.leads.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {leadWorkspace.leads.slice(0, 6).map((lead) => {
              return (
                <article key={lead.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={lead.score.overall >= 80 ? "lime" : lead.score.overall >= 70 ? "teal" : "amber"}>
                      score {lead.score.overall}
                    </Badge>
                    <span className="mono text-xs text-[var(--muted)]">{lead.score.status}</span>
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">{lead.businessName}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{lead.category} · {lead.city}</div>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-[var(--muted-2)]">{lead.outreachAngle}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="mono text-xs text-teal-200">{lead.evidence.length} evidence</span>
                    <a href="/app/magnet" className="text-xs font-medium text-white hover:text-teal-100">
                      Review
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={Magnet}
                title="No leads discovered"
                detail="Open Find Leads, describe what you sell, connect a source or paste a real list, then run discovery."
              />
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="research sources" title="Where AI is looking" />
          {leadWorkspace.brief?.sources.length ? (
          <div className="mt-5 space-y-3">
            {leadWorkspace.brief.sources.map((source) => (
              <div key={source} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Magnet size={16} className="text-[var(--teal)]" />
                    {source.replace(/-/g, " ")}
                  </div>
                  <Badge tone="teal">selected</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[6px] bg-black/20 p-2">
                    <div className="text-sm font-semibold text-white">{leadWorkspace.runs[0]?.found ?? 0}</div>
                    <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">found</div>
                  </div>
                  <div className="rounded-[6px] bg-black/20 p-2">
                    <div className="text-sm font-semibold text-white">{leadWorkspace.runs[0]?.qualified ?? 0}</div>
                    <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">qualified</div>
                  </div>
                  <div className="rounded-[6px] bg-black/20 p-2">
                    <div className="text-sm font-semibold text-white">{leadWorkspace.runs[0]?.needsReview ?? 0}</div>
                    <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">review</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={Magnet}
                title="No source selected"
                detail="Open Find Leads and choose Full free search, Light search, or manual import."
              />
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel className="p-5 xl:col-span-2">
          <SectionTitle eyebrow="agency clients" title="Client control tower" />
          <div className="mt-5 overflow-x-auto scrollbar-dark">
            <table className="w-full min-w-[840px] border-separate border-spacing-0">
              <thead>
                <tr className="mono text-left text-[11px] uppercase text-[var(--muted)]">
                  <th className="border-b border-[var(--line)] py-3 font-normal">Client</th>
                  <th className="border-b border-[var(--line)] py-3 font-normal">Spend</th>
                  <th className="border-b border-[var(--line)] py-3 font-normal">CPL</th>
                  <th className="border-b border-[var(--line)] py-3 font-normal">SLA</th>
                  <th className="border-b border-[var(--line)] py-3 font-normal">Qualified</th>
                  <th className="border-b border-[var(--line)] py-3 font-normal">Bookings</th>
                  <th className="border-b border-[var(--line)] py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {agencyClients.map((client) => (
                  <tr key={client.id} className="text-sm">
                    <td className="border-b border-[var(--line)] py-4">
                      <div className="font-semibold text-white">{client.name}</div>
                      <div className="text-xs text-[var(--muted)]">{client.vertical} · {client.city}</div>
                    </td>
                    <td className="border-b border-[var(--line)] py-4 text-[var(--muted-2)]">{formatInr(client.monthlyAdSpend)}</td>
                    <td className="border-b border-[var(--line)] py-4 text-white">{formatInr(client.costPerLead)}</td>
                    <td className="border-b border-[var(--line)] py-4 text-[var(--muted-2)]">{client.responseSlaSeconds}s</td>
                    <td className="border-b border-[var(--line)] py-4">
                      <ProgressBar value={client.qualificationRate} tone="teal" />
                    </td>
                    <td className="border-b border-[var(--line)] py-4">
                      <ProgressBar value={client.bookingRate * 5} tone="lime" />
                    </td>
                    <td className="border-b border-[var(--line)] py-4">
                      <Badge tone={client.status === "healthy" ? "teal" : client.status === "watch" ? "amber" : "rose"}>
                        {client.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!agencyClients.length ? (
              <EmptyState
                icon={Users}
                title="No client workspaces"
                detail="Create a client workspace before importing leads, launching campaigns, or running reports."
              />
            ) : null}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="automation workload" title="Today" />
          <div className="mt-5 space-y-3">
            {[
              { icon: Camera, label: "Meta leads ingested", value: metaLeads.length, tone: "text-[var(--rose)]" },
              { icon: Magnet, label: "Prospects discovered", value: leadWorkspace.leads.length, tone: "text-[var(--sky)]" },
              { icon: MessageCircle, label: "Outreach-ready prospects", value: outreachReady.length, tone: "text-[var(--teal)]" },
              { icon: MessageCircle, label: "WhatsApp AI replies", value: whatsappConversations.length, tone: "text-[var(--teal)]" },
              { icon: Clock, label: "Median first response", value: "0s", tone: "text-[var(--sky)]" },
              { icon: CalendarCheck, label: "Bookings created", value: metaLeads.filter((lead) => lead.status === "booked").length, tone: "text-[var(--lime)]" },
              { icon: AlertTriangle, label: "Human escalations", value: hotConversations.length, tone: "text-[var(--amber)]" }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                  <div className="flex items-center gap-3">
                    <Icon size={17} className={item.tone} />
                    <span className="text-sm text-[var(--muted-2)]">{item.label}</span>
                  </div>
                  <span className="font-semibold text-white">{item.value}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <Panel className="p-5">
          <SectionTitle eyebrow="follow-up engine" title="Queued actions" />
          {followUpTasks.length ? (
          <div className="mt-5 space-y-3">
            {followUpTasks.map((task) => {
              const client = agencyClients.find((candidate) => candidate.id === task.clientId);
              return (
                <div key={task.id} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      {task.automation === "ai" ? <Bot size={16} className="text-[var(--teal)]" /> : <Target size={16} className="text-[var(--amber)]" />}
                      {task.title}
                    </div>
                    <Badge tone={task.automation === "human" ? "amber" : "teal"}>{task.automation}</Badge>
                  </div>
                  <div className="mono mt-2 text-[11px] text-[var(--muted)]">{client?.name} · {task.channel} · {task.status}</div>
                </div>
              );
            })}
          </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={CalendarCheck}
                title="No follow-ups queued"
                detail="AI follow-ups will appear after real leads, conversations, or booked visits enter the system."
              />
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="campaign pulse" title="Lead acquisition economics" />
          <div className="mt-5">
            <MiniBars values={sourceBars} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { icon: IndianRupee, label: "Total spend", value: formatInr(totalAdSpend) },
              { icon: Activity, label: "Total leads", value: totalLeads.toLocaleString("en-IN") },
              { icon: MessageCircle, label: "AI cost posture", value: "aggressive" }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                  <Icon size={18} className="text-[var(--teal)]" />
                  <div className="mt-3 text-lg font-semibold text-white">{item.value}</div>
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
