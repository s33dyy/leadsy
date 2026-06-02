import { headers } from "next/headers";
import {
  BadgeCheck,
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
import { listExtensionTokens } from "@/lib/extension-store";

export const dynamic = "force-dynamic";

type ConnectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
  if (value === "connected") return "Meta authorization completed. Leadsy can now receive WhatsApp webhook messages after the Meta subscription is active.";
  if (value === "cancelled") return "Meta authorization was cancelled before access was granted.";
  if (value === "unconfigured") return "Meta authorization needs app credentials before it can finish.";
  if (value === "error") return "Meta authorization could not finish. Try connecting again.";
  return undefined;
}

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const session = await getCurrentSession();
  const tokens = session ? await listExtensionTokens(session.tenantId, session.id) : [];
  const origin = await appOrigin();
  const webhookUrl = `${origin}/api/meta/whatsapp/webhook`;
  const metaConnectUrl = process.env.META_EMBEDDED_SIGNUP_URL?.trim();
  const metaStatus = metaStatusCopy((await searchParams)?.meta);

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Meta connection" title="Connect Meta / WhatsApp" />
          <Badge tone={metaConnectUrl ? "teal" : "amber"}>{metaConnectUrl ? "Ready to connect" : "Onboarding pending"}</Badge>
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
                  Business owners connect their own Meta Business and WhatsApp number here. Leadsy then listens for new
                  inbound WhatsApp messages from that authorized account.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                { icon: BadgeCheck, title: "Meta login", detail: "Owner grants Leadsy access." },
                { icon: Phone, title: "WhatsApp number", detail: "Owner selects the business number." },
                { icon: MessageCircle, title: "Incoming leads", detail: "Texts create lead records." }
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

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {metaConnectUrl ? (
                <a
                  href={metaConnectUrl}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.14] px-4 text-sm font-medium text-teal-50 hover:border-teal-200 hover:bg-teal-300/[0.2]"
                >
                  Connect Meta account
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
                {metaConnectUrl
                  ? "Opens Meta's authorization flow for this workspace."
                  : "Meta connection is being enabled for this workspace."}
              </span>
            </div>
            {metaStatus ? (
              <div className="mt-4 rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] px-3 py-2 text-sm leading-6 text-teal-50">
                {metaStatus}
              </div>
            ) : null}
          </section>

          <section className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={17} className="text-[var(--teal)]" />
              What Leadsy receives
            </div>
            <div className="mt-4 grid gap-3">
              {[
                { icon: Phone, title: "Sender number", detail: "Available after the person sends a WhatsApp message." },
                { icon: MessageCircle, title: "First message", detail: "Text, timestamp, and profile name are captured." },
                { icon: CheckCircle2, title: "Ad referral", detail: "Meta referral fields are kept when present." }
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
          <SectionTitle eyebrow="Browser worker" title="Pair the extension for conversation work" />
          <Badge tone="teal">{tokens.length} tokens</Badge>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted-2)]">
          The extension handles the later browser conversation work. The official Meta connection above is still the source
          of incoming WhatsApp lead identity.
        </p>
        <div className="mt-6">
          <ExtensionPairing initialTokens={tokens} />
        </div>
      </Panel>

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
