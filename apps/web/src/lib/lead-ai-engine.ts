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

export type OwnerBusinessContext = {
  businessName: string;
  externalIdentity: string;
  industry?: string;
  website?: string;
  markets: string[];
  services: string[];
  servicesHandled: string[];
  communicationStyle: string;
  knowledgeBase?: string;
  fallbackUsed: boolean;
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
const platformPlaceholderPattern = /\b(leadsy|lead qualification|whatsapp follow-up|appointment booking|crm routing|assignment|bookings|follow-up automation)\b/i;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function compactList(values: unknown, fallback: string[] = []) {
  return Array.isArray(values)
    ? values.map(clean).filter(Boolean).slice(0, 12)
    : fallback;
}

function ownerList(values: unknown) {
  return compactList(values).filter((value) => !platformPlaceholderPattern.test(value));
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
  if (!usage && !response.id && !response.model) return undefined;
  const costUsd = parseNumber(usage?.cost) ?? parseNumber(usage?.total_cost) ?? 0;
  if (costUsd < 0) return undefined;
  const fx = usdInrRate();
  return {
    provider: "openrouter",
    stage,
    model: response.model,
    generationId: response.id,
    finishReason: response.choices?.[0]?.finish_reason ?? undefined,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    totalTokens: usage?.total_tokens,
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

export function buildOwnerBusinessContext(context: Pick<LeadAiContext, "workspace" | "operator">): OwnerBusinessContext {
  const businessName = clean(context.workspace.businessName);
  const safeBusinessName = businessName && !/^leadsy workspace$/i.test(businessName) && !/^leadsy$/i.test(businessName)
    ? businessName
    : "";
  const services = ownerList(context.workspace.services);
  const servicesHandled = ownerList(context.operator.servicesHandled);
  const mergedServices = [...new Set([...services, ...servicesHandled])].slice(0, 8);
  const knowledgeBase = clean(context.operator.knowledgeBase);
  const safeKnowledgeBase = knowledgeBase && !/^add operator-specific context/i.test(knowledgeBase) ? knowledgeBase : "";
  const externalIdentity = safeBusinessName ? `${safeBusinessName} team` : "our team";
  return {
    businessName: safeBusinessName || "the business",
    externalIdentity,
    industry: clean(context.workspace.industry) && !/sales operations/i.test(clean(context.workspace.industry)) ? clean(context.workspace.industry) : undefined,
    website: clean(context.workspace.website) || undefined,
    markets: ownerList(context.workspace.markets),
    services: mergedServices,
    servicesHandled,
    communicationStyle: clean(context.operator.communicationStyle) || "Concise, helpful, and consultative",
    knowledgeBase: safeKnowledgeBase || undefined,
    fallbackUsed: !safeBusinessName || mergedServices.length === 0
  };
}

function nextMissingField(context: LeadAiContext) {
  const fields = context.workspace.leadMode === "b2c"
    ? ["name", "phone", "email", "budget"]
    : coreFields;
  return fields.find((field) => !fieldValue(context, field));
}

function latestInboundBody(context: LeadAiContext) {
  return [...context.recentMessages].reverse().find((message) => message.direction === "inbound")?.body ?? "";
}

function oneQuestion(text: string) {
  const firstQuestion = text.indexOf("?");
  if (firstQuestion < 0) return text;
  return text.slice(0, firstQuestion + 1) + text.slice(firstQuestion + 1).replace(/\?/g, ".");
}

function sanitizeLeadFacingReply(text: string, context: LeadAiContext) {
  const ownerBusiness = buildOwnerBusinessContext(context);
  let reply = clean(text)
    .replace(/\bQualification AI\b/gi, ownerBusiness.externalIdentity)
    .replace(/\bfrom Leadsy\b/gi, `from ${ownerBusiness.businessName}`)
    .replace(/\bLeadsy\b/g, ownerBusiness.businessName)
    .replace(/\bqualification\b/gi, "fit")
    .replace(/\bfollow-up automation\b/gi, "next steps")
    .replace(/\bassignment\b/gi, "handoff")
    .replace(/\bbookings\b/gi, "meeting times")
    .replace(/\bCRM routing\b/gi, "team routing");
  reply = reply.replace(/\s+/g, " ").trim();
  return oneQuestion(reply);
}

function deterministicReply(context: LeadAiRuntimeContext, purpose: LeadAiReplyPurpose, options: { ownerName?: string; slotText?: string } = {}): LeadAiReplyResult {
  const firstName = leadName(context);
  const ownerBusiness = buildOwnerBusinessContext(context);
  const company = fieldValue(context, "company");
  const need = fieldValue(context, "need");
  const missing = nextMissingField(context);

  // Minimal fallback: only used when AI is unavailable
  // The real intelligence should come from OpenRouter/AI models
  if (purpose === "qualified_handoff") {
    const reply = options.slotText
      ? `Thanks ${firstName}. ${options.ownerName ?? "Our sales owner"} has time at ${options.slotText}. Which slot works for you?`
      : `Thanks ${firstName}. ${options.ownerName ?? "Our sales owner"} will take this forward with the next step.`;
    return { reply: sanitizeLeadFacingReply(reply, context), extractedFields: {}, shouldEscalate: false, confidence: 0.62, provider: "deterministic" };
  }

  // Avoid the broken loop pattern: never repeat "which company" after personal signal
  const inboundText = latestInboundBody(context);
  const hasPersonalSignal = /\b(this is for me|this is personal|personally|for myself|my own)\b/i.test(inboundText);

  if (hasPersonalSignal && missing === "company") {
    // Skip company question, ask for need instead
    const extractedName = inboundText.match(/\b(this is for|for) ([A-Z][a-z]{2,})\b/i)?.[2];
    return {
      reply: `Got it${extractedName ? `, thanks ${extractedName}` : ""}. What outcome or challenge are you looking to solve?`,
      extractedFields: { name: extractedName || "", company: "Personal/Individual" },
      nextMissingField: "need",
      shouldEscalate: false,
      confidence: 0.6,
      provider: "deterministic"
    };
  }

  const extracted: Record<string, string> = {};
  if (missing === "email") {
    const emailMatch = inboundText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) extracted.email = emailMatch[0];
  } else if (missing === "phone") {
    const phoneMatch = inboundText.match(/\+?\d{7,15}/);
    if (phoneMatch) extracted.phone = phoneMatch[0];
  }

  // If we deterministically extracted the currently missing field, we should ask the NEXT missing field
  let nextMissing = missing;
  if (missing && extracted[missing]) {
    const fields: string[] = context.workspace.leadMode === "b2c"
      ? ["name", "phone", "email", "budget"]
      : [...coreFields];
    const missingIndex = fields.indexOf(missing);
    nextMissing = fields.slice(missingIndex + 1).find((field) => !fieldValue(context, field) && !extracted[field]);
  }

  // Default fallback: ask for the next missing field, but vary the question
  const questions: Record<string, string> = {
    company: "Which company or brand is this for?",
    need: "What outcome are you hoping to achieve?",
    budget: "What budget range should we plan around?",
    timeline: "When would you like to get started?",
    authority: "Who will approve the plan before we move ahead?",
    name: "Could I have your name to update our records?",
    phone: "What is the best phone number to reach you?",
    email: "What is your email address?"
  };
  const question = nextMissing ? questions[nextMissing] || "What's the next detail I should know?" : "Would you like me to route this to the right sales owner?";

  const asksAboutServices = /\b(service|services|offer|do you do)\b/i.test(inboundText);
  if (asksAboutServices) {
    const serviceInfo = ownerBusiness.services.length > 0
      ? `We offer ${ownerBusiness.services.join(", ")}.`
      : `Our team can share our specific service details with you.`;
    return {
      reply: `${serviceInfo} ${question}`,
      extractedFields: extracted,
      shouldEscalate: false,
      confidence: 0.6,
      provider: "deterministic"
    };
  }

  const prefix = company || need || Object.keys(extracted).length > 0 ? "Got it." : "I can help with your business enquiries.";
  const initialPrefix = company && need
    ? `I see you are with ${company} and looking at ${need}.`
    : company
      ? `I see you are with ${company}.`
      : need
      ? `I see you are looking at ${need}.`
      : "I can help with your business enquiries.";

  const reply = purpose === "initial_outbound"
    ? `Hi ${firstName}, this is ${ownerBusiness.externalIdentity}. ${initialPrefix} ${question}`
    : `${prefix} ${question}`;

  return { reply: sanitizeLeadFacingReply(reply, context), extractedFields: extracted, nextMissingField: nextMissing, shouldEscalate: false, confidence: 0.55, provider: "deterministic" };
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
  const overrideRemoteAi = process.env.NODE_ENV !== "test" && Boolean(process.env.OPENROUTER_API_KEY?.trim());
  return {
    ...process.env,
    AI_PROVIDER: overrideRemoteAi ? "openrouter" : settings.providerMode,
    LEADSY_ENABLE_REMOTE_AI: overrideRemoteAi ? "true" : (settings.remoteAiEnabled ? "true" : ""),
    LEADSY_ALLOW_PAID_AI_MODELS: overrideRemoteAi || settings.costMode === "paid" || settings.costMode === "premium" ? "true" : "",
    LEADSY_ALLOW_EXPENSIVE_AI_MODELS: settings.costMode === "premium" ? "true" : "",
    LEADSY_AI_COST_MODE: settings.costMode,
    LEADSY_ROUTINE_MODEL: route?.model
  };
}

function contextForPrompt(context: LeadAiRuntimeContext, purpose: LeadAiReplyPurpose, options: { ownerName?: string; slotText?: string }) {
  const ownerBusiness = buildOwnerBusinessContext(context);
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
    workspace: {
      businessName: ownerBusiness.businessName,
      industry: ownerBusiness.industry,
      website: ownerBusiness.website,
      services: ownerBusiness.services,
      markets: ownerBusiness.markets,
      leadSources: ownerList(context.workspace.leadSources),
      pipelineStages: compactList(context.workspace.pipelineStages),
      qualificationFields: compactList(context.workspace.qualificationFields),
      timezone: context.workspace.timezone,
      currency: context.workspace.currency,
      calendarDefaults: clean(context.workspace.calendarDefaults)
    },
    operator: {
      roleTitle: clean(context.operator.roleTitle),
      seniority: clean(context.operator.seniority),
      languages: compactList(context.operator.languages),
      timezone: clean(context.operator.timezone),
      workingHours: clean(context.operator.workingHours),
      communicationStyle: ownerBusiness.communicationStyle,
      expertise: ownerList(context.operator.expertise),
      markets: ownerBusiness.markets,
      servicesHandled: ownerBusiness.servicesHandled,
      escalationPreferences: clean(context.operator.escalationPreferences),
      restrictedClaims: compactList(context.operator.restrictedClaims),
      knowledgeBase: ownerBusiness.knowledgeBase
    },
    ownerBusiness,
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

function strictRemoteAiRequired(env: Record<string, string | undefined>) {
  return env.LEADSY_REQUIRE_REMOTE_AI?.trim().toLowerCase() === "true";
}

function openRouterRequestBody(input: {
  model: string;
  context: LeadAiRuntimeContext;
  purpose: LeadAiReplyPurpose;
  ownerName?: string;
  slotText?: string;
  includeResponseFormat: boolean;
}) {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: [
      {
        role: "system",
        content: `You are a human-sounding sales teammate for the owner business. Speak as that business or team, never as a CRM platform or AI product.\n\nRules:\n1. If the lead asks about your services/products, answer with real business info from the workspace/operator context. If no services are provided, say 'A human teammate can share our service details - what outcome are you looking to achieve?' and ask ONE qualifying question.\n2. Never repeat the same question. If the lead says 'this is for me' or 'this is for [name]', do NOT ask 'which company' again. Move to the next missing field (need, budget, timeline, etc.)\n3. Detect personal signals like 'this is for me, [name]' - extract the name and treat it as valid identity. Do not loop asking for company.\n4. Detect company signals like 'this is for AlaskaTourism' - treat as valid company, move to next question.\n5. Answer the lead's direct question first, then ask at most one clear next question.\n6. Use only the provided CRM context. Never invent facts.\n7. Do not mention internal automation, routing, AI, or platform names unless explicitly asked.\n8. Return JSON only with fields: reply, extractedFields, crmNote, nextMissingField, shouldEscalate, confidence.${
          input.context.member?.behaviorInstructions
            ? `\n\n=== AGENT SPECIFIC INSTRUCTIONS ===\nThe following instructions define your specific role. They override standard qualification rules if there is a conflict:\n${input.context.member.behaviorInstructions}`
            : ""
        }`
      },
      {
        role: "user",
        content: JSON.stringify(contextForPrompt(input.context, input.purpose, { ownerName: input.ownerName, slotText: input.slotText }))
      }
    ],
    usage: { include: true },
    temperature: input.context.aiSettings.temperature,
    max_tokens: input.context.aiSettings.maxTokens
  };
  if (input.includeResponseFormat) {
    body.response_format = {
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
    };
  }
  return body;
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
  const strictRemoteAi = strictRemoteAiRequired(env);
  if (!route?.enabled || !shouldUseRemoteAi(env) || selection.provider !== "openrouter" || !selection.model || !env.OPENROUTER_API_KEY?.trim()) {
    if (strictRemoteAi) {
      throw new Error(
        `remote_ai_required:${JSON.stringify({
          routeEnabled: Boolean(route?.enabled),
          useRemote: shouldUseRemoteAi(env),
          provider: selection.provider,
          hasModel: Boolean(selection.model),
          hasKey: Boolean(env.OPENROUTER_API_KEY?.trim())
        })}`
      );
    }
    return fallback;
  }

  try {
    const endpoint = `${env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1"}/chat/completions`;
    const headers = {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "http-referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "x-title": "Owner Sales Assistant"
    };
    const fetchOpenRouter = (includeResponseFormat: boolean) =>
      fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(12000),
        headers,
        body: JSON.stringify(
          openRouterRequestBody({
            model: selection.model as string,
            context,
            purpose: input.purpose,
            ownerName: input.ownerName,
            slotText: input.slotText,
            includeResponseFormat
          })
        )
      });
    let response = await fetchOpenRouter(true);
    let text = await response.text();
    if (!response.ok) {
      response = await fetchOpenRouter(false);
      text = await response.text();
    }
    if (!response.ok) throw new Error(text.slice(0, 300) || `OpenRouter failed with ${response.status}`);
    const payload = JSON.parse(text) as OpenRouterResponse;
    const content = clean(payload.choices?.[0]?.message?.content ?? "");
    const parsed =
      resultFromUnknown(parseJsonFromText(content)) ??
      (strictRemoteAi && content
        ? {
            reply: content,
            extractedFields: {},
            crmNote: `OpenRouter generated a non-JSON lead reply for ${context.lead.contact.displayName || context.lead.id}.`,
            nextMissingField: nextMissingField(context) ?? "",
            shouldEscalate: false,
            confidence: 0.62
          }
        : undefined);
    if (!parsed) {
      if (strictRemoteAi) throw new Error("OpenRouter returned an unparseable lead reply.");
      return fallback;
    }
    parsed.reply = sanitizeLeadFacingReply(parsed.reply, context);
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
  } catch (error) {
    if (strictRemoteAi) {
      throw new Error(`openrouter_failed:${(error as Error).message}`);
    }
    return fallback;
  }
}
