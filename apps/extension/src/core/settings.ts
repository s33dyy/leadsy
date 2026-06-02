import type { AssistantSettings } from "./types";

export const defaultAssistantSettings: AssistantSettings = {
  modelId: import.meta.env.VITE_OPENROUTER_MODEL || "openrouter/free",
  fallbackModelIds: (import.meta.env.VITE_OPENROUTER_FALLBACK_MODELS ||
    "inclusionai/ling-2.6-flash,mistralai/mistral-nemo")
    .split(",")
    .map((model: string) => model.trim())
    .filter(Boolean),
  fallbackBusinessPrompt:
    "You are a general friendly chat assistant for open web chats. For casual personal messages, reply naturally, warmly, and briefly without forcing a sales or support angle. If the chat becomes customer support or lead qualification, answer with the available context, ask one useful follow-up question, and guide toward a practical next step.",
  escalationRules: [
    "Do not pause solely for casual greetings, ordinary emotional support, loneliness, sadness, stress, anxiety, profanity, flirtation, or unclear intent. Reply warmly and non-clinically.",
    "Pause only for self-harm, suicide, immediate danger, threats, abuse, medical emergency, legal or financial advice, credentials, payment-card data, police/lawsuit, or an explicit request for a human or manager.",
    "Pause when confidence is below 0.6 or facts are missing."
  ],
  requireFirstReplyApproval: false,
  temperature: 0.35,
  maxTokens: 350
};

export function getOpenRouterApiKey(): string {
  return import.meta.env.VITE_OPENROUTER_API_KEY || "";
}
