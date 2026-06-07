export const twilioWhatsAppMessageFeeUsd = 0.005;

export type WhatsAppPricingEstimateInput = {
  workspaceCount: number;
  inboundMessages: number;
  outboundFreeformMessages: number;
  utilityTemplates: number;
  marketingTemplates: number;
  authenticationTemplates: number;
  phoneNumberMonthlyUsd: number;
  providerUtilityTemplateFeeUsd: number;
  providerMarketingTemplateFeeUsd: number;
  providerAuthenticationTemplateFeeUsd: number;
  fxRateInr: number;
};

export type WhatsAppPricingEstimate = {
  workspaceCount: number;
  totalMessageCount: number;
  templateMessageCount: number;
  twilioMessageFeesUsd: number;
  phoneNumberFeesUsd: number;
  providerTemplateFeesUsd: number;
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
  const providerTemplateFeesUsd =
    utilityTemplates * amount(input.providerUtilityTemplateFeeUsd) +
    marketingTemplates * amount(input.providerMarketingTemplateFeeUsd) +
    authenticationTemplates * amount(input.providerAuthenticationTemplateFeeUsd);
  const totalUsd = twilioMessageFeesUsd + phoneNumberFeesUsd + providerTemplateFeesUsd;
  return {
    workspaceCount,
    totalMessageCount,
    templateMessageCount,
    twilioMessageFeesUsd,
    phoneNumberFeesUsd,
    providerTemplateFeesUsd,
    totalUsd,
    totalInr: totalUsd * amount(input.fxRateInr),
    simulatorMonthlyUsd: 0
  };
}
