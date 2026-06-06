import {
  appendTwilioOutboundMessage,
  saveTwilioInboundMessage,
  type LeadKnowledgeContact
} from "./lead-knowledge-store";
import {
  normalizeWorkspaceWhatsAppNumber,
  upsertWorkspaceWhatsAppSender
} from "./workspace-whatsapp-sender-store";

export const twilioSimulatorHandle = "Leadsy Simulator";
export const twilioSimulatorStatusReason = "Simulation mode: no external WhatsApp delivery.";

type Scope = {
  tenantId: string;
  ownerId: string;
};

type GenericWhatsAppSendResult = {
  ok: true;
  leadId: string;
  conversationId: string;
  messageId: string;
  providerMessageSid: string;
  deliveryStatus: string;
  transportMode: "simulator";
};

function simulatorSid(prefix: "SIMIN" | "SIMOUT") {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`;
}

export function normalizeSimulatorWhatsAppAddress(value: string) {
  return normalizeWorkspaceWhatsAppNumber({ whatsappNumber: value })?.twilioFrom;
}

export async function ensureWorkspaceTwilioSimulator(input: Scope & { businessName?: string }) {
  return upsertWorkspaceWhatsAppSender({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    businessName: input.businessName,
    transportMode: "simulator",
    simulatorHandle: twilioSimulatorHandle,
    status: "approved",
    statusReason: twilioSimulatorStatusReason
  });
}

export async function saveSimulatedTwilioInboundMessage(input: Scope & {
  from: string;
  body: string;
  profileName?: string;
  receivedAt?: string;
}) {
  const from = normalizeSimulatorWhatsAppAddress(input.from);
  if (!from) throw new Error("A valid simulated WhatsApp lead phone is required.");

  return saveTwilioInboundMessage({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    source: "twilio_simulator",
    leadSource: "Twilio Simulator",
    messageSid: simulatorSid("SIMIN"),
    from,
    to: "whatsapp:leadsy-simulator",
    body: input.body,
    profileName: input.profileName,
    receivedAt: input.receivedAt,
    deliveryStatus: "received",
    raw: {
      source: "twilio_simulator",
      simulatorHandle: twilioSimulatorHandle,
      externalDelivery: false
    }
  });
}

export async function sendAndStoreSimulatedWhatsAppMessage(input: Scope & {
  to: string;
  leadId?: string;
  body?: string;
  contact?: LeadKnowledgeContact;
}): Promise<GenericWhatsAppSendResult & Awaited<ReturnType<typeof appendTwilioOutboundMessage>>> {
  const to = normalizeSimulatorWhatsAppAddress(input.to);
  if (!to) throw new Error("A valid simulated WhatsApp recipient is required.");

  const stored = await appendTwilioOutboundMessage({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    source: "twilio_simulator",
    leadSource: "Twilio Simulator",
    messageSid: simulatorSid("SIMOUT"),
    to,
    from: `simulator:${twilioSimulatorHandle}`,
    body: input.body,
    leadId: input.leadId,
    contact: input.contact,
    deliveryStatus: "simulated_delivered",
    raw: {
      source: "twilio_simulator",
      simulatorHandle: twilioSimulatorHandle,
      externalDelivery: false
    }
  });

  return {
    ok: true,
    leadId: stored.message.leadId,
    conversationId: stored.message.conversationId,
    messageId: stored.message.id,
    providerMessageSid: stored.message.providerMessageSid ?? stored.message.externalId,
    deliveryStatus: stored.message.deliveryStatus ?? "simulated_delivered",
    transportMode: "simulator",
    ...stored
  };
}
