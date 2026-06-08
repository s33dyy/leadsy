export type TenantId = "tenant_northstar";

export type AccountTier = "strategic" | "enterprise" | "mid-market" | "growth";
export type DealStage = "qualified" | "discovery" | "technical-win" | "proposal" | "commit";
export type LeadSource =
  | "website"
  | "outbound"
  | "partner"
  | "intent"
  | "event"
  | "referral"
  | "job-change"
  | "instagram"
  | "facebook"
  | "whatsapp";
export type Channel = "email" | "linkedin" | "phone" | "whatsapp" | "chat" | "ads";
export type ClientVertical = "real-estate" | "education" | "clinic" | "agency" | "local-services";
export type LeadLifecycleStatus =
  | "new"
  | "ai-contacted"
  | "qualifying"
  | "qualified"
  | "booked"
  | "site-visit"
  | "won"
  | "dead"
  | "spam";
export type SignalType =
  | "intent-surge"
  | "funding"
  | "job-change"
  | "site-visit"
  | "tech-change"
  | "competitor"
  | "hiring"
  | "product-usage"
  | "meta-lead"
  | "whatsapp-reply"
  | "budget-confirmed"
  | "site-visit-request";

export type Account = {
  id: string;
  tenantId: TenantId;
  name: string;
  domain: string;
  industry: string;
  employees: number;
  region: string;
  tier: AccountTier;
  owner: string;
  health: number;
  intent: number;
  icpFit: number;
  revenuePotential: number;
  technologies: string[];
  activeSignals: SignalType[];
  summary: string;
};

export type Contact = {
  id: string;
  tenantId: TenantId;
  accountId: string;
  name: string;
  title: string;
  email: string;
  phoneStatus: "verified" | "missing" | "risky";
  persona: "economic-buyer" | "technical-buyer" | "champion" | "influencer";
  relationshipStrength: number;
  lastTouch: string;
};

export type Deal = {
  id: string;
  tenantId: TenantId;
  accountId: string;
  name: string;
  value: number;
  stage: DealStage;
  forecast: "pipeline" | "best-case" | "commit";
  probability: number;
  closeDate: string;
  nextStep: string;
  risk: "low" | "medium" | "high";
};

export type Lead = {
  id: string;
  tenantId: TenantId;
  accountId: string;
  contactId: string;
  source: LeadSource;
  score: number;
  intentScore: number;
  icpScore: number;
  status: "new" | "working" | "enriched" | "routed" | "sequenced" | "converted";
  detectedAt: string;
  reason: string;
};

export type AgencyClient = {
  id: string;
  tenantId: TenantId;
  name: string;
  vertical: ClientVertical;
  businessType?: string;
  inviteCode?: string;
  inviteGeneratedAt?: string;
  clientUserId?: string;
  clientRegisteredAt?: string;
  targetAudience?: string;
  primaryOffer?: string;
  leadLocation?: string;
  monthlyLeadGoal?: number;
  onboardingCompletedAt?: string;
  city: string;
  plan: "starter" | "growth" | "scale";
  monthlyAdSpend: number;
  monthlyLeads: number;
  costPerLead: number;
  responseSlaSeconds: number;
  qualificationRate: number;
  bookingRate: number;
  conversionRate: number;
  status: "healthy" | "watch" | "urgent";
  owner: string;
};

export type MetaLead = {
  id: string;
  tenantId: TenantId;
  clientId: string;
  platform: "instagram" | "facebook";
  campaignName: string;
  adSetName: string;
  creative: string;
  fullName: string;
  phone: string;
  city: string;
  propertyType: "plot" | "flat" | "villa" | "commercial" | "rental" | "unknown";
  budget: string;
  preferredLocation: string;
  timeline: "immediate" | "this-month" | "1-3-months" | "researching";
  rawQuality: "high" | "medium" | "low" | "spam";
  costPerLead: number;
  receivedAt: string;
  status: LeadLifecycleStatus;
};

export type QualificationSnapshot = {
  id: string;
  tenantId: TenantId;
  leadId: string;
  budgetScore: number;
  locationScore: number;
  urgencyScore: number;
  intentScore: number;
  spamRisk: number;
  sentiment: "positive" | "neutral" | "hesitant" | "negative";
  language: "english" | "hindi" | "hinglish" | "bengali" | "tamil" | "telugu" | "marathi";
  summary: string;
  nextBestAction: string;
  escalate: boolean;
};

export type WhatsAppMessage = {
  id: string;
  direction: "inbound" | "outbound" | "ai";
  body: string;
  sentAt: string;
  deliveryStatus: "sent" | "delivered" | "read" | "failed";
  contentType: "text" | "voice" | "template";
};

export type WhatsAppConversation = {
  id: string;
  tenantId: TenantId;
  clientId: string;
  leadId: string;
  contactName: string;
  phone: string;
  status: LeadLifecycleStatus;
  assignedTo: string;
  unread: number;
  lastMessageAt: string;
  aiSummary: string;
  aiSuggestedReply: string;
  qualification: QualificationSnapshot;
  messages: WhatsAppMessage[];
};

export type FollowUpTask = {
  id: string;
  tenantId: TenantId;
  clientId: string;
  leadId: string;
  channel: "whatsapp" | "call" | "site-visit";
  dueAt: string;
  title: string;
  automation: "ai" | "human" | "hybrid";
  status: "queued" | "done" | "blocked";
};

export type LeadResearchSourceType =
  | "openrouter-web-search"
  | "directory-osint"
  | "social-osint"
  | "website-contact-osint"
  | "review-reputation-osint"
  | "content-gap-osint"
  | "hiring-news-osint"
  | "competitor-osint"
  | "browser-public-page"
  | "manual-import";

export type LeadResearchMode = "broad" | "focused";

export type LeadDiscoveryMode =
  | "b2b-company"
  | "b2b-local-business"
  | "b2c-public-profile"
  | "consumer-intent"
  | "creator-influencer"
  | "recruiting-candidate";

export type AgentQuestionCategory =
  | "audience-mode"
  | "buyer-priority"
  | "market-priority"
  | "source-priority"
  | "proof-strictness"
  | "blocked-source-recovery"
  | "contact-policy";

export const LEAD_MAGNET_MAX_LEAD_GOAL = 1000;
export const LEAD_MAGNET_BATCH_MIN = 50;
export const LEAD_MAGNET_BATCH_MAX = 100;
export const LEAD_MAGNET_DEFAULT_BATCH_SIZE = 75;

export type LeadResearchSourceBreakdown = {
  searchesRun: number;
  candidateCount: number;
  pagesFetched: number;
  rawResultsDiscarded?: number;
  promisingCount?: number;
  directFetchBlocked?: number;
  retriedAfterBackoff?: number;
  alternateSourceRecovered?: number;
  robotsSkipped?: number;
  sourceDeferred?: number;
  rateLimitedCount?: number;
  usableProspects?: number;
  properDataCount?: number;
  missingContactCount?: number;
  needsProof?: number;
  rejected?: number;
  savedCount?: number;
  costInr?: number;
  qualityGateBreakdown?: LeadQualityGateBreakdown;
};

export type LeadQualityGateBreakdown = {
  savedGood?: number;
  missingContact?: number;
  weakFit?: number;
  missingLocation?: number;
  directoryOnly?: number;
  missingEvidenceUrl?: number;
  blockedSource?: number;
  rejectedNoise?: number;
  weakIdentity?: number;
  passiveEvidence?: number;
  scoreTooLow?: number;
};

export type LeadResearchMetrics = {
  searchesRun: number;
  pagesFetched: number;
  candidateCount: number;
  dedupedCount: number;
  promisingCount?: number;
  rejectedCount?: number;
  campaignId?: string;
  campaignBatchCount?: number;
  targetLeadGoal?: number;
  minQualifiedTarget?: number;
  campaignGoodCount?: number;
  campaignNeedsProofCount?: number;
  batchNumber?: number;
  batchSize?: number;
  rawResultsDiscarded?: number;
  usableProspects?: number;
  properDataCount?: number;
  missingContactCount?: number;
  directFetchBlocked?: number;
  retriedAfterBackoff?: number;
  alternateSourceRecovered?: number;
  robotsSkipped?: number;
  sourceDeferred?: number;
  rateLimitedCount?: number;
  savedCount: number;
  qualityGateBreakdown?: LeadQualityGateBreakdown;
  stoppedEarly?: boolean;
  sourceExhaustedReason?: string;
  audienceModes?: LeadDiscoveryMode[];
  sourceBreakdown?: Partial<Record<LeadResearchSourceType, LeadResearchSourceBreakdown>>;
};

export type SearchLane = {
  id: string;
  label: string;
  audienceMode?: LeadDiscoveryMode;
  buyerSegment: string;
  locationFocus: string;
  sourceTypes: LeadResearchSourceType[];
  queries: string[];
  searches?: Array<{
    query: string;
    sourceType: LeadResearchSourceType;
    why?: string;
  }>;
  why: string;
  expectedEvidence: string[];
};

export type OwnerWebsiteContext = {
  url?: string;
  status: "not-provided" | "fetched" | "unavailable";
  summary: string;
  offerTerms: string[];
  buyerTypes: string[];
  marketTerms: string[];
  disqualifiers: string[];
  proofTerms: string[];
  fetchedAt?: string;
  error?: string;
};

export type ResearchToolPrimitive =
  | "search_public_web"
  | "classify_search_result"
  | "expand_directory_page"
  | "fetch_public_page"
  | "extract_contact_paths"
  | "verify_business_fit"
  | "score_lead_evidence"
  | "save_leads";

export type ResearchToolRecipeStep = {
  primitive: ResearchToolPrimitive;
  goal: string;
  inputHint: string;
};

export type ResearchToolRecipe = {
  id: string;
  name: string;
  ownerId?: string;
  ownerWebsiteUrl?: string;
  goal: string;
  reason: string;
  queries: string[];
  steps: ResearchToolRecipeStep[];
  expectedEvidence: string[];
  createdAt: string;
};

export type ResearchToolRecipeEvaluation = {
  recipeId: string;
  status: "keep" | "revise" | "discard";
  reason: string;
  savedGood: number;
  needsProof: number;
  rejected: number;
  gateBreakdown?: LeadQualityGateBreakdown;
  evaluatedAt: string;
};

export type OwnerSearchMemory = {
  id: string;
  ownerId: string;
  briefFingerprint: string;
  recipeId: string;
  ownerWebsiteUrl?: string;
  summary: string;
  recipe: ResearchToolRecipe;
  evaluation: ResearchToolRecipeEvaluation;
  createdAt: string;
};

export type AgentQuestionOption = {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
};

export type AgentQuestion = {
  id: string;
  category?: AgentQuestionCategory;
  prompt: string;
  kind: "single-choice";
  options: AgentQuestionOption[];
  defaultOptionId: string;
  answeredOptionId?: string;
  reason: string;
};

export type LeadResearchStrategy = {
  offer: string;
  ownerWebsiteContext?: OwnerWebsiteContext;
  audienceModes: LeadDiscoveryMode[];
  buyerTypes: string[];
  markets: string[];
  buyingTriggers: string[];
  disqualifiers: string[];
  evidenceRules: string[];
  assumptions: string[];
  questions: AgentQuestion[];
  lanes: SearchLane[];
  toolRecipes?: ResearchToolRecipe[];
};

export type LeadSearchSessionStatus =
  | "needs-input"
  | "ready"
  | "running"
  | "stopping"
  | "stopped"
  | "completed"
  | "failed"
  | "stale";

export type LeadSearchSession = {
  id: string;
  tenantId: string;
  ownerId: string;
  briefId: string;
  briefFingerprint: string;
  briefSnapshot: LeadBriefSnapshot;
  status: LeadSearchSessionStatus;
  strategy: LeadResearchStrategy;
  answers: Record<string, string>;
  planPreview?: ResearchPlanPreview;
  latestRunId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type SpendGuard = {
  mode: "protected" | "full";
  capInr: number;
  estimatedMaxInr: number;
  requiresApproval: boolean;
  spentInr?: number;
  stoppedReason?:
    | "budget-cap"
    | "weak-candidate-pool"
    | "no-public-evidence"
    | "expensive-model"
    | "campaign-target-reached"
    | "source-exhausted"
    | "max-batches-reached"
    | "no-new-good-leads";
};

export type LeadRunOutcome = {
  status: "leads-saved" | "needs-proof" | "no-fit" | "needs-source" | "stopped-budget" | "failed";
  headline: string;
  summary: string;
  whyNoLeads?: string;
  nextActions: string[];
};

export type ResearchPlanPreview = {
  id: string;
  tenantId: string;
  ownerId: string;
  briefId: string;
  briefFingerprint?: string;
  briefSnapshot?: LeadBriefSnapshot;
  researchMode: LeadResearchMode;
  targetLeadGoal?: number;
  minQualifiedTarget?: number;
  batchNumber?: number;
  batchSize?: number;
  existingGoodCount?: number;
  audienceModes?: LeadDiscoveryMode[];
  ownerWebsiteContext?: OwnerWebsiteContext;
  toolRecipes?: ResearchToolRecipe[];
  lanes: SearchLane[];
  spendGuard: SpendGuard;
  estimatedSearches: number;
  estimatedPages: number;
  createdAt: string;
  expiresAt?: string;
};

export type LeadResearchEventType =
  | "searched-web"
  | "candidate-found"
  | "public-page-checked"
  | "osint-added"
  | "sentiment-scored"
  | "saved"
  | "updated-duplicate"
  | "quarantined"
  | "discarded-noise"
  | "rejected"
  | "cost-recorded";

export type LeadResearchEventStatus = "running" | "completed" | "needs-proof" | "rejected" | "deferred" | "failed";

export type LeadRejectionReason =
  | "bad-fit-vendor"
  | "marketplace-product"
  | "generic-directory"
  | "non-business-page"
  | "out-of-location"
  | "weak-evidence"
  | "duplicate"
  | "fake-contact"
  | "blocked-source";

export type LeadQualityDecision = {
  status: "good" | "needs-proof" | "rejected";
  reason?: LeadRejectionReason;
  summary: string;
  decidedAt: string;
};

export type LeadSentiment = {
  label: "positive" | "neutral" | "hesitant" | "negative";
  score: number;
  reason: string;
};

export type LeadLocationEvidence = {
  city?: string;
  area?: string;
  state?: string;
  country?: string;
  status: "found" | "not-found";
  evidence?: string;
};

export type FxRateSnapshot = {
  base: "USD";
  quote: "INR";
  rate: number;
  source: "frankfurter" | "env" | "default";
  fetchedAt: string;
};

export type OpenRouterUsageCost = {
  provider: "openrouter";
  stage?: "planner" | "dossier-builder" | "message-drafter" | "qualification-reply" | "qualification-extractor" | "initial-outreach";
  model?: string;
  generationId?: string;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd: number;
  costInr: number;
  fx: FxRateSnapshot;
  createdAt: string;
};

export type LeadQualityCounts = {
  savedGood: number;
  needsProof: number;
  rejected: number;
  updatedDuplicates: number;
};

export type LeadResearchEvent = {
  id: string;
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
  createdAt: string;
};

export type LeadBrief = {
  id: string;
  tenantId: string;
  ownerId: string;
  service: string;
  idealCustomers: string;
  searchLocations: string;
  leadGoal: number;
  researchMode?: LeadResearchMode;
  sources: LeadResearchSourceType[];
  aiAction: "draft-only" | "follow-up-plan";
  excludedLeads: string;
  ownerWebsiteUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadRunLabel = "Live Campaign" | "QA Scenario" | "Worst Case";

export type LeadBriefSnapshot = {
  service: string;
  idealCustomers: string;
  searchLocations: string;
  leadGoal: number;
  researchMode?: LeadResearchMode;
  sources: LeadResearchSourceType[];
  aiAction: "draft-only" | "follow-up-plan";
  excludedLeads: string;
  ownerWebsiteUrl?: string;
};

function normalizeFingerprintPart(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function leadBriefFingerprint(brief: LeadBriefSnapshot) {
  return [
    "lead-brief-v2",
    normalizeFingerprintPart(brief.service),
    normalizeFingerprintPart(brief.idealCustomers),
    normalizeFingerprintPart(brief.searchLocations),
    Math.max(1, Math.min(LEAD_MAGNET_MAX_LEAD_GOAL, Math.round(brief.leadGoal))),
    normalizeFingerprintPart(brief.researchMode),
    [...brief.sources].sort().join(","),
    brief.aiAction,
    normalizeFingerprintPart(brief.excludedLeads),
    normalizeFingerprintPart(brief.ownerWebsiteUrl)
  ].join("|");
}

export type EvidenceUrl = {
  label: string;
  url?: string;
  sourceType: LeadResearchSourceType;
  capturedAt: string;
  note?: string;
};

export type LeadScore = {
  fit: number;
  urgency: number;
  contactability: number;
  evidence: number;
  overall: number;
  confidence: number;
  status: "high-confidence" | "needs-review" | "blocked";
  reasons: string[];
};

export type LeadDossier = {
  id: string;
  tenantId: string;
  ownerId: string;
  campaignId?: string;
  briefFingerprint?: string;
  audienceMode?: LeadDiscoveryMode;
  businessName: string;
  category: string;
  city: string;
  area?: string;
  location: LeadLocationEvidence;
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
  recentActivitySignals: string[];
  contentQualitySignal: string;
  whyTheyMayNeedAgency: string;
  outreachAngle: string;
  nextAction: string;
  sentiment: LeadSentiment;
  qualityDecision: LeadQualityDecision;
  analysisSummary: string;
  quarantineReason?: LeadRejectionReason;
  score: LeadScore;
  evidence: EvidenceUrl[];
  sourceTypes: LeadResearchSourceType[];
  createdAt: string;
  updatedAt: string;
};

export type LeadSourceRun = {
  id: string;
  tenantId: string;
  ownerId: string;
  campaignId?: string;
  scenarioLabel?: string;
  runLabel?: LeadRunLabel;
  inputSnapshot?: LeadBriefSnapshot;
  audienceModes?: LeadDiscoveryMode[];
  status: "completed" | "needs-connection" | "failed";
  sourcesRequested: LeadResearchSourceType[];
  sourcesUsed: LeadResearchSourceType[];
  found: number;
  qualified: number;
  needsReview: number;
  blocked: number;
  metrics?: LeadResearchMetrics;
  events: LeadResearchEvent[];
  cost?: OpenRouterUsageCost;
  outcome?: LeadRunOutcome;
  ownerSummary?: string;
  nextActions?: string[];
  spendGuard?: SpendGuard;
  planPreview?: ResearchPlanPreview;
  qualityCounts?: LeadQualityCounts;
  recommendation: string;
  connectionMessages: string[];
  startedAt: string;
  completedAt: string;
};

export type MessageDraft = {
  id: string;
  tenantId: string;
  ownerId: string;
  leadId: string;
  channel: "whatsapp" | "instagram-dm" | "email";
  message: string;
  rationale: string;
  followUpPlan: string[];
  status: "draft";
  createdAt: string;
};

export type AgentRunLog = {
  id: string;
  tenantId: string;
  ownerId: string;
  agent: "lead-finder" | "lead-scorer" | "message-drafter" | "page-extractor";
  provider: "openrouter" | "browser-worker" | "local";
  inputSummary: string;
  outputSummary: string;
  displayTitle?: string;
  displaySummary?: string;
  technicalSummary?: string;
  status: "completed" | "needs-connection" | "failed";
  metrics?: LeadResearchMetrics;
  cost?: OpenRouterUsageCost;
  createdAt: string;
};

export type Activity = {
  id: string;
  tenantId: TenantId;
  accountId: string;
  contactId?: string;
  type: "email" | "call" | "meeting" | "note" | "chat" | "automation";
  title: string;
  detail: string;
  occurredAt: string;
  actor: string;
};

export type Campaign = {
  id: string;
  tenantId: TenantId;
  name: string;
  channels: Channel[];
  audience: string;
  status: "draft" | "active" | "paused";
  leads: number;
  replyRate: number;
  meetings: number;
  deliverability: number;
  aiPersonalization: number;
};

export type WorkflowNode = {
  id: string;
  type: "trigger" | "condition" | "ai" | "enrichment" | "crm" | "message" | "routing";
  label: string;
  status: "idle" | "running" | "complete" | "blocked";
  description: string;
};

export type DashboardKpi = {
  label: string;
  value: string;
  delta: string;
  tone: "good" | "watch" | "risk";
};

export type CaptureFlow = {
  name: string;
  trigger: string;
  qualification: string;
  action: string;
};

export type AnalyticsPoint = {
  week: string;
  pipeline: number;
  target: number;
  intent: number;
  meetings: number;
};

export const tenantId: TenantId = "tenant_northstar";

export const kpis: DashboardKpi[] = [];

export const agencyClients: AgencyClient[] = [];

export const metaLeads: MetaLead[] = [];

export const qualificationSnapshots: QualificationSnapshot[] = [];

export const whatsappConversations: WhatsAppConversation[] = [];

export const followUpTasks: FollowUpTask[] = [];

export const accounts: Account[] = [];

export const contacts: Contact[] = [];

export const deals: Deal[] = [];

export const leads: Lead[] = [];

export const activities: Activity[] = [];

export const campaigns: Campaign[] = [];

export const workflowNodes: WorkflowNode[] = [
  {
    id: "node_trigger",
    type: "trigger",
    label: "Intent surge detected",
    status: "idle",
    description: "Bombora-like topic spike or repeated high-intent site visits."
  },
  {
    id: "node_enrich",
    type: "enrichment",
    label: "Waterfall enrichment",
    status: "idle",
    description: "Run company, contact, verification, and duplicate resolution providers."
  },
  {
    id: "node_score",
    type: "ai",
    label: "ICP + timing score",
    status: "idle",
    description: "LLM-generated buying rationale with deterministic score calibration."
  },
  {
    id: "node_route",
    type: "routing",
    label: "Route to owner",
    status: "idle",
    description: "Territory, account owner, SLA, and capacity-aware assignment."
  },
  {
    id: "node_message",
    type: "message",
    label: "Personalized cadence",
    status: "idle",
    description: "Email, LinkedIn, call, and WhatsApp branch based on engagement."
  }
];

export const metaQualificationWorkflowNodes: WorkflowNode[] = [
  {
    id: "meta_trigger",
    type: "trigger",
    label: "Meta lead received",
    status: "idle",
    description: "Instagram or Facebook webhook lands with campaign, creative, form fields, and phone number."
  },
  {
    id: "meta_normalize",
    type: "enrichment",
    label: "Normalize and dedupe",
    status: "idle",
    description: "Clean phone, match client workspace, detect duplicate enquiries, and attach campaign source."
  },
  {
    id: "meta_qualify",
    type: "ai",
    label: "AI qualification",
    status: "idle",
    description: "Extract budget, location, timeline, urgency, sentiment, spam risk, and preferred language."
  },
  {
    id: "meta_whatsapp",
    type: "message",
    label: "WhatsApp first reply",
    status: "idle",
    description: "Send an instant contextual WhatsApp opener in the right language with one clear next question."
  },
  {
    id: "meta_route",
    type: "routing",
    label: "Book or escalate",
    status: "idle",
    description: "Book meeting/site visit if qualified, otherwise keep AI nurture running until a human is needed."
  }
];

export const routingRules: string[] = [];

export const captureFlows: CaptureFlow[] = [];

export const revenueInsights: string[] = [];

export const analyticsSeries: AnalyticsPoint[] = [];

export function getAccountById(accountId: string) {
  return accounts.find((account) => account.id === accountId);
}

export function getContactById(contactId: string) {
  return contacts.find((contact) => contact.id === contactId);
}

export function getDealByAccountId(accountId: string) {
  return deals.find((deal) => deal.accountId === accountId);
}

export function getAgencyClientById(clientId: string) {
  return agencyClients.find((client) => client.id === clientId);
}

export function getMetaLeadById(leadId: string) {
  return metaLeads.find((lead) => lead.id === leadId);
}

export function getQualificationByLeadId(leadId: string) {
  return qualificationSnapshots.find((qualification) => qualification.leadId === leadId);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatInr(value: number) {
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value)}`;
}
