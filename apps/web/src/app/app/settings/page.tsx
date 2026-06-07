import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bell, Bot, Brain, Building2, MessageSquare, Search, Server, User } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { getInfrastructureStatus, type HealthTone } from "@/lib/infrastructure-status";
import { getTwilioIntegrationStatus, type TwilioIntegrationStatus } from "@/lib/twilio-transport";
import { getWorkspaceWhatsAppSender, type WorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type SettingsSection =
  | "profile"
  | "workspace"
  | "twilio"
  | "ai"
  | "agents"
  | "notifications"
  | "infrastructure";

const groups: Array<{ id: SettingsSection; label: string; icon: LucideIcon }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "twilio", label: "Twilio", icon: MessageSquare },
  { id: "ai", label: "AI", icon: Brain },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "notifications", label: "Notifications", icon: Bell },
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
    rows: [
      { label: "Account", value: "Managed by Leadsy auth" },
      { label: "Access", value: "Workspace session and role based" },
      { label: "Personalization", value: "Used by AI agents for operator context" }
    ]
  },
  workspace: {
    eyebrow: "Settings / Workspace",
    title: "Workspace",
    detail: "Business context, team defaults, and tenant-level operating rules.",
    rows: [
      { label: "Tenant isolation", value: "Next.js gateway + app database" },
      { label: "Business state", value: "Stored in Leadsy" },
      { label: "Automation", value: "Leadsy-native scheduler and task engine" }
    ]
  },
  twilio: {
    eyebrow: "Settings / Integrations / Twilio",
    title: "Leadsy-assigned WhatsApp",
    detail: "Workspace sender assignment, inbound routing, outbound replies, and delivery callbacks through Leadsy-managed Twilio infrastructure.",
    primaryHref: "/app/integrations",
    primaryLabel: "Open integrations",
    rows: []
  },
  ai: {
    eyebrow: "Settings / AI",
    title: "AI configuration",
    detail: "Model routing and cost visibility for qualification, drafting, and CRM decisions.",
    rows: [
      { label: "Provider", value: "OpenRouter" },
      { label: "Secrets", value: "Configured in deployment environment variables" },
      { label: "Cost tracking", value: "Recorded through Leadsy automation events" }
    ]
  },
  agents: {
    eyebrow: "Settings / Agents",
    title: "Teamspace agents",
    detail: "Human members, full AI agents, assisted AI agents, pipeline ownership, and auto-reply toggles.",
    primaryHref: "/app/team",
    primaryLabel: "Open teamspace",
    rows: [
      { label: "Qualification", value: "Initial inbound WhatsApp handled by configured AI agents" },
      { label: "Assignment", value: "Qualified leads route to the next human or AI owner" },
      { label: "Guardrails", value: "Dedupe, cooldown, escalation keywords, and internal thread boundaries" }
    ]
  },
  notifications: {
    eyebrow: "Settings / Notifications",
    title: "Notifications",
    detail: "Operator alerts for approvals, failed executions, follow-ups, and escalations.",
    rows: [
      { label: "Approvals", value: "Visible in the top bar and approval center" },
      { label: "Failures", value: "Escalation rules can create manager-visible tasks" },
      { label: "Follow-ups", value: "Driven and stored in Leadsy" }
    ]
  },
  infrastructure: {
    eyebrow: "Settings / Infrastructure",
    title: "Infrastructure",
    detail: "Leadsy owns follow-up scheduling, reminders, task creation, escalation rules, auth, CRM, conversations, assignments, leads, APIs, and database state.",
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
  const session = await getCurrentSession();
  const [infrastructure, twilio, sender] = await Promise.all([
    getInfrastructureStatus(),
    getTwilioIntegrationStatus(),
    session ? getWorkspaceWhatsAppSender({ tenantId: session.tenantId, ownerId: session.id }) : undefined
  ]);

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
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{section.detail}</p>
            </div>
            {activeSection === "infrastructure" ? <Badge tone={toneForHealth(infrastructure.automation.health)}>Automation: {infrastructure.automation.health}</Badge> : null}
          </div>

          {activeSection === "twilio" ? (
            <TwilioSettingsPanel twilio={twilio} sender={sender} />
          ) : activeSection === "infrastructure" ? (
            <InfrastructurePanel infrastructure={infrastructure} />
          ) : (
            <SettingsSectionPanel section={section} />
          )}
        </div>
      </section>
    </div>
  );
}

function SettingsSectionPanel({ section }: { section: (typeof sectionSummaries)[SettingsSection] }) {
  return (
    <section className="mt-6 min-w-0 overflow-hidden rounded-[8px] border border-border bg-background">
      <div className="border-b border-border p-4">
        <div className="text-[14px] font-medium">{section.title}</div>
        <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">{section.detail}</p>
        {section.primaryHref ? (
          <Link href={section.primaryHref} className="mt-3 inline-flex h-8 items-center rounded-[5px] bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
            {section.primaryLabel}
          </Link>
        ) : null}
      </div>
      <div className="grid min-w-0 gap-px bg-border md:grid-cols-3">
        {section.rows.map((row) => (
          <div key={row.label} className="min-w-0 bg-background p-4">
            <div className="caption">{row.label}</div>
            <div className="mt-1.5 text-[13px] leading-5">{row.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TwilioSettingsPanel({
  twilio,
  sender
}: {
  twilio: TwilioIntegrationStatus;
  sender?: WorkspaceWhatsAppSender;
}) {
  const status = sender?.status ?? "not_started";
  const assigned = sender?.assignedPhoneNumber ?? (sender?.transportMode === "simulator" ? sender.simulatorHandle : undefined);
  return (
    <section className="mt-6 min-w-0 overflow-hidden rounded-[8px] border border-border bg-background">
      <div className="border-b border-border p-4">
        <div className="text-[14px] font-medium">Leadsy-assigned WhatsApp sender</div>
        <p className="mt-2 max-w-3xl text-[12.5px] leading-6 text-muted-foreground">
          Leadsy assigns each workspace a dedicated WhatsApp lead number when real transport is available, or a simulator sender while testing.
        </p>
        <div className="mt-3">
          <Badge tone={status === "approved" ? "lime" : status === "failed" ? "rose" : "amber"}>{status.replace(/_/g, " ")}</Badge>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-px bg-border md:grid-cols-2">
        <TwilioCell label="Workspace sender status" value={status.replace(/_/g, " ")} />
        <TwilioCell label="Assigned lead number" value={assigned ?? "Not assigned yet"} />
        <TwilioCell label="Platform connection status" value={twilio.connected ? "Configured" : "Not configured"} />
        <TwilioCell label="Platform account SID" value={maskTwilioAccountSid(twilio.accountSid)} />
        <TwilioCell label="Platform default sender" value={twilio.whatsappNumber ? "Configured" : "Not configured"} />
        <TwilioCell label="Provisioning detail" value={sender?.statusReason ?? "No provisioning event yet"} />
        <TwilioCell label="Last webhook" value={twilioDate(twilio.lastWebhook?.at)} />
        <TwilioCell label="Last delivery callback" value={twilioDate(twilio.lastDeliveryCallback?.at)} />
        <TwilioCell label="Inbound webhook URL" value="/api/twilio/webhook" />
        <TwilioCell label="Status callback URL" value="/api/twilio/status" />
      </div>
    </section>
  );
}

function TwilioCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 overflow-hidden bg-background p-4">
      <div className="caption">{label}</div>
      <div className="mt-1.5 min-w-0 truncate font-mono text-[13px]" title={value}>
        {value}
      </div>
    </div>
  );
}

function InfrastructurePanel({ infrastructure }: { infrastructure: Awaited<ReturnType<typeof getInfrastructureStatus>> }) {
  return (
    <>
      <div className="mt-6 grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-3">
        {[
          { k: "Automation engine", v: "Leadsy native" },
          { k: "Health", v: infrastructure.automation.health },
          { k: "Workflow count", v: String(infrastructure.automation.workflowCount) },
          { k: "Queue", v: infrastructure.automation.queueStatus.replace(/_/g, " ") },
          { k: "Failed executions", v: String(infrastructure.automation.failedExecutions) },
          { k: "Checked", v: compactDate(infrastructure.automation.checkedAt) }
        ].map((stat) => (
          <div key={stat.k} className="min-w-0 overflow-hidden bg-background p-4">
            <div className="caption">{stat.k}</div>
            <div className="mt-1.5 min-w-0 text-[13px]">{stat.v}</div>
          </div>
        ))}
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-medium">Backend logic modules</h2>
          <span className="caption">owned by Leadsy</span>
        </div>
        <div className="mt-3 min-w-0 divide-y divide-border overflow-hidden rounded-[8px] border border-border">
          {infrastructure.backendLogic.map((module) => (
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
          <h2 className="text-[14px] font-medium">Service health</h2>
          <span className="caption">runtime</span>
        </div>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-2">
          {infrastructure.services.map((service) => (
            <div key={service.key} className="min-w-0 overflow-hidden bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-medium">{service.label}</div>
                <Badge tone={toneForHealth(service.status)}>{service.status}</Badge>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{service.detail}</p>
              <div className="mt-3 font-mono text-[10.5px] text-muted-foreground">errors {service.errors}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
