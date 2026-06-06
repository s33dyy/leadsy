import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BadgeCheck,
  Bot,
  Brain,
  Building2,
  Check,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Monitor,
  Plug,
  Search,
  Server,
  User
} from "lucide-react";
import { Badge } from "@/components/ui";
import { automationWorkflowDefinitions } from "@/lib/automation-workflows";
import { getAiCostDashboard, getInfrastructureStatus, type HealthTone } from "@/lib/infrastructure-status";
import { getTwilioIntegrationStatus, type TwilioIntegrationStatus } from "@/lib/twilio-transport";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type SettingsSection =
  | "profile"
  | "workspace"
  | "integrations"
  | "twilio"
  | "ai"
  | "workers"
  | "notifications"
  | "meta"
  | "whatsapp"
  | "extension"
  | "infrastructure";

const groups: Array<{ id: SettingsSection; label: string; icon: LucideIcon }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "twilio", label: "Twilio", icon: MessageSquare },
  { id: "ai", label: "AI", icon: Brain },
  { id: "workers", label: "Workers", icon: Bot },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "meta", label: "Meta", icon: BadgeCheck },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { id: "extension", label: "Extension", icon: Monitor },
  { id: "infrastructure", label: "Infrastructure", icon: Server }
];

const sectionSummaries: Record<SettingsSection, {
  eyebrow: string;
  title: string;
  detail: string;
  primaryHref?: string;
  primaryLabel?: string;
  rows: Array<{ label: string; value: string }>;
}> = {
  profile: {
    eyebrow: "Settings / Profile",
    title: "Operator profile",
    detail: "Identity, role, and account context for the person running Leadsy.",
    primaryHref: "/app/connect?panel=profile",
    primaryLabel: "Open profile setup",
    rows: [
      { label: "Account", value: "Managed by Leadsy auth" },
      { label: "Access", value: "Workspace session and role based" },
      { label: "Personalization", value: "Used by workers for operator context" }
    ]
  },
  workspace: {
    eyebrow: "Settings / Workspace",
    title: "Workspace",
    detail: "Business context, team defaults, and tenant-level operating rules.",
    primaryHref: "/app/connect?panel=settings",
    primaryLabel: "Open workspace setup",
    rows: [
      { label: "Tenant isolation", value: "Next.js gateway + Postgres" },
      { label: "Business state", value: "Stored in Leadsy" },
      { label: "Automation", value: "Orchestrated by n8n" }
    ]
  },
  integrations: {
    eyebrow: "Settings / Integrations",
    title: "Integration surfaces",
    detail: "Meta, WhatsApp, email, extension, and provider connections in one place.",
    primaryHref: "/app/integrations",
    primaryLabel: "Open integrations",
    rows: [
      { label: "Meta", value: "OAuth and webhook intake stay in Leadsy" },
      { label: "Twilio", value: "Leadsy-managed platform transport" },
      { label: "Extension", value: "Browser capture is the Legacy Capture Layer" }
    ]
  },
  twilio: {
    eyebrow: "Settings / Integrations / Twilio",
    title: "Twilio WhatsApp",
    detail: "Leadsy-managed WhatsApp transport for inbound messages, outbound sends, and delivery callbacks.",
    primaryHref: "/app/integrations",
    primaryLabel: "Open integrations",
    rows: [
      { label: "Inbound", value: "Leadsy-owned Twilio webhook" },
      { label: "Outbound", value: "Leadsy sends through Twilio API" },
      { label: "Delivery", value: "Twilio status callback updates message records" }
    ]
  },
  ai: {
    eyebrow: "Settings / AI",
    title: "AI configuration",
    detail: "OpenRouter usage and model cost visibility for automation decisions.",
    primaryHref: "/app/settings?section=infrastructure",
    primaryLabel: "Open cost dashboard",
    rows: [
      { label: "Provider", value: "OpenRouter" },
      { label: "Secrets", value: "Configured in Railway environment variables" },
      { label: "Cost tracking", value: "Recorded through Leadsy automation metadata" }
    ]
  },
  workers: {
    eyebrow: "Settings / Workers",
    title: "Workers",
    detail: "Operator task queues, approval routing, and retry behavior.",
    primaryHref: "/app/worker",
    primaryLabel: "Open workers",
    rows: [
      { label: "Queue ownership", value: "Leadsy stores task state" },
      { label: "Execution", value: "n8n schedules reminders, task creation, and escalations only" },
      { label: "Approval", value: "Operators approve before send actions" }
    ]
  },
  notifications: {
    eyebrow: "Settings / Notifications",
    title: "Notifications",
    detail: "Operator alerts for approvals, failed executions, and follow-up reminders.",
    rows: [
      { label: "Approvals", value: "Visible in the top bar and approval center" },
      { label: "Failures", value: "Escalation rules can create manager-visible tasks" },
      { label: "Follow-ups", value: "Driven by n8n schedules, stored in Leadsy" }
    ]
  },
  meta: {
    eyebrow: "Settings / Meta",
    title: "Meta",
    detail: "Meta OAuth, webhook intake, Lead Ads, Instagram, and Messenger stay preserved.",
    primaryHref: "/app/connect",
    primaryLabel: "Connect Meta",
    rows: [
      { label: "OAuth", value: "Leadsy-owned" },
      { label: "Webhook intake", value: "Leadsy-owned" },
      { label: "Provider actions", value: "Leadsy-owned" }
    ]
  },
  whatsapp: {
    eyebrow: "Settings / WhatsApp",
    title: "WhatsApp",
    detail: "WhatsApp message storage stays in Leadsy. Twilio is managed by Leadsy as platform infrastructure.",
    primaryHref: "/app/settings?section=twilio",
    primaryLabel: "Review platform transport",
    rows: [
      { label: "Inbound storage", value: "Leadsy" },
      { label: "Cloud provider", value: "Twilio WhatsApp API" },
      { label: "Browser handoff", value: "Extension remains Legacy Capture Layer fallback" }
    ]
  },
  extension: {
    eyebrow: "Settings / Extension",
    title: "Browser extension",
    detail: "The extension captures and prepares browser-channel work. It is not the workflow engine.",
    primaryHref: "/app/worker",
    primaryLabel: "Open extension workers",
    rows: [
      { label: "Role", value: "Capture layer" },
      { label: "Task source", value: "Leadsy task queue" },
      { label: "WhatsApp timing", value: "Composer and send button readiness checks enabled" }
    ]
  },
  infrastructure: {
    eyebrow: "Settings / Infrastructure",
    title: "Automation",
    detail: "n8n is limited to follow-up scheduling, reminder generation, task creation, and escalation rules. Leadsy keeps auth, CRM, conversations, assignments, leads, APIs, and Postgres.",
    rows: []
  }
};

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function sectionFromValue(value: string): SettingsSection {
  return groups.some((group) => group.id === value) ? (value as SettingsSection) : "infrastructure";
}

function toneForHealth(status: HealthTone): "lime" | "amber" | "rose" | "neutral" {
  if (status === "healthy") return "lime";
  if (status === "warning") return "amber";
  if (status === "critical") return "rose";
  return "neutral";
}

function compactDate(value?: string) {
  if (!value) return "No execution yet";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 4
  }).format(value);
}

function maskTwilioAccountSid(value?: string) {
  if (!value) return "Not configured";
  if (value.length <= 8) return "Configured";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function twilioDate(value?: string) {
  if (!value) return "No callback yet";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : {};
  const activeSection = sectionFromValue(paramValue(params, "section"));
  const section = sectionSummaries[activeSection];
  const [infrastructure, aiCosts, twilio] = await Promise.all([getInfrastructureStatus(), getAiCostDashboard(), getTwilioIntegrationStatus()]);
  const automation = infrastructure.automation;
  const backendLogic = infrastructure.backendLogic;
  const providerConfigs = infrastructure.providerConfigs;
  const dashboardUrl = automation.dashboardUrl;
  const backendAgentUrl = automation.backendAgentWorkflowUrl;
  const executionsUrl = dashboardUrl ? `${dashboardUrl}/executions` : undefined;

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-cols-12 gap-px overflow-hidden bg-border">
      <aside className="col-span-12 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-background md:col-span-3 xl:col-span-2">
        <div className="border-b border-border p-3">
          <div className="flex h-7 items-center gap-2 rounded-[5px] border border-border bg-surface-2 px-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <span className="flex-1 text-[12px] text-muted-foreground">Search settings...</span>
          </div>
        </div>
        <nav className="p-2">
          {groups.map((group) => {
            const Icon = group.icon;
            const active = group.id === activeSection;
            return (
              <Link key={group.id} href={`/app/settings?section=${group.id}`} className={`nav-item w-full ${active ? "bg-sidebar-accent text-foreground" : ""}`}>
                <Icon className="nav-icon" />
                <span className="flex-1 text-left">{group.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="col-span-12 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-background md:col-span-9 xl:col-span-10">
        <div className="mx-auto w-full min-w-0 max-w-4xl p-6">
          <div className="caption">{section.eyebrow}</div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="mt-1 text-[22px] tracking-tight">{section.title}</h1>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {section.detail}
              </p>
            </div>
            {activeSection === "infrastructure" ? <Badge tone={toneForHealth(automation.health)}>n8n: {automation.health}</Badge> : null}
          </div>

          {activeSection !== "infrastructure" && activeSection !== "twilio" ? <SettingsSectionPanel section={section} /> : null}
          {activeSection === "twilio" ? <TwilioSettingsPanel twilio={twilio} /> : null}

          {activeSection === "infrastructure" ? (
          <>
          <div className="mt-6 grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-3">
            {[
              {
                k: "n8n URL",
                v: automation.publicUrl ? (
                  <a className="inline-flex min-w-0 max-w-full items-center gap-1 text-primary hover:underline" href={automation.publicUrl}>
                    <span className="truncate">{automation.publicUrl.replace(/^https?:\/\//, "")}</span> <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not configured</span>
                )
              },
              { k: "Health", v: <span className="inline-flex items-center gap-1.5 text-primary"><span className="dot bg-primary pulse-dot" /> {automation.health}</span> },
              { k: "Workflow count", v: <span className="font-mono">{automation.workflowCount}</span> },
              { k: "Event types", v: <span className="font-mono">{automationWorkflowDefinitions.length}</span> },
              { k: "Last execution", v: <span className="font-mono">{compactDate(automation.lastExecution)}</span> },
              { k: "Failed executions", v: <span className="font-mono text-destructive">{automation.failedExecutions}</span> },
              { k: "Queue", v: <span className="font-mono">{automation.queueStatus.replace(/_/g, " ")}</span> },
              { k: "Internal URL", v: <span className="truncate font-mono text-[11px] text-muted-foreground">{automation.internalUrl || "Not configured"}</span> },
              { k: "Checked", v: <span className="font-mono">{compactDate(automation.checkedAt)}</span> }
            ].map((stat) => (
              <div key={stat.k} className="min-w-0 overflow-hidden bg-background p-4">
                <div className="caption">{stat.k}</div>
                <div className="mt-1.5 min-w-0 text-[13px]">{stat.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {dashboardUrl ? (
              <a href={dashboardUrl} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] bg-primary px-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
                Open n8n dashboard <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {backendAgentUrl ? (
              <a href={backendAgentUrl} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2.5 text-[12px] hover:bg-surface-3">
                Open backend agent <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {executionsUrl ? (
              <a href={executionsUrl} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2.5 text-[12px] hover:bg-surface-3">
                Open executions <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium">Backend logic modules</h2>
              <span className="caption">owned by n8n</span>
            </div>
            <div className="mt-3 min-w-0 divide-y divide-border overflow-hidden rounded-[8px] border border-border">
              {backendLogic.map((module) => (
                <div key={module.key} className="grid min-w-0 grid-cols-12 items-center gap-3 px-3 py-2.5 text-[12px] hover:bg-surface-2">
                  <div className="col-span-12 min-w-0 overflow-hidden md:col-span-3">
                    <div className="truncate font-medium">{module.label}</div>
                    <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">{module.key}</div>
                  </div>
                  <div className="col-span-12 min-w-0 truncate text-muted-foreground md:col-span-5">{module.detail}</div>
                  <div className="col-span-4 min-w-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground md:col-span-1">{module.actionCount} actions</div>
                  <div className="col-span-4 min-w-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground md:col-span-1">{module.guardrailCount} rails</div>
                  <div className="col-span-4 min-w-0 truncate whitespace-nowrap text-right font-mono text-[10.5px] text-primary md:col-span-2">
                    {module.editableFrom.join(" / ")}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium">Provider config hub</h2>
              <span className="caption">managed in n8n</span>
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-2">
              {providerConfigs.map((provider) => (
                <div key={provider.key} className="min-w-0 overflow-hidden bg-background p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{provider.label}</div>
                      <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">{provider.detail}</p>
                    </div>
                    <Badge className="shrink-0" tone={toneForHealth(provider.status)}>
                      {provider.managedByN8n ? "n8n owned" : "connect n8n"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid min-w-0 grid-cols-3 gap-px overflow-hidden rounded-[6px] border border-border bg-border text-[11px]">
                    <div className="min-w-0 overflow-hidden bg-surface-2 p-2">
                      <div className="caption">Fields</div>
                      <div className="mt-1 truncate font-mono">{provider.fieldCount}</div>
                    </div>
                    <div className="min-w-0 overflow-hidden bg-surface-2 p-2">
                      <div className="caption">Protected</div>
                      <div className="mt-1 truncate font-mono">{provider.secretFieldCount}</div>
                    </div>
                    <div className="min-w-0 overflow-hidden bg-surface-2 p-2">
                      <div className="caption">Workflows</div>
                      <div className="mt-1 truncate font-mono">{provider.workflowCount}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium">Backend agent event map</h2>
              <span className="caption">single n8n backend agent</span>
            </div>
            <ul className="mt-3 min-w-0 divide-y divide-border overflow-hidden rounded-[6px] border border-border">
              {automationWorkflowDefinitions.map((workflow) => (
                <li key={workflow.key} className="grid min-w-0 grid-cols-12 items-center gap-2 px-3 py-2.5 text-[12px] hover:bg-surface-2">
                  <span className="col-span-12 min-w-0 truncate font-mono md:col-span-3">{workflow.key}</span>
                  <span className="col-span-12 min-w-0 truncate md:col-span-3">{workflow.name}</span>
                  <span className="col-span-10 truncate text-muted-foreground md:col-span-5">{workflow.purpose}</span>
                  {backendAgentUrl ? (
                    <a href={backendAgentUrl} className="col-span-2 justify-self-end text-muted-foreground hover:text-foreground md:col-span-1">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <ChevronRight className="col-span-2 h-3.5 w-3.5 justify-self-end text-muted-foreground md:col-span-1" />
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 grid min-w-0 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-3">
            {[
              { label: "AI requests", value: String(aiCosts.totals.requests) },
              { label: "Tokens", value: String(aiCosts.totals.totalTokens) },
              { label: "Estimated cost", value: formatInr(aiCosts.totals.estimatedCostInr) }
            ].map((item) => (
              <div key={item.label} className="min-w-0 overflow-hidden bg-background p-4">
                <div className="caption">{item.label}</div>
                <div className="mt-1.5 truncate font-mono text-[16px]">{item.value}</div>
              </div>
            ))}
          </section>

          <section className="mt-6">
            <div className="flex items-center gap-2 text-[12.5px]">
              <Check className="h-3.5 w-3.5 text-primary" />
              <span>{automation.detail}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Edit operational schedules and escalation rules in n8n; keep payload storage, CRM decisions, conversations, assignments, and lead state in Leadsy.
            </p>
          </section>
          </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SettingsSectionPanel({
  section
}: {
  section: (typeof sectionSummaries)[SettingsSection];
}) {
  return (
    <div className="mt-6 grid gap-5">
      <div className="grid min-w-0 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-3">
        {section.rows.map((row) => (
          <div key={row.label} className="min-w-0 overflow-hidden bg-background p-4">
            <div className="caption">{row.label}</div>
            <div className="mt-2 text-[13px] leading-5 text-foreground">{row.value}</div>
          </div>
        ))}
      </div>
      {section.primaryHref && section.primaryLabel ? (
        <Link href={section.primaryHref} className="inline-flex h-8 w-fit items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-3 text-[12px] font-medium hover:bg-surface-3">
          {section.primaryLabel} <ChevronRight className="h-3 w-3" />
        </Link>
      ) : null}
      <div className="rounded-[8px] border border-border bg-black/20 p-4">
        <div className="flex items-center gap-2 text-[12.5px]">
          <Check className="h-3.5 w-3.5 text-primary" />
          <span>Configuration here preserves Leadsy as the secure app boundary while n8n handles operational automation.</span>
        </div>
      </div>
    </div>
  );
}

function TwilioSettingsPanel({ twilio }: { twilio: TwilioIntegrationStatus }) {
  const rows = [
    { label: "Connection Status", value: twilio.connected ? "Leadsy managed" : "Platform config pending" },
    { label: "Account SID", value: maskTwilioAccountSid(twilio.accountSid) },
    { label: "WhatsApp Number", value: twilio.whatsappNumber ?? "Not configured" },
    {
      label: "Last Webhook",
      value: twilio.lastWebhook?.at
        ? `${twilioDate(twilio.lastWebhook.at)} · ${twilio.lastWebhook.messageSid ?? "unknown SID"}`
        : "No webhook yet"
    },
    {
      label: "Last Delivery Callback",
      value: twilio.lastDeliveryCallback?.at
        ? `${twilioDate(twilio.lastDeliveryCallback.at)} · ${twilio.lastDeliveryCallback.status ?? "unknown status"}`
        : "No callback yet"
    }
  ];

  return (
    <div className="mt-6 overflow-hidden rounded-[8px] border border-border bg-border">
      <div className="bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Twilio WhatsApp API</div>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-6 text-muted-foreground">
              Twilio is Leadsy-managed platform infrastructure for WhatsApp conversations. Clients do not need to connect their own Twilio account, and secrets stay in environment variables.
            </p>
          </div>
          <Badge tone={twilio.connected ? "lime" : "amber"}>{twilio.connected ? "Leadsy managed" : "Platform pending"}</Badge>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-px md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 bg-background p-4">
            <div className="caption">{row.label}</div>
            <div className="mt-1.5 min-w-0 truncate font-mono text-[12px] text-foreground">{row.value}</div>
          </div>
        ))}
        <div className="min-w-0 bg-background p-4">
          <div className="caption">Inbound Webhook URL</div>
          <div className="mt-1.5 min-w-0 truncate font-mono text-[12px] text-foreground">/api/twilio/webhook</div>
        </div>
        <div className="min-w-0 bg-background p-4">
          <div className="caption">Status Callback URL</div>
          <div className="mt-1.5 min-w-0 truncate font-mono text-[12px] text-foreground">/api/twilio/status</div>
        </div>
      </div>
    </div>
  );
}
