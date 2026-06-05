import type { AutomationWorkflowKey } from "./automation-catalog";

export type N8nProviderConfigKey = "meta" | "whatsapp" | "email" | "openrouter";

export type N8nProviderConfigField = {
  key: string;
  label: string;
  env: string;
  secret: boolean;
  required: boolean;
  purpose: string;
};

export type N8nProviderConfigGroup = {
  key: N8nProviderConfigKey;
  label: string;
  owner: "n8n";
  purpose: string;
  leadsyBoundary: string;
  fields: N8nProviderConfigField[];
};

export const n8nProviderConfigGroups: N8nProviderConfigGroup[] = [
  {
    key: "meta",
    label: "Meta",
    owner: "n8n",
    purpose: "Provider credentials for automation calls against Meta Graph APIs after Leadsy stores the event.",
    leadsyBoundary: "Leadsy keeps Meta OAuth, webhook verification, tenant routing, and stored communications.",
    fields: [
      {
        key: "appId",
        label: "App ID",
        env: "META_APP_ID",
        secret: false,
        required: true,
        purpose: "Identifies the Meta app used by automation calls."
      },
      {
        key: "appSecret",
        label: "App secret",
        env: "META_APP_SECRET",
        secret: true,
        required: true,
        purpose: "Signs and validates Meta app-level automation requests."
      },
      {
        key: "graphVersion",
        label: "Graph API version",
        env: "META_GRAPH_VERSION",
        secret: false,
        required: false,
        purpose: "Pins Graph API calls made by n8n provider steps."
      },
      {
        key: "leadAdsPageAccessToken",
        label: "Lead Ads page access token",
        env: "META_LEAD_ADS_PAGE_ACCESS_TOKEN",
        secret: true,
        required: false,
        purpose: "Lets n8n enrich stored Meta Lead Ads records when needed."
      }
    ]
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    owner: "n8n",
    purpose: "Provider credentials for approved WhatsApp follow-up and reply automation.",
    leadsyBoundary: "Leadsy keeps inbound WhatsApp webhook handling, storage, qualification state, and approvals.",
    fields: [
      {
        key: "businessToken",
        label: "Business API token",
        env: "WHATSAPP_BUSINESS_TOKEN",
        secret: true,
        required: true,
        purpose: "Authorizes n8n to call the WhatsApp Business Cloud API after approval."
      },
      {
        key: "phoneNumberId",
        label: "Phone number ID",
        env: "WHATSAPP_PHONE_NUMBER_ID",
        secret: false,
        required: true,
        purpose: "Selects the sending phone number for approved WhatsApp actions."
      },
      {
        key: "sendMode",
        label: "Send mode",
        env: "WHATSAPP_SEND_MODE",
        secret: false,
        required: false,
        purpose: "Keeps automation in approval-only mode until outbound sends are intentionally enabled."
      }
    ]
  },
  {
    key: "email",
    label: "Email",
    owner: "n8n",
    purpose: "Provider credentials for outbound email notifications, alerts, and approved outreach.",
    leadsyBoundary: "Leadsy keeps communication records, approvals, and audit history.",
    fields: [
      {
        key: "provider",
        label: "Email provider",
        env: "EMAIL_PROVIDER",
        secret: false,
        required: false,
        purpose: "Selects smtp, resend, or postmark in n8n branches."
      },
      {
        key: "smtpHost",
        label: "SMTP host",
        env: "SMTP_HOST",
        secret: false,
        required: false,
        purpose: "SMTP host when n8n uses direct SMTP."
      },
      {
        key: "smtpUser",
        label: "SMTP user",
        env: "SMTP_USER",
        secret: false,
        required: false,
        purpose: "SMTP username for n8n email sends."
      },
      {
        key: "smtpPassword",
        label: "SMTP password",
        env: "SMTP_PASSWORD",
        secret: true,
        required: false,
        purpose: "SMTP password for n8n email sends."
      },
      {
        key: "resendApiKey",
        label: "Resend API key",
        env: "RESEND_API_KEY",
        secret: true,
        required: false,
        purpose: "Alternative Resend credential for n8n email sends."
      },
      {
        key: "postmarkServerToken",
        label: "Postmark server token",
        env: "POSTMARK_SERVER_TOKEN",
        secret: true,
        required: false,
        purpose: "Alternative Postmark credential for n8n email sends."
      }
    ]
  },
  {
    key: "openrouter",
    label: "OpenRouter",
    owner: "n8n",
    purpose: "Provider credentials and model routing for automation research, qualification, summaries, and drafts.",
    leadsyBoundary: "Leadsy keeps AI approvals, saved outputs, cost records, and deterministic fallbacks.",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        env: "OPENROUTER_API_KEY",
        secret: true,
        required: true,
        purpose: "Authorizes n8n automation steps that call OpenRouter."
      },
      {
        key: "baseUrl",
        label: "Base URL",
        env: "OPENROUTER_BASE_URL",
        secret: false,
        required: false,
        purpose: "Overrides the default OpenRouter API base URL."
      },
      {
        key: "fastModel",
        label: "Fast model",
        env: "OPENROUTER_FAST_MODEL",
        secret: false,
        required: false,
        purpose: "Low-latency model for routine routing and summaries."
      },
      {
        key: "researchModel",
        label: "Research model",
        env: "OPENROUTER_RESEARCH_MODEL",
        secret: false,
        required: false,
        purpose: "Research model for lead intelligence jobs."
      },
      {
        key: "dossierModel",
        label: "Dossier model",
        env: "OPENROUTER_DOSSIER_MODEL",
        secret: false,
        required: false,
        purpose: "Model for heavier dossier generation."
      },
      {
        key: "sentimentModel",
        label: "Sentiment model",
        env: "OPENROUTER_SENTIMENT_MODEL",
        secret: false,
        required: false,
        purpose: "Model for conversation sentiment and intent analysis."
      }
    ]
  }
];

export const n8nProviderConfigByWorkflowKey: Record<AutomationWorkflowKey, N8nProviderConfigKey[]> = {
  "lead-added": ["openrouter"],
  "lead-updated": ["openrouter"],
  "research-requested": ["openrouter"],
  "qualification-requested": ["openrouter"],
  "task-generated": ["email"],
  "approval-requested": ["email"],
  "follow-up-due": ["whatsapp", "email", "openrouter"],
  "meta-lead-received": ["meta", "openrouter"],
  "whatsapp-message-received": ["whatsapp", "openrouter"],
  "worker-retry": ["email"]
};

export function providerConfigKeysForWorkflow(key: AutomationWorkflowKey) {
  return n8nProviderConfigByWorkflowKey[key] ?? [];
}
