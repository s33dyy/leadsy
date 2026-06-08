import Link from "next/link";
import { LeadSummaryAction, type LeadSummaryMessage } from "@/components/lead-summary-modal";
import { LeadsConsole } from "@/components/leads-console";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import {
  listCrmAssignmentHistory,
  listCrmFollowUpTasks,
  type CrmAssignmentHistoryRecord,
  type CrmFollowUpTask
} from "@/lib/crm-store";
import {
  buildQualificationInputAudit,
  conversationMessages,
  listLeadKnowledgeRecords,
  productPipelineStatusForLead,
  productPipelineStatusLabel,
  type LeadKnowledgeMessage,
  type LeadKnowledgeRecord,
  type LeadKnowledgeChannel
} from "@/lib/lead-knowledge-store";
import { ensureDefaultQualificationAgent, listTeamMembers, type TeamMember } from "@/lib/teamspace-store";

export const dynamic = "force-dynamic";

type LeadsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type LeadWorkspaceTab = "details" | "comms" | "tasks";
type LeadCommsChannel = Extract<LeadKnowledgeChannel, "whatsapp" | "email" | "call">;

const workspaceTabs: Array<{ id: LeadWorkspaceTab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "comms", label: "Comms" },
  { id: "tasks", label: "Tasks" }
];

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function activeTabFromValue(value: string): LeadWorkspaceTab {
  if (value === "comms" || value === "tasks") return value;
  return "details";
}

function activeCommsChannelFromValue(value: string): LeadCommsChannel {
  if (value === "email" || value === "call") return value;
  return "whatsapp";
}

function leadHref(leadId: string, tab: LeadWorkspaceTab = "details") {
  const params = new URLSearchParams({ contact: leadId });
  if (tab !== "details") params.set("tab", tab);
  return `/app/leads?${params.toString()}`;
}

function commsHref(leadId: string, channel: LeadCommsChannel) {
  const params = new URLSearchParams({ contact: leadId, tab: "comms", channel });
  return `/app/leads?${params.toString()}`;
}

function leadName(lead: LeadKnowledgeRecord) {
  return lead.contact.displayName || lead.contact.phone || lead.contact.waId || lead.contact.email || "Unknown lead";
}

function relativeTime(value?: string) {
  if (!value) return "now";
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs) || diffMs < 0) return "now";
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function memberTypeLabel(member?: TeamMember) {
  if (!member) return "No member record";
  if (member.type === "human") return "Human";
  if (member.type === "ai_agent_assisted") return "Assisted AI";
  return "Full AI";
}

function matchesSearch(lead: LeadKnowledgeRecord, query: string) {
  if (!query) return true;
  const haystack = [
    leadName(lead),
    lead.contact.phone,
    lead.contact.email,
    lead.leadSource,
    lead.summary,
    lead.nextAction,
    ...Object.values(lead.qualificationFields),
    ...lead.facts
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function taskDueLabel(value?: string) {
  if (!value) return "Unscheduled";
  return new Date(value).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedLeadId = paramValue(params, "contact");
  const query = paramValue(params, "q");
  const activeTab = activeTabFromValue(paramValue(params, "tab"));
  const activeCommsChannel = activeCommsChannelFromValue(paramValue(params, "channel"));
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  if (scope) {
    await ensureDefaultQualificationAgent(scope);
  }
  const [allLeads, members, allTasks] = scope
    ? await Promise.all([
        listLeadKnowledgeRecords(scope),
        listTeamMembers(scope),
        listCrmFollowUpTasks(scope, { includeClosed: true })
      ])
    : [[], [], []];
  const leads = allLeads.filter((lead) => matchesSearch(lead, query));
  const active = leads.find((lead) => lead.id === selectedLeadId) ?? leads[0];
  const activeMessages = active ? conversationMessages(active.messages) : [];
  const activeConversation = active?.conversations.find((conversation) => conversation.id === activeMessages.at(-1)?.conversationId) ?? active?.conversations[0];
  const activeOwner = active?.assigneeId ? members.find((member) => member.id === active.assigneeId) : undefined;
  const audit = active ? buildQualificationInputAudit(active) : undefined;
  const assignmentHistory = active && scope ? await listCrmAssignmentHistory(scope, { leadId: active.id }) : [];
  const tasks = active ? allTasks.filter((task) => task.leadId === active.id) : [];

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <section className="col-span-12 flex min-h-0 flex-col bg-background md:col-span-4 xl:col-span-3">
        <LeadsConsole allLeads={allLeads} activeLeadId={active?.id} activeTab={activeTab} initialQuery={query} />
      </section>

      <section className="col-span-12 min-h-0 overflow-y-auto bg-background md:col-span-8 xl:col-span-9">
        {active ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-5 p-5">
            <LeadHeader
              lead={active}
              owner={activeOwner}
              conversationId={activeConversation?.id}
              messages={activeMessages}
              missingFields={(audit?.fields ?? []).filter((field) => field.state === "Missing").map((field) => field.field)}
            />
            <div className="flex border-b border-border">
              {workspaceTabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={leadHref(active.id, tab.id)}
                  className={`h-10 border-b-2 px-4 py-2 text-sm ${
                    activeTab === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
            {activeTab === "details" ? (
              <DetailsTab
                active={active}
                activeOwner={activeOwner}
                members={members}
                auditFields={audit?.fields ?? []}
                assignmentHistory={assignmentHistory}
              />
            ) : null}
            {activeTab === "comms" ? (
              <CommsTab active={active} activeMessages={activeMessages} activeChannel={activeCommsChannel} />
            ) : null}
            {activeTab === "tasks" ? <TasksTab active={active} members={members} tasks={tasks} /> : null}
          </div>
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
            Add or receive a lead to begin.
          </div>
        )}
      </section>
    </div>
  );
}

function LeadHeader({
  lead,
  owner,
  conversationId,
  messages,
  missingFields
}: {
  lead: LeadKnowledgeRecord;
  owner?: TeamMember;
  conversationId?: string;
  messages: LeadKnowledgeMessage[];
  missingFields: string[];
}) {
  const summaryMessages: LeadSummaryMessage[] = messages.slice(-8).map((message) => ({
    id: message.id,
    label: `${message.direction} - ${message.channel}`,
    body: message.body,
    detail: relativeTime(message.sentAt)
  }));
  return (
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-surface-3 font-mono text-[12px]">
          {leadName(lead).slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{leadName(lead)}</h1>
          <p className="text-sm text-muted-foreground">{lead.contact.phone || lead.contact.email || "No contact detail"} · {lead.leadSource || "Leadsy"}</p>
        </div>
        {conversationId ? (
          <Link href={`/app/communications?conversation=${conversationId}`} className="inline-flex h-9 items-center rounded-[5px] bg-primary px-3 text-sm font-medium text-primary-foreground">
            Open conversation
          </Link>
        ) : null}
        <LeadSummaryAction
          title={`${leadName(lead)} summary`}
          subtitle={lead.contact.phone || lead.contact.email || lead.leadSource}
          summary={lead.summary}
          nextAction={lead.nextAction}
          owner={owner?.name || lead.assigneeName}
          qualification={lead.qualificationStage.replace(/_/g, " ")}
          messages={summaryMessages}
          missingFields={missingFields}
          facts={lead.facts}
          triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-3 text-sm"
        />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <InfoCell label="Owner" value={owner?.name || lead.assigneeName || "Unassigned"} />
        <InfoCell label="Qualification" value={lead.qualificationStage.replace(/_/g, " ")} />
        <InfoCell label="Pipeline" value={productPipelineStatusLabel(productPipelineStatusForLead(lead))} />
      </div>
    </header>
  );
}

function DetailsTab({
  active,
  activeOwner,
  members,
  auditFields,
  assignmentHistory
}: {
  active: LeadKnowledgeRecord;
  activeOwner?: TeamMember;
  members: TeamMember[];
  auditFields: ReturnType<typeof buildQualificationInputAudit>["fields"];
  assignmentHistory: CrmAssignmentHistoryRecord[];
}) {
  const latestAssignment = assignmentHistory[0];
  return (
    <div className="grid gap-5 xl:grid-cols-[0.66fr_0.34fr]">
      <div className="space-y-5">
        <section className="rounded-[8px] border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="caption">Assign lead</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Current owner: {activeOwner?.name || active.assigneeName || "Unassigned"} · {memberTypeLabel(activeOwner)} · senderMode {activeOwner?.senderMode ?? "none"}
              </p>
            </div>
            <Badge tone={activeOwner?.senderMode === "workspace" ? "teal" : activeOwner?.senderMode === "simulator" ? "amber" : "neutral"}>
              {activeOwner?.senderMode === "workspace" ? "workspace sender" : activeOwner?.senderMode === "simulator" ? "simulator sender" : "no sender"}
            </Badge>
          </div>
          <form action="/api/leads/assign" method="post" className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="leadId" value={active.id} />
            <input type="hidden" name="sendInitialAiMessage" value="true" />
            <select
              name="assigneeId"
              defaultValue={active.assigneeId ?? ""}
              className="h-9 min-w-0 flex-1 rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="" disabled>Select owner</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {memberTypeLabel(member)} · {member.senderMode}
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground">
              Assign owner
            </button>
          </form>
          <div className="mt-3 rounded-[6px] border border-border bg-background p-3">
            <div className="caption">Assignment history</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {latestAssignment
                ? `${latestAssignment.fromAssigneeName || "Unassigned"} -> ${latestAssignment.toAssigneeName || "Unassigned"} by ${latestAssignment.assignedByName || "Leadsy"}`
                : "No manual reassignment recorded yet."}
            </p>
          </div>
        </section>

        <section className="rounded-[8px] border border-border bg-surface p-4">
          <div className="caption">Qualification inputs</div>
          <div className="mt-3 grid gap-px overflow-hidden rounded-[6px] border border-border bg-border md:grid-cols-2">
            {auditFields.map((field) => (
              <div key={field.field} className="bg-background p-3">
                <div className="caption">{field.field}</div>
                <div className="mt-1 text-sm">{field.value}</div>
                <div className="mt-2 font-mono text-[10px] text-muted-foreground">{field.state} · {field.confidence}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-3">
        <InfoCell label="Summary" value={active.summary || "No summary yet"} />
        <InfoCell label="Next action" value={active.nextAction || "Continue qualification"} />
        <InfoCell label="Source / campaign" value={[active.leadSource, active.campaignId].filter(Boolean).join(" · ") || "Leadsy"} />
        <div className="rounded-[8px] border border-border bg-surface p-3">
          <div className="caption">AI notes and facts</div>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {active.facts.length ? (
              active.facts.slice(0, 8).map((fact, index) => <li key={`${active.id}-fact-${index}`}>{fact}</li>)
            ) : (
              <li>No CRM notes yet.</li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function channelLabel(channel: LeadCommsChannel) {
  if (channel === "email") return "Email";
  if (channel === "call") return "Calls";
  return "WhatsApp";
}

function CommsTab({
  active,
  activeMessages,
  activeChannel
}: {
  active: LeadKnowledgeRecord;
  activeMessages: LeadKnowledgeMessage[];
  activeChannel: LeadCommsChannel;
}) {
  const channels: LeadCommsChannel[] = ["whatsapp", "email", "call"];
  const channelMessages = activeMessages.filter((message) => message.channel === activeChannel);
  const channelConversation = active.conversations.find((conversation) => conversation.channel === activeChannel);
  const channelCounts = new Map(channels.map((channel) => [channel, activeMessages.filter((message) => message.channel === channel).length]));
  return (
    <div className="grid gap-5 xl:grid-cols-[0.66fr_0.34fr]">
      <section className="rounded-[8px] border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="caption">Comms / {channelLabel(activeChannel)}</div>
            <p className="mt-1 text-sm text-muted-foreground">Channel records stay separated. WhatsApp messages remain inbound and outbound only.</p>
          </div>
          {activeChannel === "whatsapp" && channelConversation ? (
            <Link href={`/app/communications?conversation=${channelConversation.id}`} className="h-8 rounded-[5px] bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              Reply in Inbox
            </Link>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-1 border-b border-border pb-3">
          {channels.map((channel) => (
            <Link
              key={channel}
              href={commsHref(active.id, channel)}
              className={`rounded-[5px] px-2.5 py-1.5 text-[12px] ${activeChannel === channel ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:bg-surface-2"}`}
            >
              {channelLabel(channel)} <span className="font-mono text-[10px] text-muted-foreground">{channelCounts.get(channel) ?? 0}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {channelMessages.length ? (
            channelMessages.slice(-12).map((message) => (
              <div key={message.id} className={`rounded-[6px] border border-border p-3 ${message.direction === "outbound" ? "bg-primary/10" : "bg-background"}`}>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {message.direction} · {message.deliveryStatus || "tracked"} · {relativeTime(message.sentAt)}
                </div>
                <p className="mt-1 text-sm leading-6">{message.body}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[6px] border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">
                No {channelLabel(activeChannel).toLowerCase()} activity tracked for this lead yet.
              </p>
              {activeChannel !== "whatsapp" ? (
                <form action="/api/leads/channel-activity" method="post" className="mt-3 grid gap-2">
                  <input type="hidden" name="leadId" value={active.id} />
                  <input type="hidden" name="channel" value={activeChannel} />
                  <textarea name="body" rows={3} required placeholder={`Log ${channelLabel(activeChannel).toLowerCase()} activity`} className="rounded-[6px] border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                  <button type="submit" className="h-8 w-fit rounded-[5px] bg-primary px-3 text-sm font-medium text-primary-foreground">
                    Log {channelLabel(activeChannel)}
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </div>
      </section>
      <aside className="space-y-3">
        <InfoCell label="Messages" value={String(channelMessages.length)} />
        <InfoCell label="Conversations" value={String(active.conversations.length)} />
        <InfoCell label="Last activity" value={active.lastMessageAt ? relativeTime(active.lastMessageAt) : "No activity yet"} />
      </aside>
    </div>
  );
}

function TasksTab({ active, members, tasks }: { active: LeadKnowledgeRecord; members: TeamMember[]; tasks: CrmFollowUpTask[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.6fr_0.4fr]">
      <section className="rounded-[8px] border border-border bg-surface p-4">
        <div className="caption">Lead tasks</div>
        <div className="mt-3 space-y-2">
          {tasks.length ? (
            tasks.map((task) => (
              <div key={task.id} className="rounded-[6px] border border-border bg-background p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{task.topic}</span>
                  <Badge tone={task.status === "done" ? "teal" : task.priority === "urgent" || task.priority === "high" ? "amber" : "neutral"}>{task.status.replace(/_/g, " ")}</Badge>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{taskDueLabel(task.dueAt)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{task.description || "No task description."}</p>
                <div className="mt-2 font-mono text-[10px] text-muted-foreground">{task.assigneeName || "Unassigned"} · {task.type.replace(/_/g, " ")}</div>
              </div>
            ))
          ) : (
            <p className="rounded-[6px] border border-border bg-background p-3 text-sm text-muted-foreground">
              No human or hybrid follow-up tasks for this lead yet.
            </p>
          )}
        </div>
      </section>

      <form action="/api/crm/follow-up-tasks" method="post" className="rounded-[8px] border border-border bg-surface p-4">
        <div className="caption">Create task</div>
        <input type="hidden" name="leadId" value={active.id} />
        <label className="mt-3 grid gap-1.5">
          <span className="text-xs text-muted-foreground">Topic</span>
          <input name="topic" required placeholder="Call after qualification" className="h-9 rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
        </label>
        <label className="mt-3 grid gap-1.5">
          <span className="text-xs text-muted-foreground">Owner</span>
          <select name="assigneeId" defaultValue={active.assigneeId ?? ""} className="h-9 rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-primary">
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {memberTypeLabel(member)}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 grid gap-1.5">
          <span className="text-xs text-muted-foreground">Priority</span>
          <select name="priority" defaultValue="normal" className="h-9 rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-primary">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="mt-3 grid gap-1.5">
          <span className="text-xs text-muted-foreground">Due date</span>
          <input name="dueAt" type="datetime-local" className="h-9 rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
        </label>
        <label className="mt-3 grid gap-1.5">
          <span className="text-xs text-muted-foreground">Description</span>
          <textarea name="description" rows={4} className="rounded-[6px] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <button type="submit" className="mt-4 h-9 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground">
          Create task
        </button>
      </form>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface p-3">
      <div className="caption">{label}</div>
      <div className="mt-1 break-words text-sm text-foreground">{value}</div>
    </div>
  );
}
