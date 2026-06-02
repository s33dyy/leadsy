import Link from "next/link";
import { Clock, Inbox, MessageCircle, Phone, RadioTower } from "lucide-react";
import { Badge, EmptyState, Panel, PrimaryLink, SectionTitle } from "@/components/ui";
import { listMetaWhatsAppInboundMessages, type MetaWhatsAppInboundMessage } from "@/lib/meta-whatsapp-webhook-store";

export const dynamic = "force-dynamic";

function isAdOriginated(message: MetaWhatsAppInboundMessage) {
  return message.referral?.sourceType === "ad" || Boolean(message.referral?.ctwaClid || message.referral?.sourceId);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export default async function LeadsPage() {
  const messages = await listMetaWhatsAppInboundMessages();
  const adOriginated = messages.filter(isAdOriginated);

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Leads" title="Incoming WhatsApp leads from Meta ads" />
          <div className="flex flex-wrap gap-2">
            <Badge tone="teal">{messages.length} total</Badge>
            <Badge tone="sky">{adOriginated.length} ad-originated</Badge>
          </div>
        </div>

        {messages.length ? (
          <div className="mt-6 grid gap-3">
            {messages.map((message) => (
              <article key={message.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Phone size={16} className="text-[var(--teal)]" />
                      <h2 className="text-lg font-semibold text-white">{message.profileName || message.from}</h2>
                      <Badge tone={isAdOriginated(message) ? "teal" : "neutral"}>
                        {isAdOriginated(message) ? "Ad-originated" : "Inbound"}
                      </Badge>
                    </div>
                    <div className="mono mt-2 text-xs text-[var(--muted)]">{message.from}</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--muted-2)]">
                    <Clock size={15} className="text-[var(--teal)]" />
                    {formatDate(message.receivedAt)}
                  </div>
                </div>

                <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--muted-2)]">
                  {message.messageText || `Received ${message.messageType} message`}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Message ID", message.messageId],
                    ["Phone number ID", message.phoneNumberId ?? "unknown"],
                    ["Business account", message.whatsappBusinessAccountId ?? "unknown"],
                    ["Sent", formatDate(message.sentAt)]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                      <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
                      <div className="mono mt-2 break-all text-xs text-white">{value}</div>
                    </div>
                  ))}
                </div>

                {message.referral ? (
                  <div className="mt-4 rounded-[8px] border border-teal-300/25 bg-teal-300/[0.07] p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-teal-50">
                      <RadioTower size={16} />
                      Meta ad referral
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {[
                        ["Source", message.referral.sourceType ?? "unknown"],
                        ["Ad/source ID", message.referral.sourceId ?? "unknown"],
                        ["Click ID", message.referral.ctwaClid ?? "unknown"],
                        ["Headline", message.referral.headline ?? "not sent"],
                        ["Body", message.referral.body ?? "not sent"],
                        ["URL", message.referral.sourceUrl ?? "not sent"]
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
                          <div className="mt-1 break-all text-sm text-white">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={Inbox}
              title="No incoming leads yet"
              detail="When a person sends the first WhatsApp message from a Meta ad, Leadsy will show their phone number, message, timestamp, and referral payload here."
              action={<PrimaryLink href="/app/connect">Open connection config</PrimaryLink>}
            />
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageCircle size={17} className="text-[var(--teal)]" />
            Conversation work happens in the extension
          </div>
          <Link href="/app/worker" className="text-sm font-medium text-teal-100 hover:text-white">
            Open worker
          </Link>
        </div>
      </Panel>
    </div>
  );
}
