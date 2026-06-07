import { TwilioSimulatorConsole } from "@/components/twilio-simulator-console";
import { requireAgencySession } from "@/lib/auth";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { ensureWorkspaceTwilioSimulator } from "@/lib/twilio-simulator";

export const dynamic = "force-dynamic";

export default async function SimulateTwilioPage() {
  const session = await requireAgencySession();
  const businessName = typeof session.onboardingProfile?.businessName === "string" ? session.onboardingProfile.businessName : undefined;
  const sender = await ensureWorkspaceTwilioSimulator({
    tenantId: session.tenantId,
    ownerId: session.id,
    businessName
  });
  const leads = await listLeadKnowledgeRecords({ tenantId: session.tenantId, ownerId: session.id });
  const simulatedConversations = leads
    .map((lead) => {
      const messages = lead.messages
        .filter((message) => message.source === "twilio_simulator")
        .map((message) => ({
          id: message.id,
          from: message.direction === "outbound" ? "us" as const : "lead" as const,
          body: message.body,
          sentAt: message.sentAt,
          deliveryStatus: message.deliveryStatus
        }));
      const lastMessage = messages.at(-1);
      const digits = (lead.contact.waId || lead.contact.phone)?.replace(/\D/g, "");
      return {
        leadId: lead.id,
        lead: lead.contact.displayName || lead.contact.phone || "Simulated lead",
        phone: lead.contact.phone,
        to: digits ? `whatsapp:+${digits}` : undefined,
        qualification: lead.qualificationStage.replace(/_/g, " "),
        lastMessage: lastMessage?.body,
        lastActivity: lastMessage?.sentAt,
        messages
      };
    })
    .filter((conversation) => conversation.messages.length > 0)
    .sort((left, right) => (right.lastActivity ?? "").localeCompare(left.lastActivity ?? ""));
  const recentEvents = leads
    .flatMap((lead) =>
      lead.messages
        .filter((message) => message.source === "twilio_simulator")
        .map((message) => ({
          id: message.id,
          lead: lead.contact.displayName || lead.contact.phone || "Simulated lead",
          phone: lead.contact.phone,
          direction: message.direction === "outbound" ? "outbound" as const : "inbound" as const,
          body: message.body,
          deliveryStatus: message.deliveryStatus,
          sentAt: message.sentAt
        }))
    )
    .sort((left, right) => right.sentAt.localeCompare(left.sentAt))
    .slice(0, 12);

  return <TwilioSimulatorConsole sender={sender} recentEvents={recentEvents} simulatedConversations={simulatedConversations} />;
}
