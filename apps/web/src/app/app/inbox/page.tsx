import { Mic, MessageCircle, PhoneCall, Repeat2, Sparkles } from "lucide-react";
import { followUpTasks, whatsappConversations } from "@leadsy/domain";
import { WhatsAppInbox } from "@/components/whatsapp-inbox";
import { Badge, EmptyState, Panel, SectionTitle } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { listExtensionConversations, listExtensionTasks } from "@/lib/extension-store";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await getCurrentSession();
  const extensionConversations = session ? await listExtensionConversations(session.tenantId, session.id) : [];
  const extensionTasks = session ? await listExtensionTasks(session.tenantId, session.id) : [];
  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="WhatsApp command inbox" title="AI-assisted conversations, follow-ups, and booking handoffs" />
          <Badge tone="teal">{extensionConversations.length || whatsappConversations.length} active conversations</Badge>
        </div>
        <div className="mt-6">
          <WhatsAppInbox extensionConversations={extensionConversations} />
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          { icon: Sparkles, title: "AI-assisted replies", detail: "Budget, location, timeline, and intent-aware responses." },
          { icon: Mic, title: "Voice note architecture", detail: "Inbound audio transcription, sentiment, summary, and reply drafting." },
          { icon: Repeat2, title: "Smart follow-ups", detail: "No hot lead is left idle after read, no-reply, or missed-call events." },
          { icon: PhoneCall, title: "Human escalation", detail: "Route high-intent buyers to the correct closer with context." }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Panel key={item.title} className="p-4">
              <Icon size={18} className="text-[var(--teal)]" />
              <div className="mt-4 text-sm font-semibold text-white">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{item.detail}</p>
            </Panel>
          );
        })}
      </section>

      <Panel className="p-5">
        <SectionTitle eyebrow="follow-up queue" title="Lead retention worklist" />
        {extensionTasks.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {extensionTasks.map((task) => (
            <div key={task.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageCircle size={16} className="text-[var(--teal)]" />
                  {task.contact.displayName || task.contact.handle || task.contact.phone || "Worker task"}
                </div>
                <Badge tone={task.status === "blocked" || task.status === "failed" ? "amber" : "teal"}>{task.status}</Badge>
              </div>
              <div className="mono mt-3 text-[11px] text-[var(--muted)]">
                {task.platform.replace(/-/g, " ")} · {task.type.replace(/_/g, " ")}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">{task.draftMessage}</p>
            </div>
          ))}
        </div>
        ) : followUpTasks.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {followUpTasks.map((task) => (
            <div key={task.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageCircle size={16} className="text-[var(--teal)]" />
                  {task.title}
                </div>
                <Badge tone={task.automation === "human" ? "amber" : "teal"}>{task.automation}</Badge>
              </div>
              <div className="mono mt-3 text-[11px] text-[var(--muted)]">{task.channel} · {task.dueAt}</div>
            </div>
          ))}
        </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              icon={Repeat2}
              title="No follow-ups"
              detail="The follow-up queue is empty. Real follow-ups will appear after conversations or bookings are created."
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
