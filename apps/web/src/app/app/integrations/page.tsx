import Link from "next/link";
import { Check, ExternalLink, Plug } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { getInfrastructureStatus, type HealthTone } from "@/lib/infrastructure-status";
import { getTwilioIntegrationStatus } from "@/lib/twilio-transport";
import { getWorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export const dynamic = "force-dynamic";

type IntegrationItem = {
  name: string;
  desc: string;
  status: "Connected" | "Available" | "Needs config" | "Leadsy managed" | "Platform pending";
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
  const [infrastructure, twilio, sender] = await Promise.all([
    getInfrastructureStatus(),
    getTwilioIntegrationStatus(),
    session ? getWorkspaceWhatsAppSender({ tenantId: session.tenantId, ownerId: session.id }) : undefined
  ]);
  const openRouter = infrastructure.services.find((service) => service.key === "openrouter");
  const providerConfigs = new Map(infrastructure.providerConfigs.map((provider) => [provider.key, provider]));
  const emailConfig = providerConfigs.get("email");
  const emailConfigured = configured(process.env.SMTP_HOST, process.env.EMAIL_SERVER, process.env.RESEND_API_KEY, process.env.POSTMARK_SERVER_TOKEN);

  const items: IntegrationItem[] = [
    {
      name: "Leadsy WhatsApp",
      desc: "Workspace WhatsApp channel for inbound lead messages and human or AI replies. Transport details stay internal to Leadsy.",
      status: sender?.status === "approved" ? "Leadsy managed" : "Platform pending",
      scope: sender?.assignedPhoneNumber || sender?.statusReason || twilio.whatsappNumber || "Leadsy platform config pending",
      href: "/simulate-twilio"
    },
    {
      name: "OpenRouter",
      desc: "Model routing for research, qualification, drafting, and CRM decisions.",
      status: openRouter?.status === "healthy" ? "Connected" : "Needs config",
      scope: openRouter?.detail,
      href: "/app/settings"
    },
    {
      name: "Email",
      desc: "Optional operator reminder and escalation notifications configured on the web service.",
      status: emailConfigured ? "Connected" : "Available",
      scope: emailConfig?.detail || (emailConfigured ? "Web service configured" : "Add SMTP, Resend, or Postmark config"),
      href: "/app/settings"
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
              Configure systems Leadsy uses while keeping CRM state in the app database.
            </p>
          </div>
          <Badge tone={serviceTone(openRouter?.status ?? "unknown")}>AI: {openRouter?.status ?? "unknown"}</Badge>
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
                {item.status === "Connected" || item.status === "Leadsy managed" ? (
                  <span className="inline-flex items-center gap-1 rounded-[3px] bg-primary/10 px-1.5 py-0.5 font-mono text-[10.5px] text-primary">
                    <Check className="h-3 w-3" /> {item.status}
                  </span>
                ) : (
                  <Badge tone={item.status === "Needs config" || item.status === "Platform pending" ? "amber" : "neutral"}>{item.status}</Badge>
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
