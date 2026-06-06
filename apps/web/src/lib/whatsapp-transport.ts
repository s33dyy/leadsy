import { sendAndStoreSimulatedWhatsAppMessage } from "./twilio-simulator";
import { sendAndStoreTwilioWhatsAppMessage } from "./twilio-transport";
import { getWorkspaceWhatsAppSender } from "./workspace-whatsapp-sender-store";
import type { LeadKnowledgeContact } from "./lead-knowledge-store";

type Scope = {
  tenantId: string;
  ownerId: string;
};

export type WhatsAppSendResult = {
  ok: true;
  leadId: string;
  conversationId: string;
  messageId: string;
  providerMessageSid: string;
  deliveryStatus: string;
  transportMode: "twilio" | "simulator";
};

export async function sendAndStoreWhatsAppMessage(input: Scope & {
  to: string;
  leadId?: string;
  body?: string;
  contact?: LeadKnowledgeContact;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}): Promise<WhatsAppSendResult> {
  const sender = await getWorkspaceWhatsAppSender(input);
  if (sender?.transportMode === "simulator") {
    return sendAndStoreSimulatedWhatsAppMessage({
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      leadId: input.leadId,
      to: input.to,
      body: input.body,
      contact: input.contact
    });
  }

  const stored = await sendAndStoreTwilioWhatsAppMessage(input);
  return {
    ok: true,
    leadId: stored.message.leadId,
    conversationId: stored.message.conversationId,
    messageId: stored.message.id,
    providerMessageSid: stored.message.providerMessageSid ?? stored.message.externalId,
    deliveryStatus: stored.message.deliveryStatus ?? "queued",
    transportMode: "twilio"
  };
}
