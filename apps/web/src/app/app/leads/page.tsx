import { Ban, CheckCircle2, Clock, ExternalLink, Inbox, MessageCircle, Phone, RadioTower } from "lucide-react";
import { Badge, EmptyState, Panel, PrimaryLink, SectionTitle } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import {
  listMetaWhatsAppConversations,
  type MetaWhatsAppConversation
} from "@/lib/meta-whatsapp-webhook-store";

export const dynamic = "force-dynamic";

type LeadsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const whatsappWebBase = "https://web.whatsapp.com/send";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function latestMessage(conversation: MetaWhatsAppConversation) {
  return conversation.lastMessageText || `Received ${conversation.lastMessageType} message`;
}

function noticeCopy(params: Record<string, string | string[] | undefined>) {
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  if (notice === "contact-excluded") return "Contact excluded from leads. The conversation is still tracked.";
  if (notice === "contact-restored") return "Contact restored as a lead.";
  return "";
}

function statusTone(conversation: MetaWhatsAppConversation): "teal" | "amber" | "lime" {
  if (conversation.leadStatus === "excluded") return "amber";
  return conversation.adOriginated ? "lime" : "teal";
}

function statusLabel(conversation: MetaWhatsAppConversation) {
  if (conversation.leadStatus === "excluded") return "Excluded";
  return conversation.adOriginated ? "Ad lead" : "Lead";
}

function contactLabel(conversation: MetaWhatsAppConversation) {
  return conversation.profileName || conversation.waId || conversation.contactId;
}

function whatsappHref(conversation: MetaWhatsAppConversation) {
  return conversation.whatsappUrl || `${whatsappWebBase}?phone=${encodeURIComponent(conversation.contactId)}`;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const session = await getCurrentSession();
  const conversations = session
    ? await listMetaWhatsAppConversations({ tenantId: session.tenantId, ownerId: session.id })
    : [];
  const activeLeads = conversations.filter((conversation) => conversation.leadStatus === "lead");
  const excludedContacts = conversations.filter((conversation) => conversation.leadStatus === "excluded");
  const notice = noticeCopy(searchParams ? await searchParams : {});

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Leads" title="All WhatsApp conversations" />
          <div className="flex flex-wrap gap-2">
            <Badge tone="teal">{conversations.length} conversations</Badge>
            <Badge tone="lime">{activeLeads.length} leads</Badge>
            <Badge tone="amber">{excludedContacts.length} excluded</Badge>
          </div>
        </div>

        {notice ? (
          <div className="mt-4 rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] px-3 py-2 text-sm leading-6 text-teal-50">
            {notice}
          </div>
        ) : null}

        {conversations.length ? (
          <div className="mt-6 overflow-x-auto rounded-[8px] border border-[var(--line)] bg-black/20">
            <table className="min-w-[980px] w-full border-collapse text-left">
              <thead className="border-b border-[var(--line)] bg-white/[0.03]">
                <tr className="mono text-[10px] uppercase text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Last message</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Messages</th>
                  <th className="px-4 py-3 font-medium">Last seen</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((conversation) => (
                  <tr key={conversation.contactId} className="border-b border-[var(--line)] last:border-b-0">
                    <td className="px-4 py-4 align-top">
                      <a
                        href={whatsappHref(conversation)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-[240px] items-center gap-2 text-sm font-semibold text-white hover:text-teal-100"
                      >
                        <Phone size={15} className="shrink-0 text-[var(--teal)]" />
                        <span className="truncate">{contactLabel(conversation)}</span>
                      </a>
                      <div className="mono mt-2 break-all text-xs text-[var(--muted)]">{conversation.contactId}</div>
                    </td>
                    <td className="max-w-[320px] px-4 py-4 align-top">
                      <p className="line-clamp-2 text-sm leading-6 text-[var(--muted-2)]">{latestMessage(conversation)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {conversation.adOriginated ? (
                          <Badge tone="lime">
                            <RadioTower size={12} />
                            Meta ad
                          </Badge>
                        ) : null}
                        {conversation.displayPhoneNumber ? <Badge tone="neutral">{conversation.displayPhoneNumber}</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge tone={statusTone(conversation)}>{statusLabel(conversation)}</Badge>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="teal">{conversation.inboundCount} in</Badge>
                        <Badge tone="sky">{conversation.outboundCount} out</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-[var(--muted-2)]">
                      <span className="inline-flex items-center gap-2">
                        <Clock size={14} className="text-[var(--teal)]" />
                        {formatDate(conversation.lastMessageAt)}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex min-w-[220px] flex-wrap gap-2">
                        <a
                          href={whatsappHref(conversation)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-xs font-medium text-teal-100 hover:bg-teal-300/[0.18]"
                        >
                          <MessageCircle size={14} />
                          Open WhatsApp
                          <ExternalLink size={13} />
                        </a>
                        <form action="/api/meta/whatsapp/conversations/lead-status" method="post">
                          <input type="hidden" name="contactId" value={conversation.contactId} />
                          <input
                            type="hidden"
                            name="leadStatus"
                            value={conversation.leadStatus === "excluded" ? "lead" : "excluded"}
                          />
                          <button
                            type="submit"
                            className={`inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border px-3 text-xs font-medium ${
                              conversation.leadStatus === "excluded"
                                ? "border-lime-300/25 bg-lime-300/10 text-lime-100 hover:bg-lime-300/[0.16]"
                                : "border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/[0.16]"
                            }`}
                          >
                            {conversation.leadStatus === "excluded" ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                            {conversation.leadStatus === "excluded" ? "Restore as lead" : "Exclude contact"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={Inbox}
              title="No WhatsApp conversations yet"
              detail="When WhatsApp messages arrive from Meta webhooks, Leadsy will track the sender, latest message, source, and lead status here."
              action={<PrimaryLink href="/app/connect">Open connection config</PrimaryLink>}
            />
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageCircle size={17} className="text-[var(--teal)]" />
            WhatsApp history is kept even when a contact is excluded
          </div>
          <a href="/app/worker" className="text-sm font-medium text-teal-100 hover:text-white">
            Open worker
          </a>
        </div>
      </Panel>
    </div>
  );
}
