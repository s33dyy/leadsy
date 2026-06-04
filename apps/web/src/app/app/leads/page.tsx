import {
  Ban,
  CheckCircle2,
  Clock,
  EyeOff,
  ExternalLink,
  Filter,
  Inbox,
  ListChecks,
  Mail,
  MessageCircle,
  NotebookPen,
  PhoneCall,
  RadioTower,
  Search,
  Archive,
  Pencil,
  UserRound,
  Workflow
} from "lucide-react";
import Link from "next/link";
import { Badge, EmptyState, Panel, PrimaryLink, SectionTitle } from "@/components/ui";
import { LeadScrollKeeper } from "@/components/lead-scroll-keeper";
import { SelectedLeadTasks } from "@/components/selected-lead-tasks";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionTaskEvents, listExtensionTasks, type ExtensionTask, type ExtensionTaskEvent } from "@/lib/extension-store";
import {
  listLeadKnowledgeRecords,
  syncLeadKnowledgeFromExtensionTasks,
  type LeadKnowledgeChannel,
  type LeadKnowledgeConversation,
  type LeadKnowledgeMessage,
  type LeadKnowledgeRecord
} from "@/lib/lead-knowledge-store";

export const dynamic = "force-dynamic";

type LeadsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ViewFilter = "all" | "needs-reply" | "active" | "meta" | "extension" | "excluded";
type LeadWorkspaceTab = "details" | "comms" | "tasks";
type CommChannelFilter = "all" | "whatsapp" | "instagram" | "facebook" | "email" | "call" | "browser" | "manual";

const viewFilters: Array<{ id: ViewFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs-reply", label: "Needs reply" },
  { id: "active", label: "Active leads" },
  { id: "meta", label: "Meta" },
  { id: "extension", label: "Extension" },
  { id: "excluded", label: "Excluded" }
];

const workspaceTabs: Array<{ id: LeadWorkspaceTab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "comms", label: "Comms" },
  { id: "tasks", label: "Tasks" }
];

const commFilters: Array<{ id: CommChannelFilter; label: string; channels?: LeadKnowledgeChannel[] }> = [
  { id: "all", label: "All" },
  { id: "whatsapp", label: "WhatsApp", channels: ["whatsapp", "whatsapp-web"] },
  { id: "instagram", label: "Instagram", channels: ["instagram", "instagram-web"] },
  { id: "facebook", label: "Facebook", channels: ["facebook", "facebook-web"] },
  { id: "email", label: "Email", channels: ["email"] },
  { id: "call", label: "Call Notes", channels: ["call"] },
  { id: "browser", label: "Browser Chat", channels: ["generic-web-chat"] },
  { id: "manual", label: "Manual", channels: ["manual"] }
];

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value?: string) {
  if (!value) return "No activity";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function shortDate(value?: string) {
  if (!value) return "No touch";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function contactLabel(lead: LeadKnowledgeRecord) {
  return lead.contact.displayName || lead.contact.handle || lead.contact.phone || lead.contact.email || lead.contact.waId || "Unknown lead";
}

function latestMessage(lead: LeadKnowledgeRecord) {
  return lead.lastMessagePreview || lead.summary || "No communication logged yet";
}

function latestDirection(lead: LeadKnowledgeRecord) {
  return lead.messages.at(-1)?.direction ?? "note";
}

function needsReply(lead: LeadKnowledgeRecord) {
  return lead.leadStatus === "lead" && latestDirection(lead) === "inbound";
}

function crmStage(lead: LeadKnowledgeRecord) {
  if (lead.leadStatus === "excluded") return "Not a lead";
  if (needsReply(lead)) return "Needs reply";
  if (lead.outboundCount > 0) return "Working";
  if (lead.channels.some((channel) => channel === "whatsapp" || channel === "instagram" || channel === "facebook")) return "New Meta lead";
  return "New lead";
}

function stageTone(stage: string): "teal" | "amber" | "lime" | "sky" | "neutral" {
  if (stage === "Needs reply") return "amber";
  if (stage === "Working") return "sky";
  if (stage === "New Meta lead") return "lime";
  if (stage === "Not a lead") return "neutral";
  return "teal";
}

function nextAction(lead: LeadKnowledgeRecord) {
  if (lead.leadStatus === "excluded") return "Track only. No sales follow-up.";
  if (lead.nextAction) return lead.nextAction;
  if (needsReply(lead)) return "Reply in the right Meta channel and qualify intent.";
  if (!lead.outboundCount) return "Open conversation and start qualification.";
  return "Wait for reply or log the next outcome.";
}

function noticeCopy(params: Record<string, string | string[] | undefined>) {
  const notice = paramValue(params, "notice");
  if (notice === "lead-excluded") return "Lead excluded. Conversation history stays recorded.";
  if (notice === "lead-restored") return "Lead restored.";
  if (notice === "conversation-excluded") return "Conversation excluded from AI knowledge.";
  if (notice === "conversation-restored") return "Conversation restored to AI knowledge.";
  if (notice === "manual-message-added") return "Manual communication logged.";
  if (notice === "lead-edited") return "Lead details updated.";
  if (notice === "lead-archived") return "Lead archived. History is preserved.";
  if (notice === "message-hidden") return "Communication hidden from the active timeline.";
  if (notice === "message-restored") return "Communication restored.";
  if (notice === "lead-magnet-archived") return "Lead Magnet is archived. Lead Intelligence is the active workspace.";
  return "";
}

function crmHref(input: {
  view?: ViewFilter;
  q?: string;
  contact?: string;
  tab?: LeadWorkspaceTab;
  commChannel?: CommChannelFilter;
}) {
  const params = new URLSearchParams();
  if (input.view && input.view !== "all") params.set("view", input.view);
  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.contact) params.set("contact", input.contact);
  if (input.tab && input.tab !== "details") params.set("tab", input.tab);
  if (input.commChannel && input.commChannel !== "all") params.set("commChannel", input.commChannel);
  const query = params.toString();
  return query ? `/app/leads?${query}` : "/app/leads";
}

function matchesQuery(lead: LeadKnowledgeRecord, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    contactLabel(lead),
    lead.contact.phone,
    lead.contact.email,
    lead.contact.handle,
    lead.contact.profileUrl,
    latestMessage(lead),
    crmStage(lead),
    nextAction(lead),
    ...lead.channels
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

function matchesView(lead: LeadKnowledgeRecord, view: ViewFilter) {
  if (view === "needs-reply") return needsReply(lead);
  if (view === "active") return lead.leadStatus === "lead";
  if (view === "meta") return lead.channels.some((channel) => channel === "whatsapp" || channel === "instagram" || channel === "facebook");
  if (view === "extension") return lead.channels.some((channel) => channel.endsWith("-web") || channel === "generic-web-chat");
  if (view === "excluded") return lead.leadStatus === "excluded";
  return true;
}

function filterLeads(leads: LeadKnowledgeRecord[], view: ViewFilter, query: string) {
  return leads.filter((lead) => matchesView(lead, view) && matchesQuery(lead, query));
}

function activityTitle(message: LeadKnowledgeMessage) {
  if (message.direction === "outbound") return "Outbound";
  if (message.direction === "note") return "Manual note";
  if (message.direction === "system") return "Worker event";
  return "Inbound";
}

function channelLabel(channel: LeadKnowledgeChannel) {
  if (channel === "email") return "Email";
  if (channel === "call") return "Call Notes";
  if (channel === "generic-web-chat") return "Browser Chat";
  return channel.replace(/-/g, " ");
}

function openHref(lead: LeadKnowledgeRecord) {
  const conversationUrl = lead.conversations.find((conversation) => conversation.sourceUrl)?.sourceUrl;
  if (conversationUrl) return conversationUrl;
  const phone = (lead.contact.phone || lead.contact.waId || "").replace(/\D/g, "");
  if (phone) return `https://web.whatsapp.com/send?phone=${phone}`;
  if (lead.contact.profileUrl) return lead.contact.profileUrl;
  return "";
}

function activeTabFromValue(value: string): LeadWorkspaceTab {
  return workspaceTabs.some((tab) => tab.id === value) ? (value as LeadWorkspaceTab) : "details";
}

function commChannelFromValue(value: string): CommChannelFilter {
  return commFilters.some((filter) => filter.id === value) ? (value as CommChannelFilter) : "all";
}

function messagesForCommChannel(lead: LeadKnowledgeRecord, commChannel: CommChannelFilter) {
  const filter = commFilters.find((candidate) => candidate.id === commChannel);
  if (!filter?.channels) return lead.messages;
  const allowed = new Set(filter.channels);
  return lead.messages.filter((message) => allowed.has(message.channel));
}

function conversationsForCommChannel(lead: LeadKnowledgeRecord, commChannel: CommChannelFilter) {
  const filter = commFilters.find((candidate) => candidate.id === commChannel);
  if (!filter?.channels) return lead.conversations;
  const allowed = new Set(filter.channels);
  return lead.conversations.filter((conversation) => allowed.has(conversation.channel));
}

function tasksForLead(tasks: ExtensionTask[], lead: LeadKnowledgeRecord) {
  return tasks.filter((task) => taskMatchesLead(task, lead));
}

function backfillLeadIdsForTasks(tasks: ExtensionTask[], leads: LeadKnowledgeRecord[]) {
  return tasks.map((task) => {
    if (task.leadId) return task;
    const match = leads.find((lead) => taskMatchesLead(task, lead));
    return match ? { ...task, leadId: match.id } : task;
  });
}

function taskMatchesLead(task: ExtensionTask, lead: LeadKnowledgeRecord) {
  if (task.leadId) return task.leadId === lead.id;
  const conversationIds = new Set(lead.conversations.map((conversation) => conversation.id));
  if (task.conversationId && conversationIds.has(task.conversationId)) return true;
  const leadValues = identityValuesForLead(lead);
  return identityValuesForTask(task).some((value) => leadValues.has(value));
}

function identityValuesForLead(lead: LeadKnowledgeRecord) {
  return new Set(
    [
      lead.contact.phone,
      lead.contact.waId,
      lead.contact.email,
      lead.contact.handle,
      lead.contact.profileUrl,
      ...lead.identityKeys,
      ...lead.conversations.flatMap((conversation) => [conversation.sourceUrl, conversation.contact.phone, conversation.contact.email, conversation.contact.handle, conversation.contact.profileUrl])
    ]
      .flatMap((value) => normalizeIdentityValues(value))
      .filter(Boolean)
  );
}

function identityValuesForTask(task: ExtensionTask) {
  return [
    task.targetUrl,
    whatsappPhoneFromUrl(task.targetUrl),
    task.contact.phone,
    task.contact.email,
    task.contact.handle,
    task.contact.profileUrl
  ]
    .flatMap((value) => normalizeIdentityValues(value))
    .filter(Boolean);
}

function normalizeIdentityValues(value?: string) {
  const clean = value?.trim();
  if (!clean) return [];
  const lower = clean.toLowerCase();
  const digits = clean.replace(/\D/g, "");
  return [lower, digits.length >= 7 ? digits : undefined].filter(Boolean) as string[];
}

function whatsappPhoneFromUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.searchParams.get("phone") ?? undefined;
  } catch {
    return undefined;
  }
}

function eventsForTasks(events: ExtensionTaskEvent[], tasks: ExtensionTask[]) {
  const taskIds = new Set(tasks.map((task) => task.id));
  return events.filter((event) => taskIds.has(event.taskId));
}

function toneForChannel(channel: LeadKnowledgeChannel): "teal" | "amber" | "lime" | "sky" | "neutral" {
  if (channel === "whatsapp" || channel === "instagram" || channel === "facebook") return "lime";
  if (channel === "email" || channel === "call" || channel === "manual") return "amber";
  if (channel.endsWith("-web") || channel === "generic-web-chat") return "sky";
  return "teal";
}

function Metric({
  label,
  value,
  tone = "teal"
}: {
  label: string;
  value: string | number;
  tone?: "teal" | "amber" | "lime" | "sky";
}) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
      <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <Badge tone={tone}>ops</Badge>
    </div>
  );
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = searchParams ? await searchParams : {};
  const session = await getCurrentSession();
  const tasks = session ? await listExtensionTasks(session.tenantId, session.id) : [];
  if (session) {
    await syncLeadKnowledgeFromExtensionTasks({ tenantId: session.tenantId, ownerId: session.id }, tasks);
  }
  const leads = session ? await listLeadKnowledgeRecords({ tenantId: session.tenantId, ownerId: session.id }) : [];
  const leadTasks = backfillLeadIdsForTasks(tasks, leads);
  const taskEvents = session ? await listExtensionTaskEvents(session.tenantId, session.id) : [];
  const requestedView = paramValue(params, "view") as ViewFilter;
  const activeView = viewFilters.some((filter) => filter.id === requestedView) ? requestedView : "all";
  const activeTab = activeTabFromValue(paramValue(params, "tab"));
  const activeCommChannel = commChannelFromValue(paramValue(params, "commChannel"));
  const query = paramValue(params, "q");
  const filteredLeads = filterLeads(leads, activeView, query);
  const selectedLeadId = paramValue(params, "contact");
  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) ??
    leads.find((lead) => lead.id === selectedLeadId) ??
    filteredLeads[0] ??
    leads[0] ??
    null;
  const activeLeads = leads.filter((lead) => lead.leadStatus === "lead");
  const replyQueue = leads.filter(needsReply);
  const excludedLeads = leads.filter((lead) => lead.leadStatus === "excluded");
  const metaLeads = leads.filter((lead) => matchesView(lead, "meta"));
  const notice = noticeCopy(params);

  return (
    <div className="space-y-5">
      <LeadScrollKeeper />
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Lead Intelligence" title="Knowledge workspace" />
          <div className="flex flex-wrap gap-2">
            <Badge tone="teal">All Meta and browser conversations</Badge>
            <Badge tone="amber">{replyQueue.length} Needs reply</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total records" value={leads.length} />
          <Metric label="Active leads" value={activeLeads.length} tone="lime" />
          <Metric label="Needs reply" value={replyQueue.length} tone="amber" />
          <Metric label="Meta-sourced" value={metaLeads.length} tone="sky" />
          <Metric label="Excluded" value={excludedLeads.length} tone="amber" />
        </div>

        {notice ? (
          <div className="mt-4 rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] px-3 py-2 text-sm leading-6 text-teal-50">
            {notice}
          </div>
        ) : null}
      </Panel>

      <div className="grid min-h-[760px] gap-5 xl:grid-cols-[minmax(340px,0.42fr)_minmax(0,1fr)]">
        <Panel className="min-w-0 p-4 md:p-5" data-testid="lead-list-pane">
          <LeadListPane
            leads={filteredLeads}
            selectedLead={selectedLead}
            activeView={activeView}
            query={query}
            activeTab={activeTab}
            commChannel={activeCommChannel}
          />
        </Panel>

        <Panel className="min-w-0 p-4 md:p-5" data-testid="lead-workspace-pane">
          {selectedLead ? (
            <LeadRecordWorkspace
              lead={selectedLead}
              activeView={activeView}
              query={query}
              activeTab={activeTab}
              commChannel={activeCommChannel}
              tasks={tasksForLead(leadTasks, selectedLead)}
              taskEvents={taskEvents}
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="No lead selected"
              detail="When conversations arrive, select one from the lead list to inspect details, comms, tasks, and AI knowledge."
              action={<PrimaryLink href="/app/connect">Open connection config</PrimaryLink>}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function LeadListPane({
  leads,
  selectedLead,
  activeView,
  query,
  activeTab,
  commChannel
}: {
  leads: LeadKnowledgeRecord[];
  selectedLead: LeadKnowledgeRecord | null;
  activeView: ViewFilter;
  query: string;
  activeTab: LeadWorkspaceTab;
  commChannel: CommChannelFilter;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <ListChecks size={17} className="text-[var(--teal)]" />
          Leads list, filters
        </div>
        <Badge tone="neutral">{leads.length} shown</Badge>
      </div>

      <form method="get" action="/app/leads" className="mt-4 flex min-w-0 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-black/20 px-3">
        {activeView !== "all" ? <input type="hidden" name="view" value={activeView} /> : null}
        {selectedLead ? <input type="hidden" name="contact" value={selectedLead.id} /> : null}
        {activeTab !== "details" ? <input type="hidden" name="tab" value={activeTab} /> : null}
        {commChannel !== "all" ? <input type="hidden" name="commChannel" value={commChannel} /> : null}
        <Search size={15} className="shrink-0 text-[var(--muted)]" />
        <input
          name="q"
          defaultValue={query}
          placeholder="Search name, handle, phone, status, message"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[var(--muted)]"
        />
      </form>

      <div className="mt-3 flex max-w-full items-center gap-2 overflow-x-auto pb-1">
        <Filter size={15} className="shrink-0 text-[var(--muted)]" />
        {viewFilters.map((filter) => (
          <Link
            key={filter.id}
            href={crmHref({ view: filter.id, q: query, contact: selectedLead?.id, tab: activeTab, commChannel })}
            scroll={false}
            className={`inline-flex h-9 shrink-0 items-center rounded-[6px] border px-3 text-xs font-medium ${
              activeView === filter.id
                ? "border-teal-300/40 bg-teal-300/[0.12] text-teal-100"
                : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {leads.length ? (
        <div className="mt-4 grid flex-1 auto-rows-min gap-2 overflow-y-auto pr-1">
          {leads.map((lead) => {
            const selected = selectedLead?.id === lead.id;
            const stage = crmStage(lead);
            return (
              <Link
                key={lead.id}
                href={crmHref({ view: activeView, q: query, contact: lead.id, tab: activeTab, commChannel })}
                scroll={false}
                className={`block rounded-[8px] border p-3 ${
                  selected
                    ? "border-teal-300/35 bg-teal-300/[0.1]"
                    : "border-[var(--line)] bg-black/20 hover:border-[var(--line-strong)] hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                      <UserRound size={15} className="shrink-0 text-[var(--teal)]" />
                      <span className="truncate">{contactLabel(lead)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted-2)]">{latestMessage(lead)}</p>
                  </div>
                  <Badge tone={stageTone(stage)}>{stage}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {lead.channels.slice(0, 4).map((channel) => (
                    <Badge key={channel} tone={toneForChannel(channel)}>
                      {channelLabel(channel)}
                    </Badge>
                  ))}
                  {lead.channels.length > 4 ? <Badge tone="neutral">+{lead.channels.length - 4}</Badge> : null}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
                  <Clock size={13} />
                  {shortDate(lead.lastMessageAt)}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState icon={Inbox} title="No records in this view" detail="Change the filter or wait for Meta webhooks, extension sync, or manual communication logs." />
        </div>
      )}
    </div>
  );
}

function LeadRecordWorkspace({
  lead,
  activeView,
  query,
  activeTab,
  commChannel,
  tasks,
  taskEvents
}: {
  lead: LeadKnowledgeRecord;
  activeView: ViewFilter;
  query: string;
  activeTab: LeadWorkspaceTab;
  commChannel: CommChannelFilter;
  tasks: ExtensionTask[];
  taskEvents: ExtensionTaskEvent[];
}) {
  const href = openHref(lead);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mono text-[11px] uppercase text-[var(--teal)]">Selected lead</div>
          <h3 className="mt-1 truncate text-2xl font-semibold text-white md:text-3xl">{contactLabel(lead)}</h3>
          <div className="mono mt-2 break-all text-xs text-[var(--muted)]">{lead.id}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={stageTone(crmStage(lead))}>{crmStage(lead)}</Badge>
          <Badge tone="neutral">{lead.messageCount} comms</Badge>
        </div>
      </div>

      <div className="flex max-w-full gap-2 overflow-x-auto border-b border-[var(--line)] pb-3">
        {workspaceTabs.map((tab) => (
          <Link
            key={tab.id}
            href={crmHref({ view: activeView, q: query, contact: lead.id, tab: tab.id, commChannel })}
            scroll={false}
            className={`inline-flex h-10 min-w-[118px] shrink-0 items-center justify-center rounded-[6px] border px-3 text-sm font-medium ${
              activeTab === tab.id
                ? "border-teal-300/40 bg-teal-300/[0.12] text-teal-100"
                : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === "details" ? <LeadDetailsTab lead={lead} href={href} /> : null}
      {activeTab === "comms" ? (
        <LeadCommsTab lead={lead} activeView={activeView} query={query} commChannel={commChannel} />
      ) : null}
      {activeTab === "tasks" ? <LeadTasksTab tasks={tasks} taskEvents={eventsForTasks(taskEvents, tasks)} /> : null}
    </div>
  );
}

function LeadDetailsTab({ lead, href }: { lead: LeadKnowledgeRecord; href: string }) {
  const included = lead.conversations.filter((conversation) => conversation.knowledgeStatus === "included");
  const excluded = lead.conversations.filter((conversation) => conversation.knowledgeStatus === "excluded");
  return (
    <div className="grid gap-4 xl:grid-cols-[0.64fr_0.36fr]">
      <div className="space-y-4">
        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ListChecks size={16} className="text-[var(--teal)]" />
            All Details + knowledge base
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">{lead.summary || "No summary has been generated yet."}</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <DetailLine label="Phone" value={lead.contact.phone || lead.contact.waId} />
            <DetailLine label="Email" value={lead.contact.email} />
            <DetailLine label="Handle" value={lead.contact.handle} />
            <DetailLine label="Profile" value={lead.contact.profileUrl} />
          </div>
        </div>

        <details className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-white">
            <Pencil size={16} className="text-[var(--teal)]" />
            Edit lead
          </summary>
          <form action="/api/leads/edit" method="post" className="mt-4 grid gap-3">
            <input type="hidden" name="leadId" value={lead.id} />
            <div className="grid gap-2 md:grid-cols-2">
              <LeadInput name="displayName" label="Name" value={lead.contact.displayName} />
              <LeadInput name="phone" label="Phone" value={lead.contact.phone || lead.contact.waId} />
              <LeadInput name="email" label="Email" value={lead.contact.email} />
              <LeadInput name="handle" label="Handle" value={lead.contact.handle} />
            </div>
            <LeadInput name="profileUrl" label="Profile URL" value={lead.contact.profileUrl} />
            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Summary
              <textarea name="summary" defaultValue={lead.summary || ""} rows={3} className="rounded-[6px] border border-[var(--line)] bg-black/30 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-white outline-none" />
            </label>
            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Next action
              <textarea name="nextAction" defaultValue={lead.nextAction || ""} rows={2} className="rounded-[6px] border border-[var(--line)] bg-black/30 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-white outline-none" />
            </label>
            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Facts
              <textarea name="facts" defaultValue={lead.facts.join("\n")} rows={5} className="rounded-[6px] border border-[var(--line)] bg-black/30 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-white outline-none" />
            </label>
            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]">
              <Pencil size={15} />
              Save lead
            </button>
          </form>
        </details>

        <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Workflow size={16} className="text-[var(--teal)]" />
            Next action
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{nextAction(lead)}</p>
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">Knowledge facts</div>
            <Badge tone="neutral">{lead.facts.length}</Badge>
          </div>
          {lead.facts.length ? (
            <div className="mt-3 grid gap-2">
              {lead.facts.slice(0, 8).map((fact) => (
                <div key={fact} className="rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 py-2 text-sm leading-6 text-[var(--muted-2)]">
                  {fact}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">No knowledge facts yet.</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
            >
              <MessageCircle size={15} />
              Open conversation
              <ExternalLink size={13} />
            </a>
          ) : (
            <span className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 text-sm text-[var(--muted-2)]">
              No conversation URL
            </span>
          )}
          <LeadStatusForm lead={lead} />
          <form action="/api/leads/delete" method="post">
            <input type="hidden" name="leadId" value={lead.id} />
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-amber-300/25 bg-amber-300/10 px-3 text-sm font-medium text-amber-100 hover:bg-amber-300/[0.16]"
            >
              <Archive size={15} />
              Archive lead
            </button>
          </form>
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="text-sm font-semibold text-white">Knowledge sources</div>
          <div className="mt-3 grid gap-2">
            <Badge tone="teal">{included.length} included in AI</Badge>
            <Badge tone="amber">{excluded.length} excluded from AI</Badge>
            <Badge tone="neutral">{lead.channels.length} channels</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-[6px] border border-[var(--line)] bg-white/[0.03] p-3">
      <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-2 break-words text-sm text-white">{value || "Not recorded"}</div>
    </div>
  );
}

function LeadInput({ name, label, value }: { name: string; label: string; value?: string }) {
  return (
    <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
      {label}
      <input
        name={name}
        defaultValue={value || ""}
        className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm normal-case tracking-normal text-white outline-none"
      />
    </label>
  );
}

function LeadCommsTab({
  lead,
  activeView,
  query,
  commChannel
}: {
  lead: LeadKnowledgeRecord;
  activeView: ViewFilter;
  query: string;
  commChannel: CommChannelFilter;
}) {
  const messages = messagesForCommChannel(lead, commChannel);
  const conversations = conversationsForCommChannel(lead, commChannel);
  return (
    <div className="space-y-4">
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
        {commFilters.map((filter) => (
          <Link
            key={filter.id}
            href={crmHref({ view: activeView, q: query, contact: lead.id, tab: "comms", commChannel: filter.id })}
            scroll={false}
            className={`inline-flex h-9 shrink-0 items-center rounded-[6px] border px-3 text-xs font-medium ${
              commChannel === filter.id
                ? "border-teal-300/40 bg-teal-300/[0.12] text-teal-100"
                : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.38fr_0.62fr]">
        <div className="space-y-4">
          <ManualMessageForm lead={lead} commChannel={commChannel} />
          <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <RadioTower size={16} className="text-[var(--teal)]" />
                Conversations
              </div>
              <Badge tone="neutral">{conversations.length}</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              {conversations.length ? (
                conversations.map((conversation) => <ConversationCard key={conversation.id} lead={lead} conversation={conversation} />)
              ) : (
                <p className="text-sm leading-6 text-[var(--muted-2)]">No conversations in this channel yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageCircle size={16} className="text-[var(--teal)]" />
              Activity timeline
            </div>
            <Badge tone="neutral">{messages.length} logged comms</Badge>
          </div>
          <div className="mt-3 grid max-h-[620px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
            {messages.length ? (
              [...messages].reverse().map((message) => <MessageEvent key={message.id} lead={lead} message={message} />)
            ) : (
              <EmptyState icon={Inbox} title="No comms in this channel" detail="Choose another channel or log a manual communication." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadTasksTab({ tasks, taskEvents }: { tasks: ExtensionTask[]; taskEvents: ExtensionTaskEvent[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Workflow size={16} className="text-[var(--teal)]" />
          Selected lead tasks
        </div>
        <Badge tone="neutral">{tasks.length} tasks</Badge>
      </div>
      <SelectedLeadTasks initialTasks={tasks} initialEvents={taskEvents} />
    </div>
  );
}

function LeadStatusForm({ lead, compact = false }: { lead: LeadKnowledgeRecord; compact?: boolean }) {
  return (
    <form action="/api/leads/status" method="post">
      <input type="hidden" name="leadId" value={lead.id} />
      <input type="hidden" name="leadStatus" value={lead.leadStatus === "excluded" ? "lead" : "excluded"} />
      <button
        type="submit"
        className={`inline-flex ${compact ? "h-9 text-xs" : "h-10 w-full text-sm"} items-center justify-center gap-2 rounded-[6px] border px-3 font-medium ${
          lead.leadStatus === "excluded"
            ? "border-lime-300/25 bg-lime-300/10 text-lime-100 hover:bg-lime-300/[0.16]"
            : "border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/[0.16]"
        }`}
      >
        {lead.leadStatus === "excluded" ? <CheckCircle2 size={15} /> : <Ban size={15} />}
        {lead.leadStatus === "excluded" ? "Restore as lead" : "Exclude lead"}
      </button>
    </form>
  );
}

function defaultManualChannel(commChannel: CommChannelFilter): LeadKnowledgeChannel {
  if (commChannel === "email") return "email";
  if (commChannel === "call") return "call";
  if (commChannel === "whatsapp") return "whatsapp";
  if (commChannel === "instagram") return "instagram";
  if (commChannel === "facebook") return "facebook";
  if (commChannel === "browser") return "generic-web-chat";
  return "manual";
}

function ManualMessageForm({ lead, commChannel }: { lead: LeadKnowledgeRecord; commChannel: CommChannelFilter }) {
  return (
    <form action="/api/leads/manual-message" method="post" className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
      <input type="hidden" name="leadId" value={lead.id} />
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <NotebookPen size={16} className="text-[var(--teal)]" />
        Log manual comms
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          name="direction"
          defaultValue="note"
          className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none"
        >
          <option value="note">Note</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select
          name="channel"
          defaultValue={defaultManualChannel(commChannel)}
          className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none"
        >
          <option value="manual">Manual</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="email">Email</option>
          <option value="call">Call Notes</option>
          <option value="generic-web-chat">Browser chat</option>
        </select>
      </div>
      <textarea
        name="body"
        required
        rows={4}
        placeholder="Add call notes, offline updates, email summaries, or manually recorded messages"
        className="mt-2 w-full resize-y rounded-[6px] border border-[var(--line)] bg-black/30 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-[var(--muted)]"
      />
      <button
        type="submit"
        className="mt-3 inline-flex h-10 items-center justify-center rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
      >
        Save manual comm
      </button>
    </form>
  );
}

function ConversationCard({ lead, conversation }: { lead: LeadKnowledgeRecord; conversation: LeadKnowledgeConversation }) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            {conversation.channel === "email" ? <Mail size={14} className="text-[var(--teal)]" /> : null}
            {conversation.channel === "call" ? <PhoneCall size={14} className="text-[var(--teal)]" /> : null}
            {channelLabel(conversation.channel)}
          </div>
          <div className="mono mt-1 break-all text-[10px] uppercase text-[var(--muted)]">{conversation.source}</div>
        </div>
        <Badge tone={conversation.knowledgeStatus === "excluded" ? "amber" : "teal"}>
          {conversation.knowledgeStatus === "excluded" ? "Excluded from AI" : "In AI knowledge"}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{conversation.lastMessagePreview || conversation.summary || "No messages yet"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{conversation.messageCount} comms</Badge>
        <span className="text-xs text-[var(--muted)]">{shortDate(conversation.lastMessageAt)}</span>
        <form action="/api/leads/conversation-status" method="post">
          <input type="hidden" name="leadId" value={lead.id} />
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input
            type="hidden"
            name="knowledgeStatus"
            value={conversation.knowledgeStatus === "excluded" ? "included" : "excluded"}
          />
          <button
            type="submit"
            className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-2 text-xs font-medium text-[var(--muted-2)] hover:text-white"
          >
            {conversation.knowledgeStatus === "excluded" ? "Restore to AI" : "Exclude from AI"}
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageEvent({ lead, message }: { lead: LeadKnowledgeRecord; message: LeadKnowledgeMessage }) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <MessageCircle size={14} className={message.direction === "outbound" ? "text-sky-200" : "text-[var(--teal)]"} />
          {activityTitle(message)}
        </div>
        <Badge tone={message.direction === "outbound" ? "sky" : message.direction === "note" ? "neutral" : "teal"}>
          {message.direction}
        </Badge>
      </div>
      <p className="mt-2 break-words text-sm leading-6 text-[var(--muted-2)]">{message.body}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        <span>{formatDate(message.sentAt)}</span>
        <Badge tone={toneForChannel(message.channel)}>{channelLabel(message.channel)}</Badge>
        <form action="/api/leads/message-status" method="post">
          <input type="hidden" name="leadId" value={lead.id} />
          <input type="hidden" name="messageId" value={message.id} />
          <input type="hidden" name="hidden" value="true" />
          <button
            type="submit"
            className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] border border-[var(--line)] bg-black/20 px-2 text-[11px] font-medium text-[var(--muted-2)] hover:text-white"
          >
            <EyeOff size={12} />
            Hide from timeline
          </button>
        </form>
      </div>
    </div>
  );
}
