export const twilioWhatsAppMessageFeeUsd = 0.005;

export type WhatsAppPricingEstimateInput = {
  workspaceCount: number;
  inboundMessages: number;
  outboundFreeformMessages: number;
  utilityTemplates: number;
  marketingTemplates: number;
  authenticationTemplates: number;
  phoneNumberMonthlyUsd: number;
  metaUtilityTemplateFeeUsd: number;
  metaMarketingTemplateFeeUsd: number;
  metaAuthenticationTemplateFeeUsd: number;
  fxRateInr: number;
};

export type WhatsAppPricingEstimate = {
  workspaceCount: number;
  totalMessageCount: number;
  templateMessageCount: number;
  twilioMessageFeesUsd: number;
  phoneNumberFeesUsd: number;
  metaTemplateFeesUsd: number;
  totalUsd: number;
  totalInr: number;
  simulatorMonthlyUsd: number;
};

function amount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculateTwilioPricingEstimate(input: WhatsAppPricingEstimateInput): WhatsAppPricingEstimate {
  const workspaceCount = amount(input.workspaceCount);
  const inboundMessages = amount(input.inboundMessages);
  const outboundFreeformMessages = amount(input.outboundFreeformMessages);
  const utilityTemplates = amount(input.utilityTemplates);
  const marketingTemplates = amount(input.marketingTemplates);
  const authenticationTemplates = amount(input.authenticationTemplates);
  const templateMessageCount = utilityTemplates + marketingTemplates + authenticationTemplates;
  const totalMessageCount = inboundMessages + outboundFreeformMessages + templateMessageCount;
  const twilioMessageFeesUsd = totalMessageCount * twilioWhatsAppMessageFeeUsd;
  const phoneNumberFeesUsd = workspaceCount * amount(input.phoneNumberMonthlyUsd);
  const metaTemplateFeesUsd =
    utilityTemplates * amount(input.metaUtilityTemplateFeeUsd) +
    marketingTemplates * amount(input.metaMarketingTemplateFeeUsd) +
    authenticationTemplates * amount(input.metaAuthenticationTemplateFeeUsd);
  const totalUsd = twilioMessageFeesUsd + phoneNumberFeesUsd + metaTemplateFeesUsd;
  return {
    workspaceCount,
    totalMessageCount,
    templateMessageCount,
    twilioMessageFeesUsd,
    phoneNumberFeesUsd,
    metaTemplateFeesUsd,
    totalUsd,
    totalInr: totalUsd * amount(input.fxRateInr),
    simulatorMonthlyUsd: 0
  };
}
