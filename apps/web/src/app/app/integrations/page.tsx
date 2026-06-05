import Link from "next/link";
import { Check, ExternalLink, Plug } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionTokens } from "@/lib/extension-store";
import { getInfrastructureStatus, type HealthTone } from "@/lib/infrastructure-status";
import { listMetaOAuthConnections } from "@/lib/meta-oauth-store";

export const dynamic = "force-dynamic";

type IntegrationItem = {
  name: string;
  desc: string;
  status: "Connected" | "Available" | "Needs config" | "Warning";
  scope?: string;
  href: string;
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
  const [metaConnections, extensionTokens, infrastructure] = await Promise.all([
    session ? listMetaOAuthConnections(session.tenantId, session.id) : [],
    session ? listExtensionTokens(session.tenantId, session.id) : [],
    getInfrastructureStatus()
  ]);
  const latestMeta = metaConnections[0];
  const openRouter = infrastructure.services.find((service) => service.key === "openrouter");
  const n8n = infrastructure.services.find((service) => service.key === "n8n");
  const whatsappConnected = latestMeta?.channels.whatsapp.status === "connected";
  const emailConfigured = configured(process.env.SMTP_HOST, process.env.EMAIL_SERVER, process.env.RESEND_API_KEY, process.env.POSTMARK_SERVER_TOKEN);

  const items: IntegrationItem[] = [
    {
      name: "Meta - Instagram & Messenger",
      desc: "OAuth, webhook intake, Lead Ads context, Instagram, and Messenger stay in Leadsy.",
      status: metaConnections.length ? "Connected" : "Needs config",
      scope: latestMeta?.facebookPageId || latestMeta?.instagramBusinessAccountId || "Meta app credentials and assets",
      href: "/app/connect"
    },
    {
      name: "WhatsApp Business API",
      desc: "Official Meta webhook messages are stored in Postgres; workers only orchestrate follow-up.",
      status: whatsappConnected ? "Connected" : "Needs config",
      scope: latestMeta?.phoneNumberId || latestMeta?.whatsappBusinessAccountId || "WABA and phone number asset",
      href: "/app/connect"
    },
    {
      name: "OpenRouter",
      desc: "Model routing for research, qualification, drafting, and AI cost reporting.",
      status: openRouter?.status === "healthy" ? "Connected" : "Needs config",
      scope: openRouter?.detail,
      href: "/app/settings"
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
      desc: "One router workflow for scheduled jobs, approvals, research, qualification, and retries.",
      status: n8n?.status === "healthy" ? "Connected" : n8n?.status === "critical" ? "Warning" : "Needs config",
      scope: `${infrastructure.automation.workflowCount} workflow - ${infrastructure.automation.detail}`,
      href: "/app/settings"
    },
    {
      name: "Email",
      desc: "Outbound email channel for outreach and operator notifications.",
      status: emailConfigured ? "Connected" : "Available",
      scope: emailConfigured ? "SMTP/provider variables configured" : "Configure SMTP, Resend, or Postmark variables",
      href: "/app/settings"
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
                {item.status === "Connected" ? (
                  <span className="inline-flex items-center gap-1 rounded-[3px] bg-primary/10 px-1.5 py-0.5 font-mono text-[10.5px] text-primary">
                    <Check className="h-3 w-3" /> Connected
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
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
