import type {
  AssistantSettings,
  ChatMessage,
  ChatSiteProfile,
  ConversationLog,
  DomSnapshot,
  KnowledgeContext,
  ResponderDecision
} from "./types";
import { buildProfileDetectionPrompt, normalizeProfileFromAi } from "./profile";
import { censorProfanity } from "./profanity";

export type ChatRole = "system" | "user" | "assistant";

export interface OpenRouterMessage {
  role: ChatRole;
  content: string;
}

export interface OpenRouterClientOptions {
  apiKey: string;
  modelId: string;
  fallbackModelIds?: string[];
  temperature: number;
  maxTokens: number;
  fetchFn?: typeof fetch;
}

export class OpenRouterClient {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: OpenRouterClientOptions) {
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  async detectProfile(snapshot: DomSnapshot, messages: ChatMessage[]): Promise<ChatSiteProfile> {
    const parsed = await this.completeJson<Partial<ChatSiteProfile>>([
      {
        role: "system",
        content:
          "You detect web chat DOM selectors. Return only a compact JSON object, no markdown, no explanation."
      },
      {
        role: "user",
        content: buildProfileDetectionPrompt(snapshot, messages)
      }
    ]);

    return normalizeProfileFromAi(parsed, snapshot.siteFingerprint);
  }

  async decideReply(
    chat: ConversationLog,
    messages: ChatMessage[],
    knowledge: KnowledgeContext,
    settings: AssistantSettings
  ): Promise<ResponderDecision> {
    const parsed = await this.completeJson<ResponderDecision>([
      {
        role: "system",
        content: [
          "You are a private browser extension auto-responder.",
          "Return only JSON shaped as ResponderDecision: action, replyText, confidence, reason, tags, optional leadFields, optional supportMetadata.",
          "Use action=pause when escalation is safer than replying.",
          "For casual personal chats, greetings, jokes, and ambiguous friendly messages, send a short natural friendly reply. Do not require sales or support intent.",
          "Do not pause solely because the user used profanity, insults, flirtation, or unclear intent. Reply calmly, keep boundaries, and ask what they need.",
          "For ordinary emotional support, loneliness, sadness, stress, or anxiety, do not claim to be a therapist or human. Send a warm, supportive, non-clinical reply and invite the person to share what they need.",
          "Pause only for self-harm, suicide, immediate danger, threats, abuse, medical emergency, legal or financial advice, credentials/payment-card data, or explicit human/manager escalation.",
          "Censor profanity in your reply text using asterisks.",
          settings.escalationRules.join("\n")
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            businessPrompt: knowledge.businessPrompt,
            supportNotes: knowledge.supportNotes,
            leadQualificationHints: knowledge.leadQualificationHints,
            chatFingerprint: chat.chatFingerprint,
            recentMessages: messages.slice(-20).map((message) => ({
              ...message,
              text: censorProfanity(message.text)
            }))
          },
          null,
          2
        )
      }
    ]);

    return {
      action: parsed.action === "send" ? "send" : "pause",
      replyText: censorProfanity(String(parsed.replyText || "")),
      confidence: Number(parsed.confidence || 0),
      reason: String(parsed.reason || "No reason supplied."),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      leadFields: parsed.leadFields,
      supportMetadata: parsed.supportMetadata
    };
  }

  private async completeJson<T>(messages: OpenRouterMessage[]): Promise<T> {
    if (!this.options.apiKey) {
      throw new Error("Missing OpenRouter API key. Add VITE_OPENROUTER_API_KEY to .env.local.");
    }

    const modelIds = Array.from(new Set([this.options.modelId, ...(this.options.fallbackModelIds || [])]));
    const failures: string[] = [];

    for (const modelId of modelIds) {
      try {
        const content = await this.completeWithModel(modelId, messages);
        return parseStrictJsonObject<T>(content);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown OpenRouter failure";
        failures.push(`${modelId}: ${message}`);
        if (!shouldTryFallback(message)) {
          break;
        }
      }
    }

    throw new Error(`OpenRouter request failed for all configured cheap models. ${failures.join(" | ")}`);
  }

  private async complete(messages: OpenRouterMessage[]): Promise<string> {
    if (!this.options.apiKey) {
      throw new Error("Missing OpenRouter API key. Add VITE_OPENROUTER_API_KEY to .env.local.");
    }

    const modelIds = Array.from(new Set([this.options.modelId, ...(this.options.fallbackModelIds || [])]));
    const failures: string[] = [];

    for (const modelId of modelIds) {
      try {
        return await this.completeWithModel(modelId, messages);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown OpenRouter failure";
        failures.push(`${modelId}: ${message}`);
        if (!shouldTryFallback(message)) {
          break;
        }
      }
    }

    throw new Error(`OpenRouter request failed for all configured cheap models. ${failures.join(" | ")}`);
  }

  private async completeWithModel(modelId: string, messages: OpenRouterMessage[]): Promise<string> {
    const response = await this.fetchFn("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "chrome-extension://leadsy-chat-auto-responder",
        "X-Title": "Leadsy Chat Auto Responder"
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        response_format: { type: "json_object" },
        temperature: this.options.temperature,
        max_tokens: this.options.maxTokens
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter request failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as {
      model?: string;
      provider?: string;
      choices?: Array<{
        finish_reason?: string | null;
        native_finish_reason?: string | null;
        message?: { content?: string | null; refusal?: string | null };
      }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      const firstChoice = data.choices?.[0];
      throw new Error(
        [
          "OpenRouter returned no message content.",
          `model=${data.model || "unknown"}`,
          `provider=${data.provider || "unknown"}`,
          `finish=${firstChoice?.finish_reason || "unknown"}`,
          `native=${firstChoice?.native_finish_reason || "unknown"}`,
          `refusal=${firstChoice?.message?.refusal || "none"}`
        ].join(" ")
      );
    }
    return content;
  }
}

function shouldTryFallback(message: string): boolean {
  return (
    message.includes("returned no message content") ||
    message.includes("valid JSON object") ||
    message.includes(" 429 ") ||
    message.includes(" 400 ") ||
    message.includes("Provider returned error") ||
    message.includes(" 500 ") ||
    message.includes(" 502 ") ||
    message.includes(" 503 ") ||
    message.includes(" 504 ")
  );
}

export function parseStrictJsonObject<T>(text: string): T {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("OpenRouter response did not contain a valid JSON object");
  }

  try {
    const parsed = JSON.parse(withoutFence.slice(start, end + 1));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Parsed value was not an object");
    }
    return parsed as T;
  } catch (error) {
    throw new Error(
      `OpenRouter response did not contain a valid JSON object: ${
        error instanceof Error ? error.message : "unknown parse error"
      }`
    );
  }
}
