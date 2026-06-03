import {
  accounts,
  activities,
  agencyClients,
  campaigns,
  contacts,
  deals,
  discoveredLeads,
  formatCurrency,
  formatInr,
  getAccountById,
  getAgencyClientById,
  getContactById,
  getDiscoveredLeadById,
  getMetaLeadById,
  getQualificationByLeadId,
  leads,
  metaLeads,
  whatsappConversations,
  LEAD_MAGNET_BATCH_MAX,
	  LEAD_MAGNET_BATCH_MIN,
	  LEAD_MAGNET_DEFAULT_BATCH_SIZE,
	  LEAD_MAGNET_MAX_LEAD_GOAL,
	  leadBriefFingerprint,
	  type AgentQuestion,
	  type AgentQuestionCategory,
	  type AgentRunLog,
	  type DiscoveredLead,
	  type EvidenceUrl,
	  type FxRateSnapshot,
	  type Lead,
	  type LeadBrief,
	  type LeadBriefSnapshot,
	  type LeadDiscoveryMode,
	  type LeadDossier,
  type LeadQualityCounts,
  type LeadQualityDecision,
  type LeadQualityGateBreakdown,
  type LeadRejectionReason,
  type LeadResearchEvent,
  type LeadResearchEventStatus,
  type LeadResearchEventType,
	  type LeadResearchMetrics,
	  type LeadResearchStrategy,
	  type LeadRunOutcome,
  type LeadResearchSourceBreakdown,
  type LeadResearchSourceType,
  type LeadScore,
  type LeadSourceRun,
  type MessageDraft,
  type MetaLead,
	  type OpenRouterUsageCost,
  type OwnerSearchMemory,
  type OwnerWebsiteContext,
  type ResearchPlanPreview,
  type ResearchToolRecipe,
  type ResearchToolRecipeEvaluation,
  type SearchLane,
  type SpendGuard,
  type WhatsAppConversation
} from "@leadsy/domain";
import {
  fetchPublicPage,
  isPublicFetchError,
  searchPublicWeb,
  type PublicFetchDiagnostic,
  type PublicFetchResult,
  type PublicSearchResult
} from "./research-tools";

export type CopilotIntent =
  | "forecast"
  | "account-summary"
  | "outreach"
  | "workflow"
  | "filter"
  | "qualification"
  | "whatsapp"
  | "agency"
  | "lead-magnet"
  | "general";

export type CopilotRequest = {
  tenantId: string;
  userId: string;
  prompt: string;
  accountId?: string;
};

export type CopilotResponse = {
  intent: CopilotIntent;
  answer: string;
  actions: Array<{
    label: string;
    command: string;
    payload?: Record<string, unknown>;
  }>;
  citations: string[];
};

export type EnrichmentResult = {
  leadId: string;
  account: string;
  contact: string;
  confidence: number;
  summary: string;
  recommendedRoute: string;
  verification: {
    email: "valid" | "catch-all" | "invalid";
    phone: "verified" | "missing" | "risky";
    duplicateRisk: "low" | "medium" | "high";
  };
  signals: string[];
};

export type QualificationResult = {
  leadId: string;
  client: string;
  score: number;
  urgency: number;
  spamRisk: number;
  language: string;
  recommendation: string;
  reason: string;
  route: "ai-nurture" | "human-now" | "book-meeting" | "mark-spam";
};

export type WhatsAppReplyResult = {
  conversationId: string;
  reply: string;
  tone: "fast" | "warm" | "premium" | "recovery";
  shouldEscalate: boolean;
  nextAction: string;
};

export type ExtensionReplyMessage = {
  id?: string;
  externalId?: string;
  direction: "incoming" | "outgoing" | "system" | "inbound" | "outbound";
  text?: string;
  body?: string;
  timestamp?: number;
  sentAt?: string;
  sourceUrl?: string;
};

export type ExtensionReplyDecision = {
  action: "send" | "pause";
  replyText: string;
  confidence: number;
  reason: string;
  tags: string[];
  leadFields?: Record<string, string>;
  supportMetadata?: Record<string, string>;
};

export type ExtensionLeadKnowledgeContext = {
  lead?: {
    id: string;
    leadStatus: "lead" | "excluded";
    contact: {
      displayName?: string;
      phone?: string;
      email?: string;
      handle?: string;
      profileUrl?: string;
      waId?: string;
    };
    summary?: string;
    nextAction?: string;
  };
  messages: Array<{
    direction: string;
    body: string;
    sentAt: string;
  }>;
  facts: string[];
};

export type ExtensionReplyInput = {
  tenantId: string;
  ownerId: string;
  platform: string;
  sourceUrl: string;
  chatFingerprint: string;
  contact?: {
    displayName?: string;
    phone?: string;
    email?: string;
    handle?: string;
    profileUrl?: string;
  };
  messages: ExtensionReplyMessage[];
  knowledge?: ExtensionLeadKnowledgeContext;
  existingSummary?: string;
};

export type LeadMagnetDiscoveryResult = {
  runId: string;
  found: number;
  qualified: number;
  blocked: number;
  leads: DiscoveredLead[];
  recommendation: string;
};

export type LeadMagnetOutreachResult = {
  leadId: string;
  status: "queued" | "blocked";
  message: string;
  reason: string;
  nextAction: string;
};

export type LeadResearchResult = {
  run: LeadSourceRun;
  leads: LeadDossier[];
  agentRuns: AgentRunLog[];
};

export type LeadResearchProgressHandler = (event: LeadResearchEvent) => void | Promise<void>;

export type LeadDraftResult = {
  draft: MessageDraft;
  agentRun: AgentRunLog;
};

export interface RevenueAIModel {
  complete(request: CopilotRequest): Promise<CopilotResponse>;
  summarizeLead(lead: Lead): Promise<string>;
}

export type RawLeadCandidate = {
  businessName?: string;
  category?: string;
  city?: string;
  area?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  googleMapsUrl?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  recentActivitySignals?: string[];
  contentQualitySignal?: string;
  whyTheyMayNeedAgency?: string;
  outreachAngle?: string;
  nextAction?: string;
  sentiment?: {
    label?: "positive" | "neutral" | "hesitant" | "negative";
    score?: number;
    reason?: string;
  };
  analysisSummary?: string;
  evidence?: EvidenceUrl[];
  sourceTypes?: LeadResearchSourceType[];
  forceNeedsProof?: boolean;
  audienceMode?: LeadDiscoveryMode;
};

type LeadCollectionResult = {
  leads: LeadDossier[];
  summary?: string;
  messages?: string[];
  metrics?: LeadResearchMetrics;
  events?: LeadResearchEvent[];
  cost?: OpenRouterUsageCost;
  qualityCounts?: LeadQualityCounts;
  sourcesUsed?: LeadResearchSourceType[];
};

const defaultResearchSources: LeadResearchSourceType[] = [
  "openrouter-web-search",
  "directory-osint",
  "social-osint",
  "website-contact-osint",
  "review-reputation-osint",
  "content-gap-osint",
  "hiring-news-osint",
  "competitor-osint",
  "browser-public-page",
  "manual-import"
];

const publicCollectorSources: LeadResearchSourceType[] = [
  "openrouter-web-search",
  "directory-osint",
  "social-osint",
  "website-contact-osint",
  "review-reputation-osint",
  "content-gap-osint",
  "hiring-news-osint",
  "competitor-osint"
];

const leadDiscoveryModes: LeadDiscoveryMode[] = [
  "b2b-company",
  "b2b-local-business",
  "b2c-public-profile",
  "consumer-intent",
  "creator-influencer",
  "recruiting-candidate"
];

const agentQuestionCategories: AgentQuestionCategory[] = [
  "audience-mode",
  "buyer-priority",
  "market-priority",
  "source-priority",
  "proof-strictness",
  "blocked-source-recovery",
  "contact-policy"
];

function isLeadDiscoveryMode(value: unknown): value is LeadDiscoveryMode {
  return typeof value === "string" && leadDiscoveryModes.includes(value as LeadDiscoveryMode);
}

function isAgentQuestionCategory(value: unknown): value is AgentQuestionCategory {
  return typeof value === "string" && agentQuestionCategories.includes(value as AgentQuestionCategory);
}

const publicCollectorSourceSet = new Set<LeadResearchSourceType>(publicCollectorSources);

const primaryIdentitySources = new Set<LeadResearchSourceType>([
  "website-contact-osint",
  "social-osint"
]);

const supportingEvidenceSources = new Set<LeadResearchSourceType>([
  "directory-osint",
  "review-reputation-osint",
  "content-gap-osint",
  "hiring-news-osint",
  "competitor-osint"
]);

const sourceInstructions: Record<LeadResearchSourceType, string> = {
  "openrouter-web-search": "Free public web search for business names, niches, locations, websites, and source evidence.",
  "directory-osint": "Free public business directories, local listing sites, marketplaces, association pages, event/vendor pages, and chamber-style lists.",
  "social-osint": "Public Instagram, Facebook, LinkedIn, YouTube, and other social profile pages. Do not use private profiles or login-only content.",
  "website-contact-osint": "Public home, about, services, contact, landing, portfolio, and blog pages with visible contact details or offer gaps.",
  "review-reputation-osint": "Free public ratings, review counts, testimonials, review snippets, and reputation proof where visible.",
  "content-gap-osint": "Weak social/content signals: stale posts, no reels/video, unclear offer, poor local proof, outdated site, or missing conversion CTA.",
  "hiring-news-osint": "Free public hiring, expansion, launch, event, partnership, press, tender, or recent activity signals that suggest budget or urgency.",
  "competitor-osint": "Nearby or niche competitors with stronger content, better reviews, or better lead capture that create a clear outreach angle.",
  "browser-public-page": "Local public-page extractor for visible email, phone, social links, and page snippets.",
  "manual-import": "Owner-provided real records."
};

const sourceDisplayLabels: Record<LeadResearchSourceType, string> = {
  "openrouter-web-search": "Free public web",
  "directory-osint": "Business directories",
  "social-osint": "Public social profiles",
  "website-contact-osint": "Website/contact pages",
  "review-reputation-osint": "Reviews/reputation",
  "content-gap-osint": "Content gap audit",
  "hiring-news-osint": "Hiring/news signals",
  "competitor-osint": "Competitor context",
  "browser-public-page": "Public page extractor",
  "manual-import": "Manual import"
};

const sourceSearchTitles: Record<LeadResearchSourceType, string> = {
  "openrouter-web-search": "Searching public web",
  "directory-osint": "Checking public directories",
  "social-osint": "Searching public social profiles",
  "website-contact-osint": "Checking website and contact pages",
  "review-reputation-osint": "Checking review signals",
  "content-gap-osint": "Auditing public content gaps",
  "hiring-news-osint": "Checking hiring and news signals",
  "competitor-osint": "Checking competitor context",
  "browser-public-page": "Extracting public page details",
  "manual-import": "Reading manual import"
};

function selectedCollectorSources(brief: LeadBrief): LeadResearchSourceType[] {
  const selected = brief.sources.filter((source) => publicCollectorSourceSet.has(source));
  return selected.length ? selected : ["openrouter-web-search", "website-contact-osint"];
}

function briefDiscoveryText(brief: Pick<LeadBrief, "service" | "idealCustomers" | "searchLocations" | "excludedLeads" | "ownerWebsiteUrl">) {
  return `${brief.service} ${brief.idealCustomers} ${brief.searchLocations} ${brief.excludedLeads} ${brief.ownerWebsiteUrl ?? ""}`.toLowerCase();
}

function detectAudienceModes(brief: Pick<LeadBrief, "service" | "idealCustomers" | "searchLocations" | "excludedLeads" | "ownerWebsiteUrl">): LeadDiscoveryMode[] {
  const text = briefDiscoveryText(brief);
  const modes: LeadDiscoveryMode[] = [];
  const add = (mode: LeadDiscoveryMode) => {
    if (!modes.includes(mode)) modes.push(mode);
  };

  if (/\b(influencers?|creators?|youtubers?|instagrammers?|tiktokers?|bloggers?|brand collaborations?|affiliate creators?)\b/i.test(text)) {
    add("creator-influencer");
    add("b2c-public-profile");
  }
  if (/\b(job seekers?|candidates?|developers? looking for jobs?|hiring|recruit(?:ing|ment)|resume|cv|portfolio|open to work|freelancers?)\b/i.test(text)) {
    add("recruiting-candidate");
  }
  if (/\b(people asking|asking for|looking for|need(?:ing)?|wants?|customers? for|consumers?|homeowners?|parents?|students?|patients?|buyers?|users?)\b/i.test(text)) {
    add("consumer-intent");
  }
  if (/\b(local businesses?|near\b|clinics?|schools?|restaurants?|hotels?|shops?|stores?|salons?|gyms?|cafes?|doctors?|tutors?|coaching centres?|real estate agents?)\b/i.test(text)) {
    add("b2b-local-business");
  }
  if (/\b(compan(?:y|ies)|businesses?|institutions?|enterprises?|corporate|finance|real estate|education|healthcare|manufacturing|retail|hospitality|agenc(?:y|ies))\b/i.test(text)) {
    add("b2b-company");
  }

  return modes.length ? modes.slice(0, 3) : ["b2b-company"];
}

function audienceModeLabel(mode: LeadDiscoveryMode) {
  const labels: Record<LeadDiscoveryMode, string> = {
    "b2b-company": "B2B companies",
    "b2b-local-business": "Local businesses",
    "b2c-public-profile": "Public profiles",
    "consumer-intent": "Consumer intent",
    "creator-influencer": "Creators/influencers",
    "recruiting-candidate": "Candidates"
  };
  return labels[mode];
}

function sourceTypesForMode(mode: LeadDiscoveryMode, selectedSources: LeadResearchSourceType[]): LeadResearchSourceType[] {
  const selected = selectedSources.filter((source) => publicCollectorSourceSet.has(source));
  const preferred: Record<LeadDiscoveryMode, LeadResearchSourceType[]> = {
    "b2b-company": ["website-contact-osint", "directory-osint", "social-osint", "review-reputation-osint", "hiring-news-osint", "openrouter-web-search"],
    "b2b-local-business": ["directory-osint", "website-contact-osint", "review-reputation-osint", "social-osint", "openrouter-web-search"],
    "b2c-public-profile": ["social-osint", "openrouter-web-search", "browser-public-page", "manual-import"],
    "consumer-intent": ["openrouter-web-search", "social-osint", "directory-osint", "review-reputation-osint"],
    "creator-influencer": ["social-osint", "openrouter-web-search", "browser-public-page", "manual-import"],
    "recruiting-candidate": ["hiring-news-osint", "social-osint", "openrouter-web-search", "browser-public-page", "manual-import"]
  };
  const ordered = preferred[mode].filter((source) => selected.includes(source));
  return ordered.length ? ordered : selected.length ? selected : ["openrouter-web-search"];
}

function modeSignalPhrase(mode: LeadDiscoveryMode, brief: LeadBrief) {
  const offer = offerTriggerPhrase(brief);
  if (mode === "creator-influencer") return `${offer} creator collaborations public profile contact`;
  if (mode === "b2c-public-profile") return `${offer} public profile contact interest`;
  if (mode === "consumer-intent") return `${offer} looking for asking recommendations contact`;
  if (mode === "recruiting-candidate") return `${offer} portfolio resume open to work contact`;
  if (mode === "b2b-local-business") return `${offer} local business enquiry contact`;
  return offer;
}

function nowIso() {
  return new Date().toISOString();
}

let fxCache: FxRateSnapshot | null = null;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

async function usdInrRate(): Promise<FxRateSnapshot> {
  const now = Date.now();
  if (fxCache && now - Date.parse(fxCache.fetchedAt) < 6 * 60 * 60 * 1000) {
    return fxCache;
  }

  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR", {
      signal: AbortSignal.timeout(4000)
    });
    if (response.ok) {
      const payload = (await response.json()) as { rates?: { INR?: number } };
      if (typeof payload.rates?.INR === "number" && Number.isFinite(payload.rates.INR)) {
        fxCache = {
          base: "USD",
          quote: "INR",
          rate: payload.rates.INR,
          source: "frankfurter",
          fetchedAt: nowIso()
        };
        return fxCache;
      }
    }
  } catch {
    // Fall through to deterministic local fallback.
  }

  const envRate = parseNumber(process.env.USD_INR_RATE);
  fxCache = {
    base: "USD",
    quote: "INR",
    rate: envRate ?? 83,
    source: envRate ? "env" : "default",
    fetchedAt: nowIso()
  };
  return fxCache;
}

type OpenRouterUsageShape = {
  id?: string;
  model?: string;
  choices?: Array<{ finish_reason?: string | null }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number | string;
    total_cost?: number | string;
  };
};

async function openRouterCostFromResponse(
  response: OpenRouterUsageShape,
  stage?: OpenRouterUsageCost["stage"]
): Promise<OpenRouterUsageCost | undefined> {
  const costUsd = parseNumber(response.usage?.cost) ?? parseNumber(response.usage?.total_cost);
  if (!costUsd || costUsd < 0) {
    return undefined;
  }
  const fx = await usdInrRate();
  return {
    provider: "openrouter",
    stage,
    model: response.model,
    generationId: response.id,
    finishReason: response.choices?.[0]?.finish_reason ?? undefined,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    totalTokens: response.usage?.total_tokens,
    costUsd,
    costInr: costUsd * fx.rate,
    fx,
    createdAt: nowIso()
  };
}

function combineOpenRouterCosts(costs: Array<OpenRouterUsageCost | undefined>): OpenRouterUsageCost | undefined {
  const clean = costs.filter((cost): cost is OpenRouterUsageCost => Boolean(cost));
  if (!clean.length) {
    return undefined;
  }
  const latest = clean[clean.length - 1];
  return {
    provider: "openrouter",
    stage: latest.stage,
    model: [...new Set(clean.map((cost) => cost.model).filter(Boolean))].join(", ") || latest.model,
    generationId: clean.map((cost) => cost.generationId).filter(Boolean).slice(0, 4).join(", ") || latest.generationId,
    finishReason: [...new Set(clean.map((cost) => cost.finishReason).filter(Boolean))].join(", ") || latest.finishReason,
    promptTokens: clean.reduce((sum, cost) => sum + (cost.promptTokens ?? 0), 0),
    completionTokens: clean.reduce((sum, cost) => sum + (cost.completionTokens ?? 0), 0),
    totalTokens: clean.reduce((sum, cost) => sum + (cost.totalTokens ?? 0), 0),
    costUsd: clean.reduce((sum, cost) => sum + cost.costUsd, 0),
    costInr: clean.reduce((sum, cost) => sum + cost.costInr, 0),
    fx: latest.fx,
    createdAt: latest.createdAt
  };
}

function researchEvent(input: {
  runId: string;
  tenantId: string;
  ownerId: string;
  type: LeadResearchEventType;
  status: LeadResearchEventStatus;
  title: string;
  summary: string;
  technicalDetail?: string;
  query?: string;
  url?: string;
  sourceType?: LeadResearchSourceType;
  provider?: string;
  businessName?: string;
  leadId?: string;
  location?: string;
  rejectionReason?: LeadRejectionReason;
}): LeadResearchEvent {
  return {
    id: `evt_${crypto.randomUUID()}`,
    runId: input.runId,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    type: input.type,
    status: input.status,
    title: input.title,
    summary: input.summary,
    technicalDetail: input.technicalDetail,
    query: input.query,
    url: input.url,
    sourceType: input.sourceType,
    provider: input.provider,
    businessName: input.businessName,
    leadId: input.leadId,
    location: input.location,
    rejectionReason: input.rejectionReason,
    createdAt: nowIso()
  };
}

async function emitResearchEvent(
  events: LeadResearchEvent[],
  onEvent: LeadResearchProgressHandler | undefined,
  event: LeadResearchEvent
) {
  events.push(event);
  await onEvent?.(event);
}

function normalizeUrl(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }
  return undefined;
}

type PhoneRegion = "AU" | "IN" | "UNKNOWN";

function phoneRegionFromContext(context = ""): PhoneRegion {
  if (/\.(?:com|net|org|edu|gov)\.au\b|\.au\b|\baustralia(?:n)?\b/i.test(context)) return "AU";
  if (/\.(?:co|org|net|gov|ac)\.in\b|\.in\b|\bindia(?:n)?\b/i.test(context)) return "IN";
  return "UNKNOWN";
}

function phoneRegionFromBrief(brief?: Pick<LeadBrief, "searchLocations"> | string): PhoneRegion {
  return phoneRegionFromContext(typeof brief === "string" ? brief : brief?.searchLocations ?? "");
}

function normalizeAustralianPhone(digits: string) {
  if (/^61[23478]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[23478]\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^[23478]\d{8}$/.test(digits)) return `+61${digits}`;
  return undefined;
}

function normalizeIndianPhone(digits: string) {
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  return undefined;
}

function normalizePhone(value?: string, context?: Pick<LeadBrief, "searchLocations"> | string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (/^(978|979)\d{10}$/.test(digits)) {
    return undefined;
  }
  if (digits.length < 10 || digits.length > 15 || /^(\d)\1+$/.test(digits)) {
    return undefined;
  }
  const region = phoneRegionFromBrief(context);
  if (cleaned.startsWith("+")) {
    const normalized = `+${digits}`;
    if (region === "AU" && !normalized.startsWith("+61")) return undefined;
    if (region === "IN" && !normalized.startsWith("+91")) return undefined;
    return normalized;
  }
  if (region === "AU") return normalizeAustralianPhone(digits);
  if (region === "IN") return normalizeIndianPhone(digits);
  if (/^61[23478]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return undefined;
}

function normalizeEmail(value?: string) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
}

function sourceEvidence(sourceType: LeadResearchSourceType, label: string, url?: string, note?: string): EvidenceUrl {
  return {
    label,
    url: normalizeUrl(url),
    note,
    sourceType,
    capturedAt: nowIso()
  };
}

function isResearchSource(value: unknown): value is LeadResearchSourceType {
  return typeof value === "string" && value in sourceInstructions;
}

function normalizeCandidateSources(value: unknown, fallback: LeadResearchSourceType[]) {
  const allowed = new Set<LeadResearchSourceType>([...fallback, "openrouter-web-search"]);
  const sources = Array.isArray(value)
    ? value.filter((source): source is LeadResearchSourceType => isResearchSource(source) && allowed.has(source))
    : [];
  return sources.length ? [...new Set(sources)] : fallback;
}

function inferLeadSources(raw: RawLeadCandidate, selected: LeadResearchSourceType[]) {
  const inferred = new Set<LeadResearchSourceType>(["openrouter-web-search"]);
  const evidenceText = (raw.evidence ?? [])
    .map((item) => `${item.label} ${item.note ?? ""} ${item.url ?? ""}`)
    .join(" ")
    .toLowerCase();

  if (selected.includes("directory-osint") && /director|listing|marketplace|association|vendor|chamber|justdial|sulekha|indiamart/i.test(evidenceText)) {
    inferred.add("directory-osint");
  }
  if (selected.includes("social-osint") && (raw.instagram || raw.facebook || raw.linkedin || /instagram|facebook|linkedin|youtube/i.test(evidenceText))) {
    inferred.add("social-osint");
  }
  if (selected.includes("website-contact-osint") && raw.website) {
    inferred.add("website-contact-osint");
  }
  if (selected.includes("review-reputation-osint") && (raw.rating || raw.reviewCount || /review|rating|testimonial/i.test(evidenceText))) {
    inferred.add("review-reputation-osint");
  }
  if (selected.includes("content-gap-osint") && raw.contentQualitySignal) {
    inferred.add("content-gap-osint");
  }
  if (selected.includes("hiring-news-osint") && ((raw.recentActivitySignals?.length ?? 0) > 0 || /hiring|career|launch|event|news|press/i.test(evidenceText))) {
    inferred.add("hiring-news-osint");
  }
  if (selected.includes("competitor-osint") && /competitor|nearby|alternative|compared|gap/i.test(`${raw.outreachAngle ?? ""} ${raw.whyTheyMayNeedAgency ?? ""}`)) {
    inferred.add("competitor-osint");
  }

  return [...inferred].filter((source) => selected.includes(source) || source === "openrouter-web-search");
}

function normalizeEvidenceSource(value: unknown, fallback: LeadResearchSourceType) {
  return isResearchSource(value) ? value : fallback;
}

function scoreLead(raw: RawLeadCandidate, brief: LeadBrief): LeadScore {
  const evidenceCount = raw.evidence?.length ?? 0;
  const hasDirectContact = Boolean(normalizePhone(raw.phone, brief) || normalizePhone(raw.whatsapp, brief) || normalizeEmail(raw.email));
  const hasWebOrSocial = Boolean(normalizeUrl(raw.website) || normalizeUrl(raw.instagram) || normalizeUrl(raw.facebook) || normalizeUrl(raw.linkedin));
  const briefWords = `${brief.idealCustomers} ${brief.searchLocations}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const haystack = `${raw.businessName ?? ""} ${raw.category ?? ""} ${raw.city ?? ""} ${raw.area ?? ""} ${
    raw.whyTheyMayNeedAgency ?? ""
  }`.toLowerCase();
  const fitHits = briefWords.filter((word) => word.length > 3 && haystack.includes(word)).length;

  const fit = clampScore(48 + Math.min(32, fitHits * 8) + (raw.category ? 10 : 0));
  const urgency = clampScore(45 + (raw.recentActivitySignals?.length ?? 0) * 10 + (raw.contentQualitySignal ? 8 : 0));
  const contactability = clampScore((hasDirectContact ? 72 : rawHasContactPath(raw, brief) ? 54 : 34) + (hasWebOrSocial ? 16 : 0));
  const evidence = clampScore(Math.min(100, evidenceCount * 28 + (raw.address ? 12 : 0) + (raw.rating ? 10 : 0)));
  const overall = clampScore(fit * 0.32 + urgency * 0.22 + contactability * 0.24 + evidence * 0.22);
  const confidence = clampScore(evidence * 0.55 + contactability * 0.25 + (raw.businessName ? 20 : 0));
  const status = overall >= 76 && confidence >= 68 ? "high-confidence" : confidence < 35 ? "blocked" : "needs-review";

  return {
    fit,
    urgency,
    contactability,
    evidence,
    overall,
    confidence,
    status,
    reasons: [
      hasDirectContact ? "Public direct contact found." : "No public phone/email verified yet.",
      evidenceCount ? `${evidenceCount} evidence source${evidenceCount === 1 ? "" : "s"} attached.` : "No usable source evidence.",
      fitHits ? "Matches the agency brief." : "Needs manual review against the agency brief."
    ]
  };
}

function locationTokens(brief: LeadBrief) {
  return brief.searchLocations
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !["near", "and", "the", "for", "with"].includes(token));
}

function candidateHasRequestedLocation(candidate: Pick<SearchCandidate, "title" | "url" | "snippet">, brief: LeadBrief) {
  const requested = brief.searchLocations.toLowerCase();
  const tokens = locationTokens(brief);
  if (!tokens.length) {
    return true;
  }
  let host = "";
  try {
    host = new URL(candidate.url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const haystack = `${candidate.title} ${candidate.url} ${candidate.snippet ?? ""} ${host}`.toLowerCase();
  if (/australia/.test(requested)) {
    return /australia|australian/.test(haystack) || host.endsWith(".au");
  }
  if (/canada/.test(requested)) {
    return /canada|canadian/.test(haystack) || host.endsWith(".ca");
  }
  if (/united kingdom|uk|england/.test(requested)) {
    return /united kingdom|england|london|british/.test(haystack) || host.endsWith(".uk");
  }
  return tokens.some((token) => haystack.includes(token));
}

function leadLocation(raw: RawLeadCandidate, brief: LeadBrief) {
  const city = raw.city?.trim();
  const area = raw.area?.trim();
  const address = raw.address?.trim();
  const tokens = locationTokens(brief);
  const haystack = `${city ?? ""} ${area ?? ""} ${address ?? ""} ${raw.evidence?.map((item) => `${item.label} ${item.note ?? ""} ${item.url ?? ""}`).join(" ") ?? ""}`.toLowerCase();
  const matched = tokens.find((token) => haystack.includes(token));
  const locationText = [area, city].filter(Boolean).join(", ");

  return {
    city,
    area,
    country: undefined,
    status: city || area || matched ? "found" as const : "not-found" as const,
    evidence: matched ? `Matched requested location term "${matched}".` : locationText || "location not found"
  };
}

function leadSentiment(raw: RawLeadCandidate, score: LeadScore) {
  const supplied = raw.sentiment;
  const label = supplied?.label ?? (score.overall >= 76 ? "positive" : score.overall >= 50 ? "neutral" : "hesitant");
  return {
    label,
    score: clampUnit(supplied?.score ?? score.overall / 100),
    reason:
      supplied?.reason?.trim() ||
      (label === "positive"
        ? "Public evidence suggests a reachable business with a practical reason to improve lead flow."
        : label === "hesitant"
          ? "Evidence exists, but contact/location or fit needs a human review before outreach."
          : "Public signals are usable but not strong enough for a hot-lead label.")
  };
}

function hostFromUrl(value?: string) {
  try {
    return value ? new URL(value).hostname.replace(/^www\./, "").toLowerCase() : "";
  } catch {
    return "";
  }
}

function pageLooksLikeVendor(host: string) {
  return /(hubspot|salesforce|zoho|leadsquared|pipedrive|freshworks|freshsales|mailchimp|semrush|ahrefs|shopify|intercom|zendesk)\./i.test(host);
}

function prospectPageRejectReason(input: { title?: string; url?: string; host?: string }): LeadRejectionReason | undefined {
  const identity = pageIdentity(input);
  const compact = identity.compact;
  if (articleOrPublisherRejectReason(input)) {
    return "non-business-page";
  }
  if (/(^|\.)gov(\.|$)|(^|\.)mil(\.|$)/i.test(identity.host)) {
    return "non-business-page";
  }
  if (/(^|\.)xnxx\.|(^|\.)xvideos\.|(^|\.)pornhub\.|(^|\.)redtube\.|(^|\.)youporn\.|\bporn\b|\bxxx\b|\bsex videos?\b/i.test(compact)) {
    return "non-business-page";
  }
  if (/(^|\.)youtube\.|(^|\.)youtu\.be|(^|\.)music\.youtube\.|(^|\.)spotify\.|(^|\.)soundcloud\./i.test(identity.host)) {
    return "non-business-page";
  }
  if (/(^|\.)merriam-webster\.|(^|\.)dictionary\.cambridge\.|(^|\.)dictionary\.com|(^|\.)britannica\.|(^|\.)wiktionary\./i.test(identity.host)) {
    return "non-business-page";
  }
  if (/(^|\.)reverseaustralia\.|(^|\.)allbusinessnumbers\.|(^|\.)findbusinessaddress\.|(^|\.)australianlists\./i.test(identity.host)) {
    return "generic-directory";
  }
  if (/(^|\.)financedirectory\.|(^|\.)cybo\.|(^|\.)justdial\.|(^|\.)sulekha\.|(^|\.)indiamart\./i.test(identity.host)) {
    return "generic-directory";
  }
  if (/(^|\.)businessgreen\.|(^|\.)lokmat\.|(^|\.)news18\.|(^|\.)ndtv\.|(^|\.)timesofindia\.|(^|\.)hindustantimes\./i.test(identity.host)) {
    return "non-business-page";
  }
  if (/^blog\./i.test(identity.host)) {
    return "non-business-page";
  }
  if (/find-a-(broker|doctor|clinic|agent)|directory|listing|classifieds?|compare|comparison|jobs?/i.test(identity.path)) {
    return "generic-directory";
  }
  if (/(^|\.)wikipedia\.org|(^|\.)wikimedia\.org|(^|\.)gov\.in|(^|\.)nic\.in|digitalindia|digilocker|digitalseva|digitalgujarat|passportseva|udyamregistration/i.test(compact)) {
    return "non-business-page";
  }
  if (/(^|\.)apple\.com|(^|\.)microsoft\.com|(^|\.)dell\.com|(^|\.)stackoverflow\.com|(^|\.)github\.com|(^|\.)npmjs\.com|(^|\.)zhihu\.com|(^|\.)quora\.com|(^|\.)reddit\.com|(^|\.)google\.com|(^|\.)play\.google\.com|(^|\.)dropbox\.com/i.test(identity.host)) {
    return "non-business-page";
  }
  if (/(^|\.)who\.int|(^|\.)cnet\.com|(^|\.)techspot\.com|(^|\.)vedantu\.com|(^|\.)education\.com|(^|\.)lisedunetwork\.com/i.test(identity.host)) {
    return "non-business-page";
  }
  if (/(^|\/)(docs?|help|support|kb|learn|forum|forums|community|communities|thread|question|answers?|wiki|blog|blogs|news|article|articles|press|project|case-stud(?:y|ies)|install|download|store|apps?)(\/|$)/i.test(identity.path)) {
    return "non-business-page";
  }
  if (/\b(how to|step[- ]by[- ]step|guide|tutorial|definition|meaning|what is|news|latest news|journal|open access|stock market|share market)\b/i.test(identity.title)) {
    return "non-business-page";
  }
  return undefined;
}

function articleOrPublisherRejectReason(input: { title?: string; url?: string; host?: string }): LeadRejectionReason | undefined {
  const identity = pageIdentity(input);
  const slugWords = identity.path
    .split("/")
    .flatMap((part) => part.split("-"))
    .filter((part) => /^[a-z0-9]{3,}$/i.test(part));
  const longSlug = slugWords.length >= 8;
  const hostLabels = identity.host.split(/[.-]+/).filter(Boolean);
  const publisherHost = hostLabels.some((label) =>
    /news|magazine|daily|times|herald|journal|press|media|blog|articles?|stories?/i.test(label)
  );
  const articlePath = /(^|\/)(20\d{2}|news|article|articles|blog|blogs|press|media|story|stories|insights?|resources?)(\/|$)/i.test(identity.path);
  const articleTitle = identity.title.split(/\s+/).length >= 8 &&
    /\b(is|are|was|were|has|have|will|with|appointment|appoints?|appointed|announces?|launches?|expands?|expanding|raises?|funding|acquires?|acquisition|interview|story|platform for)\b/i.test(identity.title);
  if ((publisherHost && (longSlug || articlePath || articleTitle)) || (longSlug && articleTitle) || (articlePath && articleTitle)) {
    return "non-business-page";
  }
  return undefined;
}

function pageIdentity(input: { title?: string; url?: string; host?: string }) {
  const title = input.title ?? "";
  const host = input.host ?? hostFromUrl(input.url);
  let path = "";
  try {
    path = input.url ? new URL(input.url).pathname.toLowerCase() : "";
  } catch {
    path = "";
  }
  return { title, host, path, compact: `${title} ${host} ${path}`.toLowerCase() };
}

function utilityPageRejectReason(input: { title?: string; url?: string; host?: string }): LeadRejectionReason | undefined {
  const identity = pageIdentity(input);
  if (/(^|\/)(login|signin|sign-in|account|privacy|terms|cookies?|cart|checkout|wp-login|admin)(\/|$)/i.test(identity.path)) {
    return "non-business-page";
  }
  if (/^(privacy policy|terms(?: of service)?|cookie policy|cart|checkout|login|sign in|technical difficulties|error page|page not found)$/i.test(identity.title.trim())) {
    return "non-business-page";
  }
  return undefined;
}

function marketplaceRejectReason(input: { title?: string; url?: string; host?: string }): LeadRejectionReason | undefined {
  const identity = pageIdentity(input);
  if (/(^|\.)amazon\.|(^|\.)flipkart\./i.test(identity.host) || /\/dp\//i.test(identity.path)) {
    return "marketplace-product";
  }
  if (genericMarketplaceOrDirectory(input)) {
    return "generic-directory";
  }
  if (/(\/buy\/|\/get-quotes?\/|\/quotes?\/)/i.test(identity.path)) {
    return "marketplace-product";
  }
  if (/\b(isbn|paperback|hardcover)\b/i.test(identity.title)) {
    return "marketplace-product";
  }
  if (/\b(book buyers?|sell books?|buy books?|equipment marketplace|supplier directory|quote marketplace)\b/i.test(identity.title)) {
    return "marketplace-product";
  }
  if (/\b(assignment help|homework help|essay writing|dissertation writing|thesis writing|coursework help|academic writing|take my class|do my assignment)\b/i.test(identity.compact)) {
    return "bad-fit-vendor";
  }
  if (/\b(online electronic shopping|shopping store)\b/i.test(identity.title) && !hasBusinessVerticalSignal(identity.title)) {
    return "marketplace-product";
  }
  return undefined;
}

function genericMarketplaceOrDirectory(input: { title?: string; url?: string; host?: string }) {
  const identity = pageIdentity(input);
  const hostWords = identity.host.replace(/^www\./i, "").replace(/\.[a-z]{2,}$/i, "").replace(/[.-]+/g, " ");
  const pathWords = identity.path.replace(/[/-]+/g, " ");
  const combined = `${identity.title} ${hostWords} ${pathWords}`.toLowerCase();
  const directoryTitle =
    /\b(find|search|browse|compare|comparison|classifieds?|jobs?|job board|book online appointment with|directory of|list of|suppliers?|vendors?|get quotes?|quote marketplace|clinics?\s*&\s*more|doctors?,\s*clinics?|top\s+\d+|best\s+\d+)\b/i.test(combined);
  const directoryHost = /\b(directory|directories|listings?|classifieds?|marketplace|supplier|suppliers|quotes?|finder|find|compare|comparison|booking|jobboard|jobs?)\b/i.test(hostWords);
  const directoryPath = /(^|\/)(directory|directories|listings?|classifieds?|marketplace|find-a|find-|compare|comparison|get-quotes?|quotes?|suppliers?|vendors?|buyers?-guide|jobs?)(\/|$)/i.test(identity.path);
  return (directoryHost && (directoryPath || directoryTitle)) || (directoryPath && directoryTitle);
}

function hasBusinessVerticalSignal(value: string) {
  return /(clinic|diagnostic|hospital|doctor|dental|healthcare|coaching|institute|classes|academy|school|college|training|education|admission|real estate|builder|developer|broker|property|finance|insurance|wealth|loan|consult|services|solutions|pvt|ltd|llp|enterprise|business|company|center|centre)/i.test(value);
}

function genericBusinessName(value?: string) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) return true;
  const wordCount = normalized.split(/\s+/).length;
  if (/^@/.test(normalized)) return true;
  if (wordCount >= 9 && /\b(is|are|was|were|has|have|will|with|appointment|appoints?|appointed|announces?|launches?|expands?|expanding|platform for)\b/i.test(normalized)) return true;
  return /^(home|contact(?: us)?|about(?: us)?|services?|patient information|placements?|places?|jobs?|classifieds?|comparison|financial help(?: &| and) support|debt help enquiries|talk to a business lending specialist|business lending specialist|help(?: &| and) support|support|privacy policy|terms(?: of service)?|page not found)$/i.test(normalized) ||
    /\b(logo(?:text)?|government|public services?|subsidy|standards for|patient information|jobs? for students|home loan comparison|classifieds? portal|what is|simple guide|beginner'?s guide|how to|top\s+\d+|best\s+\d+|find a doctor|find doctors?|finder|book online appointment|get quotes?|pursue your|research & innovation|overseas education consultants since|migration agent|finance broker [a-z]+|finance company [a-z]+|assignment help|homework help|essay writing|dissertation writing|thesis writing|academic writing)\b/i.test(normalized);
}

function titleCaseIdentity(value: string) {
  return value
    .replace(/\b(llc|llp|ltd|pty|plc|inc|co|ca|cpa|ndis|rto)\b/gi, (match) => match.toUpperCase())
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

function businessNameFromHostUrl(value?: string) {
  const host = domainFromUrl(value);
  if (!host) return "";
  const parts = host.split(".");
  const secondLevelSuffix = parts.length > 2 && /^(com|net|org|co|edu|gov)$/i.test(parts.at(-2) ?? "") && /^[a-z]{2}$/i.test(parts.at(-1) ?? "");
  const nameParts = secondLevelSuffix ? parts.slice(0, -2) : parts.slice(0, -1);
  return titleCaseIdentity(nameParts.join(" ").replace(/[-_]+/g, " "));
}

function evidenceUrl(raw: RawLeadCandidate) {
  return raw.website || raw.instagram || raw.facebook || raw.linkedin || raw.evidence?.find((item) => item.url)?.url;
}

function hasEvidenceUrl(raw: RawLeadCandidate) {
  return Boolean(evidenceUrl(raw));
}

function evidenceHasContactPath(evidence: EvidenceUrl[] = []) {
  return evidence.some((item) => /contact|enquir|inquir|appointment|booking|quote|callback|linkedin|facebook|instagram|whatsapp|phone|email/i.test(`${item.label} ${item.url ?? ""} ${item.note ?? ""}`));
}

function rawHasContactPath(raw: RawLeadCandidate, brief?: Pick<LeadBrief, "searchLocations">) {
  return Boolean(
    normalizePhone(raw.phone, brief) ||
      normalizePhone(raw.whatsapp, brief) ||
      normalizeEmail(raw.email) ||
      normalizeUrl(raw.instagram) ||
      normalizeUrl(raw.facebook) ||
      normalizeUrl(raw.linkedin) ||
      evidenceHasContactPath(raw.evidence)
  );
}

function leadHasContactPath(lead: LeadDossier) {
  return Boolean(lead.phone || lead.whatsapp || lead.email || lead.instagram || lead.facebook || lead.linkedin || evidenceHasContactPath(lead.evidence));
}

function rawHasIndustryFit(raw: RawLeadCandidate, brief: LeadBrief) {
  const evidenceText = (raw.evidence ?? []).map((item) => `${item.label} ${item.url ?? ""}`).join(" ");
  const category = raw.category?.trim().toLowerCase() === brief.idealCustomers.trim().toLowerCase() ? "" : raw.category ?? "";
  const haystack = `${raw.businessName ?? ""} ${category} ${raw.contentQualitySignal ?? ""} ${evidenceText}`.toLowerCase();
  const tokens = brief.idealCustomers
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !/^(with|over|above|business|businesses|industries|industry|customers|clients|services|local|near)$/.test(token))
    .slice(0, 12);
  const briefText = brief.idealCustomers.toLowerCase();
  const verticalSignals = [
    /finance|loan|mortgage|lending|broker|accounting|accountant|tax|wealth|insurance|credit/i,
    /health|clinic|medical|doctor|dental|diagnostic|hospital|ndis|care|physio|therapy/i,
    /education|school|college|coaching|tutor|training|admission|university|institute|rto|student/i,
    /real estate|property|builder|developer|housing|buyers? agent|rental|conveyanc/i
  ];
  const briefSignals = verticalSignals.filter((pattern) => pattern.test(briefText));
  return tokens.some((token) => haystack.includes(token)) || briefSignals.some((pattern) => pattern.test(haystack));
}

function rawHasConcreteBuyerSubtype(raw: RawLeadCandidate, brief: LeadBrief) {
  const evidenceText = (raw.evidence ?? []).map((item) => `${item.label} ${item.note ?? ""} ${item.url ?? ""}`).join(" ");
  const haystack = `${raw.businessName ?? ""} ${raw.category ?? ""} ${raw.contentQualitySignal ?? ""} ${raw.whyTheyMayNeedAgency ?? ""} ${evidenceText}`.toLowerCase();
  const briefText = brief.idealCustomers.toLowerCase();
  const subtypeSignals: RegExp[] = [];
  if (/finance|financial|accounting|mortgage|insurance|wealth|loan|credit|tax/i.test(briefText)) {
    subtypeSignals.push(/\b(accountants?|accounting|tax advisory|bookkeeping|mortgage brokers?|finance brokers?|financial planners?|wealth management|insurance brokers?|credit repair|loan advisory|lending)\b/i);
  }
  if (/health|healthcare|medical|clinic|doctor|dental|physio|therapy|diagnostic|pathology/i.test(briefText)) {
    subtypeSignals.push(/\b(clinics?|medical practices?|dental|dentists?|physio(?:therapy)?|allied health|diagnostic|pathology|specialists?|psychologists?|therapy|health centres?|surgery consultants?)\b/i);
  }
  if (/education|school|college|tutor|training|rto|childcare|early learning/i.test(briefText)) {
    subtypeSignals.push(/\b(tutors?|tutoring|schools?|colleges?|academy|rto|vocational training|training providers?|childcare|early learning|learning centres?|education centres?)\b/i);
  }
  if (!subtypeSignals.length) {
    return true;
  }
  return subtypeSignals.some((pattern) => pattern.test(haystack));
}

function nonBuyerInstitutionRejectReason(raw: RawLeadCandidate, brief: LeadBrief): LeadRejectionReason | undefined {
  if (briefAllowsProviderProspects(brief)) return undefined;
  const evidenceText = (raw.evidence ?? []).map((item) => `${item.label} ${item.note ?? ""} ${item.url ?? ""}`).join(" ");
  const url = raw.website || raw.evidence?.find((item) => item.url)?.url;
  const identity = pageIdentity({
    title: `${raw.businessName ?? ""} ${raw.category ?? ""} ${raw.contentQualitySignal ?? ""} ${evidenceText}`,
    url
  });
  const haystack = identity.compact;
  if (/\b(association|council|society|conference|symposium|event organiser|events? page|regulator|regulatory body|professional body)\b/i.test(haystack)) {
    return "bad-fit-vendor";
  }
  if (/\b(university|tafe|government|department|public hospital|health district|local health district|national directory)\b/i.test(haystack)) {
    return "bad-fit-vendor";
  }
  if (/\b(travel|tour|hotel|property listings?|real estate listings?|classifieds?|job board|jobs? in)\b/i.test(haystack)) {
    return "generic-directory";
  }
  return undefined;
}

function rawSelfReportsNeedsProof(raw: RawLeadCandidate) {
  const text = `${raw.analysisSummary ?? ""} ${raw.contentQualitySignal ?? ""} ${raw.whyTheyMayNeedAgency ?? ""}`.toLowerCase();
  return /\bneeds[-\s]?proof\b|\bneeds verification\b|\bnot (?:a )?(?:fully )?qualified\b|\bcontact details incomplete\b|\bmissing direct (?:email|phone|contact)\b/.test(text);
}

function requestedCountryCode(brief: LeadBrief) {
  const location = brief.searchLocations.toLowerCase();
  if (/\baustralia|australian\b/.test(location)) return "AU";
  if (/\bindia|indian\b/.test(location)) return "IN";
  if (/\bcanada|canadian\b/.test(location)) return "CA";
  if (/\bunited kingdom|\buk\b|\bengland|british\b/.test(location)) return "UK";
  return undefined;
}

function countryCodeFromUrl(value?: string) {
  const host = domainFromUrl(value);
  if (!host) return undefined;
  if (/(^|\.)au$/i.test(host) || /\.(?:com|net|org|edu|gov)\.au$/i.test(host)) return "AU";
  if (/(^|\.)in$/i.test(host) || /\.(?:co|org|net|gov|ac)\.in$/i.test(host)) return "IN";
  if (/(^|\.)ca$/i.test(host) || /\.(?:com|org|net)\.ca$/i.test(host)) return "CA";
  if (/(^|\.)uk$/i.test(host) || /\.(?:co|org|ac|gov)\.uk$/i.test(host)) return "UK";
  return undefined;
}

function evidenceCountryConflicts(raw: RawLeadCandidate, brief: LeadBrief) {
  const requested = requestedCountryCode(brief);
  if (!requested) return false;
  const urls = [raw.website, raw.instagram, raw.facebook, raw.linkedin, raw.googleMapsUrl, ...(raw.evidence ?? []).map((item) => item.url)].filter(Boolean);
  const evidenceCountries = urls.map((url) => countryCodeFromUrl(url)).filter(Boolean);
  return evidenceCountries.length > 0 && !evidenceCountries.includes(requested);
}

function briefAllowsProviderProspects(brief: LeadBrief) {
  return /\b(agenc(?:y|ies)|marketing|seo|advertising|software|saas|it companies?|web design|development firms?|consultants?|vendors?|suppliers?|marketplaces?|directories)\b/i.test(brief.idealCustomers);
}

function badFitProviderRejectReason(input: { title?: string; url?: string; category?: string; evidence?: EvidenceUrl[] }, brief: LeadBrief): LeadRejectionReason | undefined {
  if (briefAllowsProviderProspects(brief)) return undefined;
  const evidenceText = input.evidence?.map((item) => `${item.label} ${item.url ?? ""}`).join(" ") ?? "";
  const identity = pageIdentity({ title: `${input.title ?? ""} ${input.category ?? ""} ${evidenceText}`, url: input.url });
  const haystack = identity.compact;
  if (/\b(big|enterprise|5cr|10cr|famous|mnc|listed|public company|large compan)/i.test(brief.excludedLeads) && /\b(bank|university|government|national|multinational|public company|investor relations|asx|listed company)\b/i.test(haystack)) {
    return "bad-fit-vendor";
  }
  if (/\b(marketing agency|digital marketing|seo(?:\s+services?|\s+agency)?|advertising agency|creative agency|growth agency|lead generation|web(?:site)? design|web(?:site)? development|software development|odoo|crm implementation|it consulting|managed it|media agency|assignment help|homework help|essay writing|dissertation writing|thesis writing|coursework help|academic writing|take my class|do my assignment)\b/i.test(haystack)) {
    return "bad-fit-vendor";
  }
  if (genericMarketplaceOrDirectory({ title: input.title, url: input.url })) {
    return "generic-directory";
  }
  return undefined;
}

function evidenceSourceTypes(raw: RawLeadCandidate) {
  return [
    ...(raw.sourceTypes ?? []),
    ...(raw.evidence ?? []).map((item) => item.sourceType)
  ].filter((source): source is LeadResearchSourceType => isResearchSource(source));
}

function evidenceUrlsForRaw(raw: RawLeadCandidate) {
  return [raw.website, raw.instagram, raw.facebook, raw.linkedin, raw.googleMapsUrl, ...(raw.evidence ?? []).map((item) => item.url)].filter(
    (url): url is string => Boolean(url)
  );
}

function sourceTypeSetForRaw(raw: RawLeadCandidate) {
  return new Set(evidenceSourceTypes(raw));
}

function directoryLikeUrl(url?: string) {
  const host = hostFromUrl(url);
  return /(directory|yellowpages|yelp|hotfrog|trueblue|startlocal|australiabiz|businesslistings|localbusinessguide|cylex|cybo|aubiz|dnb|chamber|marketplace|listing|businesslist|clutch|goodfirms|sortlist|apollo|zoominfo|crunchbase|kompass|europages|yellow|whitepages|association|members?)/i.test(
    host
  );
}

function hasIndependentBusinessEvidence(raw: RawLeadCandidate) {
  return Boolean(
    (normalizeUrl(raw.website) && !directoryLikeUrl(raw.website)) ||
      normalizeUrl(raw.instagram) ||
      normalizeUrl(raw.facebook) ||
      normalizeUrl(raw.linkedin) ||
      evidenceUrlsForRaw(raw).some((url) => {
        const host = hostFromUrl(url);
        return host && !socialPlatformHost(host) && !directoryLikeUrl(url);
      })
  );
}

function isDirectoryOnlyEvidence(raw: RawLeadCandidate) {
  const sourceTypes = sourceTypeSetForRaw(raw);
  return sourceTypes.has("directory-osint") && ![...primaryIdentitySources].some((source) => sourceTypes.has(source)) && !hasIndependentBusinessEvidence(raw);
}

function passiveEvidenceOnly(raw: RawLeadCandidate) {
  const sourceTypes = evidenceSourceTypes(raw).filter((source) => source !== "openrouter-web-search");
  return sourceTypes.length > 0 && sourceTypes.every((source) => supportingEvidenceSources.has(source)) && !hasIndependentBusinessEvidence(raw);
}

function publicProfileHasBusinessIntent(raw: RawLeadCandidate, brief: LeadBrief) {
  const evidenceText = (raw.evidence ?? []).map((item) => `${item.label} ${item.note ?? ""} ${item.url ?? ""}`).join(" ");
  const haystack = `${raw.businessName ?? ""} ${raw.category ?? ""} ${raw.city ?? ""} ${raw.area ?? ""} ${raw.contentQualitySignal ?? ""} ${
    raw.whyTheyMayNeedAgency ?? ""
  } ${evidenceText}`.toLowerCase();
  if (/\b(private profile|personal blog|fan account|fanpage|followers only|login required|sign in required)\b/i.test(haystack)) {
    return false;
  }
  const hasProfileUrl = Boolean(normalizeUrl(raw.instagram) || normalizeUrl(raw.facebook) || normalizeUrl(raw.linkedin));
  const socialEvidence = evidenceUrlsForRaw(raw).some((url) => socialPlatformHost(hostFromUrl(url)));
  if (!hasProfileUrl && !socialEvidence) {
    return true;
  }
  const businessIntent =
    rawHasIndustryFit(raw, brief) ||
    /\b(official|business|clinic|school|college|academy|advisor|broker|consultant|services|studio|store|shop|seller|brand|agency|company|enquiry|booking|appointment|quote|contact|email|phone|whatsapp)\b/i.test(
      haystack
    );
  return businessIntent && rawHasContactPath(raw, brief);
}

function normalizedRawLeadIdentity(raw: RawLeadCandidate): RawLeadCandidate {
  const current = raw.businessName?.trim();
  if (current && !genericBusinessName(current)) {
    return raw;
  }
  const fallback = businessNameFromHostUrl(raw.website) || businessNameFromHostUrl(raw.evidence?.find((item) => item.url)?.url);
  return fallback ? { ...raw, businessName: fallback } : raw;
}

function briefTargetsSoftwareVendors(brief: LeadBrief) {
  return /saas|software vendor|crm provider|martech|software companies|it companies/i.test(`${brief.service} ${brief.idealCustomers}`);
}

function audienceModeForRaw(raw: RawLeadCandidate, brief: LeadBrief): LeadDiscoveryMode {
  return raw.audienceMode ?? detectAudienceModes(brief)[0] ?? "b2b-company";
}

function profileModeAllowsProfileAsContact(mode: LeadDiscoveryMode) {
  return mode === "creator-influencer" || mode === "b2c-public-profile";
}

function rawHasExplicitIntentOrContact(raw: RawLeadCandidate, brief?: Pick<LeadBrief, "searchLocations">) {
  const evidenceText = (raw.evidence ?? []).map((item) => `${item.label} ${item.note ?? ""} ${item.url ?? ""}`).join(" ");
  const text = `${raw.contentQualitySignal ?? ""} ${raw.whyTheyMayNeedAgency ?? ""} ${raw.analysisSummary ?? ""} ${evidenceText}`.toLowerCase();
  return Boolean(
    normalizePhone(raw.phone, brief) ||
      normalizePhone(raw.whatsapp, brief) ||
      normalizeEmail(raw.email) ||
      /\b(open to work|looking for|asking for|need(?:ing)?|wanted|required|available|hiring|seeking|enquiry|contact me|dm|email|whatsapp)\b/i.test(text)
  );
}

function qualityDecisionForRaw(raw: RawLeadCandidate, brief: LeadBrief, score: LeadScore): LeadQualityDecision {
  const evidenceText = (raw.evidence ?? []).map((item) => `${item.label} ${item.note ?? ""} ${item.url ?? ""}`).join(" ");
  const url = raw.website || raw.evidence?.find((item) => item.url)?.url;
  const host = hostFromUrl(url);
  const combined = `${raw.businessName ?? ""} ${raw.category ?? ""} ${raw.city ?? ""} ${raw.area ?? ""} ${raw.address ?? ""} ${raw.whyTheyMayNeedAgency ?? ""} ${raw.outreachAngle ?? ""} ${evidenceText}`.toLowerCase();
  const identity = `${raw.businessName ?? ""} ${raw.category ?? ""} ${url ?? ""} ${host} ${raw.evidence?.map((item) => item.label).join(" ") ?? ""}`;
  const location = leadLocation(raw, brief);
  const hasPublicWebIdentity = Boolean(normalizeUrl(raw.website) || normalizeUrl(raw.instagram) || normalizeUrl(raw.facebook) || normalizeUrl(raw.linkedin) || raw.evidence?.some((item) => item.url));
  const hasCustomerIdentity = Boolean(raw.businessName?.trim()) && !genericBusinessName(raw.businessName) && (hasBusinessVerticalSignal(identity) || hasPublicWebIdentity);
  const hasPublicEvidenceUrl = hasEvidenceUrl(raw);
  const hasContactPath = rawHasContactPath(raw, brief);
  const hasIndustryFit = rawHasIndustryFit(raw, brief);
  const hasBusinessProfileIntent = publicProfileHasBusinessIntent(raw, brief);
  const audienceMode = audienceModeForRaw(raw, brief);

  const reject = (reason: LeadRejectionReason, summary: string): LeadQualityDecision => ({
    status: "rejected",
    reason,
    summary,
    decidedAt: nowIso()
  });

  if (pageLooksLikeVendor(host) && !briefTargetsSoftwareVendors(brief)) {
    return reject("bad-fit-vendor", "Rejected because this is a software/vendor page, not a likely customer prospect.");
  }
  const providerReason = badFitProviderRejectReason({ title: raw.businessName, url, category: raw.category, evidence: raw.evidence }, brief);
  if (providerReason) {
    return reject(providerReason, "Rejected because this looks like a supplier, agency, directory, or marketplace page instead of a buyer prospect.");
  }
  const nonBuyerReason = nonBuyerInstitutionRejectReason(raw, brief);
  if (nonBuyerReason) {
    return reject(nonBuyerReason, "Rejected because this looks like an institution, association, directory, or unrelated listing instead of a concrete buyer prospect.");
  }
  if (prospectPageRejectReason({ title: raw.businessName ?? raw.evidence?.[0]?.label, url, host })) {
    return reject("non-business-page", "Rejected because this is not a public business prospect page.");
  }
  const marketplaceReason = marketplaceRejectReason({ title: raw.businessName ?? raw.evidence?.[0]?.label, url, host });
  if (marketplaceReason) {
    return reject(marketplaceReason, marketplaceReason === "generic-directory"
      ? "Rejected because this looks like a generic listing page instead of one clear business prospect."
      : "Rejected because this looks like a marketplace, book, or product page instead of a business lead.");
  }
  if (utilityPageRejectReason({ title: raw.businessName ?? raw.evidence?.[0]?.label, url, host })) {
    return reject("non-business-page", "Rejected because the source is not a public business prospect page.");
  }
  if (/justdial|sulekha|indiamart|directory|listing|top\s+\d+|best\s+\d+/i.test(`${host} ${combined}`) && !raw.website && !raw.phone && !raw.email) {
    return reject("generic-directory", "Rejected because this is a generic listing page without one clear business to contact.");
  }
  if (location.status === "not-found" && locationTokens(brief).length > 0) {
    return {
      status: "needs-proof",
      reason: "out-of-location",
      summary: "Needs proof because the requested location was not visible in the public evidence.",
      decidedAt: nowIso()
    };
  }
  if (evidenceCountryConflicts(raw, brief)) {
    return {
      status: "needs-proof",
      reason: "out-of-location",
      summary: "Needs proof because the public evidence appears to belong to a different country than the requested search location.",
      decidedAt: nowIso()
    };
  }
  if (!hasCustomerIdentity) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because Leadsy could not confirm one clear business identity from public evidence.",
      decidedAt: nowIso()
    };
  }
  if (isDirectoryOnlyEvidence(raw)) {
    return {
      status: "needs-proof",
      reason: "generic-directory",
      summary: "Needs proof because a directory/listing page can support evidence but cannot be the only Good-lead identity.",
      decidedAt: nowIso()
    };
  }
  if (passiveEvidenceOnly(raw)) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because review, content, news, or competitor signals can enrich a lead but cannot create a Good lead alone.",
      decidedAt: nowIso()
    };
  }
  if (!hasBusinessProfileIntent) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because the public profile does not yet show business intent, buyer fit, and a contact path.",
      decidedAt: nowIso()
    };
  }
  if (!hasPublicWebIdentity || !hasPublicEvidenceUrl) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because the record does not yet have a website or public profile evidence URL.",
      decidedAt: nowIso()
    };
  }
  if (!hasIndustryFit) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because the public evidence does not yet prove this business fits the requested buyer lane.",
      decidedAt: nowIso()
    };
  }
  if ((audienceMode === "consumer-intent" || audienceMode === "recruiting-candidate") && !rawHasExplicitIntentOrContact(raw, brief)) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because this mode needs explicit public intent or contact evidence before becoming a Good lead.",
      decidedAt: nowIso()
    };
  }
  if (profileModeAllowsProfileAsContact(audienceMode) && hasPublicEvidenceUrl && hasPublicWebIdentity && hasCustomerIdentity && hasIndustryFit && hasContactPath) {
    return {
      status: "good",
      summary: "Saved as a usable profile lead because it has a public identity, profile evidence, audience fit, and market clue for manual inspection.",
      decidedAt: nowIso()
    };
  }
  if (!rawHasConcreteBuyerSubtype(raw, brief)) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because the record matches a broad industry word but not a concrete buyer subtype from the campaign lane.",
      decidedAt: nowIso()
    };
  }
  if (!hasContactPath) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because no public contact path was found yet.",
      decidedAt: nowIso()
    };
  }
  if (rawSelfReportsNeedsProof(raw)) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because the dossier itself reported incomplete proof or contactability.",
      decidedAt: nowIso()
    };
  }
  if (score.confidence < 40) {
    return {
      status: "needs-proof",
      reason: "weak-evidence",
      summary: "Needs proof because public contact or evidence is still weak.",
      decidedAt: nowIso()
    };
  }
  return {
    status: "good",
    summary: "Saved as a usable lead because it has public evidence, a business identity, and enough fit/contact signal.",
    decidedAt: nowIso()
  };
}

function qualityGateBreakdownForRaw(raw: RawLeadCandidate, brief: LeadBrief, decision: LeadQualityDecision): LeadQualityGateBreakdown {
  if (decision.status === "good") return { savedGood: 1 };
  if (decision.status === "rejected") {
    return decision.reason === "blocked-source" ? { blockedSource: 1 } : { rejectedNoise: 1 };
  }
  const score = scoreLead(raw, brief);
  if (!hasEvidenceUrl(raw)) return { missingEvidenceUrl: 1 };
  if (!rawHasContactPath(raw, brief)) return { missingContact: 1 };
  const location = leadLocation(raw, brief);
  if (location.status === "not-found" || evidenceCountryConflicts(raw, brief)) return { missingLocation: 1 };
  if (!rawHasIndustryFit(raw, brief) || !rawHasConcreteBuyerSubtype(raw, brief)) return { weakFit: 1 };
  if (isDirectoryOnlyEvidence(raw)) return { directoryOnly: 1 };
  if (passiveEvidenceOnly(raw)) return { passiveEvidence: 1 };
  if (!raw.businessName?.trim() || genericBusinessName(raw.businessName)) return { weakIdentity: 1 };
  if (score.confidence < 40) return { scoreTooLow: 1 };
  return { rejectedNoise: 1 };
}

function createLeadDossier(rawInput: RawLeadCandidate, brief: LeadBrief, tenantId: string, ownerId: string): LeadDossier | null {
  const raw = normalizedRawLeadIdentity(rawInput);
  const businessName = raw.businessName?.trim();
  const city = raw.city?.trim() || brief.searchLocations.trim();
  const evidence = (raw.evidence ?? []).filter((item) => item.url || item.note);
  if (!businessName || !city || !evidence.length) {
    return null;
  }

  const score = scoreLead({ ...raw, evidence }, brief);
  if (score.status === "blocked") {
    return null;
  }
  const qualityDecision = qualityDecisionForRaw({ ...raw, evidence }, brief, score);
  if (qualityDecision.status === "rejected") {
    return null;
  }
  const location = leadLocation({ ...raw, evidence }, brief);
  const sentiment = leadSentiment(raw, score);

  const phone = normalizePhone(raw.phone, brief);
  const whatsapp = normalizePhone(raw.whatsapp, brief);
  const now = nowIso();
  return {
    id: `lead_${crypto.randomUUID()}`,
    tenantId,
    ownerId,
    audienceMode: audienceModeForRaw(raw, brief),
    businessName,
    category: raw.category?.trim() || "Unknown business category",
    city,
    area: raw.area?.trim() || undefined,
    location: {
      ...location,
      city: location.city || city,
      area: location.area || raw.area?.trim() || undefined
    },
    phone,
    whatsapp,
    email: normalizeEmail(raw.email),
    website: normalizeUrl(raw.website),
    instagram: normalizeUrl(raw.instagram),
    facebook: normalizeUrl(raw.facebook),
    linkedin: normalizeUrl(raw.linkedin),
    googleMapsUrl: normalizeUrl(raw.googleMapsUrl),
    address: raw.address?.trim() || undefined,
    rating: typeof raw.rating === "number" ? raw.rating : undefined,
    reviewCount: typeof raw.reviewCount === "number" ? raw.reviewCount : undefined,
    recentActivitySignals: raw.recentActivitySignals?.filter(Boolean).slice(0, 5) ?? [],
    contentQualitySignal: raw.contentQualitySignal?.trim() || "Needs manual content review.",
    whyTheyMayNeedAgency:
      raw.whyTheyMayNeedAgency?.trim() ||
      `Potential fit for ${brief.service} based on public business context and the agency lead brief.`,
    outreachAngle:
      raw.outreachAngle?.trim() ||
      `Lead with a practical ${brief.service} improvement connected to their local visibility.`,
    nextAction: raw.nextAction?.trim() || "Review evidence, then approve an AI-drafted WhatsApp or DM.",
    sentiment,
    qualityDecision,
    analysisSummary:
      raw.analysisSummary?.trim() ||
      `${qualityDecision.summary} Sentiment: ${sentiment.label}. Location: ${location.evidence ?? "location not found"}.`,
    quarantineReason: qualityDecision.status === "needs-proof" ? qualityDecision.reason : undefined,
    score,
    evidence,
    sourceTypes: raw.sourceTypes?.length ? [...new Set(raw.sourceTypes)] : ["manual-import"],
    createdAt: now,
    updatedAt: now
  };
}

function uniqueLeadKey(lead: LeadDossier) {
  return (
    normalizePhone(lead.phone) ||
    normalizePhone(lead.whatsapp) ||
    normalizeUrl(lead.website)?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase() ||
    `${lead.businessName}:${lead.city}`.toLowerCase().replace(/[^a-z0-9:]+/g, "")
  );
}

function dedupeLeads(leads: LeadDossier[]) {
  const byKey = new Map<string, LeadDossier>();
  for (const lead of leads) {
    const key = uniqueLeadKey(lead);
    const current = byKey.get(key);
    if (!current || lead.score.overall > current.score.overall) {
      byKey.set(key, {
        ...(current ?? lead),
        ...lead,
        evidence: [...(current?.evidence ?? []), ...lead.evidence].filter(
          (item, index, all) => all.findIndex((candidate) => (candidate.url ?? candidate.note) === (item.url ?? item.note)) === index
        ),
        sourceTypes: [...new Set([...(current?.sourceTypes ?? []), ...lead.sourceTypes])]
      });
    }
  }
  return [...byKey.values()].sort((left, right) => right.score.overall - left.score.overall);
}

function openRouterKey() {
  return process.env.OPENROUTER_API_KEY?.trim();
}

function openRouterBaseUrl() {
  return process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
}

async function postJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text.slice(0, 500) || `Request failed with ${response.status}`);
  }
  return JSON.parse(text) as T;
}

function parseJsonFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function rawLeadsFromUnknown(value: unknown): RawLeadCandidate[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const maybe = value as { leads?: unknown; dossiers?: unknown; results?: unknown };
  const list = Array.isArray(maybe.leads)
    ? maybe.leads
    : Array.isArray(maybe.dossiers)
      ? maybe.dossiers
      : Array.isArray(maybe.results)
        ? maybe.results
        : [];
  return list.filter((item): item is RawLeadCandidate => Boolean(item && typeof item === "object"));
}

function leadResearchJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      leads: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            businessName: { type: "string" },
            audienceMode: { type: "string", enum: leadDiscoveryModes },
            category: { type: "string" },
            city: { type: "string" },
            area: { type: "string" },
            phone: { type: "string" },
            whatsapp: { type: "string" },
            email: { type: "string" },
            website: { type: "string" },
            instagram: { type: "string" },
            facebook: { type: "string" },
            linkedin: { type: "string" },
            googleMapsUrl: { type: "string" },
            address: { type: "string" },
            rating: { type: "number" },
            reviewCount: { type: "number" },
            recentActivitySignals: { type: "array", items: { type: "string" } },
            contentQualitySignal: { type: "string" },
            whyTheyMayNeedAgency: { type: "string" },
            outreachAngle: { type: "string" },
            nextAction: { type: "string" },
            analysisSummary: { type: "string" },
            sentiment: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string", enum: ["positive", "neutral", "hesitant", "negative"] },
                score: { type: "number" },
                reason: { type: "string" }
              }
            },
            sourceTypes: {
              type: "array",
              items: { type: "string", enum: Object.keys(sourceInstructions) }
            },
            evidence: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  label: { type: "string" },
                  url: { type: "string" },
                  note: { type: "string" },
                  sourceType: { type: "string", enum: Object.keys(sourceInstructions) },
                  capturedAt: { type: "string" }
                },
                required: ["label", "sourceType", "capturedAt"]
              }
            }
          },
          required: ["businessName", "category", "city", "whyTheyMayNeedAgency", "outreachAngle", "evidence"]
        }
      }
    },
    required: ["leads"]
  };
}

type PlannedSearch = {
  query: string;
  sourceType: LeadResearchSourceType;
  audienceMode?: LeadDiscoveryMode;
  why?: string;
};

type SearchCandidate = PublicSearchResult & {
  query: string;
  sourceType: LeadResearchSourceType;
  audienceMode?: LeadDiscoveryMode;
  rank: number;
};

type FetchedResearchPage = PublicFetchResult & {
  query: string;
  sourceType: LeadResearchSourceType;
  audienceMode?: LeadDiscoveryMode;
  titleFromSearch: string;
  rank: number;
};

export type LeadSearchResultClassification =
  | "business"
  | "business-page"
  | "directory"
  | "article"
  | "portal"
  | "vendor"
  | "job"
  | "job-post"
  | "marketplace-listing"
  | "social-profile"
  | "creator-profile"
  | "personal-profile"
  | "candidate-profile"
  | "noise";

export type LeadContactPath = {
  type: "email" | "phone" | "whatsapp" | "website" | "linkedin" | "facebook" | "instagram" | "social" | "enquiry-form";
  value: string;
  url?: string;
  source?: string;
};

type ResearchBudget = {
  mode: "broad" | "focused";
  maxSearches: number;
  resultsPerSearch: number;
  maxFetches: number;
  maxSaves: number;
  targetLeadGoal: number;
  minQualifiedTarget: number;
  batchNumber: number;
  batchSize: number;
  existingGoodCount: number;
  excludedDomains: string[];
};

type ResearchToolStats = LeadResearchMetrics & {
  queries: string[];
  errors: string[];
};

type CampaignProgress = {
  targetLeadGoal: number;
  minQualifiedTarget: number;
  batchNumber: number;
  batchSize: number;
  existingGoodCount: number;
  excludedDomains: string[];
};

type ResearchContext = {
  runId: string;
  tenantId: string;
  ownerId: string;
  events: LeadResearchEvent[];
  spendGuard: SpendGuard;
  onEvent?: LeadResearchProgressHandler;
};

function emptyResearchStats(): ResearchToolStats {
  return {
    searchesRun: 0,
    pagesFetched: 0,
    candidateCount: 0,
    dedupedCount: 0,
    savedCount: 0,
    rawResultsDiscarded: 0,
    usableProspects: 0,
    properDataCount: 0,
    missingContactCount: 0,
    directFetchBlocked: 0,
    retriedAfterBackoff: 0,
    alternateSourceRecovered: 0,
    robotsSkipped: 0,
    sourceDeferred: 0,
    rateLimitedCount: 0,
    qualityGateBreakdown: {},
    sourceBreakdown: {},
    queries: [],
    errors: []
  };
}

function emptySourceBreakdown(): LeadResearchSourceBreakdown {
  return {
    searchesRun: 0,
    candidateCount: 0,
    pagesFetched: 0,
    rawResultsDiscarded: 0,
    promisingCount: 0,
    directFetchBlocked: 0,
    retriedAfterBackoff: 0,
    alternateSourceRecovered: 0,
    robotsSkipped: 0,
    sourceDeferred: 0,
    rateLimitedCount: 0,
    usableProspects: 0,
    properDataCount: 0,
    missingContactCount: 0,
    needsProof: 0,
    rejected: 0,
    savedCount: 0,
    costInr: 0,
    qualityGateBreakdown: {}
  };
}

function ensureSourceBreakdown(stats: ResearchToolStats, sourceType: LeadResearchSourceType) {
  stats.sourceBreakdown ??= {};
  stats.sourceBreakdown[sourceType] ??= emptySourceBreakdown();
  return stats.sourceBreakdown[sourceType]!;
}

function addSourceBreakdown(
  stats: ResearchToolStats | undefined,
  sourceType: LeadResearchSourceType | undefined,
  patch: Partial<LeadResearchSourceBreakdown>
) {
  if (!stats || !sourceType) return;
  const current = ensureSourceBreakdown(stats, sourceType);
  for (const [key, value] of Object.entries(patch) as Array<[keyof LeadResearchSourceBreakdown, LeadResearchSourceBreakdown[keyof LeadResearchSourceBreakdown]]>) {
    if (key === "qualityGateBreakdown" || typeof value !== "number" || !value) continue;
    const writable = current as unknown as Record<string, number | undefined>;
    writable[key] = (writable[key] ?? 0) + value;
  }
}

function addQualityGateBreakdown(
  stats: ResearchToolStats | undefined,
  sourceType: LeadResearchSourceType | undefined,
  patch: LeadQualityGateBreakdown
) {
  if (!stats) return;
  stats.qualityGateBreakdown ??= {};
  for (const [key, value] of Object.entries(patch) as Array<[keyof LeadQualityGateBreakdown, number | undefined]>) {
    if (!value) continue;
    stats.qualityGateBreakdown[key] = (stats.qualityGateBreakdown[key] ?? 0) + value;
  }
  if (sourceType) {
    const source = ensureSourceBreakdown(stats, sourceType);
    source.qualityGateBreakdown ??= {};
    for (const [key, value] of Object.entries(patch) as Array<[keyof LeadQualityGateBreakdown, number | undefined]>) {
      if (!value) continue;
      source.qualityGateBreakdown[key] = (source.qualityGateBreakdown[key] ?? 0) + value;
    }
  }
}

function sourceBreakdownSnapshot(stats: ResearchToolStats) {
  const breakdown = stats.sourceBreakdown ?? {};
  return Object.fromEntries(
    Object.entries(breakdown)
      .filter((entry): entry is [string, LeadResearchSourceBreakdown] => Boolean(entry[1]))
      .filter(([, metrics]) => {
        const total =
          metrics.searchesRun +
          metrics.candidateCount +
          metrics.pagesFetched +
          (metrics.rawResultsDiscarded ?? 0) +
          (metrics.usableProspects ?? 0) +
          (metrics.needsProof ?? 0) +
          (metrics.rejected ?? 0) +
          (metrics.sourceDeferred ?? 0);
        return total > 0;
      })
      .map(([source, metrics]) => [source, { ...metrics }])
  ) as LeadResearchMetrics["sourceBreakdown"];
}

function recordFetchDiagnostics(stats: ResearchToolStats, diagnostics?: PublicFetchDiagnostic[], sourceType?: LeadResearchSourceType) {
  for (const diagnostic of diagnostics ?? []) {
    if (diagnostic.type === "direct-fetch-blocked") {
      stats.directFetchBlocked = (stats.directFetchBlocked ?? 0) + 1;
      stats.sourceDeferred = (stats.sourceDeferred ?? 0) + 1;
      addSourceBreakdown(stats, sourceType, { directFetchBlocked: 1, sourceDeferred: 1 });
    }
    if (diagnostic.type === "rate-limited") {
      stats.rateLimitedCount = (stats.rateLimitedCount ?? 0) + 1;
      stats.sourceDeferred = (stats.sourceDeferred ?? 0) + 1;
      addSourceBreakdown(stats, sourceType, { rateLimitedCount: 1, sourceDeferred: 1 });
    }
    if (diagnostic.type === "retried-after-backoff") {
      stats.retriedAfterBackoff = (stats.retriedAfterBackoff ?? 0) + 1;
      addSourceBreakdown(stats, sourceType, { retriedAfterBackoff: 1 });
    }
    if (diagnostic.type === "robots-skipped") {
      stats.robotsSkipped = (stats.robotsSkipped ?? 0) + 1;
      stats.sourceDeferred = (stats.sourceDeferred ?? 0) + 1;
      addSourceBreakdown(stats, sourceType, { robotsSkipped: 1, sourceDeferred: 1 });
    }
    if (diagnostic.type === "domain-capped" || diagnostic.type === "source-deferred") {
      stats.sourceDeferred = (stats.sourceDeferred ?? 0) + 1;
      addSourceBreakdown(stats, sourceType, { sourceDeferred: 1 });
    }
  }
}

function clampLeadGoal(value: number) {
  return Math.max(1, Math.min(LEAD_MAGNET_MAX_LEAD_GOAL, Math.round(value)));
}

export function campaignMinQualifiedTarget(leadGoal: number) {
  return clampLeadGoal(leadGoal);
}

function configuredBatchSize() {
  const configured = parseNumber(process.env.LEADSY_RESEARCH_BATCH_SIZE);
  const raw = configured && configured > 0 ? configured : LEAD_MAGNET_DEFAULT_BATCH_SIZE;
  return Math.max(LEAD_MAGNET_BATCH_MIN, Math.min(LEAD_MAGNET_BATCH_MAX, Math.round(raw)));
}

function domainFromUrl(value?: string) {
  try {
    return value ? new URL(value).hostname.replace(/^www\./, "").toLowerCase() : "";
  } catch {
    return "";
  }
}

function leadEvidenceDomains(lead: LeadDossier) {
  return [
    domainFromUrl(lead.website),
    domainFromUrl(lead.instagram),
    domainFromUrl(lead.facebook),
    domainFromUrl(lead.linkedin),
    ...lead.evidence.map((item) => domainFromUrl(item.url))
	  ].filter((domain) => domain && !/(^|\.)instagram\.com$|(^|\.)facebook\.com$|(^|\.)linkedin\.com$|(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)google\.com$/i.test(domain));
}

function briefSnapshotForFingerprint(brief: LeadBrief): LeadBriefSnapshot {
  return {
    service: brief.service,
    idealCustomers: brief.idealCustomers,
    searchLocations: brief.searchLocations,
    leadGoal: brief.leadGoal,
    researchMode: brief.researchMode,
    sources: brief.sources,
    aiAction: brief.aiAction,
    excludedLeads: brief.excludedLeads,
    ownerWebsiteUrl: brief.ownerWebsiteUrl
  };
}

function briefFingerprintForBrief(brief: LeadBrief) {
  return leadBriefFingerprint(briefSnapshotForFingerprint(brief));
}

function leadBelongsToBrief(lead: LeadDossier, brief: LeadBrief) {
  return lead.briefFingerprint === briefFingerprintForBrief(brief);
}

function campaignProgressForBrief(
  brief: LeadBrief,
  existingLeads: LeadDossier[] = [],
  previousRuns: LeadSourceRun[] = []
): CampaignProgress {
  const targetLeadGoal = clampLeadGoal(brief.leadGoal);
  const minQualifiedTarget = campaignMinQualifiedTarget(targetLeadGoal);
  const batchSize = targetLeadGoal > 100 ? configuredBatchSize() : targetLeadGoal;
  const currentBriefFingerprint = briefFingerprintForBrief(brief);
  const currentBriefLeads = existingLeads.filter((lead) => leadBelongsToBrief(lead, brief));
  const existingGoodCount = currentBriefLeads.filter((lead) => lead.qualityDecision?.status === "good").length;
  const previousBatchNumber = Math.max(
    0,
    ...previousRuns
      .filter((run) => run.runLabel !== "QA Scenario" && run.runLabel !== "Worst Case")
      .filter((run) => run.inputSnapshot && leadBriefFingerprint(run.inputSnapshot) === currentBriefFingerprint)
      .map((run) => run.metrics?.batchNumber ?? 0)
  );
  const inferredBatchNumber = Math.floor(existingGoodCount / Math.max(1, batchSize)) + 1;
  return {
    targetLeadGoal,
    minQualifiedTarget,
    batchNumber: Math.max(previousBatchNumber + 1, inferredBatchNumber),
    batchSize,
    existingGoodCount,
    excludedDomains: [...new Set(currentBriefLeads.flatMap(leadEvidenceDomains))].slice(0, 80)
  };
}

function remainingBatchSaveTarget(progress: CampaignProgress) {
  const remaining = progress.targetLeadGoal - progress.existingGoodCount;
  return Math.max(1, Math.min(progress.batchSize, Math.max(1, remaining)));
}

function researchBudgetForBrief(brief: LeadBrief, progress = campaignProgressForBrief(brief)): ResearchBudget {
  const broad = brief.researchMode === "broad" || (!brief.researchMode && (brief.leadGoal >= 25 || brief.sources.length >= defaultResearchSources.length));
  const campaign = progress.targetLeadGoal > 100;
  return broad
    ? {
        mode: "broad",
        maxSearches: campaign ? 18 : 12,
        resultsPerSearch: campaign ? 12 : 10,
        maxFetches: campaign ? 100 : 50,
        maxSaves: remainingBatchSaveTarget(progress),
        ...progress
      }
    : {
        mode: "focused",
        maxSearches: campaign ? 8 : 5,
        resultsPerSearch: 8,
        maxFetches: campaign ? 40 : 20,
        maxSaves: remainingBatchSaveTarget(progress),
        ...progress
      };
}

const defaultSpendCapInr = 1;

function spendCapFromEnv() {
  const configured = parseNumber(process.env.LEADSY_SPEND_CAP_INR) ?? parseNumber(process.env.LEADSY_DEFAULT_SPEND_CAP_INR);
  return configured && configured > 0 ? configured : defaultSpendCapInr;
}

function openRouterPlannerModel() {
  return process.env.OPENROUTER_FAST_MODEL || process.env.OPENROUTER_RESEARCH_MODEL || process.env.AI_DEFAULT_MODEL || "openai/gpt-5.2";
}

function openRouterDossierModel() {
  return process.env.OPENROUTER_DOSSIER_MODEL || process.env.OPENROUTER_RESEARCH_MODEL || process.env.OPENROUTER_SENTIMENT_MODEL || process.env.AI_DEFAULT_MODEL || "openai/gpt-5.2";
}

function expensiveResearchModel() {
  const model = openRouterDossierModel().toLowerCase();
  return /gpt-5|claude-4|opus|o1|o3|o4|reasoning/.test(model);
}

function sanitizeSearchTerm(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s&+.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function locationFocuses(brief: LeadBrief) {
  const raw = sanitizeSearchTerm(brief.searchLocations);
  if (!raw) return [""];
  const normalized = raw.toLowerCase();
  if (/\bafrica\b/.test(normalized)) {
    return ["Nigeria", "Kenya", "South Africa", "Ghana"].slice(0, 4);
  }
  if (/\benglish[-\s]?speaking markets?\b/.test(normalized)) {
    return ["United States", "United Kingdom", "Canada", "Australia"].slice(0, 4);
  }
  if (/\bglobal\b|\bworldwide\b|\binternational\b/.test(normalized)) {
    return ["United States", "United Kingdom", "India", "Canada"].slice(0, 4);
  }
  return raw
    .split(/,|\/|\bor\b/i)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function searchExclusionSuffix(brief: LeadBrief) {
  const excluded = brief.excludedLeads.toLowerCase();
  const tokens = new Set<string>();
  ["-assignment", "-essay", "-article", "-news", "-wikipedia"].forEach((token) => tokens.add(token));
  if (/big|enterprise|5cr|10cr|famous|mnc|listed|public company/.test(excluded)) {
    ["-careers", "-investor"].forEach((token) => tokens.add(token));
  }
  if (/agenc/.test(excluded)) tokens.add("-agency");
  if (/outside|other city/.test(excluded)) tokens.add("-outside");
  return [...tokens].join(" ");
}

function titleCaseWords(value: string) {
  return value.replace(/\b[a-z]/gi, (char) => char.toUpperCase());
}

function meaningfulBriefTerms(value: string, limit = 8) {
  return [
    ...new Set(
      sanitizeSearchTerm(value)
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length >= 3)
        .filter(
          (token) =>
            !/^(and|or|the|for|with|without|from|near|over|above|under|below|between|revenue|turnover|business|businesses|company|companies|industries|industry|clients|customers|find|search|lead|leads|good|proper|real|big|small|medium|large)$/.test(
              token
            )
        )
    )
  ].slice(0, limit);
}

function cleanTermList(values: string[], limit = 8) {
  return [
    ...new Set(
      values
        .map((value) => sanitizeSearchTerm(value).trim())
        .filter((value) => value.length >= 3 && value.length <= 90)
    )
  ].slice(0, limit);
}

function ownerWebsiteContextFromPage(brief: LeadBrief, page?: PublicFetchResult, error?: string): OwnerWebsiteContext {
  const url = normalizeUrl(brief.ownerWebsiteUrl);
  if (!url) {
    return {
      status: "not-provided",
      summary: "Owner website was not provided.",
      offerTerms: [],
      buyerTypes: [],
      marketTerms: [],
      disqualifiers: [],
      proofTerms: []
    };
  }
  if (!page) {
    return {
      url,
      status: "unavailable",
      summary: error || "Owner website could not be fetched from public pages.",
      offerTerms: meaningfulBriefTerms(`${brief.service} ${brief.idealCustomers}`, 8),
      buyerTypes: splitBriefPhrases(brief.idealCustomers),
      marketTerms: splitBriefPhrases(brief.searchLocations),
      disqualifiers: splitBriefPhrases(brief.excludedLeads),
      proofTerms: ["public evidence", "contact path"],
      error,
      fetchedAt: nowIso()
    };
  }
  const text = `${page.title} ${page.siteName ?? ""} ${page.schemaName ?? ""} ${page.logoAlt ?? ""} ${page.text.slice(0, 5000)}`;
  const sentences = page.text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 30 && sentence.length <= 220)
    .slice(0, 3);
  return {
    url: page.url || url,
    status: "fetched",
    summary: sentences.join(" ") || `${page.title || "Owner website"} public page context.`,
    offerTerms: cleanTermList([...meaningfulBriefTerms(`${brief.service} ${text}`, 12), ...splitBriefPhrases(brief.service)], 10),
    buyerTypes: cleanTermList([...splitBriefPhrases(brief.idealCustomers), ...meaningfulBriefTerms(text, 12)], 10),
    marketTerms: cleanTermList([...splitBriefPhrases(brief.searchLocations), ...meaningfulBriefTerms(`${brief.searchLocations} ${text}`, 6)], 8),
    disqualifiers: cleanTermList(splitBriefPhrases(brief.excludedLeads), 8),
    proofTerms: cleanTermList(["contact", "about", "services", "enquiry", "booking", ...meaningfulBriefTerms(text, 8)], 10),
    fetchedAt: nowIso()
  };
}

async function resolveOwnerWebsiteContext(brief: LeadBrief): Promise<OwnerWebsiteContext | undefined> {
  const url = normalizeUrl(brief.ownerWebsiteUrl);
  if (!url) return undefined;
  try {
    const page = await fetchPublicPage({ url });
    return ownerWebsiteContextFromPage(brief, page);
  } catch (error) {
    return ownerWebsiteContextFromPage(brief, undefined, isPublicFetchError(error) ? error.message : (error as Error).message);
  }
}

function splitBriefPhrases(value: string, fallback: string[] = []) {
  const clean = value
    .replace(/\b(industries|industry|companies|businesses|customers|clients|ideal|target|like|such as|revenue|turnover|over|above|under|below|between)\b/gi, " ")
    .replace(/\b\d+\s*(?:cr|crore|lakh|m|million|k)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const phrases = clean
    .split(/,|\/|;|\bor\b|\band\b/gi)
    .map((part) => sanitizeSearchTerm(part).trim())
    .filter((part) => part.length >= 3 && part.length <= 72)
    .filter((part) => !/^(with|without|revenue|turnover|people|staff|team|employees|markets?)$/i.test(part));
  return [...new Set(phrases.length ? phrases : fallback)].slice(0, 8);
}

function offerTriggerPhrase(brief: LeadBrief) {
  const serviceTerms = meaningfulBriefTerms(brief.service, 5).join(" ");
  const offer = serviceTerms || sanitizeSearchTerm(brief.service).slice(0, 60);
  return `${offer} enquiry procurement contact requirements`.replace(/\s+/g, " ").trim();
}

function genericBuyerPhrases(brief: LeadBrief, ownerContext?: OwnerWebsiteContext) {
  if (ownerContext?.buyerTypes.length) {
    return ownerContext.buyerTypes.slice(0, 8);
  }
  const customerPhrases = splitBriefPhrases(brief.idealCustomers);
  if (customerPhrases.length) return customerPhrases;
  const serviceTerms = meaningfulBriefTerms(brief.service, 4).join(" ");
  return [serviceTerms ? `businesses needing ${serviceTerms}` : "businesses with public contact pages"];
}

function buyerSegmentForMode(buyer: string, mode: LeadDiscoveryMode) {
  if (mode === "creator-influencer") return /\b(creator|influencer|profile)\b/i.test(buyer) ? buyer : `${buyer} creators and influencers`;
  if (mode === "b2c-public-profile") return /\b(profile|people|creator|professional)\b/i.test(buyer) ? buyer : `${buyer} public profiles`;
  if (mode === "consumer-intent") return /\b(people|consumer|customer|buyer|user|parent|student|homeowner|patient)\b/i.test(buyer) ? buyer : `people asking for ${buyer}`;
  if (mode === "recruiting-candidate") return /\b(candidate|developer|job|resume|portfolio|professional)\b/i.test(buyer) ? buyer : `${buyer} candidates`;
  return /\bbusiness(?:es)?\b/i.test(buyer) ? buyer : `${buyer} businesses`;
}

function expectedEvidenceForMode(mode: LeadDiscoveryMode) {
  if (mode === "creator-influencer" || mode === "b2c-public-profile") {
    return [
      "real public identity",
      "audience/profile fit",
      "requested geography or market clue",
      "public profile or evidence URL",
      "profile URL or contact path"
    ];
  }
  if (mode === "consumer-intent") {
    return [
      "real public identity or listing",
      "visible intent signal",
      "requested geography or market clue",
      "public evidence URL",
      "contact path or profile for manual inspection"
    ];
  }
  if (mode === "recruiting-candidate") {
    return [
      "real candidate identity",
      "role/skill fit",
      "market or availability clue",
      "public portfolio/profile evidence URL",
      "contact path or profile for manual inspection"
    ];
  }
  return [
    "real business identity",
    "public evidence URL",
    "buyer-lane fit",
    "requested geography or market proof",
    "contact page, email, phone, WhatsApp, public profile, or enquiry form"
  ];
}

function genericLeadResearchStrategy(
  brief: LeadBrief,
  selectedSources: LeadResearchSourceType[] = selectedCollectorSources(brief),
  ownerWebsiteContext?: OwnerWebsiteContext
): LeadResearchStrategy {
  const buyerPhrases = genericBuyerPhrases(brief, ownerWebsiteContext);
  const markets = locationFocuses(brief);
  const audienceModes = detectAudienceModes(brief);
  const trigger = offerTriggerPhrase(brief);
  const lanes: SearchLane[] = [];

  for (const location of markets.length ? markets : [""]) {
    for (const mode of audienceModes) {
      for (const buyer of buyerPhrases) {
        if (lanes.length >= 12) break;
        const buyerSegment = buyerSegmentForMode(buyer, mode);
        const sourceTypes = sourceTypesForMode(mode, selectedSources);
        const segment = {
          label: titleCaseWords(`${audienceModeLabel(mode)} ${buyer}`),
          buyerSegment,
          signal: modeSignalPhrase(mode, brief),
          sources: sourceTypes
        };
        const searches = buildCollectorSearchesForLane({
          segment,
          location,
          brief,
          selectedSources: segment.sources,
          batchNumber: 1
        });
        lanes.push({
          id: `lane_${lanes.length + 1}`,
          label: `${audienceModeLabel(mode)} · ${titleCaseWords(buyer)}${location ? ` · ${location}` : ""}`,
          audienceMode: mode,
          buyerSegment,
          locationFocus: location,
          sourceTypes,
          queries: searches.map((search) => search.query),
          searches,
          why: `Research ${buyerSegment}${location ? ` in ${location}` : ""} for ${audienceModeLabel(mode).toLowerCase()} signals related to ${brief.service}.`,
          expectedEvidence: expectedEvidenceForMode(mode)
        });
      }
    }
  }

  return {
    offer: brief.service.trim(),
    ownerWebsiteContext,
    audienceModes,
    buyerTypes: buyerPhrases,
    markets,
    buyingTriggers: [
      ...(ownerWebsiteContext?.offerTerms ?? []),
      trigger,
      "contact us enquiry procurement facilities services",
      "active website public profile reviews team locations"
    ],
    disqualifiers: cleanTermList([
      ...splitBriefPhrases(brief.excludedLeads, brief.excludedLeads ? [brief.excludedLeads] : []),
      ...(ownerWebsiteContext?.disqualifiers ?? [])
    ]),
    evidenceRules: [
      "real business identity",
      "buyer fit for the current lane",
      "requested geography or acceptable market proof",
      "public evidence URL",
      "at least one public contact path",
      ...(ownerWebsiteContext?.proofTerms ?? []).slice(0, 3)
    ],
    assumptions: revenueProxyAssumptions(brief),
    questions: clarificationQuestionsForBrief(brief, buyerPhrases, markets),
    lanes
  };
}

function revenueProxyAssumptions(brief: LeadBrief) {
  const text = `${brief.idealCustomers} ${brief.excludedLeads}`.toLowerCase();
  if (!/\b(revenue|turnover|cr|crore|lakh|million|budget|company size|employees|staff)\b/i.test(text)) {
    return [];
  }
  return [
    "Revenue or company size will be treated as a public proxy unless directly proven.",
    "Proxy signals include institutional buyer type, multi-location footprint, active website, visible team, projects, reviews, procurement/facility pages, or public scale clues."
  ];
}

function clarificationQuestionsForBrief(brief: LeadBrief, buyerPhrases: string[], markets: string[]): AgentQuestion[] {
  const questions: AgentQuestion[] = [];
  const audienceModes = detectAudienceModes(brief);
  const briefText = briefDiscoveryText(brief);
  const broadMarket = /\b(africa|asia|europe|global|worldwide|international|english[-\s]?speaking markets?)\b/i.test(brief.searchLocations);
  const vagueBuyer = buyerPhrases.length <= 1 && /businesses|companies|industries|clients|customers/i.test(brief.idealCustomers);
  const ambiguousAudience =
    audienceModes.length > 1 ||
    /\b(customers?|leads?|people|audience|users?)\b/i.test(briefText) ||
    (/\bgym\b/i.test(briefText) && /\b(customers?|members?)\b/i.test(briefText));

  if (ambiguousAudience) {
    const defaultMode = audienceModes[0] ?? "b2b-company";
    const modeOptions = [
      ...audienceModes,
      ...(["b2b-company", "b2b-local-business", "creator-influencer", "consumer-intent", "recruiting-candidate"] as LeadDiscoveryMode[])
    ]
      .filter((mode, index, all) => all.indexOf(mode) === index)
      .slice(0, 3);
    const modeOptionsWithAll = [
      ...modeOptions.map((mode) => ({
        id: mode,
        label: audienceModeLabel(mode),
        description:
          mode === "b2b-company"
            ? "Find companies and institutions with public websites, listings, and contact paths."
            : mode === "b2b-local-business"
              ? "Find local businesses with public listings, reviews, websites, or social pages."
              : mode === "recruiting-candidate"
                ? "Find public candidate, portfolio, resume, or professional profile evidence."
                : mode === "consumer-intent"
                  ? "Find public posts/listings where people show buying or request intent."
                  : "Find public profile or creator pages that can be inspected manually.",
        recommended: mode === defaultMode
      })),
      ...(audienceModes.length > 1
        ? [
            {
              id: "all-relevant-modes",
              label: "All relevant modes",
              description: "Create separated lanes for each plausible audience mode and keep results grouped by mode.",
              recommended: false
            }
          ]
        : [])
    ];
    questions.push({
      id: "audience-mode",
      category: "audience-mode",
      prompt: "Which audience should I search first?",
      kind: "single-choice",
      defaultOptionId: defaultMode,
      reason: "The brief could point to more than one lead type, so Leadsy should choose the first search mode before spending searches.",
      options: modeOptionsWithAll.slice(0, 4)
    });
  }

  if (vagueBuyer) {
    questions.push({
      id: "buyer-priority",
      category: "buyer-priority",
      prompt: "Which buyer type should I start with?",
      kind: "single-choice",
      defaultOptionId: "agent-recommended",
      reason: "The buyer description is broad, so Leadsy should pick a first lane before spending searches.",
      options: [
        {
          id: "agent-recommended",
          label: "AI recommended",
          description: "Let Leadsy choose the buyer type most likely to show public contact and buying signals.",
          recommended: true
        },
        {
          id: "highest-budget",
          label: "Highest budget",
          description: "Prioritize larger or more institutional buyers using public scale proxies."
        },
        {
          id: "easiest-proof",
          label: "Easiest proof",
          description: "Prioritize buyers with public websites, listings, reviews, and contact pages."
        }
      ]
    });
  }

  if (broadMarket || markets.length > 3) {
    questions.push({
      id: "market-priority",
      category: "market-priority",
      prompt: "Which market should I prioritize first?",
      kind: "single-choice",
      defaultOptionId: "agent-recommended",
      reason: "The geography is large, so Leadsy should sequence markets instead of searching everything at once.",
      options: [
        {
          id: "agent-recommended",
          label: "AI recommended",
          description: "Start where public business pages and directories are easiest to verify.",
          recommended: true
        },
        {
          id: "largest-market",
          label: "Largest market",
          description: "Start with the biggest likely buyer pool."
        },
        {
          id: "fastest-proof",
          label: "Fastest proof",
          description: "Start with markets that usually expose websites, directories, and contact pages."
        }
      ]
    });
  }

  if (brief.leadGoal >= 100 || /\b(revenue|turnover|budget|cr|crore|employees|staff)\b/i.test(`${brief.idealCustomers} ${brief.excludedLeads}`)) {
    questions.push({
      id: "proof-strictness",
      category: "proof-strictness",
      prompt: "Should I optimize for more leads or stricter proof?",
      kind: "single-choice",
      defaultOptionId: "balanced-proof",
      reason: "Large campaigns need a clear quality target so the good-lead list does not get polluted.",
      options: [
        {
          id: "balanced-proof",
          label: "Balanced proof",
          description: "Save Good only with identity, fit, location, evidence, and contact path; keep weaker records in Needs Proof.",
          recommended: true
        },
        {
          id: "more-leads",
          label: "More leads",
          description: "Accept more Needs Proof records for later manual completion."
        },
        {
          id: "strict-proof",
          label: "Strict proof",
          description: "Save fewer records, but require stronger public evidence before Good."
        }
      ]
    });
  }

  return questions.slice(0, 3);
}

function buyerSegmentsForBrief(brief: LeadBrief) {
  const segments: Array<{ label: string; buyerSegment: string; signal: string; sources: LeadResearchSourceType[] }> = [];
  const addSegment = (segment: { label: string; buyerSegment: string; signal: string; sources: LeadResearchSourceType[] }) => {
    const key = `${segment.buyerSegment}:${segment.signal}`.toLowerCase();
    if (!segments.some((existing) => `${existing.buyerSegment}:${existing.signal}`.toLowerCase() === key)) {
      segments.push(segment);
    }
  };
  const dynamicSegments = customerSegmentsFromBrief(brief);
  if (dynamicSegments.length) {
    dynamicSegments.forEach(addSegment);
  }
  if (!segments.length) {
    addSegment({
      label: "AI recommended buyer lane",
      buyerSegment: genericBuyerPhrases(brief)[0] ?? "businesses with public contact pages",
      signal: offerTriggerPhrase(brief),
      sources: ["website-contact-osint", "directory-osint", "content-gap-osint"]
    });
  }
  return segments.slice(0, 12);
}

function customerSegmentsFromBrief(brief: LeadBrief) {
  const parts = splitBriefPhrases(brief.idealCustomers).slice(0, 8);

  return [...new Set(parts)].map((part) => ({
    label: `${titleCaseWords(part)} prospects`,
    buyerSegment: /\bbusiness(?:es)?\b/i.test(part) ? part : `${part} businesses`,
    signal: offerTriggerPhrase(brief),
    sources: ["website-contact-osint", "directory-osint", "review-reputation-osint"] as LeadResearchSourceType[]
  }));
}

function countrySiteHint() {
  return "";
}

function batchSignalPhrases(batchNumber: number, signal: string) {
  const sets = [
    [`${signal} contact us`, `about services phone`, `enquiry contact services`],
    [`${signal} book consultation`, `get quote request callback`, `team services contact`],
    [`email phone services`, `enquire now contact form`, `LinkedIn company contact`],
    [`appointment phone`, `locations contact services`, `consultation contact business`]
  ];
  return sets[(Math.max(1, batchNumber) - 1) % sets.length];
}

function savedDomainExclusionSuffix(_domains: string[]) {
  return "";
}

function buildLaneQueries(input: {
  segment: ReturnType<typeof buyerSegmentsForBrief>[number];
  location: string;
  brief: LeadBrief;
  batchNumber?: number;
  excludedDomains?: string[];
}) {
  const segment = sanitizeSearchTerm(input.segment.buyerSegment.replace(/\bbusinesses\b/gi, ""));
  const signal = sanitizeSearchTerm(input.segment.signal);
  const location = input.location;
  const exclude = searchExclusionSuffix(input.brief);
  const siteHint = countrySiteHint();
  const savedDomainExclusions = savedDomainExclusionSuffix(input.excludedDomains ?? []);
  return batchSignalPhrases(input.batchNumber ?? 1, signal)
    .map((phrase) => `${siteHint} ${segment} ${location} ${phrase} ${exclude} ${savedDomainExclusions}`)
    .map((query) => query.replace(/\s+/g, " ").trim());
}

function sourceSpecificQueryPhrases(sourceType: LeadResearchSourceType, input: { signal: string; batchNumber: number }) {
  const rotating = batchSignalPhrases(input.batchNumber, input.signal);
  const bySource: Record<LeadResearchSourceType, string[]> = {
    "openrouter-web-search": rotating,
    "website-contact-osint": [
      "official website contact us services phone",
      "about us services enquiry contact form",
      "book appointment request quote email phone"
    ],
    "directory-osint": [
      "business directory listing contact",
      "association member directory chamber listing",
      "local business listing phone website"
    ],
    "social-osint": [
      "Instagram business profile contact",
      "LinkedIn company page contact",
      "Facebook page public profile"
    ],
    "review-reputation-osint": [
      "reviews ratings testimonials",
      "customer reviews public rating",
      "reputation testimonials contact"
    ],
    "hiring-news-osint": [
      "hiring expansion launch event",
      "careers hiring team growth",
      "press release partnership launch"
    ],
    "content-gap-osint": [
      "official website contact services",
      "social profile contact services",
      "outdated website services enquiry"
    ],
    "competitor-osint": [
      "nearby competitors services contact",
      "alternatives local providers contact",
      "similar businesses services website"
    ],
    "browser-public-page": ["public page contact email phone"],
    "manual-import": ["manual import"]
  };
  return bySource[sourceType] ?? rotating;
}

function sourceExpectedEvidence(sourceType: LeadResearchSourceType) {
  if (sourceType === "website-contact-osint") return "website/contact proof";
  if (sourceType === "directory-osint") return "directory/listing evidence";
  if (sourceType === "social-osint") return "public profile signal";
  if (sourceType === "review-reputation-osint") return "review/reputation signal";
  if (sourceType === "hiring-news-osint") return "hiring/news signal";
  if (sourceType === "content-gap-osint") return "content gap clue";
  if (sourceType === "competitor-osint") return "competitor context";
  return "public source evidence";
}

function buildCollectorSearchesForLane(input: {
  segment: ReturnType<typeof buyerSegmentsForBrief>[number];
  location: string;
  brief: LeadBrief;
  selectedSources: LeadResearchSourceType[];
  batchNumber: number;
  excludedDomains?: string[];
}) {
  const segment = sanitizeSearchTerm(input.segment.buyerSegment.replace(/\bbusinesses\b/gi, ""));
  const signal = sanitizeSearchTerm(input.segment.signal);
  const location = input.location;
  const exclude = searchExclusionSuffix(input.brief);
  const savedDomainExclusions = savedDomainExclusionSuffix(input.excludedDomains ?? []);
  const segmentSources = input.segment.sources.filter((source) => input.selectedSources.includes(source));
  const orderedSources = [
    ...segmentSources,
    ...input.selectedSources.filter((source) => !segmentSources.includes(source))
  ].filter((source) => publicCollectorSourceSet.has(source));

  return [...new Set(orderedSources)].flatMap((sourceType) => {
    const phrase = sourceSpecificQueryPhrases(sourceType, {
      signal,
      batchNumber: input.batchNumber
    })[(input.batchNumber - 1) % sourceSpecificQueryPhrases(sourceType, { signal, batchNumber: input.batchNumber }).length];
    const query = `${segment} ${location} ${phrase} ${exclude} ${savedDomainExclusions}`.replace(/\s+/g, " ").trim();
    return query
      ? [
          {
            query,
            sourceType,
            why: `${sourceDisplayLabels[sourceType]}: ${sourceInstructions[sourceType]}`
          }
        ]
      : [];
  });
}

export function buildResearchPlanPreview(input: {
  tenantId: string;
  ownerId: string;
  brief: LeadBrief;
  existingLeads?: LeadDossier[];
  previousRuns?: LeadSourceRun[];
  budgetCapInr?: number;
  fullRun?: boolean;
}): ResearchPlanPreview {
  const progress = campaignProgressForBrief(input.brief, input.existingLeads, input.previousRuns);
  const budget = researchBudgetForBrief(input.brief, progress);
  const selectedSources = selectedCollectorSources(input.brief);
  const capInr = input.fullRun ? Math.max(spendCapFromEnv(), input.budgetCapInr ?? 5) : input.budgetCapInr ?? spendCapFromEnv();
  const dynamicStrategy = genericLeadResearchStrategy(input.brief, selectedSources);
  const lanes: SearchLane[] = [];
  const offset = dynamicStrategy.lanes.length ? ((Math.max(1, budget.batchNumber) - 1) * budget.maxSearches) % dynamicStrategy.lanes.length : 0;
  for (let index = 0; index < dynamicStrategy.lanes.length && lanes.length < budget.maxSearches; index += 1) {
    const lane = dynamicStrategy.lanes[(offset + index) % dynamicStrategy.lanes.length];
    if (!lane) continue;
    const searches = (lane.searches?.length ? lane.searches : lane.queries.map((query, queryIndex) => ({
      query,
      sourceType: lane.sourceTypes[queryIndex % lane.sourceTypes.length] ?? "openrouter-web-search",
      why: lane.why
    }))).slice(0, Math.max(1, budget.maxSearches));
    const laneSources = [...new Set(searches.map((search) => search.sourceType))];
    lanes.push({
      id: `lane_${lanes.length + 1}`,
      label: lane.label,
      audienceMode: lane.audienceMode,
      buyerSegment: lane.buyerSegment,
      locationFocus: lane.locationFocus,
      sourceTypes: laneSources.length ? laneSources : ["openrouter-web-search"],
      queries: searches.length
        ? searches.map((search) => search.query)
        : lane.queries,
      searches,
      why: lane.why,
      expectedEvidence: [...new Set([...lane.expectedEvidence, ...laneSources.map(sourceExpectedEvidence)])]
    });
  }

  const estimatedSearches = Math.min(
    budget.maxSearches,
    lanes.reduce((sum, lane) => sum + (lane.searches?.length ?? Math.min(2, lane.queries.length)), 0)
  );
  const estimatedPages = Math.min(budget.maxFetches, estimatedSearches * Math.min(6, budget.resultsPerSearch));
  return {
    id: `plan_${crypto.randomUUID()}`,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    briefId: input.brief.id,
    briefFingerprint: briefFingerprintForBrief(input.brief),
    briefSnapshot: briefSnapshotForFingerprint(input.brief),
    researchMode: budget.mode,
    targetLeadGoal: budget.targetLeadGoal,
    minQualifiedTarget: budget.minQualifiedTarget,
    batchNumber: budget.batchNumber,
    batchSize: budget.batchSize,
    existingGoodCount: budget.existingGoodCount,
    audienceModes: dynamicStrategy.audienceModes,
    lanes,
    spendGuard: {
      mode: input.fullRun ? "full" : "protected",
      capInr,
      estimatedMaxInr: input.fullRun ? Math.max(capInr, 5) : capInr,
      requiresApproval: !input.fullRun,
      stoppedReason: expensiveResearchModel() && capInr <= spendCapFromEnv() ? "expensive-model" : undefined
    },
    estimatedSearches,
    estimatedPages,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString()
  };
}

function stringArrayFromUnknown(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  const clean = value
    .map((item) => (typeof item === "string" ? sanitizeSearchTerm(item).trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 12);
  return clean.length ? [...new Set(clean)] : fallback;
}

function audienceModesFromUnknown(value: unknown, fallback: LeadDiscoveryMode[] = ["b2b-company"]) {
  if (!Array.isArray(value)) return fallback;
  const modes = value.filter(isLeadDiscoveryMode);
  return modes.length ? [...new Set(modes)].slice(0, 4) : fallback;
}

function agentQuestionsFromUnknown(value: unknown, fallback: AgentQuestion[]) {
  if (!Array.isArray(value)) return fallback;
  const questions: AgentQuestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as {
      id?: unknown;
      category?: unknown;
      prompt?: unknown;
      reason?: unknown;
      defaultOptionId?: unknown;
      options?: unknown;
    };
    const options: AgentQuestion["options"] = [];
    if (Array.isArray(raw.options)) {
      raw.options.forEach((option, index) => {
        if (!option || typeof option !== "object" || options.length >= 4) return;
        const optionRaw = option as { id?: unknown; label?: unknown; description?: unknown; recommended?: unknown };
        const id = typeof optionRaw.id === "string" && optionRaw.id.trim() ? optionRaw.id.trim().slice(0, 64) : `option_${index + 1}`;
        const label = typeof optionRaw.label === "string" && optionRaw.label.trim() ? optionRaw.label.trim().slice(0, 80) : "";
        const description =
          typeof optionRaw.description === "string" && optionRaw.description.trim() ? optionRaw.description.trim().slice(0, 180) : label;
        if (label) {
          options.push({ id, label, description, recommended: optionRaw.recommended === true });
        }
      });
    }
    const prompt = typeof raw.prompt === "string" ? raw.prompt.trim().slice(0, 160) : "";
    if (!prompt || options.length < 2) continue;
    const defaultOptionId =
      typeof raw.defaultOptionId === "string" && options.some((option) => option.id === raw.defaultOptionId)
        ? raw.defaultOptionId
        : options.find((option) => option.recommended)?.id ?? options[0]?.id ?? "";
    questions.push({
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 64) : `question_${questions.length + 1}`,
      category: isAgentQuestionCategory(raw.category) ? raw.category : undefined,
      prompt,
      kind: "single-choice",
      options: options.map((option) => ({ ...option, recommended: option.id === defaultOptionId || option.recommended })),
      defaultOptionId,
      reason:
        typeof raw.reason === "string" && raw.reason.trim()
          ? raw.reason.trim().slice(0, 220)
          : "Leadsy needs this choice to avoid wasting searches."
    });
    if (questions.length >= 3) break;
  }
  return questions.length ? questions : fallback;
}

function lanesFromUnknown(value: unknown, brief: LeadBrief, selectedSources: LeadResearchSourceType[], fallback: SearchLane[]) {
  if (!Array.isArray(value)) return fallback;
  const lanes: SearchLane[] = [];
  const safeSources = selectedSources.filter((source) => publicCollectorSourceSet.has(source));
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as {
      label?: unknown;
      buyerSegment?: unknown;
      locationFocus?: unknown;
      queries?: unknown;
      sourceTypes?: unknown;
      audienceMode?: unknown;
      why?: unknown;
      expectedEvidence?: unknown;
    };
    const buyerSegment = typeof raw.buyerSegment === "string" ? sanitizeSearchTerm(raw.buyerSegment).slice(0, 120) : "";
    const locationFocus = typeof raw.locationFocus === "string" ? sanitizeSearchTerm(raw.locationFocus).slice(0, 80) : "";
    const queries = stringArrayFromUnknown(raw.queries).slice(0, 8);
    if (!buyerSegment || (!locationFocus && !brief.searchLocations.trim())) continue;
    const sourceTypes = Array.isArray(raw.sourceTypes)
      ? raw.sourceTypes.filter((source): source is LeadResearchSourceType => isResearchSource(source) && publicCollectorSourceSet.has(source) && selectedSources.includes(source))
      : [];
    const chosenSources: LeadResearchSourceType[] = [
      ...new Set<LeadResearchSourceType>(sourceTypes.length ? sourceTypes : safeSources.length ? safeSources : ["openrouter-web-search"])
    ];
    const searches = queries.flatMap((query, index) => {
      const sourceType: LeadResearchSourceType = chosenSources[index % chosenSources.length] ?? "openrouter-web-search";
      return query
        ? [
            {
              query,
              sourceType,
              why: typeof raw.why === "string" ? raw.why.trim().slice(0, 220) : undefined
            }
          ]
        : [];
    });
    lanes.push({
      id: `lane_${lanes.length + 1}`,
      label:
        typeof raw.label === "string" && raw.label.trim()
          ? raw.label.trim().slice(0, 100)
          : `${titleCaseWords(buyerSegment)}${locationFocus ? ` · ${locationFocus}` : ""}`,
      audienceMode: isLeadDiscoveryMode(raw.audienceMode) ? raw.audienceMode : fallback[lanes.length]?.audienceMode,
      buyerSegment,
      locationFocus,
      sourceTypes: chosenSources,
      queries,
      searches,
      why:
        typeof raw.why === "string" && raw.why.trim()
          ? raw.why.trim().slice(0, 260)
          : `Research ${buyerSegment}${locationFocus ? ` in ${locationFocus}` : ""} for public evidence related to ${brief.service}.`,
      expectedEvidence: stringArrayFromUnknown(raw.expectedEvidence, [
        "real business identity",
        "buyer fit",
        "public evidence URL",
        "contact path"
      ]).slice(0, 8)
    });
    if (lanes.length >= 12) break;
  }
  return lanes.length ? lanes : fallback;
}

function ownerWebsiteContextFromUnknown(value: unknown, fallback?: OwnerWebsiteContext): OwnerWebsiteContext | undefined {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as {
    url?: unknown;
    status?: unknown;
    summary?: unknown;
    offerTerms?: unknown;
    buyerTypes?: unknown;
    marketTerms?: unknown;
    disqualifiers?: unknown;
    proofTerms?: unknown;
    fetchedAt?: unknown;
    error?: unknown;
  };
  const status = raw.status === "fetched" || raw.status === "unavailable" || raw.status === "not-provided" ? raw.status : fallback?.status ?? "unavailable";
  return {
    url: typeof raw.url === "string" ? normalizeUrl(raw.url) ?? raw.url.slice(0, 300) : fallback?.url,
    status,
    summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim().slice(0, 600) : fallback?.summary ?? "Owner website context unavailable.",
    offerTerms: stringArrayFromUnknown(raw.offerTerms, fallback?.offerTerms ?? []),
    buyerTypes: stringArrayFromUnknown(raw.buyerTypes, fallback?.buyerTypes ?? []),
    marketTerms: stringArrayFromUnknown(raw.marketTerms, fallback?.marketTerms ?? []),
    disqualifiers: stringArrayFromUnknown(raw.disqualifiers, fallback?.disqualifiers ?? []),
    proofTerms: stringArrayFromUnknown(raw.proofTerms, fallback?.proofTerms ?? []),
    fetchedAt: typeof raw.fetchedAt === "string" ? raw.fetchedAt : fallback?.fetchedAt,
    error: typeof raw.error === "string" ? raw.error.slice(0, 300) : fallback?.error
  };
}

const researchToolPrimitives = new Set([
  "search_public_web",
  "classify_search_result",
  "expand_directory_page",
  "fetch_public_page",
  "extract_contact_paths",
  "verify_business_fit",
  "score_lead_evidence",
  "save_leads"
]);

function recipesFromUnknown(value: unknown, fallback: ResearchToolRecipe[] = []): ResearchToolRecipe[] {
  if (!Array.isArray(value)) return fallback;
  const recipes: ResearchToolRecipe[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as {
      id?: unknown;
      name?: unknown;
      ownerId?: unknown;
      ownerWebsiteUrl?: unknown;
      goal?: unknown;
      reason?: unknown;
      queries?: unknown;
      steps?: unknown;
      expectedEvidence?: unknown;
      createdAt?: unknown;
    };
    const steps = Array.isArray(raw.steps)
      ? raw.steps
          .map((step) => {
            if (!step || typeof step !== "object") return null;
            const stepRaw = step as { primitive?: unknown; goal?: unknown; inputHint?: unknown };
            const primitive = typeof stepRaw.primitive === "string" && researchToolPrimitives.has(stepRaw.primitive) ? stepRaw.primitive : undefined;
            if (!primitive) return null;
            return {
              primitive,
              goal: typeof stepRaw.goal === "string" && stepRaw.goal.trim() ? stepRaw.goal.trim().slice(0, 160) : "Run research primitive.",
              inputHint: typeof stepRaw.inputHint === "string" && stepRaw.inputHint.trim() ? stepRaw.inputHint.trim().slice(0, 220) : "Use current lane context."
            };
          })
          .filter((step): step is ResearchToolRecipe["steps"][number] => Boolean(step))
      : [];
    const queries = stringArrayFromUnknown(raw.queries).slice(0, 8);
    if (!queries.length || !steps.length) continue;
    recipes.push({
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 80) : `recipe_${recipes.length + 1}`,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 120) : "Adaptive research recipe",
      ownerId: typeof raw.ownerId === "string" ? raw.ownerId.slice(0, 100) : undefined,
      ownerWebsiteUrl: typeof raw.ownerWebsiteUrl === "string" ? normalizeUrl(raw.ownerWebsiteUrl) ?? raw.ownerWebsiteUrl.slice(0, 300) : undefined,
      goal: typeof raw.goal === "string" && raw.goal.trim() ? raw.goal.trim().slice(0, 260) : "Improve public lead discovery for this owner.",
      reason: typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim().slice(0, 300) : "Generated from search diagnostics.",
      queries,
      steps,
      expectedEvidence: stringArrayFromUnknown(raw.expectedEvidence, ["identity", "fit", "location", "evidence URL", "contact path"]).slice(0, 8),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso()
    });
    if (recipes.length >= 4) break;
  }
  return recipes.length ? recipes : fallback;
}

function strategyFromUnknown(value: unknown, brief: LeadBrief, selectedSources: LeadResearchSourceType[], fallback: LeadResearchStrategy) {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as {
    offer?: unknown;
    audienceModes?: unknown;
    buyerTypes?: unknown;
    markets?: unknown;
    buyingTriggers?: unknown;
    disqualifiers?: unknown;
    evidenceRules?: unknown;
    assumptions?: unknown;
    questions?: unknown;
    lanes?: unknown;
    searchLanes?: unknown;
    ownerWebsiteContext?: unknown;
    toolRecipes?: unknown;
  };
  return {
    offer: typeof raw.offer === "string" && raw.offer.trim() ? raw.offer.trim().slice(0, 160) : fallback.offer,
    ownerWebsiteContext: ownerWebsiteContextFromUnknown(raw.ownerWebsiteContext, fallback.ownerWebsiteContext),
    audienceModes: audienceModesFromUnknown(raw.audienceModes, fallback.audienceModes),
    buyerTypes: stringArrayFromUnknown(raw.buyerTypes, fallback.buyerTypes),
    markets: stringArrayFromUnknown(raw.markets, fallback.markets),
    buyingTriggers: stringArrayFromUnknown(raw.buyingTriggers, fallback.buyingTriggers),
    disqualifiers: stringArrayFromUnknown(raw.disqualifiers, fallback.disqualifiers),
    evidenceRules: stringArrayFromUnknown(raw.evidenceRules, fallback.evidenceRules),
    assumptions: stringArrayFromUnknown(raw.assumptions, fallback.assumptions),
    questions: agentQuestionsFromUnknown(raw.questions, fallback.questions),
    lanes: lanesFromUnknown(raw.searchLanes ?? raw.lanes, brief, selectedSources, fallback.lanes),
    toolRecipes: recipesFromUnknown(raw.toolRecipes, fallback.toolRecipes)
  };
}

function strategyWithOwnerAnswers(strategy: LeadResearchStrategy, answers?: Record<string, string>): LeadResearchStrategy {
  if (!answers) return strategy;
  const selectedAudienceMode = answers["audience-mode"];
  const audienceMode = isLeadDiscoveryMode(selectedAudienceMode) ? selectedAudienceMode : undefined;
  const lanes = audienceMode ? strategy.lanes.filter((lane) => lane.audienceMode === audienceMode) : strategy.lanes;
  return {
    ...strategy,
    audienceModes: audienceMode ? [audienceMode] : strategy.audienceModes,
    questions: [],
    lanes: lanes.length ? lanes : strategy.lanes
  };
}

export async function planLeadResearch(input: {
  brief: LeadBrief;
  tenantId: string;
  ownerId: string;
  answers?: Record<string, string>;
  ownerSearchMemory?: OwnerSearchMemory[];
}): Promise<{ strategy: LeadResearchStrategy; cost?: OpenRouterUsageCost }> {
  const selectedSources = selectedCollectorSources(input.brief);
  const ownerWebsiteContext = await resolveOwnerWebsiteContext(input.brief);
  const rememberedRecipes = (input.ownerSearchMemory ?? [])
    .filter((memory) => memory.ownerId === input.ownerId)
    .map((memory) => memory.recipe)
    .slice(0, 4);
  const fallbackBase = genericLeadResearchStrategy(input.brief, selectedSources, ownerWebsiteContext);
  const fallback = strategyWithOwnerAnswers(
    { ...fallbackBase, toolRecipes: [...rememberedRecipes, ...(fallbackBase.toolRecipes ?? [])] },
    input.answers
  );
  const apiKey = openRouterKey();
  if (!apiKey || process.env.LEADSY_AI_PLANNER_ENABLED === "false") {
    return { strategy: fallback };
  }

  type OpenRouterResponse = {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const prompt = [
    "You are Leadsy's domain-agnostic lead discovery planning agent.",
    "Turn the user's rough lead request into a tool-ready public research strategy.",
    "Do not hardcode any vertical or geography. Infer buyer lanes from the offer, buyers, location, exclusions, and public evidence requirements.",
    "Generate single-choice owner questions in the user's context only when an answer materially prevents wasted searches. Never reuse canned examples.",
    "If searches may need a new collection approach, create toolRecipes that compose only the allowed safe primitives.",
    "Revenue, budget, and company-size requests are public proxy constraints unless directly proven.",
    "Search lanes must be concrete enough for public web search and must target buyer prospects, not suppliers of the user's offer unless the user explicitly asks for suppliers.",
    "Return JSON only.",
    JSON.stringify({
      service: input.brief.service,
      idealCustomers: input.brief.idealCustomers,
      searchLocations: input.brief.searchLocations,
      leadGoal: input.brief.leadGoal,
      researchMode: input.brief.researchMode,
      sources: selectedSources,
      excludedLeads: input.brief.excludedLeads,
      ownerWebsiteUrl: input.brief.ownerWebsiteUrl,
      ownerWebsiteContext,
      ownerSearchMemory: input.ownerSearchMemory?.slice(0, 8).map((memory) => ({
        summary: memory.summary,
        recipeName: memory.recipe.name,
        evaluationStatus: memory.evaluation.status,
        savedGood: memory.evaluation.savedGood
      })) ?? [],
      answers: input.answers ?? {},
      fallback
    })
  ].join("\n");

  try {
    const result = await postJson<OpenRouterResponse & OpenRouterUsageShape>(`${openRouterBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "http-referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "x-title": "Leadsy Discovery Planning Agent"
      },
      body: JSON.stringify({
        model: openRouterPlannerModel(),
        messages: [
          {
            role: "system",
            content:
              "You plan public B2B and B2C lead discovery for an AI agent with web-search, page-fetch, directory-expansion, evidence-scoring, and save-leads tools. Return compact JSON only."
          },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "lead_discovery_strategy",
            strict: false,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                offer: { type: "string" },
                audienceModes: { type: "array", items: { type: "string", enum: leadDiscoveryModes } },
                buyerTypes: { type: "array", items: { type: "string" } },
                markets: { type: "array", items: { type: "string" } },
                buyingTriggers: { type: "array", items: { type: "string" } },
                disqualifiers: { type: "array", items: { type: "string" } },
                evidenceRules: { type: "array", items: { type: "string" } },
                assumptions: { type: "array", items: { type: "string" } },
                ownerWebsiteContext: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    url: { type: "string" },
                    status: { type: "string", enum: ["not-provided", "fetched", "unavailable"] },
                    summary: { type: "string" },
                    offerTerms: { type: "array", items: { type: "string" } },
                    buyerTypes: { type: "array", items: { type: "string" } },
                    marketTerms: { type: "array", items: { type: "string" } },
                    disqualifiers: { type: "array", items: { type: "string" } },
                    proofTerms: { type: "array", items: { type: "string" } },
                    fetchedAt: { type: "string" },
                    error: { type: "string" }
                  },
                  required: ["status", "summary", "offerTerms", "buyerTypes", "marketTerms", "disqualifiers", "proofTerms"]
                },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      category: { type: "string", enum: agentQuestionCategories },
                      prompt: { type: "string" },
                      reason: { type: "string" },
                      defaultOptionId: { type: "string" },
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            id: { type: "string" },
                            label: { type: "string" },
                            description: { type: "string" },
                            recommended: { type: "boolean" }
                          },
                          required: ["id", "label", "description"]
                        }
                      }
                    },
                    required: ["id", "prompt", "reason", "defaultOptionId", "options"]
                  }
                },
                toolRecipes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      goal: { type: "string" },
                      reason: { type: "string" },
                      queries: { type: "array", items: { type: "string" } },
                      steps: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            primitive: { type: "string", enum: [...researchToolPrimitives] },
                            goal: { type: "string" },
                            inputHint: { type: "string" }
                          },
                          required: ["primitive", "goal", "inputHint"]
                        }
                      },
                      expectedEvidence: { type: "array", items: { type: "string" } }
                    },
                    required: ["name", "goal", "reason", "queries", "steps", "expectedEvidence"]
                  }
                },
                searchLanes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string" },
                      audienceMode: { type: "string", enum: leadDiscoveryModes },
                      buyerSegment: { type: "string" },
                      locationFocus: { type: "string" },
                      sourceTypes: { type: "array", items: { type: "string", enum: selectedSources } },
                      queries: { type: "array", items: { type: "string" } },
                      why: { type: "string" },
                      expectedEvidence: { type: "array", items: { type: "string" } }
                    },
                    required: ["label", "buyerSegment", "locationFocus", "queries", "why"]
                  }
                }
              },
              required: ["offer", "audienceModes", "buyerTypes", "markets", "buyingTriggers", "evidenceRules", "questions", "searchLanes"]
            }
          }
        },
        max_tokens: 3500
      })
    });
    const cost = await openRouterCostFromResponse(result, "planner");
    const strategy = strategyFromUnknown(parseJsonFromText(result.choices?.[0]?.message?.content ?? ""), input.brief, selectedSources, fallback);
    return { strategy, cost };
  } catch {
    return { strategy: fallback };
  }
}

export function previewWithStrategy(preview: ResearchPlanPreview, strategy: LeadResearchStrategy): ResearchPlanPreview {
  const lanes = strategy.lanes.length ? strategy.lanes : preview.lanes;
  const estimatedSearches = Math.min(
    preview.spendGuard.mode === "full" ? preview.estimatedSearches : preview.estimatedSearches,
    lanes.reduce((sum, lane) => sum + (lane.searches?.length ?? Math.min(2, lane.queries.length || lane.sourceTypes.length || 1)), 0)
  );
  return {
    ...preview,
    lanes,
    audienceModes: strategy.audienceModes,
    ownerWebsiteContext: strategy.ownerWebsiteContext ?? preview.ownerWebsiteContext,
    toolRecipes: strategy.toolRecipes ?? preview.toolRecipes,
    estimatedSearches: Math.max(1, estimatedSearches),
    estimatedPages: Math.max(1, Math.min(preview.estimatedPages, Math.max(1, estimatedSearches) * 6))
  };
}

export function generateSearchLanes(input: { brief: LeadBrief; selectedSources?: LeadResearchSourceType[] }): SearchLane[] {
  const selectedSources = (input.selectedSources?.length ? input.selectedSources : selectedCollectorSources(input.brief)).filter((source) =>
    publicCollectorSourceSet.has(source)
  );
  return genericLeadResearchStrategy(input.brief, selectedSources.length ? selectedSources : ["openrouter-web-search"]).lanes;
}

export function classifySearchResult(input: {
  result: PublicSearchResult;
  brief?: LeadBrief;
  sourceType?: LeadResearchSourceType;
  query?: string;
  rank?: number;
}): { classification: LeadSearchResultClassification; reason?: LeadRejectionReason; shouldExpandDirectory: boolean } {
  const sourceType = input.sourceType ?? "openrouter-web-search";
  const candidate: SearchCandidate = {
    ...input.result,
    query: input.query ?? "",
    sourceType,
    rank: input.rank ?? 1
  };
  const reason = candidateRejectReason(candidate, input.brief);
  const haystack = `${candidate.title} ${candidate.url} ${candidate.snippet ?? ""}`.toLowerCase();
  const host = hostFromUrl(candidate.url);
  const audienceModes = input.brief ? detectAudienceModes(input.brief) : [];
  const shouldExpandDirectory = candidateLooksLikeDirectoryExpansionTarget(candidate, reason);
  if (shouldExpandDirectory) {
    return { classification: "directory", reason, shouldExpandDirectory };
  }
  if (socialPlatformHost(host) || sourceType === "social-osint") {
    if (/\b(login required|sign in|required to view|private profile|followers only)\b|\/(?:reel|reels|p|posts?|hashtag|explore|accounts?|login|signup)(?:\/|$)/i.test(haystack)) {
      return { classification: "noise", reason: reason ?? "blocked-source", shouldExpandDirectory: false };
    }
    if (audienceModes.includes("creator-influencer")) {
      return { classification: "creator-profile", reason, shouldExpandDirectory: false };
    }
    if (audienceModes.includes("recruiting-candidate")) {
      return { classification: "candidate-profile", reason, shouldExpandDirectory: false };
    }
    if (audienceModes.includes("b2c-public-profile") || audienceModes.includes("consumer-intent")) {
      return { classification: "personal-profile", reason, shouldExpandDirectory: false };
    }
    return { classification: "social-profile", reason, shouldExpandDirectory: false };
  }
  if (/\b(careers?|jobs?|hiring|vacanc(?:y|ies)|recruitment)\b/i.test(haystack)) {
    return { classification: audienceModes.includes("recruiting-candidate") ? "job-post" : "job", reason: reason ?? "non-business-page", shouldExpandDirectory: false };
  }
  if (reason === "bad-fit-vendor") {
    return { classification: "vendor", reason, shouldExpandDirectory: false };
  }
  if (reason === "marketplace-product") {
    return { classification: audienceModes.includes("consumer-intent") ? "marketplace-listing" : "portal", reason, shouldExpandDirectory: false };
  }
  if (reason === "non-business-page" && /\b(article|blog|news|guide|how to|story|press|journal)\b/i.test(haystack)) {
    return { classification: "article", reason, shouldExpandDirectory: false };
  }
  if (reason) {
    return { classification: "noise", reason, shouldExpandDirectory: false };
  }
  return { classification: "business", shouldExpandDirectory: false };
}

export function expandDirectoryPage(input: {
  brief: LeadBrief;
  page: PublicFetchResult;
  query?: string;
  sourceType?: LeadResearchSourceType;
  titleFromSearch?: string;
  rank?: number;
  maxLeads?: number;
}): RawLeadCandidate[] {
  const budget = researchBudgetForBrief(input.brief);
  const cappedBudget: ResearchBudget = {
    ...budget,
    maxSaves: input.maxLeads ? Math.max(1, Math.min(input.maxLeads, budget.maxSaves)) : budget.maxSaves
  };
  const page: FetchedResearchPage = {
    ...input.page,
    query: input.query ?? "",
    sourceType: input.sourceType ?? "directory-osint",
    titleFromSearch: input.titleFromSearch ?? input.page.title,
    rank: input.rank ?? 1
  };
  return directoryExpandedRawLeadsFromPages(input.brief, [page], cappedBudget);
}

export function extractContactPaths(input: {
  raw?: RawLeadCandidate;
  page?: PublicFetchResult;
  evidence?: EvidenceUrl[];
  brief?: Pick<LeadBrief, "searchLocations">;
}): LeadContactPath[] {
  const paths: LeadContactPath[] = [];
  const add = (path: LeadContactPath | undefined) => {
    if (!path?.value) return;
    const key = `${path.type}:${path.value}`.toLowerCase();
    if (!paths.some((existing) => `${existing.type}:${existing.value}`.toLowerCase() === key)) {
      paths.push(path);
    }
  };
  const raw = input.raw;
  add(raw?.email ? { type: "email", value: normalizeEmail(raw.email) ?? raw.email, source: "lead" } : undefined);
  add(raw?.phone ? { type: "phone", value: normalizePhone(raw.phone, input.brief) ?? raw.phone, source: "lead" } : undefined);
  add(raw?.whatsapp ? { type: "whatsapp", value: normalizePhone(raw.whatsapp, input.brief) ?? raw.whatsapp, source: "lead" } : undefined);
  add(raw?.website ? { type: "website", value: normalizeUrl(raw.website) ?? raw.website, url: normalizeUrl(raw.website), source: "lead" } : undefined);
  add(raw?.linkedin ? { type: "linkedin", value: normalizeUrl(raw.linkedin) ?? raw.linkedin, url: normalizeUrl(raw.linkedin), source: "lead" } : undefined);
  add(raw?.facebook ? { type: "facebook", value: normalizeUrl(raw.facebook) ?? raw.facebook, url: normalizeUrl(raw.facebook), source: "lead" } : undefined);
  add(raw?.instagram ? { type: "instagram", value: normalizeUrl(raw.instagram) ?? raw.instagram, url: normalizeUrl(raw.instagram), source: "lead" } : undefined);
  for (const email of input.page?.emails ?? []) {
    add({ type: "email", value: normalizeEmail(email) ?? email, source: "page" });
  }
  for (const phone of input.page?.phones ?? []) {
    add({ type: "phone", value: normalizePhone(phone, input.brief) ?? phone, source: "page" });
  }
  for (const url of input.page?.socialLinks ?? []) {
    const normalized = normalizeUrl(url) ?? url;
    const type: LeadContactPath["type"] = /linkedin\.com/i.test(url)
      ? "linkedin"
      : /facebook\.com/i.test(url)
        ? "facebook"
        : /instagram\.com/i.test(url)
          ? "instagram"
          : /wa\.me|whatsapp/i.test(url)
            ? "whatsapp"
            : "social";
    add({ type, value: normalized, url: normalized, source: "page" });
  }
  for (const evidence of [...(raw?.evidence ?? []), ...(input.evidence ?? [])]) {
    const text = `${evidence.label} ${evidence.url ?? ""} ${evidence.note ?? ""}`;
    if (/contact|enquir|inquir|appointment|booking|quote|callback/i.test(text) && evidence.url) {
      add({ type: "enquiry-form", value: evidence.url, url: evidence.url, source: "evidence" });
    }
  }
  return paths;
}

export function verifyBusinessFit(input: { raw: RawLeadCandidate; brief: LeadBrief }): {
  identity: boolean;
  buyerFit: boolean;
  locationFit: boolean;
  contactPath: boolean;
  evidenceUrl: boolean;
  status: "fit" | "needs-proof" | "rejected";
  reasons: string[];
} {
  const reasons: string[] = [];
  const identity = Boolean(input.raw.businessName?.trim()) && !genericBusinessName(input.raw.businessName);
  const buyerFit = rawHasIndustryFit(input.raw, input.brief);
  const location = leadLocation(input.raw, input.brief);
  const locationFit = location.status !== "not-found" && !evidenceCountryConflicts(input.raw, input.brief);
  const contactPath = rawHasContactPath(input.raw, input.brief);
  const evidenceUrlPresent = hasEvidenceUrl(input.raw);
  if (!identity) reasons.push("identity incomplete");
  if (!buyerFit) reasons.push("buyer-lane proof incomplete");
  if (!locationFit) reasons.push("location proof incomplete or conflicting");
  if (!contactPath) reasons.push("contact path missing");
  if (!evidenceUrlPresent) reasons.push("public evidence URL missing");
  const score = scoreLead(input.raw, input.brief);
  const decision = qualityDecisionForRaw(input.raw, input.brief, score);
  return {
    identity,
    buyerFit,
    locationFit,
    contactPath,
    evidenceUrl: evidenceUrlPresent,
    status: decision.status === "good" ? "fit" : decision.status,
    reasons: reasons.length ? reasons : [decision.summary]
  };
}

export function scoreLeadEvidence(input: { raw: RawLeadCandidate; brief: LeadBrief }): {
  score: LeadScore;
  decision: LeadQualityDecision;
  contactPaths: LeadContactPath[];
} {
  const normalizedRaw = normalizedRawLeadIdentity(input.raw);
  const score = scoreLead(normalizedRaw, input.brief);
  return {
    score,
    decision: qualityDecisionForRaw(normalizedRaw, input.brief, score),
    contactPaths: extractContactPaths({ raw: normalizedRaw, brief: input.brief })
  };
}

export function buildResearchToolRecipe(input: {
  brief: LeadBrief;
  ownerWebsiteContext?: OwnerWebsiteContext;
  diagnostics?: {
    zeroGoodRuns?: number;
    gateBlockers?: LeadQualityGateBreakdown;
    failedQueries?: string[];
  };
}): ResearchToolRecipe {
  const context = input.ownerWebsiteContext;
  const buyerTerms = cleanTermList([
    ...(context?.buyerTypes ?? []),
    ...splitBriefPhrases(input.brief.idealCustomers)
  ], 4);
  const offerTerms = cleanTermList([
    ...(context?.offerTerms ?? []),
    ...meaningfulBriefTerms(input.brief.service, 6)
  ], 5);
  const marketTerms = cleanTermList([
    ...(context?.marketTerms ?? []),
    ...locationFocuses(input.brief)
  ], 4);
  const proofTerms = cleanTermList([
    ...(context?.proofTerms ?? []),
    "contact",
    "about",
    "services",
    "enquiry"
  ], 5);
  const buyer = buyerTerms[0] ?? input.brief.idealCustomers;
  const market = marketTerms[0] ?? input.brief.searchLocations;
  const offer = offerTerms.slice(0, 3).join(" ") || input.brief.service;
  const queryBase = `${buyer} ${market} ${offer}`.replace(/\s+/g, " ").trim();
  const queries = cleanTermList([
    `${queryBase} ${proofTerms.slice(0, 3).join(" ")}`,
    `${buyer} ${market} official website contact`,
    `${buyer} ${market} directory website phone email`,
    ...(input.diagnostics?.failedQueries ?? []).map((query) => `${query} alternate public evidence contact`)
  ], 6);
  const blockers = input.diagnostics?.gateBlockers ?? {};
  const reason = Object.keys(blockers).length
    ? `Created after weak search diagnostics: ${Object.entries(blockers).map(([key, value]) => `${key} ${value}`).join(", ")}.`
    : "Created from owner brief and website context to improve public lead discovery.";
  return {
    id: `recipe_${crypto.randomUUID()}`,
    name: "Adaptive public evidence recovery",
    ownerId: input.brief.ownerId,
    ownerWebsiteUrl: normalizeUrl(input.brief.ownerWebsiteUrl),
    goal: `Find evidence-backed prospects for ${input.brief.service} without hardcoded vertical assumptions.`,
    reason,
    queries,
    steps: [
      {
        primitive: "search_public_web",
        goal: "Run context-specific public searches generated from the owner offer and failed gates.",
        inputHint: "Use recipe queries in order and keep source policy public-only."
      },
      {
        primitive: "classify_search_result",
        goal: "Separate prospects, directories, public profiles, portals, articles, and noise.",
        inputHint: "Use the active audience mode and lane fit."
      },
      {
        primitive: "expand_directory_page",
        goal: "Expand directories into individual business candidates before rejection.",
        inputHint: "Extract business name, website, phone, email, and source line when visible."
      },
      {
        primitive: "score_lead_evidence",
        goal: "Save Good only when identity, fit, location, evidence URL, and contact/profile path pass.",
        inputHint: "Return gate blockers for every non-Good candidate."
      }
    ],
    expectedEvidence: ["business identity", "buyer fit", "market proof", "public evidence URL", "contact or profile path"],
    createdAt: nowIso()
  };
}

export function runResearchToolRecipe(input: {
  recipe: ResearchToolRecipe;
  selectedSources?: LeadResearchSourceType[];
}): PlannedSearch[] {
  const selected = input.selectedSources?.length ? input.selectedSources : defaultResearchSources;
  return input.recipe.queries.map((query, index) => {
    const step = input.recipe.steps[index % input.recipe.steps.length];
    const sourceType =
      step?.primitive === "expand_directory_page"
        ? "directory-osint"
        : step?.primitive === "fetch_public_page" || step?.primitive === "extract_contact_paths"
          ? "website-contact-osint"
          : "openrouter-web-search";
    return {
      query,
      sourceType: normalizeSearchSource(sourceType, selected),
      why: input.recipe.reason
    };
  });
}

export function evaluateResearchToolRecipe(input: {
  recipe: ResearchToolRecipe;
  metrics: Partial<LeadResearchMetrics>;
}): ResearchToolRecipeEvaluation {
  const savedGood = input.metrics.usableProspects ?? input.metrics.properDataCount ?? 0;
  const needsProof = Object.values(input.metrics.sourceBreakdown ?? {}).reduce((sum, metrics) => sum + (metrics?.needsProof ?? 0), 0);
  const rejected = input.metrics.rejectedCount ?? Object.values(input.metrics.sourceBreakdown ?? {}).reduce((sum, metrics) => sum + (metrics?.rejected ?? 0), 0);
  const status: ResearchToolRecipeEvaluation["status"] = savedGood > 0 ? "keep" : needsProof > 0 || (input.metrics.candidateCount ?? 0) > 0 ? "revise" : "discard";
  return {
    recipeId: input.recipe.id,
    status,
    reason:
      status === "keep"
        ? `Keep recipe because it produced ${savedGood} Good lead${savedGood === 1 ? "" : "s"}.`
        : status === "revise"
          ? "Revise recipe because it found candidates but did not pass enough Good gates."
          : "Discard recipe because it produced no useful public candidate pool.",
    savedGood,
    needsProof,
    rejected,
    gateBreakdown: input.metrics.qualityGateBreakdown,
    evaluatedAt: nowIso()
  };
}

export function saveOwnerSearchMemory(input: {
  ownerId: string;
  brief: LeadBrief;
  recipe: ResearchToolRecipe;
  evaluation: ResearchToolRecipeEvaluation;
}): OwnerSearchMemory {
  return {
    id: `memory_${crypto.randomUUID()}`,
    ownerId: input.ownerId,
    briefFingerprint: briefFingerprintForBrief(input.brief),
    recipeId: input.recipe.id,
    ownerWebsiteUrl: normalizeUrl(input.brief.ownerWebsiteUrl),
    summary: `${input.evaluation.status}: ${input.evaluation.reason}`,
    recipe: input.recipe,
    evaluation: input.evaluation,
    createdAt: nowIso()
  };
}

export function followUpQuestionsForResearchRun(input: {
  brief: LeadBrief;
  strategy?: LeadResearchStrategy;
  run: {
    found?: number;
    needsReview?: number;
    blocked?: number;
    metrics?: Partial<LeadResearchMetrics>;
  };
}): AgentQuestion[] {
  const found = input.run.found ?? 0;
  const needsReview = input.run.needsReview ?? 0;
  const metrics = input.run.metrics ?? {};
  const noisyOrEmpty = (metrics.searchesRun ?? 0) > 0 && found === 0 && (metrics.candidateCount ?? 0) === 0;
  const blockedOrDeferred =
    (metrics.sourceDeferred ?? 0) + (metrics.robotsSkipped ?? 0) + (metrics.directFetchBlocked ?? 0) + (input.run.blocked ?? 0) > 0;
  const weakProof = found <= 1 && needsReview >= Math.max(3, found + 3);

  if (blockedOrDeferred || noisyOrEmpty) {
    return [
      {
        id: "blocked-source-recovery",
        category: "blocked-source-recovery",
        prompt: "How should I recover from weak or blocked sources?",
        kind: "single-choice",
        defaultOptionId: "alternate-public-sources",
        reason: "The last checkpoint did not produce enough verified leads, so Leadsy should switch recovery strategy before spending more searches.",
        options: [
          {
            id: "alternate-public-sources",
            label: "Alternate public sources",
            description: "Try linked websites, contact pages, directory mirrors, public profiles, snippets, and review pages.",
            recommended: true
          },
          {
            id: "switch-lane",
            label: "Switch lane",
            description: "Move to another buyer or market lane that is more likely to expose public evidence."
          },
          {
            id: "import-seeds",
            label: "Use seed list",
            description: "Pause for an owner-provided list of websites, profiles, or directories to enrich."
          }
        ]
      }
    ];
  }

  if (weakProof) {
    return [
      {
        id: "proof-strictness",
        category: "proof-strictness",
        prompt: "Should I loosen discovery or keep stricter proof?",
        kind: "single-choice",
        defaultOptionId: "balanced-proof",
        reason: "Needs Proof is growing faster than Good leads, so Leadsy needs a quality checkpoint before continuing.",
        options: [
          {
            id: "balanced-proof",
            label: "Balanced proof",
            description: "Keep Good strict, but retain inspectable candidates in Needs Proof.",
            recommended: true
          },
          {
            id: "more-leads",
            label: "More leads",
            description: "Accept more inspectable Needs Proof records and complete contact evidence later."
          },
          {
            id: "strict-proof",
            label: "Strict proof",
            description: "Only continue with lanes that show strong evidence and contact paths."
          }
        ]
      }
    ];
  }

  const modes = input.strategy?.audienceModes ?? detectAudienceModes(input.brief);
  if (modes.some((mode) => mode === "creator-influencer" || mode === "b2c-public-profile")) {
    return [
      {
        id: "contact-policy",
        category: "contact-policy",
        prompt: "For public profile leads, what contact proof is enough?",
        kind: "single-choice",
        defaultOptionId: "profile-url-enough",
        reason: "B2C/profile discovery can save inspectable leads from public profile evidence, while outreach permission stays separate.",
        options: [
          {
            id: "profile-url-enough",
            label: "Profile URL enough",
            description: "Save strong public profile matches as Good for manual inspection.",
            recommended: true
          },
          {
            id: "contact-path-required",
            label: "Contact path required",
            description: "Require email, phone, WhatsApp, form, or explicit contact instruction before Good."
          },
          {
            id: "strict-outreach",
            label: "Strict outreach",
            description: "Keep profiles in Needs Proof unless they expose both fit and outreach-safe contact evidence."
          }
        ]
      }
    ];
  }

  return [];
}

export const plan_lead_research = planLeadResearch;
export const generate_search_lanes = generateSearchLanes;
export const follow_up_questions_for_research_run = followUpQuestionsForResearchRun;
export const search_public_web = searchPublicWeb;
export const classify_search_result = classifySearchResult;
export const expand_directory_page = expandDirectoryPage;
export const fetch_public_page = fetchPublicPage;
export const extract_contact_paths = extractContactPaths;
export const verify_business_fit = verifyBusinessFit;
export const score_lead_evidence = scoreLeadEvidence;
export const build_research_tool_recipe = buildResearchToolRecipe;
export const run_research_tool_recipe = runResearchToolRecipe;
export const evaluate_research_tool_recipe = evaluateResearchToolRecipe;
export const save_owner_search_memory = saveOwnerSearchMemory;

export const leadDiscoveryTools = {
  plan_lead_research,
  generate_search_lanes,
  follow_up_questions_for_research_run,
  search_public_web,
  classify_search_result,
  expand_directory_page,
  fetch_public_page,
  extract_contact_paths,
  verify_business_fit,
  score_lead_evidence,
  build_research_tool_recipe,
  run_research_tool_recipe,
  evaluate_research_tool_recipe,
  save_owner_search_memory
};

function plannedSearchesFromPreview(preview: ResearchPlanPreview, selected: LeadResearchSourceType[], budget: ResearchBudget): PlannedSearch[] {
  const searches: PlannedSearch[] = [];
  for (const lane of preview.lanes) {
    if (lane.searches?.length) {
      for (const item of lane.searches) {
        searches.push({
          query: item.query,
          sourceType: normalizeSearchSource(item.sourceType, selected),
          audienceMode: lane.audienceMode,
          why: item.why ?? lane.why
        });
        if (searches.length >= budget.maxSearches) {
          return searches;
        }
      }
      continue;
    }
    const laneSource = lane.sourceTypes.find((source) => selected.includes(source)) ?? selected[0] ?? "openrouter-web-search";
    for (const query of lane.queries.slice(0, budget.mode === "broad" ? 2 : 1)) {
      searches.push({
        query,
        sourceType: normalizeSearchSource(laneSource, selected),
        audienceMode: lane.audienceMode,
        why: lane.why
      });
      if (searches.length >= budget.maxSearches) {
        return searches;
      }
    }
  }
  return searches;
}

function normalizeSearchSource(source: unknown, selected: LeadResearchSourceType[]): LeadResearchSourceType {
  return typeof source === "string" && isResearchSource(source) && selected.includes(source)
    ? source
    : selected[0] ?? "openrouter-web-search";
}

function plannedSearchesFromUnknown(value: unknown, selected: LeadResearchSourceType[]): PlannedSearch[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const maybe = value as { queries?: unknown; searches?: unknown };
  const list = Array.isArray(maybe.queries) ? maybe.queries : Array.isArray(maybe.searches) ? maybe.searches : [];
  const planned: PlannedSearch[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const raw = item as { query?: unknown; sourceType?: unknown; why?: unknown };
    const query = typeof raw.query === "string" ? raw.query.trim() : "";
    if (!query) {
      continue;
    }
    const search: PlannedSearch = {
      query,
      sourceType: normalizeSearchSource(raw.sourceType, selected)
    };
    if (typeof raw.why === "string" && raw.why.trim()) {
      search.why = raw.why.trim();
    }
    planned.push(search);
  }
  return planned;
}

function dedupeSearchPlan(plan: PlannedSearch[], maxSearches: number) {
  const seen = new Set<string>();
  const clean: PlannedSearch[] = [];
  for (const item of plan) {
    const key = item.query.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    clean.push(item);
    if (clean.length >= maxSearches) {
      break;
    }
  }
  return clean;
}

function fallbackSearchPlan(
  brief: LeadBrief,
  selected: LeadResearchSourceType[],
  budget: ResearchBudget,
  preview?: ResearchPlanPreview
): PlannedSearch[] {
  const previewPlan = preview ? plannedSearchesFromPreview(preview, selected, budget) : [];
  if (previewPlan.length) {
    return dedupeSearchPlan(previewPlan, budget.maxSearches);
  }

  const recipePlan = preview?.toolRecipes?.flatMap((recipe) =>
    recipe.queries.map((query, index) => ({
      query,
      sourceType: normalizeSearchSource(
        recipe.steps[index % recipe.steps.length]?.primitive === "expand_directory_page" ? "directory-osint" : "openrouter-web-search",
        selected
      ),
      why: recipe.reason
    }))
  ) ?? [];
  if (recipePlan.length) {
    return dedupeSearchPlan(recipePlan, budget.maxSearches);
  }

  const deterministicPreview = buildResearchPlanPreview({
    tenantId: brief.tenantId,
    ownerId: brief.ownerId,
    brief
  });
  const deterministicPlan = plannedSearchesFromPreview(deterministicPreview, selected, budget);
  if (deterministicPlan.length) {
    return dedupeSearchPlan(deterministicPlan, budget.maxSearches);
  }

  const service = brief.service.trim();
  const customer = brief.idealCustomers.trim();
  const location = brief.searchLocations.trim();
  const exclusions = brief.excludedLeads.trim();
  const savedDomainExclusions = savedDomainExclusionSuffix(budget.excludedDomains);
  const base = [
    { query: `${customer} ${location} contact website`, sourceType: "openrouter-web-search" },
    { query: `${customer} ${location} business directory`, sourceType: "directory-osint" },
    { query: `${customer} ${location} companies phone email`, sourceType: "website-contact-osint" },
    { query: `${customer} ${location} Instagram`, sourceType: "social-osint" },
    { query: `${customer} ${location} LinkedIn company`, sourceType: "social-osint" },
    { query: `${customer} ${location} reviews ratings`, sourceType: "review-reputation-osint" },
    { query: `${customer} ${location} outdated website content marketing`, sourceType: "content-gap-osint" },
    { query: `${customer} ${location} hiring expansion news`, sourceType: "hiring-news-osint" },
    { query: `${customer} ${location} competitors ${service}`, sourceType: "competitor-osint" },
    { query: `${customer} ${location} lead generation sales automation`, sourceType: "openrouter-web-search" },
    { query: `"${customer}" "${location}" "contact us"`, sourceType: "website-contact-osint" },
    { query: `"${customer}" "${location}" "about us"`, sourceType: "website-contact-osint" }
  ].map((item) => ({
    query: `${exclusions ? `${item.query} -${exclusions.split(/\s+/).slice(0, 3).join(" -")}` : item.query} ${savedDomainExclusions}`.trim(),
    sourceType: normalizeSearchSource(item.sourceType, selected)
  }));

  return dedupeSearchPlan(base, budget.maxSearches);
}

async function planSearchesWithOpenRouter(
  brief: LeadBrief,
  selected: LeadResearchSourceType[],
  budget: ResearchBudget,
  preview?: ResearchPlanPreview
) {
  const apiKey = openRouterKey();
  const fallback = fallbackSearchPlan(brief, selected, budget, preview);
  if (!apiKey || process.env.LEADSY_AI_PLANNER_ENABLED === "false") {
    return { plan: fallback };
  }

  type OpenRouterResponse = {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const prompt = [
    "Create public web search queries for Leadsy's lead research tools.",
    budget.mode === "broad"
      ? "This is broad research. Expand across regions, source types, business signals, and public pages. Do not collapse it into one narrow city query."
      : "This is focused research. Keep queries tighter around the city/niche.",
    "Return JSON only with queries. Each query must be executable by a normal free public web search engine.",
    "Do not use paid databases, private profiles, login-only sources, or hidden scraping.",
    `Create ${budget.maxSearches} queries.`,
    `Allowed sourceType values: ${selected.join(", ")}`,
    `Service sold: ${brief.service}`,
    `Ideal customers: ${brief.idealCustomers}`,
    `Search locations: ${brief.searchLocations}`,
    `Campaign target: ${budget.targetLeadGoal}`,
    `Current batch: ${budget.batchNumber}; save up to ${budget.maxSaves} prospects in this batch.`,
    preview?.ownerWebsiteContext ? `Owner website context: ${JSON.stringify(preview.ownerWebsiteContext)}` : "No owner website context.",
    preview?.toolRecipes?.length ? `Existing adaptive tool recipes: ${JSON.stringify(preview.toolRecipes.slice(0, 3))}` : "No adaptive recipes yet.",
    budget.excludedDomains.length ? `Already saved domains to avoid: ${budget.excludedDomains.slice(0, 20).join(", ")}` : "No saved domains yet.",
    `Avoid: ${brief.excludedLeads || "none"}`
  ].join("\n");

  try {
    const result = await postJson<OpenRouterResponse & OpenRouterUsageShape>(`${openRouterBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "http-referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "x-title": "Leadsy Broad Research Planner"
      },
      body: JSON.stringify({
        model: openRouterPlannerModel(),
        messages: [
          { role: "system", content: "You plan transparent public OSINT searches for B2B lead discovery. Return JSON only." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "lead_search_plan",
            strict: false,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                queries: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      query: { type: "string" },
                      sourceType: { type: "string", enum: selected },
                      why: { type: "string" }
                    },
                    required: ["query", "sourceType"]
                  }
                }
              },
              required: ["queries"]
            }
          }
        },
        max_tokens: 2000
      })
    });
    const cost = await openRouterCostFromResponse(result, "planner");
    const planned = dedupeSearchPlan(plannedSearchesFromUnknown(parseJsonFromText(result.choices?.[0]?.message?.content ?? ""), selected), budget.maxSearches);
    return { plan: planned.length ? planned : fallback, cost };
  } catch {
    return { plan: fallback };
  }
}

function normalizeCandidateUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function socialPlatformHost(host: string) {
  return /(instagram\.com|facebook\.com|linkedin\.com|youtube\.com|youtu\.be)$/i.test(host);
}

function socialProfilePathLooksPublic(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (!socialPlatformHost(host)) return true;
    if (/\/(login|signin|accounts|privacy|terms|help|explore|hashtag|reel|reels|p|posts?|watch|videos?|shorts|playlist|share)(\/|$)/i.test(path)) {
      return false;
    }
    if (/linkedin\.com$/i.test(host)) {
      return /^\/(?:company|school|showcase|in)\/[^/]+\/?$/i.test(path);
    }
    if (/youtube\.com$/i.test(host)) {
      return /^\/(?:@[^/]+|c\/[^/]+|channel\/[^/]+|user\/[^/]+)\/?$/i.test(path);
    }
    if (/youtu\.be$/i.test(host)) return false;
    return /^\/[^/?#]{2,80}\/?$/i.test(path);
  } catch {
    return false;
  }
}

function candidateScore(candidate: SearchCandidate) {
  const haystack = `${candidate.title} ${candidate.url}`.toLowerCase();
  let score = 100 - candidate.rank;
  if (/contact|about|services|profile|company|listing|directory|instagram|linkedin|facebook|reviews?/.test(haystack)) score += 20;
  if (/login|signin|account|pdf|privacy|terms|jobs\/apply/.test(haystack)) score -= 35;
  if (/news|article|blog|journal|press|wikipedia|government|\.gov\.|\.gov\/|\/gov\//.test(haystack)) score -= 45;
  if (/contact|about|services|book|appointment|enquir|inquir|quote|consultation/.test(haystack)) score += 12;
  if (candidate.sourceType === "website-contact-osint" && /contact|about|services/.test(haystack)) score += 15;
  if (candidate.sourceType === "social-osint" && /instagram|facebook|linkedin|youtube/.test(haystack)) score += 15;
  if (candidate.sourceType === "social-osint" && !socialProfilePathLooksPublic(candidate.url)) score -= 60;
  if (candidate.sourceType === "directory-osint" && /directory|listing|justdial|sulekha|indiamart|startup|vendor/.test(haystack)) score += 12;
  return score;
}

function candidateRejectReason(
  candidate: Pick<SearchCandidate, "title" | "url" | "snippet">,
  brief?: LeadBrief,
  options?: { allowAlternateEvidence?: boolean }
): LeadRejectionReason | undefined {
  let host = "";
  try {
    host = new URL(candidate.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "blocked-source";
  }
  if (brief && !candidateHasRequestedLocation(candidate, brief)) return "out-of-location";
  const allowAlternateEvidence = Boolean(options?.allowAlternateEvidence && alternateEvidenceHost(candidate.url));
  const haystack = `${candidate.title} ${candidate.url} ${candidate.snippet ?? ""} ${host}`.toLowerCase();
  if (socialPlatformHost(host) && !socialProfilePathLooksPublic(candidate.url)) {
    return "non-business-page";
  }
  if (socialPlatformHost(host) && /\b(private profile|log in|login|sign up|sign in|followers|following|fan account|fanpage)\b/i.test(haystack)) {
    return "non-business-page";
  }
  if (brief) {
    const providerReason = badFitProviderRejectReason({ title: candidate.title, url: candidate.url }, brief);
    if (providerReason) return providerReason;
  }
  if (pageLooksLikeVendor(host)) return "bad-fit-vendor";
  const prospectReason = prospectPageRejectReason({ title: candidate.title, url: candidate.url, host });
  if (prospectReason && !allowAlternateEvidence) return prospectReason;
  const marketplaceReason = marketplaceRejectReason({ title: candidate.title, url: candidate.url, host });
  if (marketplaceReason) return marketplaceReason;
  const utilityReason = utilityPageRejectReason({ title: candidate.title, url: candidate.url, host });
  if (utilityReason) return utilityReason;
  if (
    !allowAlternateEvidence &&
    /(justdial|sulekha|indiamart|directory|listing|top\s+\d+|best\s+\d+)/i.test(haystack) &&
    !/contact|about|profile|company|supplier|dealer/i.test(haystack)
  ) {
    return "generic-directory";
  }
  return undefined;
}

function candidateLooksLikeDirectoryExpansionTarget(candidate: SearchCandidate, reason?: LeadRejectionReason) {
  if (reason && reason !== "generic-directory") return false;
  const haystack = `${candidate.title} ${candidate.url}`.toLowerCase();
  return (
    candidate.sourceType === "directory-osint" ||
    directoryLikeUrl(candidate.url) ||
    /\b(directory|directories|members?|association|chamber|listing|list of|suppliers?|vendors?|companies|businesses|marketplace)\b/i.test(haystack)
  );
}

function dedupeCandidates(candidates: SearchCandidate[]) {
  const byUrl = new Map<string, SearchCandidate>();
  for (const candidate of candidates) {
    const key = normalizeCandidateUrl(candidate.url);
    const existing = byUrl.get(key);
    if (!existing || candidateScore(candidate) > candidateScore(existing)) {
      byUrl.set(key, candidate);
    }
  }
  return [...byUrl.values()].sort((left, right) => candidateScore(right) - candidateScore(left));
}

async function emitRejectedCandidate(input: {
  context?: ResearchContext;
  candidate: SearchCandidate;
  reason: LeadRejectionReason;
}) {
  if (!input.context) return;
  await emitResearchEvent(
    input.context.events,
    input.context.onEvent,
    researchEvent({
      ...input.context,
      type: "rejected",
      status: "rejected",
      title: "Rejected bad page",
      summary: "Leadsy skipped this result before spending AI credit because it does not look like a customer lead.",
      technicalDetail: `${input.candidate.title}\n${input.candidate.url}`,
      businessName: input.candidate.title,
      url: input.candidate.url,
      query: input.candidate.query,
      sourceType: input.candidate.sourceType,
      rejectionReason: input.reason
    })
  );
}

async function emitDiscardedSearchNoise(input: {
  context?: ResearchContext;
  candidate: SearchCandidate;
  reason: LeadRejectionReason;
}) {
  if (!input.context) return;
  await emitResearchEvent(
    input.context.events,
    input.context.onEvent,
    researchEvent({
      ...input.context,
      type: "discarded-noise",
      status: "completed",
      title: "Discarded search noise",
      summary: "Leadsy removed this search result before fetching because it does not look like a usable prospect.",
      technicalDetail: `${input.candidate.title}\n${input.candidate.url}`,
      businessName: input.candidate.title,
      url: input.candidate.url,
      query: input.candidate.query,
      sourceType: input.candidate.sourceType,
      rejectionReason: input.reason
    })
  );
}

async function runSearchPlan(plan: PlannedSearch[], budget: ResearchBudget, stats: ResearchToolStats, brief: LeadBrief, context?: ResearchContext) {
  const candidates: SearchCandidate[] = [];
  for (const item of plan.slice(0, budget.maxSearches)) {
    if (context) {
      await emitResearchEvent(
        context.events,
        context.onEvent,
        researchEvent({
          ...context,
          type: "searched-web",
          status: "running",
          title: sourceSearchTitles[item.sourceType] ?? "Searching public web",
          summary: `Checking ${sourceDisplayLabels[item.sourceType]} results for: ${item.query}`,
          technicalDetail: `Tool: search_public_web · maxResults: ${budget.resultsPerSearch}`,
          query: item.query,
          sourceType: item.sourceType,
          provider: "public-search"
        })
      );
    }
    try {
      const result = await searchPublicWeb({ query: item.query, maxResults: budget.resultsPerSearch });
      stats.searchesRun += 1;
      stats.queries.push(item.query);
      addSourceBreakdown(stats, item.sourceType, {
        searchesRun: 1,
        candidateCount: result.results.length
      });
      if (context) {
        await emitResearchEvent(
          context.events,
          context.onEvent,
          researchEvent({
            ...context,
            type: "searched-web",
            status: "completed",
            title: `${sourceDisplayLabels[item.sourceType]} search completed`,
            summary: `${result.results.length} public result${result.results.length === 1 ? "" : "s"} came back from ${sourceDisplayLabels[item.sourceType]}.`,
            technicalDetail: item.why ? `${item.query}\n${item.why}` : item.query,
            query: item.query,
            sourceType: item.sourceType,
            provider: result.diagnostics?.find((diagnostic) => diagnostic.provider)?.provider ?? "public-search"
          })
        );
      }
      result.results.forEach((searchResult, index) => {
        candidates.push({ ...searchResult, query: item.query, sourceType: item.sourceType, audienceMode: item.audienceMode, rank: index + 1 });
      });
    } catch (error) {
      stats.errors.push(`search_public_web: ${(error as Error).message}`);
      addSourceBreakdown(stats, item.sourceType, { sourceDeferred: 1 });
      if (context) {
        await emitResearchEvent(
          context.events,
          context.onEvent,
          researchEvent({
            ...context,
            type: "searched-web",
            status: "failed",
            title: "Search blocked or failed safely",
            summary: "Leadsy skipped this source instead of guessing.",
            technicalDetail: (error as Error).message,
            query: item.query,
            sourceType: item.sourceType,
            provider: "public-search"
          })
        );
      }
    }
  }
  stats.candidateCount = candidates.length;
  const deduped = dedupeCandidates(candidates);
  stats.dedupedCount = deduped.length;
  const filtered: SearchCandidate[] = [];
  const discarded: Array<{ candidate: SearchCandidate; reason: LeadRejectionReason }> = [];
  for (const candidate of deduped) {
    const host = candidateHost(candidate);
    const reason = budget.excludedDomains.includes(host) ? "duplicate" : candidateRejectReason(candidate, brief);
    if (!reason || candidateLooksLikeDirectoryExpansionTarget(candidate, reason)) {
      filtered.push(candidate);
      addSourceBreakdown(stats, candidate.sourceType, { promisingCount: 1 });
      continue;
    }
    discarded.push({ candidate, reason });
    addSourceBreakdown(stats, candidate.sourceType, { rawResultsDiscarded: 1, rejected: 1 });
  }
  stats.rawResultsDiscarded = (stats.rawResultsDiscarded ?? 0) + discarded.length;
  stats.promisingCount = filtered.length;
  for (const { candidate, reason } of discarded.slice(0, 5)) {
    await emitDiscardedSearchNoise({ context, candidate, reason });
  }
  if (context) {
    await emitResearchEvent(
      context.events,
      context.onEvent,
      researchEvent({
        ...context,
        type: "candidate-found",
        status: "completed",
        title: "Source candidate pool created",
        summary: `${candidates.length} raw results became ${filtered.length} promising candidates; ${discarded.length} search-noise result${discarded.length === 1 ? "" : "s"} were discarded before fetch.`,
        technicalDetail: deduped.slice(0, 12).map((candidate) => candidate.url).join("\n")
      })
    );
  }
  return filtered;
}

function candidateHost(candidate: Pick<SearchCandidate, "url">) {
  try {
    return new URL(candidate.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function identityTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/|www\.|\.com\.au|\.com|\.org|\.net|\.edu|\.au/g, " ")
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !/^(contact|about|services|service|business|company|group|home|page|australia|australian|phone|email|login|privacy)$/.test(token))
    .slice(0, 8);
}

function candidateIdentityTokens(candidate: SearchCandidate) {
  const host = candidateHost(candidate);
  const hostBase = host.split(".").slice(0, -1).join(" ");
  return [...new Set([...identityTokens(candidate.title), ...identityTokens(hostBase)])].slice(0, 8);
}

function searchResultHasRequestedLocation(result: PublicSearchResult, brief: LeadBrief) {
  const requested = brief.searchLocations.toLowerCase();
  const tokens = locationTokens(brief);
  if (!tokens.length) return true;
  const haystack = `${result.title} ${result.url} ${result.snippet ?? ""}`.toLowerCase();
  if (/australia/.test(requested)) return /australia|australian/.test(haystack) || /\.au(\/|$)/i.test(result.url);
  if (/canada/.test(requested)) return /canada|canadian/.test(haystack) || /\.ca(\/|$)/i.test(result.url);
  if (/united kingdom|uk|england/.test(requested)) return /united kingdom|england|london|british/.test(haystack) || /\.uk(\/|$)/i.test(result.url);
  return tokens.some((token) => haystack.includes(token));
}

function alternateResultLooksRelated(result: PublicSearchResult, original: SearchCandidate, brief: LeadBrief) {
  const tokens = candidateIdentityTokens(original);
  const haystack = `${result.title} ${result.url} ${result.snippet ?? ""}`.toLowerCase();
  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  const sameDomainText = candidateHost(original).split(".")[0];
  const domainMentioned = sameDomainText.length >= 4 && haystack.includes(sameDomainText);
  return (matchedTokens.length >= 1 || domainMentioned) && searchResultHasRequestedLocation(result, brief);
}

function alternateEvidenceQueries(candidate: SearchCandidate, brief: LeadBrief) {
  const host = candidateHost(candidate);
  const title = sanitizeSearchTerm(candidate.title).slice(0, 90);
  const hostBase = sanitizeSearchTerm(host.replace(/\.[a-z.]+$/i, "").replace(/[-_]+/g, " "));
  const location = sanitizeSearchTerm(brief.searchLocations);
  return [
    `"${title}" "${location}" contact phone`,
    `"${host}" "${location}" business`,
    `"${hostBase}" "${location}" email phone`
  ]
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter((query, index, all) => query.length > 8 && all.indexOf(query) === index)
    .slice(0, 2);
}

function recoverableFetchError(error: unknown) {
  return (
    isPublicFetchError(error) &&
    ["blocked", "rate-limited", "robots-disallowed", "domain-capped", "timeout", "network-error"].includes(error.code)
  );
}

async function emitDeferredCandidate(input: {
  context?: ResearchContext;
  candidate: SearchCandidate;
  error: Error;
}) {
  if (!input.context) return;
  await emitResearchEvent(
    input.context.events,
    input.context.onEvent,
    researchEvent({
      ...input.context,
      type: "public-page-checked",
      status: "deferred",
      title: "Direct fetch deferred",
      summary: "Leadsy paused the direct site fetch and switched to alternate public OSINT evidence.",
      technicalDetail: input.error.message,
      businessName: input.candidate.title,
      url: input.candidate.url,
      query: input.candidate.query,
      sourceType: input.candidate.sourceType
    })
  );
}

async function recoverCandidateWithAlternateEvidence(input: {
  candidate: SearchCandidate;
  brief: LeadBrief;
  budget: ResearchBudget;
  stats: ResearchToolStats;
  context?: ResearchContext;
}) {
  const recoveredPages: FetchedResearchPage[] = [];
  const blockedHost = candidateHost(input.candidate);
  for (const query of alternateEvidenceQueries(input.candidate, input.brief)) {
    if (input.stats.searchesRun >= input.budget.maxSearches + 3) break;
    try {
      const search = await searchPublicWeb({ query, maxResults: 5 });
      input.stats.searchesRun += 1;
      input.stats.queries.push(query);
      addSourceBreakdown(input.stats, input.candidate.sourceType, { searchesRun: 1, candidateCount: search.results.length });
      for (const result of search.results) {
        if (recoveredPages.length >= 2) break;
        const resultHost = candidateHost({ url: result.url });
        if (!resultHost || resultHost === blockedHost || !alternateResultLooksRelated(result, input.candidate, input.brief)) {
          continue;
        }
        const sourceType = sourceTypeForEvidenceUrl(result.url, input.candidate.sourceType);
        const reason = candidateRejectReason({ title: result.title, url: result.url }, undefined, { allowAlternateEvidence: true });
        if (reason) {
          continue;
        }
        try {
          const page = await fetchPublicPage({ url: result.url, runId: input.context?.runId, recoveredFromUrl: input.candidate.url });
          recordFetchDiagnostics(input.stats, page.diagnostics, sourceType);
          input.stats.pagesFetched += 1;
          addSourceBreakdown(input.stats, sourceType, { pagesFetched: 1 });
          const recoveredPage = {
            ...page,
            query,
            sourceType,
            audienceMode: input.candidate.audienceMode,
            titleFromSearch: result.title,
            rank: recoveredPages.length + 1
          };
          recoveredPages.push(recoveredPage);
          if (pageLooksPromisingForDossier(recoveredPage, input.brief)) {
            input.stats.alternateSourceRecovered = (input.stats.alternateSourceRecovered ?? 0) + 1;
            addSourceBreakdown(input.stats, sourceType, { alternateSourceRecovered: 1, promisingCount: 1 });
            if (input.context) {
              await emitResearchEvent(
                input.context.events,
                input.context.onEvent,
                researchEvent({
                  ...input.context,
                  type: "osint-added",
                  status: "completed",
                  title: "Recovered alternate OSINT evidence",
                  summary: "A blocked direct site was supported by another public source instead.",
                  technicalDetail: `Original: ${input.candidate.url}\nEvidence: ${page.url}`,
                  businessName: businessNameFromPage(recoveredPage),
                  url: page.url,
                  query,
                  sourceType
                })
              );
            }
            return recoveredPages;
          }
        } catch (error) {
          if (isPublicFetchError(error)) {
            recordFetchDiagnostics(input.stats, error.diagnostics, sourceType);
          }
        }
      }
    } catch (error) {
      input.stats.errors.push(`alternate_osint_search: ${(error as Error).message}`);
      addSourceBreakdown(input.stats, input.candidate.sourceType, { sourceDeferred: 1 });
    }
  }
  return recoveredPages;
}

async function fetchCandidatePages(candidates: SearchCandidate[], budget: ResearchBudget, stats: ResearchToolStats, brief: LeadBrief, context?: ResearchContext) {
  const pages: FetchedResearchPage[] = [];
  for (const candidate of candidates.slice(0, budget.maxFetches)) {
    try {
      const page = await fetchPublicPage({ url: candidate.url, runId: context?.runId });
      recordFetchDiagnostics(stats, page.diagnostics, candidate.sourceType);
      const finalRejectReason = candidateRejectReason({ title: page.title || candidate.title, url: page.url }, undefined);
      if (finalRejectReason && !candidateLooksLikeDirectoryExpansionTarget(candidate, finalRejectReason)) {
        stats.rawResultsDiscarded = (stats.rawResultsDiscarded ?? 0) + 1;
        addSourceBreakdown(stats, candidate.sourceType, { rawResultsDiscarded: 1, rejected: 1 });
        if (context) {
          await emitResearchEvent(
            context.events,
            context.onEvent,
            researchEvent({
              ...context,
              type: "discarded-noise",
              status: "completed",
              title: "Discarded fetched search noise",
              summary: "Discarded after fetch because the final page is not a real prospect page.",
              technicalDetail: `${page.title || candidate.title}\n${page.url}`,
              businessName: businessNameFromPage({ ...page, query: candidate.query, sourceType: candidate.sourceType, titleFromSearch: candidate.title, rank: candidate.rank }),
              url: page.url,
              query: candidate.query,
              sourceType: candidate.sourceType,
              rejectionReason: finalRejectReason
            })
          );
        }
        continue;
      }
      stats.pagesFetched += 1;
      addSourceBreakdown(stats, candidate.sourceType, { pagesFetched: 1 });
      pages.push({
        ...page,
        query: candidate.query,
        sourceType: candidate.sourceType,
        audienceMode: candidate.audienceMode,
        titleFromSearch: candidate.title,
        rank: candidate.rank
      });
      if (context) {
        await emitResearchEvent(
          context.events,
          context.onEvent,
          researchEvent({
            ...context,
            type: "public-page-checked",
            status: "completed",
            title: "Public page checked",
            summary: `${sourceDisplayLabels[candidate.sourceType]} checked ${page.title || candidate.title} for visible business details.`,
            technicalDetail: `Emails: ${page.emails.length}; phones: ${page.phones.length}; socials: ${page.socialLinks.length}`,
            url: page.url,
            query: candidate.query,
            sourceType: candidate.sourceType,
            businessName: businessNameFromPage({ ...page, query: candidate.query, sourceType: candidate.sourceType, titleFromSearch: candidate.title, rank: candidate.rank })
          })
        );
      }
    } catch (error) {
      if (isPublicFetchError(error)) {
        recordFetchDiagnostics(stats, error.diagnostics, candidate.sourceType);
      }
      if (recoverableFetchError(error)) {
        await emitDeferredCandidate({ context, candidate, error: error as Error });
        const recovered = await recoverCandidateWithAlternateEvidence({ candidate, brief, budget, stats, context });
        pages.push(...recovered);
        continue;
      }
      stats.errors.push(`fetch_public_page: ${(error as Error).message}`);
      if (context) {
        await emitResearchEvent(
          context.events,
          context.onEvent,
          researchEvent({
            ...context,
            type: "public-page-checked",
            status: "failed",
            title: "Public page skipped",
            summary: "The page could not be fetched publicly, so Leadsy did not use it.",
            technicalDetail: (error as Error).message,
            url: candidate.url,
            query: candidate.query,
            sourceType: candidate.sourceType
          })
        );
      }
    }
  }
  return pages;
}

function pageEvidencePack(pages: FetchedResearchPage[], budget: ResearchBudget) {
  const textLimit = budget.mode === "broad" ? 1600 : 2400;
  return pages.map((page) => ({
    url: page.url,
    title: page.title || page.titleFromSearch,
    sourceType: page.sourceType,
    searchQuery: page.query,
    emails: page.emails,
    phones: page.phones,
    socialLinks: page.socialLinks,
    siteName: page.siteName,
    schemaName: page.schemaName,
    logoAlt: page.logoAlt,
    visibleText: page.text.slice(0, textLimit)
  }));
}

function likelyBusinessHost(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const hostWords = host.replace(/[.-]+/g, " ");
    const nonBusinessPlatform = /(facebook|instagram|linkedin|youtube|youtu\.be|music\.youtube|google|bing|duckduckgo|wikipedia|wikimedia|wiktionary|dictionary|merriam-webster|cambridge|britannica|crunchbase|zaubacorp|amazon|flipkart|hubspot|salesforce|zoho|leadsquared|pipedrive|freshworks|gov\.in|nic\.in|apple|microsoft|dell|stackoverflow|github|npmjs|reddit|quora|zhihu|xnxx|xvideos|pornhub|lokmat|localwp)/i.test(host);
    const publicSectorHost = /(^|\.)gov(\.|$)|(^|\.)mil(\.|$)/i.test(host);
    const contentHost = /\b(news|magazine|daily|times|herald|journal|press|media|blog|articles?|stories?)\b/i.test(hostWords);
    return !nonBusinessPlatform && !publicSectorHost && !contentHost;
  } catch {
    return false;
  }
}

function alternateEvidenceHost(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return /(facebook|instagram|linkedin|yellowpages|yelp|hotfrog|trueblue|startlocal|australiabiz|businesslistings|localbusinessguide|cylex|cybo|aubiz|dnb|chamber|businessdirectory|directory)/i.test(host);
  } catch {
    return false;
  }
}

function sourceTypeForEvidenceUrl(url: string, fallback: LeadResearchSourceType): LeadResearchSourceType {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (/(instagram|facebook|linkedin|youtube)\.com/i.test(host)) return "social-osint";
    if (/(directory|yellowpages|yelp|hotfrog|trueblue|startlocal|australiabiz|localbusinessguide|cylex|cybo|aubiz|dnb|chamber)/i.test(host)) {
      return "directory-osint";
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function pageCanSupportLeadDossier(page: FetchedResearchPage) {
  return likelyBusinessHost(page.recoveredFromUrl ?? page.url) || alternateEvidenceHost(page.url);
}

function businessNameFromPage(page: FetchedResearchPage) {
  const title = page.title || page.titleFromSearch;
  const metadataName = [page.schemaName, page.siteName, page.logoAlt]
    .map((value) => value?.trim())
    .find((value) => value && !genericBusinessName(value) && !/^[a-z0-9-]{8,}$/.test(value));
  if (metadataName) {
    return metadataName.slice(0, 100);
  }
  const titlePart = title
    .split(/\s[|–—-]\s|:/)
    .map((part) => part.trim())
    .find((part) => part && !/^(home|contact(?: us)?|about(?: us)?|services|privacy policy|terms|login|sign in|https?|\/\/|www\.)/i.test(part));
  if (titlePart && !/^(best|top|find|book online|patient information|placements?|places?|jobs?|classifieds?|comparison|what is|how to|pursue your|research & innovation|overseas education consultants since|migration agent|finance broker|finance company|dentist|dental clinic)\b/i.test(titlePart) && !genericBusinessName(titlePart)) {
    return titlePart.slice(0, 100);
  }
  return businessNameFromHostUrl(page.recoveredFromUrl ?? page.url);
}

function categoryFromPage(page: FetchedResearchPage) {
  const haystack = `${page.title} ${page.titleFromSearch} ${page.url} ${page.text.slice(0, 2500)}`;
  const categories: string[] = [];
  if (/finance|loan|mortgage|lending|broker|accounting|accountant|tax|wealth|insurance|credit/i.test(haystack)) categories.push("Finance");
  if (/health|clinic|medical|doctor|dental|diagnostic|hospital|ndis|care|physio|therapy/i.test(haystack)) categories.push("Healthcare");
  if (/education|school|college|coaching|tutor|training|admission|university|institute|rto|student/i.test(haystack)) categories.push("Education");
  if (/real estate|property|builder|developer|housing|buyers? agent|rental|conveyanc/i.test(haystack)) categories.push("Real estate");
  return categories.length ? [...new Set(categories)].join(", ") : "Public business page";
}

function pageHasRequestedLocation(page: FetchedResearchPage, brief: LeadBrief) {
  const tokens = locationTokens(brief);
  if (!tokens.length || /india/i.test(brief.searchLocations)) return true;
  const haystack = `${page.title} ${page.url} ${page.recoveredFromUrl ?? ""} ${page.text}`.toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

function pageLooksPromisingForDossier(page: FetchedResearchPage, brief: LeadBrief) {
  const rejectReason = candidateRejectReason(
    { title: page.title || page.titleFromSearch, url: page.url },
    undefined,
    { allowAlternateEvidence: Boolean(page.recoveredFromUrl) }
  );
  const isDirectoryExpansionPage =
    rejectReason === "generic-directory" ||
    page.sourceType === "directory-osint" ||
    directoryLikeUrl(page.url) ||
    /\b(directory|members?|association|chamber|listing|list of|companies|businesses)\b/i.test(`${page.title} ${page.titleFromSearch} ${page.url}`);
  if (rejectReason && !isDirectoryExpansionPage) return false;
  const providerReason = badFitProviderRejectReason(
    { title: `${page.title || ""} ${page.titleFromSearch || ""}`, url: page.recoveredFromUrl ?? page.url },
    brief
  );
  if (providerReason && !isDirectoryExpansionPage) return false;
  const name = businessNameFromPage(page);
  const haystack = `${page.title} ${page.titleFromSearch} ${page.url} ${page.text}`.toLowerCase();
  const customerText = brief.idealCustomers.toLowerCase();
  const hasContactSignal =
    page.emails.length > 0 ||
    page.phones.length > 0 ||
    page.socialLinks.length > 0 ||
    /contact us|whatsapp|enquir|inquir|appointment|admission|book now|call us|request callback|get quote|site visit/.test(haystack);
  const hasBriefSignal = customerText
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 3 && !/^(with|over|above|business|businesses|industries|industry|customers|clients|services)$/.test(token))
    .slice(0, 12)
    .some((token) => haystack.includes(token));
  const hasCommercialSignal =
    hasBusinessVerticalSignal(`${name} ${page.title} ${page.titleFromSearch} ${page.url}`) ||
    /about us|our services|contact us|enquiry|inquiry|appointment|book now|call us|request callback|get quote|solutions|consultation|admissions?|clinic|school|college|finance|insurance|wealth|procurement|IT services|computer|laptop|headset|headphone/i.test(haystack);
  if (isDirectoryExpansionPage) {
    const hasDirectoryBusinessSignal =
      /\b(contact|phone|email|website|address|members?|companies|businesses|services?|profile|supplier|provider)\b/i.test(haystack) ||
      page.emails.length > 0 ||
      page.phones.length > 0 ||
      page.socialLinks.length > 0;
    return hasDirectoryBusinessSignal && pageHasRequestedLocation(page, brief);
  }
  const hasBusinessIdentity = Boolean(
    name &&
      name.length > 2 &&
      !/technical difficulties|digital india|wikipedia|dictionary|definition|how to|youtube|videos?|local$/i.test(name) &&
      pageCanSupportLeadDossier(page) &&
      hasCommercialSignal
  );
  return hasBusinessIdentity && hasContactSignal && hasBriefSignal && pageHasRequestedLocation(page, brief);
}

function fallbackRawLeadsFromPages(brief: LeadBrief, pages: FetchedResearchPage[], budget: ResearchBudget): RawLeadCandidate[] {
  return pages
    .filter((page) => pageCanSupportLeadDossier(page) && pageLooksPromisingForDossier(page, brief))
    .slice(0, Math.max(1, Math.min(budget.maxSaves, LEAD_MAGNET_MAX_LEAD_GOAL)))
    .map((page) => {
      const instagram = page.socialLinks.find((url) => /instagram\.com/i.test(url));
      const facebook = page.socialLinks.find((url) => /facebook\.com/i.test(url));
      const linkedin = page.socialLinks.find((url) => /linkedin\.com/i.test(url));
      return {
        businessName: businessNameFromPage(page),
        category: categoryFromPage(page),
        city: brief.searchLocations,
        phone: page.phones[0],
        whatsapp: undefined,
        email: page.emails[0],
        website: page.recoveredFromUrl ?? page.url,
        instagram,
        facebook,
        linkedin,
        contentQualitySignal: page.text.slice(0, 220) || "Public page found, needs manual content review.",
        whyTheyMayNeedAgency: `Public page appeared during research for ${brief.idealCustomers} and may be relevant for ${brief.service}.`,
        outreachAngle: `Reference a visible public page and offer a practical ${brief.service} improvement.`,
        nextAction: "Review public evidence, then approve a short WhatsApp/DM opener.",
        audienceMode: page.audienceMode,
        evidence: [
          sourceEvidence(
            page.sourceType,
            page.title || "Public page evidence",
            page.url,
            page.recoveredFromUrl
              ? `Recovered alternate public evidence after the direct site deferred: ${page.recoveredFromUrl}. Found from search query: ${page.query}`
              : `Found from search query: ${page.query}`
          )
        ],
        sourceTypes: [...new Set<LeadResearchSourceType>([page.sourceType, "browser-public-page"])]
      };
    });
}

function directoryExpandedRawLeadsFromPages(brief: LeadBrief, pages: FetchedResearchPage[], budget: ResearchBudget): RawLeadCandidate[] {
  const rawLeads: RawLeadCandidate[] = [];
  const seen = new Set<string>();
  const max = Math.max(1, Math.min(budget.maxSaves, LEAD_MAGNET_MAX_LEAD_GOAL));
  for (const page of pages) {
    const isDirectoryPage =
      page.sourceType === "directory-osint" ||
      directoryLikeUrl(page.url) ||
      /\b(directory|members?|association|chamber|listing|list of|companies|businesses)\b/i.test(`${page.title} ${page.titleFromSearch} ${page.url}`);
    if (!isDirectoryPage) continue;
    const lines = page.text
      .split(/\n| {2,}|•|·|\|/g)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length >= 8 && line.length <= 160)
      .filter((line) => /\b(contact|phone|email|www\.|https?:\/\/|services?|clinic|school|college|office|company|group|limited|ltd|llc|inc|pvt|private|consult|supplier|provider|dealer|store|centre|center)\b/i.test(line))
      .slice(0, 30);
    for (const line of lines) {
      if (rawLeads.length >= max) break;
      const candidateName = line
        .replace(/\b(?:phone|email|contact|website|address)\b[\s:.-]*/gi, " ")
        .replace(/https?:\/\/\S+|www\.\S+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
        .replace(/\+?\d[\d\s().-]{8,}\d/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(/ - | — | \| |, phone|, email/i)[0]
        ?.trim()
        .slice(0, 100);
      if (!candidateName || genericBusinessName(candidateName)) continue;
      const key = candidateName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const lineWebsite = normalizeUrl(line.match(/https?:\/\/[^\s,;)|]+|www\.[^\s,;)|]+/i)?.[0]);
      const lineEmail = normalizeEmail(line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]);
      const linePhone = normalizePhone(line.match(/\+?\d[\d\s().-]{8,}\d/)?.[0], brief);
      rawLeads.push({
        businessName: candidateName,
        category: categoryFromPage(page),
        city: brief.searchLocations,
        phone: linePhone ?? page.phones[rawLeads.length % Math.max(1, page.phones.length)],
        email: lineEmail ?? page.emails[rawLeads.length % Math.max(1, page.emails.length)],
        website: lineWebsite,
        contentQualitySignal: line,
        whyTheyMayNeedAgency: `This business appeared inside a public directory/listing while researching ${brief.idealCustomers} for ${brief.service}.`,
        outreachAngle: `Verify the business website/contact path, then reference the public listing and a practical ${brief.service} improvement.`,
        nextAction: "Open the source listing, verify contact details, then approve only if the business fit is real.",
        audienceMode: page.audienceMode,
        evidence: [
          sourceEvidence(
            "directory-osint",
            page.title || page.titleFromSearch || "Public directory evidence",
            page.url,
            `Directory expansion candidate from search query: ${page.query}. Source line: ${line}`
          )
        ],
        sourceTypes: ["directory-osint"]
      });
    }
  }
  return rawLeads;
}

async function createLeadsFromEvidence(input: {
  brief: LeadBrief;
  tenantId: string;
  ownerId: string;
  pages: FetchedResearchPage[];
  selectedSources: LeadResearchSourceType[];
  budget: ResearchBudget;
  stats?: ResearchToolStats;
  context?: ResearchContext;
  allowPaidDossier?: boolean;
}) {
  const apiKey = openRouterKey();
  const evidencePack = pageEvidencePack(input.pages, input.budget);
  let raw: RawLeadCandidate[] = [];
  let cost: OpenRouterUsageCost | undefined;

  if (apiKey && evidencePack.length && input.allowPaidDossier !== false) {
    type OpenRouterResponse = {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const prompt = [
      "Convert the attached public research evidence into real lead dossiers.",
      "Return only businesses supported by the evidence. Do not invent phone, email, address, rating, social links, or website.",
      "Good leads must have a real business identity, public evidence URL, requested-location proof, buyer fit, and at least one public contact path. Incomplete but real businesses should be needs-proof, not good.",
      `Research mode: ${input.budget.mode}`,
      `Campaign target: ${input.budget.targetLeadGoal}`,
      `Current batch ${input.budget.batchNumber}: save up to ${input.budget.maxSaves} prospects.`,
      `Service sold: ${input.brief.service}`,
      `Ideal customers: ${input.brief.idealCustomers}`,
      `Search locations: ${input.brief.searchLocations}`,
      `Bad-fit exclusions: ${input.brief.excludedLeads || "none"}`,
      `Allowed sourceTypes: ${input.selectedSources.join(", ")}`,
      "Public evidence pages:",
      JSON.stringify(evidencePack)
    ].join("\n");

    try {
      const result = await postJson<OpenRouterResponse & OpenRouterUsageShape>(`${openRouterBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "http-referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "x-title": "Leadsy Evidence-to-Dossier Agent"
        },
        body: JSON.stringify({
          model: openRouterDossierModel(),
          messages: [
            {
              role: "system",
              content:
                "You are Leadsy's lead R&D analyst. Use only the supplied public evidence. Do not reject real business homepages just because they contain footer/legal text. Build practical lead dossiers with location, contact confidence, fit reasoning, sentiment, and outreach angle. Return JSON only."
            },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "lead_research_result",
              strict: false,
              schema: leadResearchJsonSchema()
            }
          },
          max_tokens: 6000
        })
      });
      cost = await openRouterCostFromResponse(result, "dossier-builder");
      raw = rawLeadsFromUnknown(parseJsonFromText(result.choices?.[0]?.message?.content ?? ""));
    } catch {
      raw = [];
    }
  }

  if (!raw.length) {
    raw = [
      ...directoryExpandedRawLeadsFromPages(input.brief, input.pages, input.budget),
      ...fallbackRawLeadsFromPages(input.brief, input.pages, input.budget)
    ];
  }

  const leads: LeadDossier[] = [];
  let properDataCount = 0;
  let missingContactCount = 0;
  const qualityCounts: LeadQualityCounts = {
    savedGood: 0,
    needsProof: 0,
    rejected: 0,
    updatedDuplicates: 0
  };

  const primaryLeadSource = (sources: LeadResearchSourceType[]) =>
    sources.find((source) => source !== "openrouter-web-search" && source !== "browser-public-page") ??
    sources.find((source) => source !== "browser-public-page") ??
    sources[0] ??
    "openrouter-web-search";

  for (const lead of raw) {
    const inferredSources = inferLeadSources(lead, input.selectedSources);
    const sourceTypes = normalizeCandidateSources(lead.sourceTypes, inferredSources);
    const primarySource = primaryLeadSource(sourceTypes);
    const fallbackAudienceMode = lead.audienceMode ?? input.pages.find((page) => sourceTypes.includes(page.sourceType))?.audienceMode ?? detectAudienceModes(input.brief)[0];
    const normalizedRaw = normalizedRawLeadIdentity({
      ...lead,
      audienceMode: fallbackAudienceMode,
      sourceTypes,
      evidence: (lead.evidence ?? []).map((item) => ({
        ...item,
        sourceType: normalizeEvidenceSource(item.sourceType, sourceTypes[0] ?? "openrouter-web-search"),
        capturedAt: item.capturedAt || nowIso()
      }))
    });
    const preScore = scoreLead(normalizedRaw, input.brief);
    const preDecision = qualityDecisionForRaw(normalizedRaw, input.brief, preScore);
    addQualityGateBreakdown(input.stats, primarySource, qualityGateBreakdownForRaw(normalizedRaw, input.brief, preDecision));
    const dossier = createLeadDossier(normalizedRaw, input.brief, input.tenantId, input.ownerId);

    if (!dossier || preDecision.status === "rejected") {
      qualityCounts.rejected += 1;
      addSourceBreakdown(input.stats, primarySource, { rejected: 1 });
      if (input.context) {
        await emitResearchEvent(
          input.context.events,
          input.context.onEvent,
          researchEvent({
            ...input.context,
            type: "rejected",
            status: "rejected",
            title: "Rejected bad page",
            summary: preDecision.summary || "Rejected because this candidate did not look like a real prospect.",
            technicalDetail: normalizedRaw.evidence?.map((item) => `${item.label} ${item.url ?? item.note ?? ""}`).join("\n"),
            businessName: normalizedRaw.businessName,
            url: normalizedRaw.website ?? normalizedRaw.evidence?.find((item) => item.url)?.url,
            sourceType: primarySource,
            rejectionReason: preDecision.reason ?? "weak-evidence"
          })
        );
      }
      continue;
    }

    if (dossier.qualityDecision.status === "needs-proof") {
      qualityCounts.needsProof += 1;
      addSourceBreakdown(input.stats, primarySource, { needsProof: 1, savedCount: 1 });
      if (!leadHasContactPath(dossier)) {
        missingContactCount += 1;
        addSourceBreakdown(input.stats, primarySource, { missingContactCount: 1 });
      }
      if (input.context) {
        await emitResearchEvent(
          input.context.events,
          input.context.onEvent,
          researchEvent({
            ...input.context,
            type: "quarantined",
            status: "needs-proof",
            title: "Quarantined weak candidate",
            summary: dossier.qualityDecision.summary,
            technicalDetail: dossier.evidence.map((item) => `${item.label} ${item.url ?? item.note ?? ""}`).join("\n"),
            businessName: dossier.businessName,
            url: dossier.website ?? dossier.evidence.find((item) => item.url)?.url,
            location: dossier.location.evidence,
            sourceType: primarySource,
            rejectionReason: dossier.qualityDecision.reason
          })
        );
      }
      leads.push(dossier);
      if (leads.length >= input.budget.maxSaves) {
        break;
      }
      continue;
    }

    qualityCounts.savedGood += 1;
    properDataCount += 1;
    addSourceBreakdown(input.stats, primarySource, { usableProspects: 1, properDataCount: 1, savedCount: 1 });
    if (input.context) {
      await emitResearchEvent(
        input.context.events,
        input.context.onEvent,
        researchEvent({
          ...input.context,
          type: "osint-added",
          status: "completed",
          title: "OSINT details added",
          summary: `${dossier.businessName}: contact, location, evidence, and outreach angle prepared.`,
          technicalDetail: dossier.analysisSummary,
          businessName: dossier.businessName,
          leadId: dossier.id,
          url: dossier.website ?? dossier.evidence.find((item) => item.url)?.url,
          location: dossier.location.evidence,
          sourceType: primarySource
        })
      );
      await emitResearchEvent(
        input.context.events,
        input.context.onEvent,
        researchEvent({
          ...input.context,
          type: "sentiment-scored",
          status: "completed",
          title: "Sentiment and score added",
          summary: `${dossier.sentiment.label} sentiment · score ${dossier.score.overall}/100.`,
          technicalDetail: dossier.sentiment.reason,
          businessName: dossier.businessName,
          leadId: dossier.id,
          location: dossier.location.evidence,
          sourceType: primarySource
        })
      );
      await emitResearchEvent(
        input.context.events,
        input.context.onEvent,
        researchEvent({
          ...input.context,
          type: "saved",
          status: "completed",
          title: "Saved good lead",
          summary: `${dossier.businessName} was saved because it has enough public evidence and fit.`,
          technicalDetail: dossier.qualityDecision.summary,
          businessName: dossier.businessName,
          leadId: dossier.id,
          url: dossier.website ?? dossier.evidence.find((item) => item.url)?.url,
          location: dossier.location.evidence,
          sourceType: primarySource
        })
      );
    }
    leads.push(dossier);
    if (leads.length >= input.budget.maxSaves) {
      break;
    }
  }

  return { leads, cost, qualityCounts, properDataCount, missingContactCount };
}

function researchSummary(stats: ResearchToolStats, budget: ResearchBudget) {
  const queryPreview = stats.queries.slice(0, 3).join(" | ");
  const base = `${budget.mode === "broad" ? "Broad" : "Focused"} batch ${budget.batchNumber} ran ${stats.searchesRun} public search${stats.searchesRun === 1 ? "" : "es"}, checked ${stats.pagesFetched} public page${stats.pagesFetched === 1 ? "" : "s"}, built ${stats.dedupedCount} unique candidate${stats.dedupedCount === 1 ? "" : "s"}, discarded ${stats.rawResultsDiscarded ?? 0} search-noise result${stats.rawResultsDiscarded === 1 ? "" : "s"}, and saved ${stats.usableProspects ?? stats.savedCount} usable prospect${(stats.usableProspects ?? stats.savedCount) === 1 ? "" : "s"} toward ${budget.targetLeadGoal}.`;
  const recovery =
    (stats.sourceDeferred ?? 0) || (stats.alternateSourceRecovered ?? 0)
      ? ` Source policy deferred ${stats.sourceDeferred ?? 0} direct fetch${stats.sourceDeferred === 1 ? "" : "es"} and recovered ${stats.alternateSourceRecovered ?? 0} through alternate public evidence.`
      : "";
  return queryPreview ? `${base}${recovery} Queries: ${queryPreview}.` : `${base}${recovery}`;
}

async function discoverWithPublicCollectors(
  brief: LeadBrief,
  tenantId: string,
  ownerId: string,
  context?: ResearchContext,
  planPreview?: ResearchPlanPreview,
  existingLeads: LeadDossier[] = [],
  previousRuns: LeadSourceRun[] = []
): Promise<LeadCollectionResult> {
  const selectedSources = selectedCollectorSources(brief);
  const progress = campaignProgressForBrief(brief, existingLeads, previousRuns);
  const budget = researchBudgetForBrief(brief, {
    ...progress,
    batchNumber: planPreview?.batchNumber ?? progress.batchNumber,
    batchSize: planPreview?.batchSize ?? progress.batchSize,
    existingGoodCount: planPreview?.existingGoodCount ?? progress.existingGoodCount,
    targetLeadGoal: planPreview?.targetLeadGoal ?? progress.targetLeadGoal,
    minQualifiedTarget: planPreview?.minQualifiedTarget ?? progress.minQualifiedTarget
  });
  const audienceModes = planPreview?.audienceModes?.length ? planPreview.audienceModes : detectAudienceModes(brief);
  const stats = emptyResearchStats();
  const costs: OpenRouterUsageCost[] = [];
  const planned = await planSearchesWithOpenRouter(brief, selectedSources, budget, planPreview);
  if (planned.cost) {
    costs.push(planned.cost);
  }
  if (context) {
    await emitResearchEvent(
      context.events,
      context.onEvent,
      researchEvent({
        ...context,
        type: "searched-web",
        status: "completed",
        title: "Source collectors planned",
        summary: `Leadsy prepared ${planned.plan.length} source-specific public search sweep${planned.plan.length === 1 ? "" : "s"} across ${selectedSources.map((source) => sourceDisplayLabels[source]).join(", ")}.`,
        technicalDetail: planned.plan.map((item) => `${item.sourceType}: ${item.query}`).join("\n")
      })
    );
  }
  const candidates = await runSearchPlan(planned.plan, budget, stats, brief, context);
  if (!candidates.length) {
    stats.stoppedEarly = true;
    if (context) {
      context.spendGuard.stoppedReason = "weak-candidate-pool";
      await emitResearchEvent(
        context.events,
        context.onEvent,
        researchEvent({
          ...context,
          type: "cost-recorded",
          status: "completed",
          title: "Stopped to protect budget",
          summary: "Leadsy did not spend AI credit because the public search results were not promising customer leads.",
          technicalDetail: "No paid dossier builder call was made."
        })
      );
    }
  }
  const pages = candidates.length ? await fetchCandidatePages(candidates, budget, stats, brief, context) : [];
  const promisingPages = pages.filter((page) => pageLooksPromisingForDossier(page, brief));
  stats.promisingCount = promisingPages.length;
  const weakPages = pages.filter((page) => !promisingPages.includes(page));
  stats.rawResultsDiscarded = (stats.rawResultsDiscarded ?? 0) + weakPages.length;
  for (const page of weakPages) {
    addSourceBreakdown(stats, page.sourceType, { rawResultsDiscarded: 1 });
  }
  const protectedExpensiveRun = Boolean(context?.spendGuard.mode === "protected" && expensiveResearchModel() && context.spendGuard.capInr <= spendCapFromEnv());
  const allowPaidDossier = promisingPages.length > 0 && !protectedExpensiveRun;

  if (pages.length && !promisingPages.length && context) {
    stats.stoppedEarly = true;
    context.spendGuard.stoppedReason = "no-public-evidence";
    await emitResearchEvent(
      context.events,
      context.onEvent,
      researchEvent({
        ...context,
        type: "cost-recorded",
        status: "completed",
        title: "Stopped to protect budget",
        summary: "Pages were checked, but none had enough customer evidence for a paid AI dossier pass.",
        technicalDetail: "No paid dossier builder call was made."
      })
    );
  }

  if (promisingPages.length && protectedExpensiveRun && context) {
    stats.stoppedEarly = true;
    context.spendGuard.stoppedReason = "expensive-model";
    await emitResearchEvent(
      context.events,
      context.onEvent,
      researchEvent({
        ...context,
        type: "cost-recorded",
        status: "completed",
        title: "Protected budget",
        summary: "Leadsy found some possible pages, but skipped the expensive AI dossier pass under the Rs. 1 protected cap.",
        technicalDetail: "Use full research after reviewing the search plan if you want deeper AI extraction."
      })
    );
  }

  const dossierResult = await createLeadsFromEvidence({
    brief,
    tenantId,
    ownerId,
    pages: promisingPages,
    selectedSources,
    budget,
    stats,
    context,
    allowPaidDossier
  });
  if (dossierResult.cost) {
    costs.push(dossierResult.cost);
  }
  const leads = dossierResult.leads;
  stats.savedCount = leads.length;
  stats.usableProspects = dossierResult.qualityCounts.savedGood;
  stats.properDataCount = dossierResult.properDataCount;
  stats.missingContactCount = dossierResult.missingContactCount;
  const cost = combineOpenRouterCosts(costs);
  if (cost) {
    addSourceBreakdown(stats, "openrouter-web-search", { costInr: cost.costInr });
  }
  if (context && cost) {
    await emitResearchEvent(
      context.events,
      context.onEvent,
      researchEvent({
        ...context,
        type: "cost-recorded",
        status: "completed",
        title: "AI credit cost recorded",
        summary: `OpenRouter burned Rs. ${cost.costInr.toFixed(6)} for this research run.`,
        technicalDetail: `USD ${cost.costUsd.toFixed(8)} · FX ${cost.fx.rate} (${cost.fx.source}) · tokens ${cost.totalTokens ?? 0}`
      })
    );
  }

  return {
    leads,
    summary: researchSummary(stats, budget),
    messages: [...new Set(stats.errors)].slice(0, 4).map((error) => `Research tool blocked/failed safely: ${error}`),
    metrics: {
      searchesRun: stats.searchesRun,
      pagesFetched: stats.pagesFetched,
      candidateCount: stats.candidateCount,
      dedupedCount: stats.dedupedCount,
      promisingCount: stats.promisingCount,
      rejectedCount: stats.rejectedCount,
      targetLeadGoal: budget.targetLeadGoal,
      minQualifiedTarget: budget.minQualifiedTarget,
      batchNumber: budget.batchNumber,
      batchSize: budget.batchSize,
      rawResultsDiscarded: stats.rawResultsDiscarded,
      usableProspects: stats.usableProspects,
      properDataCount: stats.properDataCount,
      missingContactCount: stats.missingContactCount,
      directFetchBlocked: stats.directFetchBlocked,
      retriedAfterBackoff: stats.retriedAfterBackoff,
      alternateSourceRecovered: stats.alternateSourceRecovered,
      robotsSkipped: stats.robotsSkipped,
      sourceDeferred: stats.sourceDeferred,
      rateLimitedCount: stats.rateLimitedCount,
      qualityGateBreakdown: stats.qualityGateBreakdown,
      savedCount: stats.savedCount,
      audienceModes,
      sourceBreakdown: sourceBreakdownSnapshot(stats)
    },
    events: context?.events,
    cost,
    qualityCounts: {
      ...dossierResult.qualityCounts,
      rejected: dossierResult.qualityCounts.rejected + (stats.rejectedCount ?? 0)
    },
    sourcesUsed: [...new Set<LeadResearchSourceType>([
      ...promisingPages.map((page) => page.sourceType),
      ...leads.flatMap((lead) => lead.sourceTypes)
    ])]
  };
}

async function enrichFromPublicWebsite(lead: LeadDossier): Promise<LeadDossier> {
  if (process.env.BROWSER_WORKER_PROVIDER === "disabled" || !lead.website) {
    return lead;
  }

  try {
    const page = await fetchPublicPage({ url: lead.website });
    const email = normalizeEmail(page.emails[0]);
    const phone = normalizePhone(page.phones[0], `${lead.location?.city ?? ""} ${lead.location?.area ?? ""}`);
    const instagram = normalizeUrl(page.socialLinks.find((url) => /instagram\.com/i.test(url)));
    const facebook = normalizeUrl(page.socialLinks.find((url) => /facebook\.com/i.test(url)));
    const description = page.text.slice(0, 180) || page.title;

    return {
      ...lead,
      email: lead.email || email,
      phone: lead.phone || phone,
      whatsapp: lead.whatsapp,
      instagram: lead.instagram || instagram,
      facebook: lead.facebook || facebook,
      contentQualitySignal: description
        ? `Website public snippet: ${description.slice(0, 180)}`
        : lead.contentQualitySignal,
      evidence: [
        ...lead.evidence,
        sourceEvidence("browser-public-page", "Public website extraction", page.url)
      ],
      sourceTypes: [...new Set<LeadResearchSourceType>([...lead.sourceTypes, "browser-public-page"])],
      updatedAt: nowIso()
    };
  } catch {
    return lead;
  }
}

export function buildManualLeadDossiers(input: {
  tenantId: string;
  ownerId: string;
  brief: LeadBrief;
  rawText: string;
}): LeadDossier[] {
  const lines = input.rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, Math.min(input.brief.leadGoal || 50, LEAD_MAGNET_MAX_LEAD_GOAL)));

  return lines
    .map((line, index) => {
      const parts = line.split(/,|\t/).map((part) => part.trim()).filter(Boolean);
      const website = parts.find((part) => normalizeUrl(part));
      const email = parts.find((part) => normalizeEmail(part));
      const phone = parts.find((part) => normalizePhone(part, input.brief));
      const businessName = parts.find((part) => part !== website && part !== email && part !== phone) ?? line.slice(0, 80);
      return createLeadDossier(
        {
          businessName,
          category: input.brief.idealCustomers,
          city: input.brief.searchLocations,
          phone,
          whatsapp: undefined,
          email,
          website,
          whyTheyMayNeedAgency: `Imported by the agency owner as a possible fit for ${input.brief.service}.`,
          outreachAngle: `Review public context, then use a practical ${input.brief.service} opener.`,
          nextAction: "Verify source context, then draft a first touch.",
          evidence: [sourceEvidence("manual-import", `Manual import line ${index + 1}`, website, line)],
          sourceTypes: ["manual-import"]
        },
        input.brief,
        input.tenantId,
        input.ownerId
      );
    })
    .filter((lead): lead is LeadDossier => Boolean(lead));
}

function qualityGateSummary(breakdown?: LeadQualityGateBreakdown) {
  if (!breakdown) return "";
  const labels: Array<[keyof LeadQualityGateBreakdown, string]> = [
    ["missingContact", "missing contact path"],
    ["weakFit", "weak buyer fit"],
    ["missingLocation", "missing location proof"],
    ["directoryOnly", "directory-only evidence"],
    ["missingEvidenceUrl", "missing evidence URL"],
    ["weakIdentity", "weak identity"],
    ["passiveEvidence", "passive evidence only"],
    ["blockedSource", "blocked source"],
    ["rejectedNoise", "rejected noise"]
  ];
  const top = labels
    .map(([key, label]) => ({ label, count: breakdown[key] ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);
  return top.length ? `Main blockers: ${top.map((item) => `${item.label} (${item.count})`).join(", ")}.` : "";
}

function runOutcome(input: {
  leadCount: number;
  needsProof: number;
  missingOpenRouter: boolean;
  ranAnySource: boolean;
  failedSource: boolean;
  metrics?: LeadResearchMetrics;
  spendGuard: SpendGuard;
  cost?: OpenRouterUsageCost;
}): LeadRunOutcome {
  const spent = input.cost?.costInr ?? 0;
  const gateSummary = qualityGateSummary(input.metrics?.qualityGateBreakdown);
  if (input.leadCount > 0) {
    const target = input.metrics?.targetLeadGoal;
    const batch = input.metrics?.batchNumber;
    return {
      status: "leads-saved",
      headline: target ? `${input.leadCount} / ${target} good leads saved` : `${input.leadCount} good lead${input.leadCount === 1 ? "" : "s"} saved`,
      summary: `Leadsy saved evidence-backed prospects${batch ? ` in batch ${batch}` : ""} and spent ${formatInr(spent)} in AI credit.`,
      nextActions: ["Open Good leads", "Review evidence", "Draft outreach for approval"]
    };
  }
  if (input.missingOpenRouter || !input.ranAnySource) {
    return {
      status: "needs-source",
      headline: "Connect a source before research",
      summary: "Leadsy needs at least one public collector or a pasted lead list before it can research real businesses.",
      whyNoLeads: "No live research source was available.",
      nextActions: ["Select public collectors", "Paste a small real lead list", "Run protected search again"]
    };
  }
  if (input.spendGuard.stoppedReason) {
    return {
      status: "stopped-budget",
      headline: "Stopped before wasting more money",
      summary: `Leadsy checked public sources and protected the budget. AI credit spent: ${formatInr(spent)}.`,
      whyNoLeads:
        gateSummary ||
        (input.spendGuard.stoppedReason === "weak-candidate-pool"
          ? "The first search results were mostly bad-fit pages, portals, products, or generic sources."
          : input.spendGuard.stoppedReason === "expensive-model"
            ? "The configured model is expensive, so Leadsy skipped deep AI extraction under the protected cap."
            : "The checked pages did not contain enough public business evidence."),
      nextActions: ["Review Good blockers", "Answer the recovery question", "Run Search again with the improved lane"]
    };
  }
  if (input.needsProof > 0) {
    return {
      status: "needs-proof",
      headline: `${input.needsProof} candidate${input.needsProof === 1 ? "" : "s"} need proof`,
      summary: "Leadsy found possible businesses but kept them out of Good leads until evidence is stronger.",
      whyNoLeads: gateSummary || "The records lacked enough fit, contact, or location proof.",
      nextActions: ["Open Needs proof", "Update missing details", "Approve only real prospects"]
    };
  }
  if (input.failedSource) {
    return {
      status: "failed",
      headline: "Research source had a problem",
      summary: "One source failed safely. Leadsy did not guess or invent leads.",
      whyNoLeads: "The public source returned an error or blocked fetches.",
      nextActions: ["Open Research details", "Try a focused lane", "Paste seed leads if available"]
    };
  }
  return {
    status: "no-fit",
    headline: "No good leads saved",
    summary: `Leadsy ran ${input.metrics?.searchesRun ?? 0} searches and checked ${input.metrics?.pagesFetched ?? 0} pages, but saved 0 because the evidence was weak.`,
    whyNoLeads: gateSummary || "The target was too broad or the public results were not real customer prospects.",
    nextActions: ["Choose a concrete industry lane", "Use a city or region", "Run protected search again"]
  };
}

export async function runLeadResearch(input: {
  tenantId: string;
  ownerId: string;
  brief: LeadBrief;
  existingLeads?: LeadDossier[];
  previousRuns?: LeadSourceRun[];
  planPreview?: ResearchPlanPreview;
  budgetCapInr?: number;
  fullRun?: boolean;
  onEvent?: LeadResearchProgressHandler;
}): Promise<LeadResearchResult> {
  const requested = input.brief.sources.length ? input.brief.sources : defaultResearchSources;
  const runId = `run_${crypto.randomUUID()}`;
  const startedAt = nowIso();
  const connectionMessages: string[] = [];
  const agentRuns: AgentRunLog[] = [];
  const events: LeadResearchEvent[] = [];
  const costs: OpenRouterUsageCost[] = [];
  const planPreview = input.planPreview ?? buildResearchPlanPreview({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    brief: input.brief,
    existingLeads: input.existingLeads,
    previousRuns: input.previousRuns,
    budgetCapInr: input.budgetCapInr,
    fullRun: input.fullRun
  });
  if (planPreview.briefFingerprint && planPreview.briefFingerprint !== briefFingerprintForBrief(input.brief)) {
    throw new Error("stale_session: The saved brief changed after this search plan was created. Start a new search.");
  }
  const audienceModes = planPreview.audienceModes?.length ? planPreview.audienceModes : detectAudienceModes(input.brief);
  const spendGuard: SpendGuard = { ...planPreview.spendGuard };
  const qualityCounts: LeadQualityCounts = {
    savedGood: 0,
    needsProof: 0,
    rejected: 0,
    updatedDuplicates: 0
  };
  const context: ResearchContext = {
    runId,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    events,
    spendGuard,
    onEvent: input.onEvent
  };
  let leads: LeadDossier[] = [];
  let researchMetrics: LeadResearchMetrics | undefined;
  let researchSourcesUsed: LeadResearchSourceType[] = [];

  async function collect(
    source: LeadResearchSourceType,
    provider: AgentRunLog["provider"],
    fn: () => Promise<LeadDossier[] | LeadCollectionResult>,
    missingMessage?: string
  ) {
    if (missingMessage) {
      connectionMessages.push(missingMessage);
      agentRuns.push({
        id: `agent_${crypto.randomUUID()}`,
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        agent: "lead-finder",
        provider,
        inputSummary: `${source} discovery for ${input.brief.idealCustomers} in ${input.brief.searchLocations}`,
        outputSummary: missingMessage,
        status: "needs-connection",
        createdAt: nowIso()
      });
      return;
    }
    try {
      const result = await fn();
      const found = Array.isArray(result) ? result : result.leads;
      if (!Array.isArray(result) && result.messages?.length) {
        connectionMessages.push(...result.messages);
      }
      if (!Array.isArray(result)) {
        researchMetrics = result.metrics ?? researchMetrics;
        researchSourcesUsed = [...researchSourcesUsed, ...(result.sourcesUsed ?? [])];
        if (result.cost) {
          costs.push(result.cost);
        }
        if (result.qualityCounts) {
          qualityCounts.savedGood += result.qualityCounts.savedGood;
          qualityCounts.needsProof += result.qualityCounts.needsProof;
          qualityCounts.rejected += result.qualityCounts.rejected;
          qualityCounts.updatedDuplicates += result.qualityCounts.updatedDuplicates;
        }
      }
      leads = leads.concat(found);
      agentRuns.push({
        id: `agent_${crypto.randomUUID()}`,
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        agent: "lead-finder",
        provider,
        inputSummary: `${source} discovery for ${input.brief.idealCustomers} in ${input.brief.searchLocations}`,
        outputSummary: Array.isArray(result)
          ? `Found ${found.length} evidence-backed lead${found.length === 1 ? "" : "s"}.`
          : result.summary ?? `Found ${found.length} evidence-backed lead${found.length === 1 ? "" : "s"}.`,
        displayTitle:
          provider === "openrouter"
            ? "AI-assisted public research"
            : source === "openrouter-web-search"
              ? "Multi-source public collectors"
              : "Lead finder",
        displaySummary: Array.isArray(result)
          ? `${found.length} usable lead${found.length === 1 ? "" : "s"} found.`
          : `${found.length} usable lead${found.length === 1 ? "" : "s"} saved, ${result.qualityCounts?.needsProof ?? 0} quarantined, ${result.qualityCounts?.rejected ?? 0} rejected.`,
        technicalSummary: Array.isArray(result) ? undefined : result.summary,
        status: "completed",
        metrics: Array.isArray(result) ? undefined : result.metrics,
        cost: Array.isArray(result) ? undefined : result.cost,
        createdAt: nowIso()
      });
    } catch (error) {
      connectionMessages.push(`${source} failed: ${(error as Error).message}`);
      agentRuns.push({
        id: `agent_${crypto.randomUUID()}`,
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        agent: "lead-finder",
        provider,
        inputSummary: `${source} discovery for ${input.brief.idealCustomers} in ${input.brief.searchLocations}`,
        outputSummary: (error as Error).message,
        status: "failed",
        createdAt: nowIso()
      });
    }
  }

  if (requested.some((source) => publicCollectorSourceSet.has(source))) {
    await collect(
      "openrouter-web-search",
      "local",
      () => discoverWithPublicCollectors(input.brief, input.tenantId, input.ownerId, context, planPreview, input.existingLeads, input.previousRuns)
    );
  }

  if (
    requested.includes("browser-public-page") ||
    requested.includes("website-contact-osint") ||
    requested.includes("content-gap-osint")
  ) {
    const before = dedupeLeads(leads);
    leads = await Promise.all(before.map((lead) => enrichFromPublicWebsite(lead)));
    agentRuns.push({
      id: `agent_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      agent: "page-extractor",
      provider: "browser-worker",
      inputSummary: `Public page extraction for ${before.length} discovered lead${before.length === 1 ? "" : "s"}.`,
      outputSummary: process.env.BROWSER_WORKER_PROVIDER === "disabled"
        ? "Browser worker disabled; public page extraction skipped."
        : `Extracted visible website details from ${before.filter((lead) => lead.website).length} public site${before.filter((lead) => lead.website).length === 1 ? "" : "s"}.`,
      status: process.env.BROWSER_WORKER_PROVIDER === "disabled" ? "needs-connection" : "completed",
      createdAt: nowIso()
    });
  }

  const deduped = dedupeLeads(leads).slice(0, Math.max(1, clampLeadGoal(input.brief.leadGoal)));
  const goodLeads = deduped.filter((lead) => lead.qualityDecision.status === "good");
  const needsProofLeads = deduped.filter((lead) => lead.qualityDecision.status === "needs-proof");
  const qualified = goodLeads.filter((lead) => lead.score.status === "high-confidence").length;
  const finalQualityCounts: LeadQualityCounts = {
    ...qualityCounts,
    savedGood: goodLeads.length,
    needsProof: needsProofLeads.length
  };
  const needsReview = finalQualityCounts.needsProof;
  const blocked = finalQualityCounts.rejected;
  const metrics = researchMetrics
    ? {
        ...researchMetrics,
        audienceModes,
        savedCount: deduped.length,
        usableProspects: goodLeads.length,
        properDataCount: goodLeads.length,
        missingContactCount: needsProofLeads.filter((lead) => !leadHasContactPath(lead)).length
      }
    : undefined;
  const cost = combineOpenRouterCosts(costs);
  spendGuard.spentInr = cost?.costInr ?? 0;
  const used = [...new Set([...researchSourcesUsed, ...deduped.flatMap((lead) => lead.sourceTypes)])];
  const missingOpenRouter = connectionMessages.some((message) => message.includes("OPENROUTER_API_KEY"));
  const failedSource = agentRuns.some((run) => run.status === "failed");
  const completedLeadFinder = agentRuns.some((run) => run.agent === "lead-finder" && run.status === "completed");
  const ranAnySource = agentRuns.length > 0;

  if (!deduped.length && completedLeadFinder && !failedSource && !missingOpenRouter && metrics) {
    const mode = input.brief.researchMode === "focused" ? "Focused" : "Broad";
    connectionMessages.push(
      `${mode} public collectors completed: ${metrics.searchesRun} searches, ${metrics.pagesFetched} public pages checked, ${metrics.dedupedCount} unique candidates, and 0 records saved. Leadsy refused to invent leads or contacts.`
    );
  }

  const status: LeadSourceRun["status"] = deduped.length
    ? "completed"
    : missingOpenRouter || !ranAnySource
      ? "needs-connection"
      : failedSource
        ? "failed"
        : "completed";
  const recommendation = goodLeads.length
    ? `Review usable prospects first. This batch saved ${goodLeads.length} good lead${goodLeads.length === 1 ? "" : "s"} and ${needsProofLeads.length} needs-proof candidate${needsProofLeads.length === 1 ? "" : "s"}.`
    : finalQualityCounts.needsProof
      ? `${finalQualityCounts.needsProof} candidate${finalQualityCounts.needsProof === 1 ? "" : "s"} moved to Needs Proof. Leadsy kept them out of the good-lead list until location, evidence, or fit is stronger.`
    : missingOpenRouter
      ? "AI dossier analysis is optional. Public collectors can still run; import a real list if you want seed records."
      : !ranAnySource
        ? "Select at least one live research source or import a real list."
        : failedSource
          ? "A research source returned an error. Check the agent timeline, then run again."
          : metrics
            ? `${input.brief.researchMode === "focused" ? "Focused" : "Broad"} research ran ${metrics.searchesRun} searches and checked ${metrics.pagesFetched} public pages. It saved 0 because no record had enough public evidence yet. You can broaden source words, add a seed list, or keep this run for review.`
            : "OpenRouter ran, but no evidence-backed leads were saved. Import a seed list or adjust the lead brief so Leadsy can research similar businesses.";
  const completedAt = nowIso();
  const outcome = runOutcome({
    leadCount: goodLeads.length,
    needsProof: finalQualityCounts.needsProof,
    missingOpenRouter,
    ranAnySource,
    failedSource,
    metrics,
    spendGuard,
    cost
  });

  return {
    run: {
      id: runId,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      audienceModes,
      status,
      sourcesRequested: requested,
      sourcesUsed: used,
      found: goodLeads.length,
      qualified,
      needsReview,
      blocked: Math.max(0, blocked),
      metrics,
      events: events.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      cost,
      outcome,
      ownerSummary: outcome.summary,
      nextActions: outcome.nextActions,
      spendGuard,
      planPreview,
      qualityCounts: finalQualityCounts,
      recommendation,
      connectionMessages,
      startedAt,
      completedAt
    },
    leads: deduped,
    agentRuns
  };
}

export async function draftLeadMessage(input: {
  tenantId: string;
  ownerId: string;
  brief: LeadBrief;
  lead: LeadDossier;
}): Promise<LeadDraftResult> {
  const apiKey = openRouterKey();
  const channel: MessageDraft["channel"] = input.lead.whatsapp || input.lead.phone ? "whatsapp" : input.lead.instagram ? "instagram-dm" : "email";
      let message = `Hi ${input.lead.businessName}, I noticed your business in ${input.lead.city}. We help teams with ${input.brief.service}. Would it be useful if I shared 2 quick ideas to improve lead flow this month?`;
  let rationale = "Local draft created without AI provider. Connect OpenRouter for richer personalization.";
  let cost: OpenRouterUsageCost | undefined;
  let followUpPlan = [
    "Send only after manual approval.",
    "If they reply positively, ask about current lead source and monthly goal.",
    "If no reply, follow up once with a specific idea from public evidence."
  ];

  if (apiKey) {
    try {
      type OpenRouterResponse = { choices?: Array<{ message?: { content?: string | null } }> };
      const result = await postJson<OpenRouterResponse & OpenRouterUsageShape>(`${openRouterBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "http-referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "x-title": "Leadsy Message Drafting"
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_FAST_MODEL || "openai/gpt-5.2",
          messages: [
            {
              role: "system",
              content:
                "Write short, respectful Indian SMB outreach. Be transparent that the agency reviewed public business pages when useful. Do not pretend prior consent, private access, or insider knowledge. Return JSON only."
            },
            {
              role: "user",
              content: JSON.stringify({
                service: input.brief.service,
                action: input.brief.aiAction,
                lead: input.lead,
                channel
              })
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "message_draft",
              strict: false,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  message: { type: "string" },
                  rationale: { type: "string" },
                  followUpPlan: { type: "array", items: { type: "string" } }
                },
                required: ["message", "rationale", "followUpPlan"]
              }
            }
          },
          max_tokens: 1200
        })
      });
      cost = await openRouterCostFromResponse(result, "message-drafter");
      const parsed = parseJsonFromText(result.choices?.[0]?.message?.content ?? "") as
        | { message?: string; rationale?: string; followUpPlan?: string[] }
        | null;
      message = parsed?.message?.trim() || message;
      rationale = parsed?.rationale?.trim() || rationale;
      followUpPlan = Array.isArray(parsed?.followUpPlan) && parsed.followUpPlan.length ? parsed.followUpPlan : followUpPlan;
    } catch (error) {
      rationale = `AI drafting failed, so Leadsy prepared a safe local draft. Reason: ${(error as Error).message}`;
    }
  }

  const createdAt = nowIso();
  return {
    draft: {
      id: `draft_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      leadId: input.lead.id,
      channel,
      message,
      rationale,
      followUpPlan,
      status: "draft",
      createdAt
    },
    agentRun: {
      id: `agent_${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      agent: "message-drafter",
      provider: apiKey ? "openrouter" : "local",
      inputSummary: `Draft ${channel} message for ${input.lead.businessName}.`,
      outputSummary: rationale,
      displayTitle: "Message drafted for approval",
      displaySummary: `Draft prepared for ${input.lead.businessName}. Nothing was sent.`,
      technicalSummary: rationale,
      status: "completed",
      cost,
      createdAt
    }
  };
}

function inferIntent(prompt: string): CopilotIntent {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("whatsapp") || normalized.includes("reply") || normalized.includes("conversation")) {
    return "whatsapp";
  }
  if (normalized.includes("find lead") || normalized.includes("lead magnet") || normalized.includes("prospect")) {
    return "lead-magnet";
  }
  if (normalized.includes("meta") || normalized.includes("instagram") || normalized.includes("facebook")) {
    return "qualification";
  }
  if (normalized.includes("client") || normalized.includes("agency") || normalized.includes("report")) {
    return "agency";
  }
  if (normalized.includes("forecast") || normalized.includes("close") || normalized.includes("risk")) {
    return "forecast";
  }
  if (normalized.includes("summar") || normalized.includes("account") || normalized.includes("deal")) {
    return "account-summary";
  }
  if (normalized.includes("email") || normalized.includes("sequence") || normalized.includes("outreach")) {
    return "outreach";
  }
  if (normalized.includes("workflow") || normalized.includes("automation") || normalized.includes("route")) {
    return "workflow";
  }
  if (normalized.includes("filter") || normalized.includes("list") || normalized.includes("segment")) {
    return "filter";
  }
  return "general";
}

function getContext(accountId?: string) {
  const account = accountId ? getAccountById(accountId) : accounts[0];
  const accountContacts = account ? contacts.filter((contact) => contact.accountId === account.id) : contacts;
  const accountDeals = account ? deals.filter((deal) => deal.accountId === account.id) : deals;
  const accountActivities = account ? activities.filter((activity) => activity.accountId === account.id) : activities;
  return { account, accountContacts, accountDeals, accountActivities };
}

export class DeterministicRevenueModel implements RevenueAIModel {
  async complete(request: CopilotRequest): Promise<CopilotResponse> {
    const intent = inferIntent(request.prompt);
    const { account, accountContacts, accountDeals, accountActivities } = getContext(request.accountId);
    const topDeal = accountDeals[0] ?? deals[0];
    const topContact = accountContacts[0] ?? contacts[0];
    const recentActivity = accountActivities[0] ?? activities[0];

    if (intent === "forecast") {
      const totalSpend = agencyClients.reduce((sum, client) => sum + client.monthlyAdSpend, 0);
      const totalLeads = agencyClients.reduce((sum, client) => sum + client.monthlyLeads, 0);
      const riskyDeals = deals.filter((deal) => deal.risk !== "low");
      if (!agencyClients.length && !deals.length) {
        return {
          intent,
          answer:
            "The workspace is clean. Connect a client, Meta lead source, WhatsApp account, or CRM import before forecasting pipeline or conversion economics.",
          actions: [
            { label: "Connect Meta source", command: "integrations.meta.connect" },
            { label: "Create client workspace", command: "clients.create" }
          ],
          citations: ["empty-workspace"]
        };
      }
      return {
        intent,
        answer: `Agency forecast: ${formatInr(totalSpend)} monthly ad spend is producing ${totalLeads.toLocaleString(
          "en-IN"
        )} leads at blended CPL ${formatInr(totalLeads ? Math.round(totalSpend / totalLeads) : 0)}. The biggest controllable risk is slow human follow-up, not AI cost. Keep AI qualifying every Meta lead instantly, and escalate only hot buyers. Enterprise weighted pipeline is still ${formatCurrency(
          deals.reduce((sum, deal) => sum + deal.value * (deal.probability / 100), 0)
        )}; ${riskyDeals[0]?.name ?? topDeal?.name ?? "no active deal"} needs attention.`,
        actions: [
          { label: "Review urgent clients", command: "agency.reviewClients", payload: { status: "urgent" } },
          { label: "Queue AI follow-ups", command: "followups.queue", payload: { channel: "whatsapp" } }
        ],
        citations: ["agency-clients", "meta-leads", "follow-ups"]
      };
    }

    if (intent === "outreach") {
      if (!account || !topContact) {
        return {
          intent,
          answer:
            "No outreach audience exists yet. Import contacts, connect approved lead sources, or let Lead Magnet discover prospects before generating sequences.",
          actions: [
            { label: "Open Lead Magnet", command: "leadMagnet.open" },
            { label: "Import contacts", command: "contacts.import" }
          ],
          citations: ["empty-workspace"]
        };
      }
      return {
        intent,
        answer: `Draft the first touch around ${account?.activeSignals.join(", ") ?? "active buying signals"}. Lead with the business event, then connect it to faster routing and cleaner enrichment. ${topContact.name} should receive a concise executive note; operations contacts should get the workflow proof.`,
        actions: [
          { label: "Generate sequence", command: "sequence.generate", payload: { contactId: topContact.id } },
          { label: "Check deliverability", command: "deliverability.score", payload: { campaignId: campaigns[0]?.id } }
        ],
        citations: ["campaigns", "contacts", "signals"]
      };
    }

    if (intent === "qualification") {
      const lead = metaLeads[0];
      if (!lead) {
        return {
          intent,
          answer:
            "There are no Meta leads in this workspace yet. Once the Meta webhook is connected, I can qualify budget, location, timeline, language, urgency, and spam risk instantly.",
          actions: [
            { label: "Connect Meta webhook", command: "integrations.meta.connect" },
            { label: "Open Lead Magnet", command: "leadMagnet.open" }
          ],
          citations: ["empty-meta-leads"]
        };
      }
      const client = getAgencyClientById(lead.clientId);
      const qualification = getQualificationByLeadId(lead.id);
      return {
        intent,
        answer: `${lead.fullName} from ${lead.platform} campaign "${lead.campaignName}" is worth immediate attention. CPL is ${formatInr(
          lead.costPerLead
        )}, budget is ${lead.budget}, location is ${lead.preferredLocation}, and urgency score is ${
          qualification?.urgencyScore ?? 82
        }. AI should ask one direct visit-slot question on WhatsApp, then route to ${client?.owner ?? "the client owner"} if read or replied.`,
        actions: [
          { label: "Send WhatsApp qualifier", command: "whatsapp.sendAiQualifier", payload: { leadId: lead.id } },
          { label: "Escalate hot lead", command: "routing.escalate", payload: { leadId: lead.id, owner: client?.owner } }
        ],
        citations: ["meta-leads", "qualification-snapshots", "agency-clients"]
      };
    }

    if (intent === "whatsapp") {
      const conversation = whatsappConversations[0];
      if (!conversation) {
        return {
          intent,
          answer:
            "No WhatsApp conversations exist yet. Connect WhatsApp Cloud API or ingest Meta leads to start AI-assisted qualification and follow-up.",
          actions: [
            { label: "Connect WhatsApp", command: "integrations.whatsapp.connect" },
            { label: "Connect Meta source", command: "integrations.meta.connect" }
          ],
          citations: ["empty-whatsapp"]
        };
      }
      return {
        intent,
        answer: `Suggested WhatsApp move for ${conversation.contactName}: ${conversation.aiSuggestedReply} Reason: ${conversation.aiSummary}. Keep it short, confirm intent, and push booking while the lead is still warm.`,
        actions: [
          { label: "Use suggested reply", command: "whatsapp.reply", payload: { conversationId: conversation.id } },
          { label: "Book site visit", command: "booking.create", payload: { leadId: conversation.leadId } }
        ],
        citations: ["whatsapp-conversations", "qualification-snapshots"]
      };
    }

    if (intent === "agency") {
      const urgent = agencyClients.filter((client) => client.status !== "healthy");
      if (!agencyClients.length) {
        return {
          intent,
          answer:
            "No client workspaces have been created yet. Add the first client, attach lead sources, and the agency command center will start reporting CPL, speed-to-lead, qualification, and bookings.",
          actions: [
            { label: "Create client workspace", command: "clients.create" },
            { label: "Connect lead source", command: "sources.connect" }
          ],
          citations: ["empty-clients"]
        };
      }
      return {
        intent,
        answer: `Agency view: ${agencyClients.length} clients, ${urgent.length} need attention. Generate client summaries around CPL, speed-to-lead, qualified rate, booking rate, and next operational action.`,
        actions: [
          { label: "Generate client report", command: "reports.clientSummary", payload: { clientId: urgent[0]?.id } },
          { label: "Fix SLA drift", command: "automation.tightenSla", payload: { clientId: urgent[0]?.id } }
        ],
        citations: ["agency-clients", "campaigns", "follow-ups"]
      };
    }

    if (intent === "lead-magnet") {
      const bestLead = discoveredLeads[0];
      if (!bestLead) {
        return {
          intent,
          answer:
            "Lead Magnet is clean. Add approved discovery sources first; then I can find prospects, score fit and urgency, draft outreach, and block anything that needs consent review.",
          actions: [
            { label: "Add discovery source", command: "leadMagnet.source.create" },
            { label: "Connect Instagram", command: "integrations.instagram.connect" }
          ],
          citations: ["empty-lead-magnet"]
        };
      }
      return {
        intent,
        answer: `Lead Magnet found ${discoveredLeads.length} prospects. Best lead: ${bestLead.name}, score ${bestLead.score}, because ${bestLead.reason}. I would queue outreach only when consent/context is acceptable, and otherwise add the prospect to retargeting or manual review.`,
        actions: [
          { label: "Run discovery", command: "leadMagnet.discover", payload: { source: "active" } },
          { label: "Queue approved outreach", command: "leadMagnet.queueOutreach", payload: { leadId: bestLead.id } }
        ],
        citations: ["discovered-leads", "lead-magnet-sources", "compliance-guardrails"]
      };
    }

    if (intent === "workflow") {
      return {
        intent,
        answer:
          "Recommended workflow: trigger on high intent, enrich account and contact data, run ICP + timing score, dedupe against open opportunities, route by named owner and capacity, then branch to email, LinkedIn, call, or WhatsApp based on engagement.",
        actions: [
          { label: "Create workflow", command: "workflow.create", payload: { template: "intent-to-meeting" } },
          { label: "Simulate routing", command: "routing.simulate", payload: { leadSource: "intent" } }
        ],
        citations: ["workflow-templates", "routing-rules"]
      };
    }

    if (intent === "filter") {
      if (!accounts.length && !leads.length) {
        return {
          intent,
          answer:
            "There are no records to filter yet. Connect CRM, Meta, WhatsApp, or Lead Magnet sources and I will build segments from real records.",
          actions: [{ label: "Open integrations", command: "integrations.open" }],
          citations: ["empty-workspace"]
        };
      }
      return {
        intent,
        answer:
          "Use this smart segment: ICP fit above 85, intent above 70, active signal in funding/job-change/site-visit, no open task overdue, and deal stage not commit. Sort by revenue potential and SLA age.",
        actions: [
          { label: "Apply smart filter", command: "filters.apply", payload: { name: "Hot fit + active timing" } },
          { label: "Export segment", command: "segment.export", payload: { destination: "campaign" } }
        ],
        citations: ["accounts", "leads"]
      };
    }

    if (!account || !topDeal || !recentActivity) {
      return {
        intent: "account-summary",
        answer:
          "The CRM is clean. Import accounts, contacts, deals, or inbound leads and I will generate account briefs, next actions, and relationship summaries from real data only.",
        actions: [
          { label: "Import CRM data", command: "crm.import" },
          { label: "Connect lead source", command: "sources.connect" }
        ],
        citations: ["empty-crm"]
      };
    }

    return {
      intent: "account-summary",
      answer: `${account?.name ?? "Top account"} is a ${account?.tier ?? "strategic"} account with ${
        account?.intent ?? 94
      } intent and ${account?.icpFit ?? 97} ICP fit. Latest activity: ${recentActivity.title}. Recommended next move: ${
        topDeal.nextStep
      }.`,
      actions: [
        { label: "Open account", command: "crm.openAccount", payload: { accountId: account?.id } },
        { label: "Build one-page brief", command: "copilot.accountBrief", payload: { accountId: account?.id } }
      ],
      citations: ["accounts", "activities", "revenue-insights"]
    };
  }

  async summarizeLead(lead: Lead): Promise<string> {
    const account = getAccountById(lead.accountId);
    const contact = getContactById(lead.contactId);
    return `${contact?.name ?? "Unknown contact"} at ${account?.name ?? "unknown account"} scored ${
      lead.score
    } because ${lead.reason} Route to ${account?.owner ?? "the account owner"} with a ${lead.source} play.`;
  }
}

export async function qualifyMetaLead(leadId: string): Promise<QualificationResult> {
  const lead = getMetaLeadById(leadId);
  if (!lead) {
    return {
      leadId,
      client: "unassigned",
      score: 0,
      urgency: 0,
      spamRisk: 0,
      language: "unknown",
      recommendation: "No Meta lead was found. Connect the Meta webhook or submit a real lead payload first.",
      reason: "The local workspace contains no seeded Meta leads.",
      route: "ai-nurture"
    };
  }
  const client = getAgencyClientById(lead.clientId);
  const qualification = getQualificationByLeadId(lead.id);
  const baseScore = qualification
    ? Math.round(
        qualification.budgetScore * 0.26 +
          qualification.locationScore * 0.22 +
          qualification.urgencyScore * 0.28 +
          qualification.intentScore * 0.24 -
          qualification.spamRisk * 0.35
      )
    : lead.rawQuality === "high"
      ? 86
      : lead.rawQuality === "medium"
        ? 72
        : 48;

  const route =
    qualification?.spamRisk && qualification.spamRisk > 50
      ? "mark-spam"
      : qualification?.escalate
        ? lead.status === "booked"
          ? "book-meeting"
          : "human-now"
        : "ai-nurture";

  return {
    leadId: lead.id,
    client: client?.name ?? "unassigned",
    score: Math.max(0, Math.min(100, baseScore)),
    urgency: qualification?.urgencyScore ?? 60,
    spamRisk: qualification?.spamRisk ?? 12,
    language: qualification?.language ?? "hinglish",
    recommendation: qualification?.nextBestAction ?? "Ask budget, location, timeline, and preferred call slot on WhatsApp.",
    reason:
      qualification?.summary ??
      `${lead.fullName} came from ${lead.platform}; qualify budget ${lead.budget}, location ${lead.preferredLocation}, and timeline ${lead.timeline}.`,
    route
  };
}

export async function generateWhatsAppReply(conversationId: string): Promise<WhatsAppReplyResult> {
  const conversation = whatsappConversations.find((candidate) => candidate.id === conversationId);
  if (!conversation) {
    return {
      conversationId,
      reply: "No conversation found. Connect WhatsApp or ingest a real lead before generating a reply.",
      tone: "recovery",
      shouldEscalate: false,
      nextAction: "Connect WhatsApp Cloud API and receive the first inbound conversation."
    };
  }
  const shouldEscalate = conversation.qualification.escalate || conversation.status === "booked";
  return {
    conversationId: conversation.id,
    reply: conversation.aiSuggestedReply,
    tone: shouldEscalate ? "premium" : conversation.qualification.sentiment === "hesitant" ? "recovery" : "warm",
    shouldEscalate,
    nextAction: conversation.qualification.nextBestAction
  };
}

export async function runLeadMagnetDiscovery(): Promise<LeadMagnetDiscoveryResult> {
  const qualified = discoveredLeads.filter(
    (lead) => lead.score >= 70 && (lead.consentStatus === "opted-in" || lead.consentStatus === "business-context")
  );
  const blocked = discoveredLeads.filter(
    (lead) => lead.consentStatus === "unknown" || lead.outreachStatus === "blocked" || lead.consentStatus === "do-not-contact"
  );

  return {
    runId: crypto.randomUUID(),
    found: discoveredLeads.length,
    qualified: qualified.length,
    blocked: blocked.length,
    leads: discoveredLeads,
    recommendation:
      "Use AI aggressively for research, scoring, personalization, and follow-up planning. Auto-message only when the source and consent path are approved; otherwise send to manual review or retargeting."
  };
}

export async function queueLeadMagnetOutreach(leadId: string): Promise<LeadMagnetOutreachResult> {
  const lead = getDiscoveredLeadById(leadId);
  if (!lead) {
    return {
      leadId,
      status: "blocked",
      message: "",
      reason: "No discovered lead was found. Add approved sources and run discovery first.",
      nextAction: "Create or connect a Lead Magnet source."
    };
  }
  const allowed = lead.consentStatus === "opted-in" || lead.consentStatus === "business-context";

  if (!allowed) {
    return {
      leadId: lead.id,
      status: "blocked",
      message: lead.suggestedMessage,
      reason: `Consent status is ${lead.consentStatus}. Keep this out of automated messaging until reviewed.`,
      nextAction: lead.nextAction
    };
  }

  return {
    leadId: lead.id,
    status: "queued",
    message: lead.suggestedMessage,
    reason: `Lead score ${lead.score}; ${lead.reason}`,
    nextAction: "Queue first touch, wait for reply/read signal, then move to WhatsApp qualification if phone is available."
  };
}

export async function enrichLead(leadId: string): Promise<EnrichmentResult> {
  const lead = leads.find((candidate) => candidate.id === leadId);
  if (!lead) {
    return {
      leadId,
      account: "No account",
      contact: "No contact",
      confidence: 0,
      summary: "No lead was found. Import CRM data or connect a lead source before enrichment.",
      recommendedRoute: "Connect a lead source",
      verification: {
        email: "invalid",
        phone: "missing",
        duplicateRisk: "low"
      },
      signals: []
    };
  }
  const account = getAccountById(lead.accountId);
  const contact = getContactById(lead.contactId);
  const model = new DeterministicRevenueModel();
  const summary = await model.summarizeLead(lead);

  return {
    leadId: lead.id,
    account: account?.name ?? "No account",
    contact: contact?.name ?? "No contact",
    confidence: Math.round((lead.intentScore * 0.42 + lead.icpScore * 0.4 + lead.score * 0.18) * 10) / 10,
    summary,
    recommendedRoute: account?.tier === "strategic" ? `${account.owner} - named account owner` : "Capacity-aware round robin",
    verification: {
      email: contact?.email.includes("@") ? "valid" : "invalid",
      phone: contact?.phoneStatus ?? "missing",
      duplicateRisk: lead.score > 90 ? "low" : "medium"
    },
    signals: account?.activeSignals ?? []
  };
}

function extensionMessageText(message: ExtensionReplyMessage) {
  return (message.text ?? message.body ?? "").trim();
}

function isExtensionIncoming(message: ExtensionReplyMessage) {
  return message.direction === "incoming" || message.direction === "inbound";
}

function normalizeContact(value?: string) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

function extensionKnowledgeLead(input: ExtensionReplyInput) {
  const lead = input.knowledge?.lead;
  if (!lead || lead.leadStatus === "excluded") return undefined;
  const contactNeedles = [
    normalizeContact(input.contact?.phone),
    normalizeContact(input.contact?.email),
    normalizeContact(input.contact?.handle),
    normalizeContact(input.contact?.displayName)
  ].filter(Boolean);

  if (!contactNeedles.length) return lead;
  const haystack = [
    lead.contact.phone,
    lead.contact.waId,
    lead.contact.email,
    lead.contact.handle,
    lead.contact.displayName,
    lead.contact.profileUrl
  ]
    .map(normalizeContact)
    .filter(Boolean);
  return contactNeedles.some((needle) => haystack.some((value) => value.includes(needle) || needle.includes(value))) ? lead : undefined;
}

function latestKnowledgeFact(input: ExtensionReplyInput) {
  return input.knowledge?.facts?.find((fact) => fact.trim()) || input.knowledge?.messages?.at(-1)?.body;
}

function legacyFindExtensionLeadMatch(input: ExtensionReplyInput & { leads?: LeadDossier[] }) {
  const candidates = input.leads ?? [];
  const contactNeedles = [
    normalizeContact(input.contact?.phone),
    normalizeContact(input.contact?.email),
    normalizeContact(input.contact?.profileUrl),
    normalizeContact(input.contact?.handle),
    normalizeContact(input.contact?.displayName)
  ].filter(Boolean);
  if (!contactNeedles.length) return candidates.find((lead) => lead.qualityDecision?.status === "good") ?? candidates[0];
  return candidates.find((lead) => {
    const haystack = [
      lead.phone,
      lead.whatsapp,
      lead.email,
      lead.instagram,
      lead.facebook,
      lead.linkedin,
      lead.businessName,
      lead.website
    ]
      .map(normalizeContact)
      .filter(Boolean);
    return contactNeedles.some((needle) => haystack.some((value) => value.includes(needle) || needle.includes(value)));
  }) ?? candidates.find((lead) => lead.qualityDecision?.status === "good") ?? candidates[0];
}

function unsafeExtensionConversation(text: string) {
  return /\b(suicide|self[-\s]?harm|kill myself|urgent medical|medical emergency|payment card|card number|password|otp|lawsuit|police|threat|abuse|manager|human agent)\b/i.test(
    text
  );
}

export async function decideExtensionReply(input: ExtensionReplyInput): Promise<ExtensionReplyDecision> {
  const latestIncoming = [...input.messages].reverse().find(isExtensionIncoming);
  const latestText = latestIncoming ? extensionMessageText(latestIncoming) : "";
  if (!latestText) {
    return {
      action: "pause",
      replyText: "",
      confidence: 0.2,
      reason: "No unanswered incoming message was available for Leadsy to answer.",
      tags: ["no-incoming-message"]
    };
  }

  if (unsafeExtensionConversation(latestText)) {
    return {
      action: "pause",
      replyText: "",
      confidence: 0.96,
      reason: "Leadsy detected a safety, sensitive-data, or explicit human-escalation cue.",
      tags: ["human-escalation", "safety"]
    };
  }

  const lead = extensionKnowledgeLead(input);
  const legacyLead = lead ? undefined : legacyFindExtensionLeadMatch(input as ExtensionReplyInput & { leads?: LeadDossier[] });
  const displayName = input.contact?.displayName?.split(/\s+/)[0] || lead?.contact.displayName || legacyLead?.businessName || "there";
  const service = "lead generation and follow-up";
  const contactContext = lead
    ? lead.contact.displayName || lead.contact.handle || lead.contact.phone || lead.contact.email || "known Leadsy lead"
    : legacyLead?.businessName || input.contact?.displayName || input.platform.replace(/-/g, " ");
  const leadAngle = lead?.nextAction || latestKnowledgeFact(input) || legacyLead?.outreachAngle || "your current requirement";
  const lower = latestText.toLowerCase();

  let replyText = `Hi ${displayName}, yes, I can help. To guide you properly, what result are you trying to improve first?`;
  let reason = `Leadsy replied from workspace context for ${contactContext}.`;
  let nextAction = "Ask one qualification question and keep the conversation moving.";

  if (/\b(price|pricing|cost|rate|charges|budget|quote)\b/i.test(lower)) {
    replyText = `Hi ${displayName}, I can share pricing after I understand the scope. What monthly goal or budget range should I plan around?`;
    reason = `The buyer asked about pricing; Leadsy is qualifying budget before quoting.`;
    nextAction = "Collect budget or scope, then offer a call or plan.";
  } else if (/\b(demo|call|meeting|book|appointment|visit)\b/i.test(lower)) {
    replyText = `Hi ${displayName}, sure. What time today or tomorrow works for a quick call? I will keep it focused on ${service}.`;
    reason = `The buyer showed booking intent; Leadsy is pushing toward a meeting.`;
    nextAction = "Confirm a time slot and owner handoff.";
  } else if (/\b(yes|interested|tell me|details|more)\b/i.test(lower)) {
    replyText = `Great. We help with ${service}. For ${contactContext}, I would first check ${leadAngle}. What are you using for leads right now?`;
    reason = `The buyer showed interest; Leadsy is asking one discovery question.`;
    nextAction = "Learn current lead source and pain point.";
  } else if (/\b(no|not interested|stop|unsubscribe)\b/i.test(lower)) {
    replyText = `Understood, I will not push this further. If priorities change later, you can message here.`;
    reason = "The buyer declined; Leadsy is ending respectfully.";
    nextAction = "Mark conversation as not interested.";
  }

  return {
    action: "send",
    replyText,
    confidence: lead || input.knowledge?.messages?.length ? 0.86 : 0.68,
    reason,
    tags: ["leadsy-backend", input.knowledge ? "knowledge-context" : "generic-context", lead ? "lead-context" : "no-lead-match"],
    leadFields: {
      contact: contactContext,
      service,
      nextAction
    },
    supportMetadata: {
      chatFingerprint: input.chatFingerprint,
      platform: input.platform,
      sourceUrl: input.sourceUrl
    }
  };
}

export const revenueCopilot = new DeterministicRevenueModel();
