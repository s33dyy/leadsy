import Link from "next/link";
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

export const dynamic = "force-dynamic";

const groups = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "ai", label: "AI", icon: Brain },
  { id: "workers", label: "Workers", icon: Bot },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "meta", label: "Meta", icon: BadgeCheck },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { id: "extension", label: "Extension", icon: Monitor },
  { id: "infrastructure", label: "Infrastructure", icon: Server }
];

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

export default async function SettingsPage() {
  const [infrastructure, aiCosts] = await Promise.all([getInfrastructureStatus(), getAiCostDashboard()]);
  const automation = infrastructure.automation;
  const backendLogic = infrastructure.backendLogic;
  const providerConfigs = infrastructure.providerConfigs;
  const dashboardUrl = automation.dashboardUrl;
  const routerUrl = dashboardUrl ? `${dashboardUrl}/workflow/urS7zJDAyavE5PSJ` : undefined;
  const executionsUrl = dashboardUrl ? `${dashboardUrl}/executions` : undefined;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <aside className="col-span-12 min-h-0 overflow-y-auto bg-background md:col-span-3 xl:col-span-2">
        <div className="border-b border-border p-3">
          <div className="flex h-7 items-center gap-2 rounded-[5px] border border-border bg-surface-2 px-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <span className="flex-1 text-[12px] text-muted-foreground">Search settings...</span>
          </div>
        </div>
        <nav className="p-2">
          {groups.map((group) => {
            const Icon = group.icon;
            const active = group.id === "infrastructure";
            return (
              <Link key={group.id} href={group.id === "integrations" ? "/app/integrations" : "/app/settings"} className={`nav-item w-full ${active ? "bg-sidebar-accent text-foreground" : ""}`}>
                <Icon className="nav-icon" />
                <span className="flex-1 text-left">{group.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="col-span-12 min-h-0 overflow-y-auto bg-background md:col-span-9 xl:col-span-10">
        <div className="mx-auto max-w-4xl p-6">
          <div className="caption">Settings / Infrastructure</div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="mt-1 text-[22px] tracking-tight">Automation</h1>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                n8n is the orchestration layer. Leadsy keeps auth, tenant isolation, APIs, and business state in Next.js and Postgres.
              </p>
            </div>
            <Badge tone={toneForHealth(automation.health)}>n8n: {automation.health}</Badge>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-3">
            {[
              {
                k: "n8n URL",
                v: automation.publicUrl ? (
                  <a className="inline-flex items-center gap-1 text-primary hover:underline" href={automation.publicUrl}>
                    {automation.publicUrl.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
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
              <div key={stat.k} className="bg-background p-4">
                <div className="caption">{stat.k}</div>
                <div className="mt-1.5 text-[13px]">{stat.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {dashboardUrl ? (
              <a href={dashboardUrl} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] bg-primary px-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
                Open n8n dashboard <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {routerUrl ? (
              <a href={routerUrl} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2.5 text-[12px] hover:bg-surface-3">
                Open router workflow <ExternalLink className="h-3 w-3" />
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
            <div className="mt-3 divide-y divide-border rounded-[8px] border border-border">
              {backendLogic.map((module) => (
                <div key={module.key} className="grid grid-cols-12 items-center gap-3 px-3 py-2.5 text-[12px] hover:bg-surface-2">
                  <div className="col-span-12 md:col-span-3">
                    <div className="font-medium">{module.label}</div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">{module.key}</div>
                  </div>
                  <div className="col-span-12 truncate text-muted-foreground md:col-span-5">{module.detail}</div>
                  <div className="col-span-4 font-mono text-[11px] text-muted-foreground md:col-span-1">{module.actionCount} actions</div>
                  <div className="col-span-4 font-mono text-[11px] text-muted-foreground md:col-span-1">{module.guardrailCount} rails</div>
                  <div className="col-span-4 text-right font-mono text-[10.5px] text-primary md:col-span-2">
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
            <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-2">
              {providerConfigs.map((provider) => (
                <div key={provider.key} className="bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-medium">{provider.label}</div>
                      <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">{provider.detail}</p>
                    </div>
                    <Badge tone={toneForHealth(provider.status)}>
                      {provider.managedByN8n ? "n8n owned" : "connect n8n"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[6px] border border-border bg-border text-[11px]">
                    <div className="bg-surface-2 p-2">
                      <div className="caption">Fields</div>
                      <div className="mt-1 font-mono">{provider.fieldCount}</div>
                    </div>
                    <div className="bg-surface-2 p-2">
                      <div className="caption">Protected</div>
                      <div className="mt-1 font-mono">{provider.secretFieldCount}</div>
                    </div>
                    <div className="bg-surface-2 p-2">
                      <div className="caption">Workflows</div>
                      <div className="mt-1 font-mono">{provider.workflowCount}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium">Router event map</h2>
              <span className="caption">single n8n workflow</span>
            </div>
            <ul className="mt-3 divide-y divide-border rounded-[6px] border border-border">
              {automationWorkflowDefinitions.map((workflow) => (
                <li key={workflow.key} className="grid grid-cols-12 items-center gap-2 px-3 py-2.5 text-[12px] hover:bg-surface-2">
                  <span className="col-span-12 font-mono md:col-span-3">{workflow.key}</span>
                  <span className="col-span-12 md:col-span-3">{workflow.name}</span>
                  <span className="col-span-10 truncate text-muted-foreground md:col-span-5">{workflow.purpose}</span>
                  {routerUrl ? (
                    <a href={routerUrl} className="col-span-2 justify-self-end text-muted-foreground hover:text-foreground md:col-span-1">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <ChevronRight className="col-span-2 h-3.5 w-3.5 justify-self-end text-muted-foreground md:col-span-1" />
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 grid gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-3">
            {[
              { label: "AI requests", value: String(aiCosts.totals.requests) },
              { label: "Tokens", value: String(aiCosts.totals.totalTokens) },
              { label: "Estimated cost", value: formatInr(aiCosts.totals.estimatedCostInr) }
            ].map((item) => (
              <div key={item.label} className="bg-background p-4">
                <div className="caption">{item.label}</div>
                <div className="mt-1.5 font-mono text-[16px]">{item.value}</div>
              </div>
            ))}
          </section>

          <section className="mt-6">
            <div className="flex items-center gap-2 text-[12.5px]">
              <Check className="h-3.5 w-3.5 text-primary" />
              <span>{automation.detail}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Edit the router in n8n, keep payload storage and decisions in Leadsy, and use the Next.js APIs as the only state boundary.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
