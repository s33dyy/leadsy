import { headers } from "next/headers";
import { Cable, CheckCircle2, KeyRound, MessageCircle, ShieldCheck, Webhook } from "lucide-react";
import { ExtensionPairing } from "@/components/extension-pairing";
import { Badge, Panel, SectionTitle } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionTokens } from "@/lib/extension-store";

export const dynamic = "force-dynamic";

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

export default async function ConnectPage() {
  const session = await getCurrentSession();
  const tokens = session ? await listExtensionTokens(session.tenantId, session.id) : [];
  const origin = await appOrigin();
  const webhookUrl = `${origin}/api/meta/whatsapp/webhook`;

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Connection config" title="Connect WhatsApp leads and the browser worker" />
          <Badge tone="teal">WhatsApp webhook only</Badge>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.78fr]">
          <section className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Webhook size={17} className="text-[var(--teal)]" />
              Meta callback
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] p-3">
                <div className="mono text-[10px] uppercase text-[var(--muted)]">Callback URL</div>
                <div className="mono mt-2 break-all text-sm leading-6 text-teal-50">{webhookUrl}</div>
              </div>
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--muted-2)]">
                Add this callback to the WhatsApp Business connection your Leadsy account will use. Leadsy records the phone
                number, first message, timestamp, and ad source only after the person sends a WhatsApp message.
              </div>
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--muted-2)]">
                Secure verification is handled separately from the customer workspace. This page only shows the connection
                details your team needs to route incoming leads.
              </div>
            </div>
          </section>

          <section className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={17} className="text-[var(--teal)]" />
              Live scope
            </div>
            <div className="mt-4 grid gap-3">
              {[
                { icon: MessageCircle, title: "Incoming messages", detail: "Inbound WhatsApp webhook payloads become Leadsy leads." },
                { icon: Cable, title: "Ad attribution", detail: "Referral fields are preserved when Meta sends them in the message payload." },
                { icon: CheckCircle2, title: "No hidden clickers", detail: "Clicks without a sent message remain aggregate Meta metrics only." }
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
          <SectionTitle eyebrow="Worker pairing" title="Create extension tokens for browser operators" />
          <Badge tone="teal">{tokens.length} tokens</Badge>
        </div>
        <div className="mt-6">
          <ExtensionPairing initialTokens={tokens} />
        </div>
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
