import { selectLeadsyAiModel, shouldUseRemoteAi, type LeadsyAiTask } from "@leadsy/ai";
import type { OpenRouterUsageCost } from "@leadsy/domain";
import { getAiWorkspaceSettings } from "./user-settings-store";
import type { LeadAiContext } from "./agent-runtime";

type Scope = {
  tenantId: string;
  ownerId: string;
};

export type LeadAiReplyPurpose = "initial_outbound" | "qualification_reply" | "qualified_handoff";

export type LeadAiReplyResult = {
  reply: string;
  extractedFields: Record<string, string>;
  crmNote?: string;
  nextMissingField?: string;
  shouldEscalate: boolean;
  confidence: number;
  provider: "openrouter" | "deterministic";
  cost?: OpenRouterUsageCost;
};

type LeadAiRuntimeContext = LeadAiContext & {
  aiSettings: Awaited<ReturnType<typeof getAiWorkspaceSettings>>;
};

type OpenRouterResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number | string;
    total_cost?: number | string;
  };
};

const coreFields = ["company", "need", "budget", "timeline", "authority"] as const;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function compactList(values: unknown, fallback: string[] = []) {
  return Array.isArray(values)
    ? values.map(clean).filter(Boolean).slice(0, 12)
    : fallback;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function usdInrRate() {
  const parsed = parseNumber(process.env.USD_INR_RATE);
  return {
    base: "USD" as const,
    quote: "INR" as const,
    rate: parsed ?? 83,
    source: parsed ? ("env" as const) : ("default" as const),
    fetchedAt: nowIso()
  };
}

function openRouterCostFromResponse(response: OpenRouterResponse, stage: OpenRouterUsageCost["stage"]): OpenRouterUsageCost | undefined {
  const usage = response.usage;
  if (!usage) return undefined;
  const costUsd = parseNumber(usage.cost) ?? parseNumber(usage.total_cost) ?? 0;
  if (costUsd < 0) return undefined;
  const fx = usdInrRate();
  return {
    provider: "openrouter",
    stage,
    model: response.model,
    generationId: response.id,
    finishReason: response.choices?.[0]?.finish_reason ?? undefined,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    costUsd,
    costInr: costUsd * fx.rate,
    fx,
    createdAt: nowIso()
  };
}

function parseJsonFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try {
      return JSON.parse(match[0]);
    } catch {
      return undefined;
    }
  }
}

function fieldValue(context: LeadAiContext, field: string) {
  return clean(context.qualificationFields[field]);
}

function leadName(context: LeadAiContext) {
  return clean(context.lead.contact.displayName).split(/\s+/)[0] || "there";
}

function workspaceServicePhrase(context: LeadAiContext) {
  const services = compactList(context.workspace.services);
  if (services.length) return services.slice(0, 3).join(", ");
  if (/content|marketing|seo|linkedin/i.test(`${context.workspace.industry} ${context.workspace.businessName}`)) {
    return "content marketing";
  }
  return "your sales process";
}

function fieldQuestion(field: string, context: LeadAiContext) {
  const company = fieldValue(context, "company");
  const need = fieldValue(context, "need");
  const servicePhrase = workspaceServicePhrase(context);
  if (field === "company") return "Which company or brand is this for?";
  if (field === "need") return `What ${servicePhrase} outcome should we focus on first?`;
  if (field === "budget") return `What monthly budget range should we plan around${company ? ` for ${company}` : ""}?`;
  if (field === "timeline") return `When would you like to start${need ? ` with ${need}` : ""}?`;
  if (field === "authority") return "Who will approve the plan before we move ahead?";
  return "What is the next detail I should know?";
}

function nextMissingField(context: LeadAiContext) {
  return coreFields.find((field) => !fieldValue(context, field));
}

function deterministicReply(context: LeadAiRuntimeContext, purpose: LeadAiReplyPurpose, options: { ownerName?: string; slotText?: string } = {}): LeadAiReplyResult {
  const firstName = leadName(context);
  const agentName = clean(context.member?.name) || "Leadsy";
  const company = fieldValue(context, "company");
  const need = fieldValue(context, "need");
  const servicePhrase = workspaceServicePhrase(context);
  const missing = nextMissingField(context);
  const knownLine = company && need
    ? `${company} is looking at ${need}.`
    : company
      ? `This is for ${company}.`
      : need
        ? `You are looking at ${need}.`
        : `I can help with ${servicePhrase}.`;

  if (purpose === "qualified_handoff") {
    const reply = options.slotText
      ? `Thanks ${firstName}. ${options.ownerName ?? "Our sales owner"} has time at ${options.slotText}. Which slot works for you?`
      : `Thanks ${firstName}. ${options.ownerName ?? "Our sales owner"} will take this forward with the next step.`;
    return { reply, extractedFields: {}, shouldEscalate: false, confidence: 0.62, provider: "deterministic" };
  }

  const question = missing ? fieldQuestion(missing, context) : "Would you like me to route this to the right sales owner?";
  const reply = purpose === "initial_outbound"
    ? `Hi ${firstName}, I am ${agentName} from ${clean(context.workspace.businessName) || "Leadsy"}. ${knownLine} ${question}`
    : `${knownLine} ${question}`;
  return { reply, extractedFields: {}, nextMissingField: missing, shouldEscalate: false, confidence: 0.55, provider: "deterministic" };
}

function aiTaskForPurpose(purpose: LeadAiReplyPurpose): LeadsyAiTask {
  return purpose === "qualified_handoff" ? "calendar-reply" : "qualification-reply";
}

function stageForPurpose(purpose: LeadAiReplyPurpose): OpenRouterUsageCost["stage"] {
  if (purpose === "initial_outbound") return "initial-outreach";
  return purpose === "qualified_handoff" ? "qualification-reply" : "qualification-reply";
}

function envForTask(context: LeadAiRuntimeContext, task: LeadsyAiTask): Record<string, string | undefined> {
  const settings = context.aiSettings;
  const route = settings.taskRouting[task] ?? settings.taskRouting["qualification-reply"];
  return {
    ...process.env,
    AI_PROVIDER: settings.providerMode,
    LEADSY_ENABLE_REMOTE_AI: settings.remoteAiEnabled ? "true" : "",
    LEADSY_ALLOW_PAID_AI_MODELS: settings.costMode === "paid" || settings.costMode === "premium" ? "true" : "",
    LEADSY_ALLOW_EXPENSIVE_AI_MODELS: settings.costMode === "premium" ? "true" : "",
    LEADSY_AI_COST_MODE: settings.costMode,
    LEADSY_ROUTINE_MODEL: route?.model
  };
}

function contextForPrompt(context: LeadAiRuntimeContext, purpose: LeadAiReplyPurpose, options: { ownerName?: string; slotText?: string }) {
  return {
    purpose,
    lead: {
      name: context.lead.contact.displayName,
      phone: context.lead.contact.phone || context.lead.contact.waId,
      company: fieldValue(context, "company"),
      need: fieldValue(context, "need"),
      budget: fieldValue(context, "budget"),
      timeline: fieldValue(context, "timeline"),
      authority: fieldValue(context, "authority"),
      status: context.lead.crmStatus,
      stage: context.lead.qualificationStage,
      owner: context.lead.assigneeName,
      facts: context.lead.facts.slice(-10)
    },
    missingFields: context.missingFields,
    recentMessages: context.recentMessages,
    internalNotes: context.internalNotes,
    assignmentHistory: context.assignmentHistory.slice(-6),
    openTasks: context.openTasks.slice(0, 6),
    workspace: context.workspace,
    operator: context.operator,
    agent: context.member
      ? {
          name: context.member.name,
          type: context.member.type,
          role: context.member.role,
          stages: context.member.pipelineStages,
          instructions: context.member.behaviorInstructions,
          autoReplyEnabled: context.member.autoReplyEnabled
        }
      : undefined,
    handoff: options
  };
}

function normalizeExtractedFields(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, item]) => [key, clean(item)])
      .filter(([, item]) => item)
  );
}

function resultFromUnknown(value: unknown): Omit<LeadAiReplyResult, "provider" | "cost"> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const reply = clean(record.reply);
  if (!reply) return undefined;
  const confidence = parseNumber(record.confidence);
  return {
    reply,
    extractedFields: normalizeExtractedFields(record.extractedFields),
    crmNote: clean(record.crmNote) || undefined,
    nextMissingField: clean(record.nextMissingField) || undefined,
    shouldEscalate: record.shouldEscalate === true,
    confidence: confidence === undefined ? 0.7 : Math.max(0, Math.min(1, confidence))
  };
}

export async function recordLeadAiUsage(input: Scope & {
  agent: string;
  purpose: LeadAiReplyPurpose;
  cost?: OpenRouterUsageCost;
  inputSummary: string;
  outputSummary: string;
}) {
  if (!input.cost) return undefined;
  const { appendAiUsageAgentRun } = await import("./ai-usage-store");
  return appendAiUsageAgentRun({
    id: `agent_${input.purpose}_${crypto.randomUUID()}`,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    agent: input.agent,
    cost: input.cost,
    displayTitle:
      input.purpose === "initial_outbound"
        ? "Initial Outreach AI"
        : input.purpose === "qualified_handoff"
          ? "Qualification Handoff AI"
          : "Qualification AI Reply",
    displaySummary: input.outputSummary,
    outputSummary: input.outputSummary,
    inputSummary: input.inputSummary
  });
}

export async function generateLeadAiReply(input: Scope & {
  context: LeadAiContext;
  purpose: LeadAiReplyPurpose;
  ownerName?: string;
  slotText?: string;
}): Promise<LeadAiReplyResult> {
  const task = aiTaskForPurpose(input.purpose);
  const settings = await getAiWorkspaceSettings(input);
  const context = { ...input.context, aiSettings: settings };
  const route = settings.taskRouting[task] ?? settings.taskRouting["qualification-reply"];
  const fallback = deterministicReply(context, input.purpose, { ownerName: input.ownerName, slotText: input.slotText });
  const env = envForTask(context, task);
  const selection = selectLeadsyAiModel(task, env);
  if (!route?.enabled || !shouldUseRemoteAi(env) || selection.provider !== "openrouter" || !selection.model || !env.OPENROUTER_API_KEY?.trim()) {
    return fallback;
  }

  try {
    const response = await fetch(`${env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1"}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "content-type": "application/json",
        "http-referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "x-title": "Leadsy Qualification AI"
      },
      body: JSON.stringify({
        model: selection.model,
        messages: [
          {
            role: "system",
            content:
              "You are a human-sounding sales teammate inside Leadsy. Use only the provided CRM context. Extract qualification facts from the latest conversation. Ask at most one clear question. Do not mention internal automation, routing, OpenRouter, or model details. Never invent facts. Return JSON only."
          },
          {
            role: "user",
            content: JSON.stringify(contextForPrompt(context, input.purpose, { ownerName: input.ownerName, slotText: input.slotText }))
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "lead_qualification_reply",
            strict: false,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: { type: "string" },
                extractedFields: {
                  type: "object",
                  additionalProperties: { type: "string" }
                },
                crmNote: { type: "string" },
                nextMissingField: { type: "string" },
                shouldEscalate: { type: "boolean" },
                confidence: { type: "number" }
              },
              required: ["reply", "extractedFields", "crmNote", "nextMissingField", "shouldEscalate", "confidence"]
            }
          }
        },
        temperature: settings.temperature,
        max_tokens: settings.maxTokens
      })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(text.slice(0, 300) || `OpenRouter failed with ${response.status}`);
    const payload = JSON.parse(text) as OpenRouterResponse;
    const parsed = resultFromUnknown(parseJsonFromText(payload.choices?.[0]?.message?.content ?? ""));
    if (!parsed) return fallback;
    const cost = openRouterCostFromResponse(payload, stageForPurpose(input.purpose));
    await recordLeadAiUsage({
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      agent: clean(context.member?.name) || "qualification-agent",
      purpose: input.purpose,
      cost,
      inputSummary: `${input.purpose} for ${context.lead.contact.displayName || context.lead.id}`,
      outputSummary: parsed.crmNote || parsed.reply
    });
    return { ...parsed, provider: "openrouter", cost };
  } catch {
    return fallback;
  }
}
