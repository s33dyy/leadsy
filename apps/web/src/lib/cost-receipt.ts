import "server-only";

import type { OpenRouterUsageCost } from "@leadsy/domain";
import { listTenantAiUsageRuns } from "./ai-usage-store";
import { listTenantLeadKnowledgeRecords, type LeadKnowledgeMessage } from "./lead-knowledge-store";
import { twilioWhatsAppMessageFeeUsd } from "./whatsapp-pricing-estimator";

type Scope = {
  tenantId: string;
  ownerId: string;
};

export type CostReceiptCategory = "twilio" | "twilio_simulated" | "conversation" | "openrouter";

export type CostReceiptLineItem = {
  id: string;
  category: CostReceiptCategory;
  provider: string;
  label: string;
  detail: string;
  quantity: number;
  unitLabel: string;
  unitCostUsd: number;
  amountUsd: number;
  amountInr: number;
  occurredAt: string;
  model?: string;
  generationId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type CostReceipt = {
  checkedAt: string;
  currency: "INR";
  fxRateInr: number;
  fxSource: "env" | "default";
  assumptions: string[];
  summary: {
    totalUsd: number;
    totalInr: number;
    twilio: {
      billableMessages: number;
      inboundMessages: number;
      outboundMessages: number;
      projectedSimulatorMessages: number;
      messageFeeUsd: number;
      projectedSimulatorUsd: number;
      projectedSimulatorInr: number;
      totalUsd: number;
      totalInr: number;
    };
    conversations: {
      trackedConversations: number;
      trackedMessages: number;
      simulatedMessages: number;
      totalUsd: number;
      totalInr: number;
    };
    openrouter: {
      requests: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      totalUsd: number;
      totalInr: number;
    };
  };
  lineItems: CostReceiptLineItem[];
};

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 1_000_000) / 1_000_000;
}

function envNumber(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getFxSnapshot() {
  const envRate = process.env.USD_INR_RATE?.trim();
  const parsed = envRate ? Number(envRate) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return { rate: parsed, source: "env" as const };
  }
  return { rate: 83, source: "default" as const };
}

function twilioMessageFeeUsd() {
  return envNumber("LEADSY_TWILIO_WHATSAPP_MESSAGE_FEE_USD", envNumber("TWILIO_WHATSAPP_MESSAGE_FEE_USD", twilioWhatsAppMessageFeeUsd));
}

function isExternalWhatsAppMessage(message: LeadKnowledgeMessage) {
  return message.channel === "whatsapp" && message.source === "twilio" && (message.direction === "inbound" || message.direction === "outbound");
}

function isSimulatorWhatsAppMessage(message: LeadKnowledgeMessage) {
  return message.channel === "whatsapp" && message.source === "twilio_simulator" && (message.direction === "inbound" || message.direction === "outbound");
}

function latestTimestamp(messages: LeadKnowledgeMessage[], fallback: string) {
  return messages
    .map((message) => message.sentAt || message.receivedAt || fallback)
    .sort()
    .at(-1) ?? fallback;
}

function generationParts(cost: OpenRouterUsageCost) {
  return (cost.generationId ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function shouldIncludeOpenRouterCost(cost: OpenRouterUsageCost, fallbackKey: string, seen: Set<string>) {
  const ids = generationParts(cost);
  if (!ids.length) {
    if (seen.has(fallbackKey)) return false;
    seen.add(fallbackKey);
    return true;
  }
  if (ids.every((id) => seen.has(id))) return false;
  for (const id of ids) seen.add(id);
  return true;
}

function openRouterLineItem(input: {
  id: string;
  label: string;
  detail: string;
  cost: OpenRouterUsageCost;
  fxRateInr: number;
}): CostReceiptLineItem {
  return {
    id: input.id,
    category: "openrouter",
    provider: "OpenRouter",
    label: input.label,
    detail: input.detail,
    quantity: 1,
    unitLabel: "request",
    unitCostUsd: roundMoney(input.cost.costUsd),
    amountUsd: roundMoney(input.cost.costUsd),
    amountInr: roundMoney(input.cost.costInr || input.cost.costUsd * input.fxRateInr),
    occurredAt: input.cost.createdAt,
    model: input.cost.model,
    generationId: input.cost.generationId,
    promptTokens: input.cost.promptTokens,
    completionTokens: input.cost.completionTokens,
    totalTokens: input.cost.totalTokens
  };
}

export async function getCostReceipt(scope: Scope): Promise<CostReceipt> {
  const checkedAt = new Date().toISOString();
  const fx = getFxSnapshot();
  const messageFeeUsd = twilioMessageFeeUsd();
  const records = await listTenantLeadKnowledgeRecords(scope.tenantId);
  const aiUsage = await listTenantAiUsageRuns(scope.tenantId);
  const messages = records.flatMap((record) => record.messages);
  const billableMessages = messages.filter(isExternalWhatsAppMessage);
  const simulatorMessages = messages.filter(isSimulatorWhatsAppMessage);
  const trackedConversationIds = new Set(records.flatMap((record) => record.conversations.map((conversation) => conversation.id)));
  const inboundMessages = billableMessages.filter((message) => message.direction === "inbound");
  const outboundMessages = billableMessages.filter((message) => message.direction === "outbound");
  const lineItems: CostReceiptLineItem[] = [];

  const inboundAmountUsd = inboundMessages.length * messageFeeUsd;
  if (inboundMessages.length) {
    lineItems.push({
      id: "twilio_whatsapp_inbound",
      category: "twilio",
      provider: "Twilio WhatsApp",
      label: "Inbound WhatsApp messages",
      detail: "Lead messages received through the real Twilio WhatsApp transport.",
      quantity: inboundMessages.length,
      unitLabel: "message",
      unitCostUsd: messageFeeUsd,
      amountUsd: roundMoney(inboundAmountUsd),
      amountInr: roundMoney(inboundAmountUsd * fx.rate),
      occurredAt: latestTimestamp(inboundMessages, checkedAt)
    });
  }

  const outboundAmountUsd = outboundMessages.length * messageFeeUsd;
  if (outboundMessages.length) {
    lineItems.push({
      id: "twilio_whatsapp_outbound",
      category: "twilio",
      provider: "Twilio WhatsApp",
      label: "Outbound WhatsApp replies",
      detail: "Replies sent through the real Twilio WhatsApp transport.",
      quantity: outboundMessages.length,
      unitLabel: "message",
      unitCostUsd: messageFeeUsd,
      amountUsd: roundMoney(outboundAmountUsd),
      amountInr: roundMoney(outboundAmountUsd * fx.rate),
      occurredAt: latestTimestamp(outboundMessages, checkedAt)
    });
  }

  const simulatorInboundMessages = simulatorMessages.filter((message) => message.direction === "inbound");
  const simulatorOutboundMessages = simulatorMessages.filter((message) => message.direction === "outbound");
  const simulatorProjectedAmountUsd = simulatorMessages.length * messageFeeUsd;
  const simulatorProjectedAmountInr = simulatorProjectedAmountUsd * fx.rate;

  if (simulatorInboundMessages.length) {
    const amountUsd = simulatorInboundMessages.length * messageFeeUsd;
    lineItems.push({
      id: "simulator_whatsapp_inbound_projected",
      category: "twilio_simulated",
      provider: "Twilio-equivalent simulator",
      label: "Simulated inbound WhatsApp messages",
      detail: "Projected Twilio-equivalent burn for inbound simulator messages. These were not externally delivered or charged.",
      quantity: simulatorInboundMessages.length,
      unitLabel: "message",
      unitCostUsd: messageFeeUsd,
      amountUsd: roundMoney(amountUsd),
      amountInr: roundMoney(amountUsd * fx.rate),
      occurredAt: latestTimestamp(simulatorInboundMessages, checkedAt)
    });
  }

  if (simulatorOutboundMessages.length) {
    const amountUsd = simulatorOutboundMessages.length * messageFeeUsd;
    lineItems.push({
      id: "simulator_whatsapp_outbound_projected",
      category: "twilio_simulated",
      provider: "Twilio-equivalent simulator",
      label: "Simulated outbound WhatsApp replies",
      detail: "Projected Twilio-equivalent burn for outbound simulator replies. These were not externally delivered or charged.",
      quantity: simulatorOutboundMessages.length,
      unitLabel: "message",
      unitCostUsd: messageFeeUsd,
      amountUsd: roundMoney(amountUsd),
      amountInr: roundMoney(amountUsd * fx.rate),
      occurredAt: latestTimestamp(simulatorOutboundMessages, checkedAt)
    });
  }

  if (simulatorMessages.length) {
    lineItems.push({
      id: "simulator_whatsapp_messages",
      category: "conversation",
      provider: "Leadsy Simulator",
      label: "Simulator conversation records",
      detail: "Internal simulator messages stored in Leadsy. Transport rows above show projected Twilio-equivalent burn only.",
      quantity: simulatorMessages.length,
      unitLabel: "message",
      unitCostUsd: 0,
      amountUsd: 0,
      amountInr: 0,
      occurredAt: latestTimestamp(simulatorMessages, checkedAt)
    });
  }

  if (trackedConversationIds.size) {
    lineItems.push({
      id: "tracked_conversations",
      category: "conversation",
      provider: "Leadsy CRM",
      label: "Tracked conversations",
      detail: "Conversation records are CRM state and do not add transport cost by themselves.",
      quantity: trackedConversationIds.size,
      unitLabel: "conversation",
      unitCostUsd: 0,
      amountUsd: 0,
      amountInr: 0,
      occurredAt: latestTimestamp(messages, checkedAt)
    });
  }

  const seenGenerationIds = new Set<string>();
  for (const run of aiUsage.agentRuns) {
    if (!run.cost || run.cost.provider !== "openrouter") continue;
    if (!shouldIncludeOpenRouterCost(run.cost, `agent:${run.id}`, seenGenerationIds)) continue;
    lineItems.push(
      openRouterLineItem({
        id: `openrouter_agent_${run.id}`,
        label: run.displayTitle || `${run.agent.replace(/-/g, " ")} AI run`,
        detail: run.displaySummary || run.outputSummary || run.inputSummary || "AI usage recorded by Leadsy.",
        cost: run.cost,
        fxRateInr: fx.rate
      })
    );
  }
  for (const run of aiUsage.runs) {
    if (!run.cost || run.cost.provider !== "openrouter") continue;
    if (!shouldIncludeOpenRouterCost(run.cost, `run:${run.id}`, seenGenerationIds)) continue;
    lineItems.push(
      openRouterLineItem({
        id: `openrouter_run_${run.id}`,
        label: run.scenarioLabel || run.runLabel || "Lead research AI run",
        detail: run.ownerSummary || run.recommendation || "AI usage recorded by Leadsy.",
        cost: run.cost,
        fxRateInr: fx.rate
      })
    );
  }

  const twilioTotalUsd = roundMoney(lineItems.filter((item) => item.category === "twilio" || item.category === "twilio_simulated").reduce((total, item) => total + item.amountUsd, 0));
  const twilioTotalInr = roundMoney(lineItems.filter((item) => item.category === "twilio" || item.category === "twilio_simulated").reduce((total, item) => total + item.amountInr, 0));
  const openRouterItems = lineItems.filter((item) => item.category === "openrouter");
  const openRouterTotalUsd = roundMoney(openRouterItems.reduce((total, item) => total + item.amountUsd, 0));
  const openRouterTotalInr = roundMoney(openRouterItems.reduce((total, item) => total + item.amountInr, 0));

  return {
    checkedAt,
    currency: "INR",
    fxRateInr: fx.rate,
    fxSource: fx.source,
    assumptions: [
      `Twilio WhatsApp message fee is ${messageFeeUsd.toFixed(3)} USD per inbound or outbound real WhatsApp message.`,
      "Simulator WhatsApp transport is projected at the Twilio-equivalent message fee so the burn total shows what the same flow would cost if externally delivered.",
      "Simulator WhatsApp messages are internal Leadsy test records and are not externally delivered or charged by Twilio.",
      "Conversation records, internal notes, and tasks are CRM state; real transport, projected simulator transport, and AI provider usage are shown separately in the receipt.",
      `USD to INR uses ${fx.source === "env" ? "USD_INR_RATE" : "the default fallback"} at ${fx.rate}.`
    ],
    summary: {
      totalUsd: roundMoney(twilioTotalUsd + openRouterTotalUsd),
      totalInr: roundMoney(twilioTotalInr + openRouterTotalInr),
      twilio: {
        billableMessages: billableMessages.length,
        inboundMessages: inboundMessages.length,
        outboundMessages: outboundMessages.length,
        projectedSimulatorMessages: simulatorMessages.length,
        messageFeeUsd,
        projectedSimulatorUsd: roundMoney(simulatorProjectedAmountUsd),
        projectedSimulatorInr: roundMoney(simulatorProjectedAmountInr),
        totalUsd: twilioTotalUsd,
        totalInr: twilioTotalInr
      },
      conversations: {
        trackedConversations: trackedConversationIds.size,
        trackedMessages: messages.filter((message) => message.direction === "inbound" || message.direction === "outbound").length,
        simulatedMessages: simulatorMessages.length,
        totalUsd: 0,
        totalInr: 0
      },
      openrouter: {
        requests: openRouterItems.length,
        promptTokens: openRouterItems.reduce((total, item) => total + (item.promptTokens ?? 0), 0),
        completionTokens: openRouterItems.reduce((total, item) => total + (item.completionTokens ?? 0), 0),
        totalTokens: openRouterItems.reduce((total, item) => total + (item.totalTokens ?? 0), 0),
        totalUsd: openRouterTotalUsd,
        totalInr: openRouterTotalInr
      }
    },
    lineItems: lineItems.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id))
  };
}
