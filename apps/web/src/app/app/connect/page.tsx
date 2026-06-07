import { headers } from "next/headers";
import {
  BadgeCheck,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  MessageCircle,
  Phone,
  ShieldCheck,
  Webhook
} from "lucide-react";
import { ExtensionPairing } from "@/components/extension-pairing";
import { Badge, Panel, SectionTitle } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { automationWorkflowDefinitions } from "@/lib/automation-workflows";
import { listExtensionTokens } from "@/lib/extension-store";
import { getAiCostDashboard, getInfrastructureStatus, type HealthTone } from "@/lib/infrastructure-status";
import { listMetaOAuthConnections, type MetaOAuthConnectionSummary } from "@/lib/meta-oauth-store";

export const dynamic = "force-dynamic";

type ConnectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ConnectPanel = "meta" | "settings" | "profile";

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function panelFromValue(value: string): ConnectPanel {
  if (value === "settings" || value === "profile") return value;
  return "meta";
}

function cleanOrigin(value?: string) {
  return value?.trim().replace(/\/$/, "");
}

async function appOrigin() {
  const configured = cleanOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (configured) return configured;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "leadsy.up.railway.app";
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

function metaStatusCopy(status?: string | string[]) {
  const value = Array.isArray(status) ? status[0] : status;
  if (value === "connected") return "Meta authorization completed. Leadsy can now receive message webhooks after the Meta subscription is active.";
  if (value === "cancelled") return "Meta authorization was cancelled before access was granted.";
  if (value === "unconfigured") return "Meta authorization needs app credentials before it can finish.";
  if (value === "error") return "Meta authorization could not finish. Try connecting again.";
  return undefined;
}

function channelAssetsForConnection(connection?: MetaOAuthConnectionSummary) {
  return [
    {
      label: "WhatsApp",
      icon: Phone,
      status: connection?.channels?.whatsapp?.status ?? "needs_asset",
      detail: connection?.phoneNumberId || connection?.whatsappBusinessAccountId || "Needs WABA / phone asset"
    },
    {
      label: "Instagram",
      icon: MessageCircle,
      status: connection?.channels?.instagram?.status ?? "needs_asset",
      detail: connection?.instagramBusinessAccountId || "Needs Instagram business account"
    },
    {
      label: "Facebook",
      icon: BadgeCheck,
      status: connection?.channels?.facebook?.status ?? "needs_asset",
      detail: connection?.facebookPageId || "Needs Facebook Page"
    }
  ];
}

function toneForHealth(status: HealthTone): "neutral" | "teal" | "amber" | "rose" | "lime" {
  if (status === "healthy") return "lime";
  if (status === "warning") return "amber";
  if (status === "critical") return "rose";
  return "neutral";
}

function compactDate(value?: string) {
  if (!value) return "No execution yet";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 4
  }).format(value);
}

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const params = searchParams ? await searchParams : {};
  const activePanel = panelFromValue(paramValue(params, "panel"));
  const session = await getCurrentSession();
  const [tokens, metaConnections, infrastructure, aiCosts] = await Promise.all([
    session ? listExtensionTokens(session.tenantId, session.id) : [],
    session ? listMetaOAuthConnections(session.tenantId, session.id) : [],
    getInfrastructureStatus(),
    getAiCostDashboard()
  ]);
  const latestMetaConnection = metaConnections[0];
  const hasMetaConnection = Boolean(latestMetaConnection);
  const origin = await appOrigin();
  const webhookUrl = `${origin}/api/meta/webhook`;
  const whatsappWebhookUrl = `${origin}/api/meta/whatsapp/webhook`;
  const metaConnectUrl = process.env.META_EMBEDDED_SIGNUP_URL?.trim();
  const metaStatus = metaStatusCopy(params.meta);
  const panelHeading =
    activePanel === "settings"
      ? { eyebrow: "Profile Settings", title: "Workspace and connection settings" }
      : activePanel === "profile"
      ? { eyebrow: "Profile", title: "Operator profile and workspace access" }
      : { eyebrow: "Meta connection", title: "Connect Meta messaging" };

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow={panelHeading.eyebrow} title={panelHeading.title} />
          <Badge tone={hasMetaConnection ? "lime" : metaConnectUrl ? "teal" : "amber"}>
            {hasMetaConnection ? "Connected" : metaConnectUrl ? "Ready to connect" : "Onboarding pending"}
          </Badge>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.72fr]">
          <section className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Building2 size={17} className="text-[var(--teal)]" />
                  Customer authorization
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-2)]">
                  Business owners connect their own Meta Business assets here. Leadsy then listens for inbound WhatsApp,
                  Instagram, and Facebook messages from authorized accounts.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {channelAssetsForConnection(latestMetaConnection).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Icon size={16} className="text-[var(--teal)]" />
                        {item.label}
                      </div>
                      <Badge tone={item.status === "connected" ? "lime" : "amber"}>
                        {item.status === "connected" ? "Connected" : "Needs asset"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{item.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {metaConnectUrl ? (
                <a
                  href="/api/meta/oauth/start"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.14] px-4 text-sm font-medium text-teal-50 hover:border-teal-200 hover:bg-teal-300/[0.2]"
                >
                  {hasMetaConnection ? "Reconnect Meta account" : "Connect Meta account"}
                  <ExternalLink size={16} />
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-4 text-sm font-medium text-[var(--muted-2)]"
                >
                  Connect Meta account
                  <ExternalLink size={16} />
                </span>
              )}
              <span className="text-sm leading-6 text-[var(--muted-2)]">
                {hasMetaConnection
                  ? `Connected ${latestMetaConnection?.updatedAt ? new Date(latestMetaConnection.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "to Meta"}.`
                  : metaConnectUrl
                  ? "Opens Meta's authorization flow for this workspace."
                  : "Meta connection is being enabled for this workspace."}
              </span>
            </div>
            {metaStatus ? (
              <div className="mt-4 rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] px-3 py-2 text-sm leading-6 text-teal-50">
                {metaStatus}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              <details className="rounded-[8px] border border-amber-300/25 bg-amber-300/[0.08] p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-amber-100">
                  Facebook Login is currently unavailable
                </summary>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">
                  This message is shown by Meta when the Facebook app or login product is not available for the
                  account opening the flow. Leadsy cannot override that page, but you can keep using manual leads,
                  the browser extension, and worker approvals while Meta is configured.
                </p>
              </details>

              <details className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-white">Steps to connect Meta</summary>
                <ol className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted-2)]">
                  <li>1. Confirm the Meta app is live or that your Facebook user is assigned as a tester/admin.</li>
                  <li>2. Confirm Facebook Login or Embedded Signup is available for the app.</li>
                  <li>3. Confirm the Leadsy callback URL is allowed in Meta&apos;s login settings.</li>
                  <li>4. Connect the Facebook Page, Instagram business account, and WhatsApp Business assets.</li>
                  <li>5. Return here and use Connect Meta account again.</li>
                </ol>
              </details>

              <details className="rounded-[8px] border border-teal-300/25 bg-teal-300/[0.07] p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-teal-100">Skip Meta for later</summary>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">
                  Configure Meta later from Profile Settings. Until then, operators can add leads manually, log
                  calls/emails, pair the browser extension, and keep all lead knowledge in Leadsy.
                </p>
              </details>
            </div>
          </section>

          <section className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={17} className="text-[var(--teal)]" />
              What Leadsy receives
            </div>
            <div className="mt-4 grid gap-3">
              {[
                { icon: Phone, title: "Sender identity", detail: "Phone, handle, or profile ID when Meta provides it." },
                { icon: MessageCircle, title: "Message body", detail: "Text, timestamp, and profile name are captured." },
                { icon: CheckCircle2, title: "Referral context", detail: "Meta referral fields are kept when present." }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Icon size={16} className="text-[var(--teal)]" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Legacy Capture Layer" title="Pair the extension for browser fallback" />
          <Badge tone="teal">{tokens.length} tokens</Badge>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted-2)]">
          The extension remains available for existing browser capture users, but the official Meta connection above is the primary transport for new conversation intake.
        </p>
        <div className="mt-6">
          <ExtensionPairing initialTokens={tokens} />
        </div>
      </Panel>

      {activePanel === "settings" ? (
        <Panel className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionTitle eyebrow="Infrastructure" title="Automation and service health" />
            <Badge tone={toneForHealth(infrastructure.automation.health)}>
              Automation {infrastructure.automation.health}
            </Badge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Automation engine", value: "Leadsy native", icon: ShieldCheck },
              { label: "Workflow count", value: String(infrastructure.automation.workflowCount), icon: CheckCircle2 },
              { label: "Last execution", value: compactDate(infrastructure.automation.lastExecution), icon: CheckCircle2 },
              { label: "Failed executions", value: String(infrastructure.automation.failedExecutions), icon: ShieldCheck }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-[var(--muted)]">
                    <Icon size={14} className="text-[var(--teal)]" />
                    {item.label}
                  </div>
                  <div className="mt-3 truncate text-sm font-semibold text-white" title={item.value}>
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <section className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Infrastructure dashboard</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted-2)]">
                    Service status, latency, errors, and sync signals for Leadsy operations.
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[8px] border border-[var(--line)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-white/[0.04] text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Service</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Latency</th>
                      <th className="px-3 py-2 font-medium">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {infrastructure.services.map((service) => (
                      <tr key={service.key} className="border-t border-[var(--line)]">
                        <td className="px-3 py-3">
                          <div className="font-medium text-white">{service.label}</div>
                          <div className="mt-1 max-w-[360px] truncate text-xs text-[var(--muted)]" title={service.detail}>
                            {service.detail}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={toneForHealth(service.status)}>{service.status}</Badge>
                        </td>
                        <td className="px-3 py-3 text-[var(--muted-2)]">{typeof service.latencyMs === "number" ? `${service.latencyMs}ms` : "n/a"}</td>
                        <td className="px-3 py-3 text-[var(--muted-2)]">{service.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Automation workflows</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted-2)]">
                    Workflow catalog for Leadsy-native scheduling, reminders, task creation, and escalations.
                  </p>
                </div>
                <Badge tone={infrastructure.automation.queueStatus === "healthy" ? "lime" : "neutral"}>
                  queue {infrastructure.automation.queueStatus.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="mt-4 max-h-[420px] overflow-auto rounded-[8px] border border-[var(--line)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-[#0b0f12] text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Workflow</th>
                      <th className="px-3 py-2 font-medium">Trigger</th>
                      <th className="px-3 py-2 font-medium">Links</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automationWorkflowDefinitions.map((workflow) => (
                      <tr key={workflow.key} className="border-t border-[var(--line)]">
                        <td className="px-3 py-3">
                          <div className="font-medium text-white">{workflow.name}</div>
                          <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{workflow.purpose}</div>
                        </td>
                        <td className="px-3 py-3 text-xs leading-5 text-[var(--muted-2)]">{workflow.trigger}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs text-[var(--muted)]">Native</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <BrainCircuit size={17} className="text-[var(--teal)]" />
                AI cost dashboard
              </div>
              <Badge tone="teal">{formatInr(aiCosts.totals.estimatedCostInr)} estimated</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {[
                ["Requests", aiCosts.totals.requests],
                ["Prompt tokens", aiCosts.totals.promptTokens],
                ["Completion tokens", aiCosts.totals.completionTokens],
                ["Total tokens", aiCosts.totals.totalTokens],
                ["Failures", aiCosts.totals.failures]
              ].map(([label, value]) => (
                <div key={label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
                  <div className="mt-2 text-lg font-semibold text-white">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-[8px] border border-[var(--line)]">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-white/[0.04] text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Workflow</th>
                    <th className="px-3 py-2 font-medium">Requests</th>
                    <th className="px-3 py-2 font-medium">Tokens</th>
                    <th className="px-3 py-2 font-medium">Cost</th>
                    <th className="px-3 py-2 font-medium">Failures</th>
                  </tr>
                </thead>
                <tbody>
                  {aiCosts.workflows.slice(0, 6).map((workflow) => (
                    <tr key={workflow.workflowKey} className="border-t border-[var(--line)]">
                      <td className="px-3 py-3 font-medium text-white">{workflow.workflowName}</td>
                      <td className="px-3 py-3 text-[var(--muted-2)]">{workflow.requests}</td>
                      <td className="px-3 py-3 text-[var(--muted-2)]">{workflow.totalTokens}</td>
                      <td className="px-3 py-3 text-[var(--muted-2)]">{formatInr(workflow.estimatedCostInr)}</td>
                      <td className="px-3 py-3 text-[var(--muted-2)]">{workflow.failures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{aiCosts.detail}</p>
          </section>
        </Panel>
      ) : null}

      <Panel className="p-5">
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Webhook size={17} className="text-[var(--teal)]" />
              Advanced developer details
            </span>
            <Badge tone="neutral">Internal webhook</Badge>
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.72fr]">
            <div className="rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] p-3">
              <div className="mono text-[10px] uppercase text-[var(--muted)]">Webhook endpoint</div>
              <div className="mono mt-2 break-all text-sm leading-6 text-teal-50">{webhookUrl}</div>
              <div className="mono mt-2 break-all text-xs leading-5 text-teal-100/80">WhatsApp compatibility: {whatsappWebhookUrl}</div>
            </div>
            <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--muted-2)]">
              Meta webhook subscriptions use this endpoint after the customer account is authorized. Most users never need
              to touch it.
            </div>
          </div>
        </details>
      </Panel>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound size={17} className="text-[var(--teal)]" />
            Extension download
          </div>
          <a href="/extension" className="text-sm font-medium text-teal-100 hover:text-white">
            Open download page
          </a>
        </div>
      </Panel>
    </div>
  );
}
