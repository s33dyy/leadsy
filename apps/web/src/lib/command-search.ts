export type CommandSearchResultType =
  | "route"
  | "lead"
  | "conversation"
  | "team_member"
  | "calendar_event"
  | "task"
  | "setting"
  | "action";

export type CommandSearchResult = {
  id: string;
  type: CommandSearchResultType;
  title: string;
  subtitle: string;
  href: string;
  priority: number;
};

type SearchLead = {
  id: string;
  contact?: {
    displayName?: string;
    phone?: string;
    email?: string;
    handle?: string;
    waId?: string;
  };
  leadSource?: string;
  summary?: string;
  lastMessagePreview?: string;
  conversations?: Array<{
    id: string;
    channel?: string;
    lastMessagePreview?: string;
  }>;
};

type SearchTeamMember = {
  id: string;
  name: string;
  type?: string;
  role?: string;
};

type SearchCalendarEvent = {
  id: string;
  title: string;
  status?: string;
  eventType?: string;
  startAt?: string;
};

type SearchTask = {
  id: string;
  topic: string;
  type?: string;
  status?: string;
  assigneeName?: string;
  leadId?: string;
};

export type BuildCommandSearchInput = {
  query: string;
  leads: SearchLead[];
  teamMembers: SearchTeamMember[];
  calendarEvents: SearchCalendarEvent[];
  tasks: SearchTask[];
};

const defaultResults: CommandSearchResult[] = [
  { id: "route-dashboard", type: "route", title: "Dashboard", subtitle: "Open operator overview", href: "/app", priority: 100 },
  { id: "route-leads", type: "route", title: "Leads", subtitle: "Open lead workspace", href: "/app/leads", priority: 99 },
  { id: "route-inbox", type: "route", title: "Inbox", subtitle: "Open WhatsApp conversations", href: "/app/communications", priority: 98 },
  { id: "route-calendar", type: "route", title: "Calendar", subtitle: "Open meetings and availability", href: "/app/calendar", priority: 97 },
  { id: "route-team", type: "route", title: "Team", subtitle: "Open humans and AI agents", href: "/app/team", priority: 96 },
  { id: "route-settings", type: "route", title: "Settings", subtitle: "Open workspace settings", href: "/app/settings", priority: 95 },
  { id: "action-add-lead", type: "action", title: "Add Lead", subtitle: "Create a manual lead", href: "/app/leads?new=lead", priority: 94 },
  { id: "action-simulate-twilio", type: "action", title: "Simulate Twilio", subtitle: "Create inbound simulator messages", href: "/simulate-twilio", priority: 93 }
];

const settingsResults: CommandSearchResult[] = [
  { id: "setting-profile", type: "setting", title: "Profile Settings", subtitle: "Operator identity and knowledge base", href: "/app/settings?section=profile", priority: 72 },
  { id: "setting-workspace", type: "setting", title: "Workspace Settings", subtitle: "Business context, pipeline, and defaults", href: "/app/settings?section=workspace", priority: 71 },
  { id: "setting-ai", type: "setting", title: "AI Settings", subtitle: "Model policy, prompts, and guardrails", href: "/app/settings?section=ai", priority: 70 },
  { id: "setting-agents", type: "setting", title: "Agent Settings", subtitle: "Create and configure team members", href: "/app/settings?section=agents", priority: 69 },
  { id: "setting-notifications", type: "setting", title: "Notification Settings", subtitle: "Alerts, quiet hours, and digest preferences", href: "/app/settings?section=notifications", priority: 68 }
];

const retiredTermParts = [
  ["me", "ta"],
  ["ex", "tension"],
  ["n", "8", "n"],
  ["infra", "structure"]
];
const retiredExactTerms = ["lead magnet"];

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function compact(values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(" · ");
}

function contactName(lead: SearchLead) {
  return lead.contact?.displayName || lead.contact?.phone || lead.contact?.waId || lead.contact?.email || lead.contact?.handle || "Unknown lead";
}

function scoreResult(result: CommandSearchResult, query: string) {
  if (!query) return result.priority;
  const haystack = normalize(`${result.title} ${result.subtitle}`);
  const title = normalize(result.title);
  if (title === query) return result.priority + 1000;
  if (title.startsWith(query)) return result.priority + 700;
  if (title.includes(query)) return result.priority + 500;
  if (haystack.includes(query)) return result.priority + 250;
  return 0;
}

function visibleResult(result: CommandSearchResult, query: string) {
  const searchable = normalize(`${result.title} ${result.subtitle} ${result.href}`);
  if (retiredTermParts.some((parts) => new RegExp(`\\b${parts.join("")}\\b`, "i").test(searchable))) return false;
  if (retiredExactTerms.some((term) => searchable.includes(term))) return false;
  return !query || scoreResult(result, query) > 0;
}

export function buildCommandSearchResults(input: BuildCommandSearchInput): CommandSearchResult[] {
  const query = normalize(input.query);
  const routeResults = [...defaultResults, ...settingsResults];
  const leadResults = input.leads.flatMap<CommandSearchResult>((lead) => {
    const title = contactName(lead);
    const subtitle = compact([lead.leadSource, lead.summary, lead.lastMessagePreview, lead.contact?.phone, lead.contact?.email]);
    const leadResult: CommandSearchResult = {
      id: `lead-${lead.id}`,
      type: "lead",
      title,
      subtitle: subtitle || "Lead record",
      href: `/app/leads?contact=${lead.id}`,
      priority: 90
    };
    const conversationResults = (lead.conversations ?? []).map<CommandSearchResult>((conversation) => ({
      id: `conversation-${conversation.id}`,
      type: "conversation",
      title: `${title} conversation`,
      subtitle: compact([conversation.channel, conversation.lastMessagePreview, lead.leadSource]) || "Lead conversation",
      href: `/app/communications?conversation=${conversation.id}`,
      priority: 82
    }));
    return [leadResult, ...conversationResults];
  });

  const teamResults = input.teamMembers.map<CommandSearchResult>((member) => ({
    id: `team-${member.id}`,
    type: "team_member",
    title: member.name,
    subtitle: compact([member.type?.replace(/_/g, " "), member.role, "Team member"]),
    href: "/app/team",
    priority: 74
  }));

  const calendarResults = input.calendarEvents.map<CommandSearchResult>((event) => ({
    id: `calendar-${event.id}`,
    type: "calendar_event",
    title: event.title,
    subtitle: compact([event.eventType, event.status, event.startAt ? new Date(event.startAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined]),
    href: `/app/calendar?event=${event.id}`,
    priority: 66
  }));

  const taskResults = input.tasks.map<CommandSearchResult>((task) => ({
    id: `task-${task.id}`,
    type: "task",
    title: task.topic,
    subtitle: compact([task.type?.replace(/_/g, " "), task.status, task.assigneeName]),
    href: task.leadId ? `/app/leads?contact=${task.leadId}&tab=tasks` : "/app/tasks",
    priority: 64
  }));

  return [...routeResults, ...leadResults, ...teamResults, ...calendarResults, ...taskResults]
    .filter((result) => visibleResult(result, query))
    .map((result) => ({ result, score: scoreResult(result, query) }))
    .sort((left, right) => right.score - left.score || right.result.priority - left.result.priority || left.result.title.localeCompare(right.result.title))
    .map(({ result, score }) => ({ ...result, priority: score || result.priority }))
    .slice(0, 30);
}
