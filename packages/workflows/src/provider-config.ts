import type { AutomationWorkflowKey } from "./automation-catalog";

export type N8nProviderConfigKey = "email";

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
    key: "email",
    label: "Operator Email Notifications",
    owner: "n8n",
    purpose: "Optional operator notifications for reminders and escalations. Outreach messages still require Leadsy approval and storage.",
    leadsyBoundary: "Leadsy keeps auth, CRM, leads, conversations, assignments, task state, and audit history.",
    fields: [
      {
        key: "provider",
        label: "Email provider",
        env: "EMAIL_PROVIDER",
        secret: false,
        required: false,
        purpose: "Selects smtp, resend, or postmark for optional operator notifications."
      },
      {
        key: "smtpHost",
        label: "SMTP host",
        env: "SMTP_HOST",
        secret: false,
        required: false,
        purpose: "SMTP host when n8n sends internal reminders."
      },
      {
        key: "smtpUser",
        label: "SMTP user",
        env: "SMTP_USER",
        secret: false,
        required: false,
        purpose: "SMTP username for internal reminder sends."
      },
      {
        key: "smtpPassword",
        label: "SMTP password",
        env: "SMTP_PASSWORD",
        secret: true,
        required: false,
        purpose: "SMTP password for internal reminder sends."
      },
      {
        key: "resendApiKey",
        label: "Resend API key",
        env: "RESEND_API_KEY",
        secret: true,
        required: false,
        purpose: "Alternative Resend credential for internal reminder sends."
      },
      {
        key: "postmarkServerToken",
        label: "Postmark server token",
        env: "POSTMARK_SERVER_TOKEN",
        secret: true,
        required: false,
        purpose: "Alternative Postmark credential for internal reminder sends."
      }
    ]
  }
];

export const n8nProviderConfigByWorkflowKey: Record<AutomationWorkflowKey, N8nProviderConfigKey[]> = {
  "follow-up-scheduled": [],
  "reminder-generated": [],
  "task-created": [],
  "escalation-triggered": []
};

export function providerConfigKeysForWorkflow(key: AutomationWorkflowKey) {
  return n8nProviderConfigByWorkflowKey[key] ?? [];
}
