import Link from "next/link";
import { Check, ExternalLink, Plug } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionTokens } from "@/lib/extension-store";
import { getInfrastructureStatus, type HealthTone } from "@/lib/infrastructure-status";
import { listMetaOAuthConnections } from "@/lib/meta-oauth-store";
import { getTwilioIntegrationStatus } from "@/lib/twilio-transport";

export const dynamic = "force-dynamic";

type IntegrationItem = {
  name: string;
  desc: string;
  status: "Connected" | "Available" | "Needs config" | "Warning" | "Managed in n8n";
  scope?: string;
  href: string;
  externalHref?: string;
};

function serviceTone(status: HealthTone): "lime" | "amber" | "rose" | "neutral" {
  if (status === "healthy") return "lime";
  if (status === "warning") return "amber";
  if (status === "critical") return "rose";
  return "neutral";
}

function configured(...values: Array<string | undefined>) {
  return values.some((value) => Boolean(value?.trim()));
}

export default async function IntegrationsPage() {
  const session = await getCurrentSession();
  const [metaConnections, extensionTokens, infrastructure, twilio] = await Promise.all([
    session ? listMetaOAuthConnections(session.tenantId, session.id) : [],
    session ? listExtensionTokens(session.tenantId, session.id) : [],
    getInfrastructureStatus(),
    getTwilioIntegrationStatus()
  ]);
  const latestMeta = metaConnections[0];
  const openRouter = infrastructure.services.find((service) => service.key === "openrouter");
  const n8n = infrastructure.services.find((service) => service.key === "n8n");
  const providerConfigs = new Map(infrastructure.providerConfigs.map((provider) => [provider.key, provider]));
  const metaConfig = providerConfigs.get("meta");
  const whatsappConfig = providerConfigs.get("whatsapp");
  const openRouterConfig = providerConfigs.get("openrouter");
  const emailConfig = providerConfigs.get("email");
  const n8nHref = infrastructure.automation.dashboardUrl || "/app/settings";
  const emailConfigured = configured(process.env.SMTP_HOST, process.env.EMAIL_SERVER, process.env.RESEND_API_KEY, process.env.POSTMARK_SERVER_TOKEN);

  const items: IntegrationItem[] = [
    {
      name: "Meta - Instagram & Messenger",
      desc: "OAuth and webhook intake stay in Leadsy; automation provider config is managed in n8n.",
      status: metaConnections.length ? "Connected" : "Needs config",
      scope: metaConfig?.managedByN8n
        ? "n8n provider config hub"
        : latestMeta?.facebookPageId || latestMeta?.instagramBusinessAccountId || "Connect Meta, then add automation config in n8n",
      href: "/app/connect",
      externalHref: metaConfig?.managedByN8n ? n8nHref : undefined
    },
    {
      name: "Twilio WhatsApp",
      desc: "Primary WhatsApp transport. Leadsy owns inbound storage, outbound sends, and delivery callbacks.",
      status: twilio.connected ? "Connected" : "Needs config",
      scope: twilio.whatsappNumber || latestMeta?.phoneNumberId || latestMeta?.whatsappBusinessAccountId || whatsappConfig?.detail || "Add Twilio WhatsApp env config",
      href: "/app/settings?section=twilio"
    },
    {
      name: "OpenRouter",
      desc: "Model routing for automation research, qualification, drafting, and summaries is configured in n8n.",
      status: openRouterConfig?.managedByN8n ? "Managed in n8n" : openRouter?.status === "healthy" ? "Connected" : "Needs config",
      scope: openRouterConfig?.managedByN8n ? `${openRouterConfig.workflowCount} workflows use n8n model config` : openRouter?.detail,
      href: "/app/settings",
      externalHref: openRouterConfig?.managedByN8n ? n8nHref : undefined
    },
    {
      name: "Browser Extension",
      desc: "Capture layer for WhatsApp Web, Instagram Web, Facebook Web, and generic web chat.",
      status: extensionTokens.length ? "Connected" : "Available",
      scope: extensionTokens.length ? `${extensionTokens.length} active token${extensionTokens.length === 1 ? "" : "s"}` : "Pair from Workers",
      href: "/app/worker"
    },
    {
      name: "n8n Automation",
      desc: "One backend-agent workflow for scheduled jobs, approvals, research, qualification, and retries.",
      status: n8n?.status === "healthy" ? "Connected" : n8n?.status === "critical" ? "Warning" : "Needs config",
      scope: `${infrastructure.automation.workflowCount} workflow - ${infrastructure.automation.detail}`,
      href: "/app/settings"
    },
    {
      name: "Email",
      desc: "Outbound notifications and approved outreach email config are managed in n8n.",
      status: emailConfig?.managedByN8n ? "Managed in n8n" : emailConfigured ? "Connected" : "Available",
      scope: emailConfig?.managedByN8n ? `${emailConfig.workflowCount} workflows use n8n email config` : emailConfigured ? "Web fallback configured" : "Add email provider config in n8n",
      href: "/app/settings",
      externalHref: emailConfig?.managedByN8n ? n8nHref : undefined
    },
    {
      name: "Webhooks",
      desc: "Meta webhook endpoints and Leadsy automation events for your stack.",
      status: "Available",
      scope: "/api/meta/webhook - /api/meta/whatsapp/webhook - /api/infrastructure/automation/*",
      href: "/app/connect"
    }
  ];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-5">
        <div className="caption">Integrations</div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mt-1 text-[22px] tracking-tight">Channels & infrastructure</h1>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Configure the systems Leadsy uses while keeping business state in Next.js and Postgres.
            </p>
          </div>
          <Badge tone={serviceTone(infrastructure.automation.health)}>
            n8n: {infrastructure.automation.health}
          </Badge>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-border bg-border md:grid-cols-2">
          {items.map((item) => (
            <div key={item.name} className="bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-border bg-surface-2">
                    <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium">{item.name}</div>
                    <div className="text-[11.5px] text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
                {item.status === "Connected" || item.status === "Managed in n8n" ? (
                  <span className="inline-flex items-center gap-1 rounded-[3px] bg-primary/10 px-1.5 py-0.5 font-mono text-[10.5px] text-primary">
                    <Check className="h-3 w-3" /> {item.status}
                  </span>
                ) : (
                  <Badge tone={item.status === "Warning" ? "rose" : item.status === "Needs config" ? "amber" : "neutral"}>{item.status}</Badge>
                )}
              </div>
              {item.scope ? (
                <div className="mt-3 flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate">{item.scope}</span>
                  <Link href={item.href} className="ml-auto inline-flex items-center gap-1 hover:text-foreground">
                    manage <ExternalLink className="h-3 w-3" />
                  </Link>
                  {item.externalHref ? (
                    <a href={item.externalHref} className="inline-flex items-center gap-1 hover:text-foreground">
                      n8n <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
