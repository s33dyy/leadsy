import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  leadBriefFingerprint,
  type AgentRunLog,
  type LeadBrief,
  type LeadBriefSnapshot,
  type LeadDossier,
  type LeadQualityDecision,
  type LeadResearchMode,
  type LeadResearchEvent,
  type LeadSearchSession,
  type LeadSearchSessionStatus,
  type LeadResearchSourceType,
  type LeadSourceRun,
  type MessageDraft,
  type OwnerSearchMemory,
  type ResearchToolRecipeEvaluation
} from "@leadsy/domain";
import { leadsyDataDir } from "./data-dir";

const dataFile = join(leadsyDataDir, "lead-magnet.json");
const defaultSources: LeadResearchSourceType[] = [
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
const supportedSources = new Set<LeadResearchSourceType>([
  ...defaultSources
]);

type LeadMagnetState = {
  briefs: LeadBrief[];
  briefHistory: LeadBrief[];
  leads: LeadDossier[];
  runs: LeadSourceRun[];
  drafts: MessageDraft[];
  agentRuns: AgentRunLog[];
  searchSessions: LeadSearchSession[];
  ownerSearchMemory: OwnerSearchMemory[];
};

export type LeadBriefInput = {
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

export type LeadDossierUpdateInput = {
  businessName: string;
  category: string;
  city: string;
  area?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  address?: string;
  contentQualitySignal: string;
  whyTheyMayNeedAgency: string;
  outreachAngle: string;
  nextAction: string;
};

function emptyState(): LeadMagnetState {
  return {
    briefs: [],
    briefHistory: [],
    leads: [],
    runs: [],
    drafts: [],
    agentRuns: [],
    searchSessions: [],
    ownerSearchMemory: []
  };
}

function sanitizeSources(sources: unknown, fallback: LeadResearchSourceType[] = defaultSources): LeadResearchSourceType[] {
  const clean = Array.isArray(sources)
    ? sources.filter((source): source is LeadResearchSourceType => supportedSources.has(source as LeadResearchSourceType))
    : [];
  return clean.length ? clean : fallback;
}

function sanitizeResearchMode(value: unknown): LeadResearchMode | undefined {
  return value === "broad" || value === "focused" ? value : undefined;
}

function leadHasEvidenceUrl(lead: LeadDossier) {
  return Boolean(lead.website || lead.instagram || lead.facebook || lead.linkedin || lead.googleMapsUrl || lead.evidence?.some((item) => item.url));
}

function leadHasContactPath(lead: LeadDossier) {
  return Boolean(
    lead.phone ||
      lead.whatsapp ||
      lead.email ||
      lead.instagram ||
      lead.facebook ||
      lead.linkedin ||
      lead.evidence?.some((item) => /contact|enquir|inquir|appointment|booking|quote|callback|linkedin|facebook|instagram|whatsapp|phone|email/i.test(`${item.label} ${item.url ?? ""} ${item.note ?? ""}`))
  );
}

function legacyGoodLeadNeedsProof(lead: LeadDossier) {
  const identity = `${lead.businessName} ${lead.category} ${lead.website ?? ""} ${lead.analysisSummary ?? ""} ${lead.contentQualitySignal ?? ""} ${lead.evidence?.map((item) => `${item.label} ${item.note ?? ""} ${item.url ?? ""}`).join(" ") ?? ""}`;
  if (!leadHasEvidenceUrl(lead) || !leadHasContactPath(lead)) return true;
  if (/^\d[a-z0-9-]{7,}$/i.test(lead.businessName.trim())) return true;
  if (lead.businessName.split(/\s+/).length >= 9 && /\b(is|are|was|were|has|have|will|with|appointment|appoints?|appointed|announces?|launches?|expands?|expanding|platform for)\b/i.test(lead.businessName)) return true;
  const informationalPage = /\b(patient information|placements?|places?|jobs? for students|home loan comparison|classifieds? portal|what is|simple guide|beginner'?s guide|how to|pursue your|research & innovation|overseas education consultants since|migration agent|finance broker [a-z]+|finance company [a-z]+|financial help(?: &| and) support|debt help enquiries|talk to a business lending specialist)\b/i.test(identity);
  const serviceVendor = /\b(marketing agency|digital marketing|seo services?|website design|website development|web design|web development|odoo)\b/i.test(identity);
  const academicHelp = /\b(assignment help|homework help|essay writing|dissertation writing|thesis writing|coursework help|academic writing|take my class|do my assignment)\b/i.test(identity);
  const institutionOrNonBuyer = /\b(association|council|society|conference|symposium|event organiser|events? page|regulator|regulatory body|professional body|university|tafe|government|department|public hospital|health district|local health district|national directory|travel|tour|hotel|property listings?|real estate listings?|job board|jobs? in)\b/i.test(identity);
  const selfReportedWeak = /\bneeds[-\s]?proof\b|\bneeds verification\b|\bnot (?:a )?(?:fully )?qualified\b|\bcontact details incomplete\b|\bmissing direct (?:email|phone|contact)\b/i.test(identity);
  const marketplaceOrDirectory = /\b(find doctors?|book online appointment|clinics?\s*&\s*more|get quotes?|quote marketplace|supplier directory|equipment marketplace|business directory|directory of|list of suppliers?|compare prices?|comparison|classifieds?|book buyers?|sell books?|buyers? guide|top\s+\d+|best\s+\d+)\b/i.test(identity) ||
    /\/(directory|directories|listings?|classifieds?|marketplace|find-a|compare|comparison|get-quotes?|quotes?|suppliers?|vendors?|buyers?-guide|jobs?)(\/|$)/i.test(identity);
  const deterministicFallback = lead.evidence?.some((item) => /found from search query/i.test(item.note ?? ""));
  return informationalPage || serviceVendor || academicHelp || institutionOrNonBuyer || selfReportedWeak || marketplaceOrDirectory || deterministicFallback;
}

function inferResearchMode(input: { leadGoal: number; sources: LeadResearchSourceType[]; researchMode?: LeadResearchMode }) {
  if (input.researchMode) {
    return input.researchMode;
  }
  return input.leadGoal >= 25 || input.sources.length >= defaultSources.length ? "broad" : "focused";
}

function sanitizeBrief(brief: LeadBrief): LeadBrief {
  const sources = sanitizeSources(brief.sources);
  const researchMode = sanitizeResearchMode(brief.researchMode) ?? inferResearchMode({ leadGoal: brief.leadGoal, sources });
  return { ...brief, sources, researchMode };
}

function sanitizeLead(lead: LeadDossier): LeadDossier {
  const decidedAt = lead.updatedAt ?? new Date().toISOString();
  const qualityDecision: LeadQualityDecision = lead.qualityDecision ?? {
    status: lead.score?.status === "high-confidence" ? "good" : "needs-proof",
    reason: lead.score?.status === "high-confidence" ? undefined : "weak-evidence",
    summary: lead.score?.status === "high-confidence"
      ? "Legacy lead treated as usable because it was high confidence."
      : "Legacy lead needs proof because it was created before quality decisions existed.",
    decidedAt
  };
  const strictQualityDecision: LeadQualityDecision = qualityDecision.status === "good" && legacyGoodLeadNeedsProof(lead)
    ? {
        status: "needs-proof",
        reason: "weak-evidence",
        summary: "Needs proof because this saved record was created before the stricter usable-prospect gate or has noisy/generic evidence.",
        decidedAt
      }
    : qualityDecision;
  return {
    ...lead,
    location: lead.location ?? {
      city: lead.city,
      area: lead.area,
      country: undefined,
      status: lead.city || lead.area ? "found" : "not-found",
      evidence: lead.city || lead.area ? [lead.area, lead.city].filter(Boolean).join(", ") : "location not found"
    },
    sentiment: lead.sentiment ?? {
      label: lead.score?.overall >= 76 ? "positive" : lead.score?.overall >= 50 ? "neutral" : "hesitant",
      score: Math.max(0, Math.min(1, (lead.score?.overall ?? 50) / 100)),
      reason: "Legacy sentiment inferred from the existing lead score."
    },
    qualityDecision: strictQualityDecision,
    analysisSummary: lead.analysisSummary ?? strictQualityDecision.summary,
    quarantineReason: lead.quarantineReason ?? (strictQualityDecision.status === "needs-proof" ? strictQualityDecision.reason : undefined),
    sourceTypes: sanitizeSources(lead.sourceTypes, ["manual-import"])
  };
}

function sanitizeRun(run: LeadSourceRun): LeadSourceRun {
  return {
    ...run,
    sourcesRequested: sanitizeSources(run.sourcesRequested),
    sourcesUsed: sanitizeSources(run.sourcesUsed, []),
    events: Array.isArray(run.events) ? run.events : [],
    qualityCounts: run.qualityCounts ?? {
      savedGood: run.qualified,
      needsProof: run.needsReview,
      rejected: run.blocked,
      updatedDuplicates: 0
    }
  };
}

function sanitizeSearchSession(session: LeadSearchSession): LeadSearchSession {
  return {
    ...session,
    answers: session.answers && typeof session.answers === "object" ? session.answers : {},
    strategy: {
      ...session.strategy,
      audienceModes: Array.isArray(session.strategy?.audienceModes) ? session.strategy.audienceModes : ["b2b-company"],
      buyerTypes: Array.isArray(session.strategy?.buyerTypes) ? session.strategy.buyerTypes : [],
      markets: Array.isArray(session.strategy?.markets) ? session.strategy.markets : [],
      buyingTriggers: Array.isArray(session.strategy?.buyingTriggers) ? session.strategy.buyingTriggers : [],
      disqualifiers: Array.isArray(session.strategy?.disqualifiers) ? session.strategy.disqualifiers : [],
      evidenceRules: Array.isArray(session.strategy?.evidenceRules) ? session.strategy.evidenceRules : [],
      assumptions: Array.isArray(session.strategy?.assumptions) ? session.strategy.assumptions : [],
      questions: Array.isArray(session.strategy?.questions) ? session.strategy.questions : [],
      lanes: Array.isArray(session.strategy?.lanes) ? session.strategy.lanes : []
    }
  };
}

async function readState(): Promise<LeadMagnetState> {
  try {
    const raw = await readFile(dataFile, "utf8");
    if (!raw.trim()) {
      return emptyState();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return emptyState();
    }
    const state = parsed as Partial<LeadMagnetState>;
    return {
      briefs: Array.isArray(state.briefs) ? state.briefs.map(sanitizeBrief) : [],
      briefHistory: Array.isArray(state.briefHistory) ? state.briefHistory.map(sanitizeBrief) : [],
      leads: Array.isArray(state.leads) ? state.leads.map(sanitizeLead) : [],
      runs: Array.isArray(state.runs) ? state.runs.map(sanitizeRun) : [],
      drafts: Array.isArray(state.drafts) ? state.drafts : [],
      agentRuns: Array.isArray(state.agentRuns) ? state.agentRuns : [],
      searchSessions: Array.isArray(state.searchSessions) ? state.searchSessions.map(sanitizeSearchSession) : [],
      ownerSearchMemory: Array.isArray(state.ownerSearchMemory) ? state.ownerSearchMemory : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyState();
    }
    if (error instanceof SyntaxError) {
      return emptyState();
    }
    throw error;
  }
}

async function writeState(state: LeadMagnetState) {
  await mkdir(dirname(dataFile), { recursive: true });
  const tempFile = `${dataFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, dataFile);
}

function scopeKey(tenantId: string, ownerId: string) {
  return `${tenantId}:${ownerId}`;
}

function briefSnapshot(brief: LeadBrief): LeadBriefSnapshot {
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

function leadBelongsToBrief(lead: LeadDossier, brief: LeadBrief) {
  return lead.briefFingerprint === leadBriefFingerprint(briefSnapshot(brief));
}

export async function getLeadMagnetWorkspace(tenantId: string, ownerId: string) {
  const state = await readState();
  const key = scopeKey(tenantId, ownerId);
  const brief = state.briefs.find((candidate) => scopeKey(candidate.tenantId, candidate.ownerId) === key) ?? null;
  const scopedLeads = state.leads
    .filter((lead) => scopeKey(lead.tenantId, lead.ownerId) === key)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const scopedRuns = state.runs
    .filter((run) => scopeKey(run.tenantId, run.ownerId) === key)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  const scopedSearchSessions = state.searchSessions
    .filter((session) => scopeKey(session.tenantId, session.ownerId) === key)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const campaignGoodCount = brief
    ? scopedLeads.filter((lead) => lead.qualityDecision?.status === "good" && leadBelongsToBrief(lead, brief)).length
    : 0;
  const campaignNeedsProofCount = brief
    ? scopedLeads.filter((lead) => lead.qualityDecision?.status === "needs-proof" && leadBelongsToBrief(lead, brief)).length
    : 0;
  const runs = scopedRuns.map((run) => {
    if (!brief || !run.metrics?.targetLeadGoal) {
      return run;
    }
    const usableProspects = Math.min(run.metrics.usableProspects ?? run.found, campaignGoodCount);
    return {
      ...run,
      metrics: {
        ...run.metrics,
        minQualifiedTarget: run.metrics.minQualifiedTarget ?? run.metrics.targetLeadGoal,
        campaignGoodCount,
        campaignNeedsProofCount,
        usableProspects,
        properDataCount: Math.min(run.metrics.properDataCount ?? usableProspects, campaignGoodCount)
      }
    };
  });
  return {
    brief,
    briefHistory: state.briefHistory
      .filter((candidate) => scopeKey(candidate.tenantId, candidate.ownerId) === key)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    leads: scopedLeads,
    runs,
    drafts: state.drafts
      .filter((draft) => scopeKey(draft.tenantId, draft.ownerId) === key)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    agentRuns: state.agentRuns
      .filter((run) => scopeKey(run.tenantId, run.ownerId) === key)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    searchSessions: scopedSearchSessions,
    ownerSearchMemory: state.ownerSearchMemory
      .filter((memory) => memory.ownerId === ownerId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 100),
    activeSearchSession:
      scopedSearchSessions.find((session) => ["needs-input", "ready", "running", "stopping"].includes(session.status)) ?? null
  };
}

export async function upsertLeadBrief(tenantId: string, ownerId: string, input: LeadBriefInput) {
  const state = await readState();
  const now = new Date().toISOString();
  const existing = state.briefs.findIndex(
    (candidate) => scopeKey(candidate.tenantId, candidate.ownerId) === scopeKey(tenantId, ownerId)
  );
  const brief: LeadBrief = {
    id: existing >= 0 ? state.briefs[existing].id : `brief_${crypto.randomUUID()}`,
    tenantId,
    ownerId,
    service: input.service.trim(),
    idealCustomers: input.idealCustomers.trim(),
    searchLocations: input.searchLocations.trim(),
    leadGoal: input.leadGoal,
    researchMode: inferResearchMode(input),
    sources: input.sources,
    aiAction: input.aiAction,
    excludedLeads: input.excludedLeads.trim(),
    ownerWebsiteUrl: optionalText(input.ownerWebsiteUrl),
    createdAt: existing >= 0 ? state.briefs[existing].createdAt : now,
    updatedAt: now
  };

  if (existing >= 0) {
    state.briefs[existing] = brief;
  } else {
    state.briefs.push(brief);
  }
  const latestHistory = state.briefHistory
    .filter((candidate) => scopeKey(candidate.tenantId, candidate.ownerId) === scopeKey(tenantId, ownerId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  const historyKey = `${brief.service}|${brief.idealCustomers}|${brief.searchLocations}|${brief.leadGoal}|${brief.researchMode}|${brief.sources.join(",")}|${brief.aiAction}|${brief.excludedLeads}|${brief.ownerWebsiteUrl ?? ""}`;
  const latestHistoryKey = latestHistory
    ? `${latestHistory.service}|${latestHistory.idealCustomers}|${latestHistory.searchLocations}|${latestHistory.leadGoal}|${latestHistory.researchMode}|${latestHistory.sources.join(",")}|${latestHistory.aiAction}|${latestHistory.excludedLeads}|${latestHistory.ownerWebsiteUrl ?? ""}`
    : "";
  if (historyKey !== latestHistoryKey) {
    state.briefHistory = [
      { ...brief, id: `brief_history_${crypto.randomUUID()}`, createdAt: now, updatedAt: now },
      ...state.briefHistory
    ].slice(0, 100);
  }
  await writeState(state);
  return brief;
}

export async function createLeadSearchSession(input: {
  tenantId: string;
  ownerId: string;
  brief: LeadBrief;
  strategy: LeadSearchSession["strategy"];
  planPreview?: LeadSearchSession["planPreview"];
  status?: LeadSearchSessionStatus;
}) {
  const state = await readState();
  const now = new Date().toISOString();
  const scoped = scopeKey(input.tenantId, input.ownerId);
  const activeStatuses = new Set<LeadSearchSessionStatus>(["needs-input", "ready", "running", "stopping"]);
  state.searchSessions = state.searchSessions.map((session) =>
    scopeKey(session.tenantId, session.ownerId) === scoped && activeStatuses.has(session.status)
      ? { ...session, status: "stale", updatedAt: now, error: "Replaced by a newer search brief." }
      : session
  );
  const session: LeadSearchSession = {
    id: `search_${crypto.randomUUID()}`,
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    briefId: input.brief.id,
    briefFingerprint: leadBriefFingerprint(briefSnapshot(input.brief)),
    briefSnapshot: briefSnapshot(input.brief),
    status: input.status ?? (input.strategy.questions.length ? "needs-input" : "ready"),
    strategy: input.strategy,
    answers: {},
    planPreview: input.planPreview,
    createdAt: now,
    updatedAt: now
  };
  state.searchSessions = [session, ...state.searchSessions].slice(0, 100);
  await writeState(state);
  return session;
}

export async function getLeadSearchSession(tenantId: string, ownerId: string, sessionId: string) {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  return (
    state.searchSessions.find((session) => session.id === sessionId && scopeKey(session.tenantId, session.ownerId) === scoped) ?? null
  );
}

export async function updateLeadSearchSession(
  tenantId: string,
  ownerId: string,
  sessionId: string,
  patch: Partial<Pick<LeadSearchSession, "status" | "answers" | "strategy" | "planPreview" | "latestRunId" | "error">>
) {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  const index = state.searchSessions.findIndex(
    (session) => session.id === sessionId && scopeKey(session.tenantId, session.ownerId) === scoped
  );
  if (index < 0) return null;
  const updated: LeadSearchSession = {
    ...state.searchSessions[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  state.searchSessions[index] = updated;
  await writeState(state);
  return updated;
}

export async function stopLeadSearchSession(tenantId: string, ownerId: string, sessionId: string) {
  const session = await updateLeadSearchSession(tenantId, ownerId, sessionId, {
    status: "stopping",
    error: "Stop requested by owner."
  });
  return session;
}

function normalizeDedupeValue(value?: string) {
  return value
    ?.toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function leadKey(lead: LeadDossier) {
  return (
    normalizeDedupeValue(lead.phone) ||
    normalizeDedupeValue(lead.whatsapp) ||
    normalizeDedupeValue(lead.website) ||
    `${normalizeDedupeValue(lead.businessName)}:${normalizeDedupeValue(lead.city)}`
  );
}

function mergeLead(existing: LeadDossier, incoming: LeadDossier): LeadDossier {
  const evidenceUrls = new Set(existing.evidence.map((item) => item.url ?? item.note ?? item.label));
  const evidence = [
    ...existing.evidence,
    ...incoming.evidence.filter((item) => {
      const key = item.url ?? item.note ?? item.label;
      if (evidenceUrls.has(key)) {
        return false;
      }
      evidenceUrls.add(key);
      return true;
    })
  ];
  const qualityRank = (status: LeadDossier["qualityDecision"]["status"]) => (status === "good" ? 3 : status === "needs-proof" ? 2 : 1);
  const incomingQualityRank = qualityRank(incoming.qualityDecision.status);
  const existingQualityRank = qualityRank(existing.qualityDecision.status);
  const preferIncomingJudgement =
    incomingQualityRank > existingQualityRank ||
    (incomingQualityRank === existingQualityRank && incoming.score.overall > existing.score.overall);

	  return {
	    ...existing,
	    campaignId: incoming.campaignId ?? existing.campaignId,
	    briefFingerprint: incoming.briefFingerprint ?? existing.briefFingerprint,
	    category: existing.category || incoming.category,
    audienceMode: existing.audienceMode ?? incoming.audienceMode,
    area: existing.area || incoming.area,
    location: existing.location?.status === "found" ? existing.location : incoming.location,
    phone: existing.phone || incoming.phone,
    whatsapp: existing.whatsapp || incoming.whatsapp,
    email: existing.email || incoming.email,
    website: existing.website || incoming.website,
    instagram: existing.instagram || incoming.instagram,
    facebook: existing.facebook || incoming.facebook,
    linkedin: existing.linkedin || incoming.linkedin,
    googleMapsUrl: existing.googleMapsUrl || incoming.googleMapsUrl,
    address: existing.address || incoming.address,
    rating: existing.rating ?? incoming.rating,
    reviewCount: existing.reviewCount ?? incoming.reviewCount,
    recentActivitySignals: [...new Set([...existing.recentActivitySignals, ...incoming.recentActivitySignals])],
    sourceTypes: [...new Set([...existing.sourceTypes, ...incoming.sourceTypes])],
    score: preferIncomingJudgement ? incoming.score : existing.score,
    sentiment: preferIncomingJudgement ? incoming.sentiment : existing.sentiment,
    qualityDecision: preferIncomingJudgement ? incoming.qualityDecision : existing.qualityDecision,
    analysisSummary: preferIncomingJudgement ? incoming.analysisSummary : existing.analysisSummary,
    quarantineReason: preferIncomingJudgement ? incoming.quarantineReason : existing.quarantineReason,
    evidence,
    updatedAt: new Date().toISOString()
  };
}

function optionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildRecipeMemories(input: {
  ownerId: string;
  brief?: LeadBrief;
  run: LeadSourceRun;
}): OwnerSearchMemory[] {
  if (!input.brief || !input.run.planPreview?.toolRecipes?.length || !input.run.metrics) return [];
  const savedGood = input.run.metrics.usableProspects ?? input.run.qualityCounts?.savedGood ?? input.run.found;
  const needsProof = input.run.qualityCounts?.needsProof ?? input.run.needsReview;
  const rejected = input.run.qualityCounts?.rejected ?? input.run.blocked;
  const status: ResearchToolRecipeEvaluation["status"] = savedGood > 0 ? "keep" : needsProof > 0 ? "revise" : "discard";
  if (status !== "keep") return [];
  const now = new Date().toISOString();
  return input.run.planPreview.toolRecipes.map((recipe) => {
    const evaluation: ResearchToolRecipeEvaluation = {
      recipeId: recipe.id,
      status,
      reason: `Kept because this recipe was attached to a run with ${savedGood} Good lead${savedGood === 1 ? "" : "s"}.`,
      savedGood,
      needsProof,
      rejected,
      gateBreakdown: input.run.metrics?.qualityGateBreakdown,
      evaluatedAt: now
    };
    return {
      id: `memory_${crypto.randomUUID()}`,
      ownerId: input.ownerId,
      briefFingerprint: leadBriefFingerprint(briefSnapshot(input.brief!)),
      recipeId: recipe.id,
      ownerWebsiteUrl: input.brief?.ownerWebsiteUrl,
      summary: evaluation.reason,
      recipe,
      evaluation,
      createdAt: now
    };
  });
}

export async function saveLeadMagnetResults(input: {
  tenantId: string;
  ownerId: string;
  leads: LeadDossier[];
  run: LeadSourceRun;
  agentRuns: AgentRunLog[];
  brief?: LeadBrief;
}) {
  const state = await readState();
  const scoped = scopeKey(input.tenantId, input.ownerId);
	  const existing = new Map(
    state.leads
      .filter((lead) => scopeKey(lead.tenantId, lead.ownerId) === scoped)
      .map((lead) => [leadKey(lead), lead])
	  );
	  const outsideScope = state.leads.filter((lead) => scopeKey(lead.tenantId, lead.ownerId) !== scoped);
	  const runBriefFingerprint = input.run.inputSnapshot
	    ? leadBriefFingerprint(input.run.inputSnapshot)
	    : input.brief
	      ? leadBriefFingerprint(briefSnapshot(input.brief))
	      : undefined;

	  for (const lead of input.leads) {
	    const ownedLead: LeadDossier = {
	      ...lead,
	      campaignId: input.run.campaignId ?? lead.campaignId,
	      briefFingerprint: runBriefFingerprint ?? lead.briefFingerprint
	    };
	    const key = leadKey(ownedLead);
	    const current = existing.get(key);
	    if (current) {
	      const merged = mergeLead(current, ownedLead);
      input.run.qualityCounts = {
        savedGood: input.run.qualityCounts?.savedGood ?? input.run.qualified,
        needsProof: input.run.qualityCounts?.needsProof ?? input.run.needsReview,
        rejected: input.run.qualityCounts?.rejected ?? input.run.blocked,
        updatedDuplicates: (input.run.qualityCounts?.updatedDuplicates ?? 0) + 1
      };
      const duplicateEvent: LeadResearchEvent = {
        id: `evt_${crypto.randomUUID()}`,
        runId: input.run.id,
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        type: "updated-duplicate",
        status: "completed",
        title: "Updated duplicate",
        summary: `${merged.businessName} already existed, so Leadsy merged the new evidence instead of adding a duplicate.`,
        businessName: merged.businessName,
        leadId: merged.id,
        location: merged.location?.evidence,
        createdAt: new Date().toISOString()
      };
      input.run.events = [duplicateEvent, ...(input.run.events ?? [])];
      existing.set(key, merged);
	    } else {
	      existing.set(key, ownedLead);
	    }
	  }

  state.leads = [...outsideScope, ...existing.values()];
  if (input.brief && input.run.metrics?.targetLeadGoal) {
    const scopedLeads = [...existing.values()];
    const campaignGoodCount = scopedLeads.filter(
      (lead) => lead.qualityDecision?.status === "good" && leadBelongsToBrief(lead, input.brief!)
    ).length;
    const campaignNeedsProofCount = scopedLeads.filter(
      (lead) => lead.qualityDecision?.status === "needs-proof" && leadBelongsToBrief(lead, input.brief!)
    ).length;
    const priorCampaignRuns = input.run.campaignId
      ? state.runs.filter((run) => run.campaignId === input.run.campaignId).length
      : 0;
    input.run.metrics = {
      ...input.run.metrics,
      campaignId: input.run.campaignId,
      campaignBatchCount: priorCampaignRuns + 1,
      campaignGoodCount,
      campaignNeedsProofCount
    };
  }
  state.runs = [input.run, ...state.runs].slice(0, 500);
  const recipeMemories = buildRecipeMemories({
    ownerId: input.ownerId,
    brief: input.brief,
    run: input.run
  });
  if (recipeMemories.length) {
    const seen = new Set(recipeMemories.map((memory) => memory.recipeId));
    state.ownerSearchMemory = [
      ...recipeMemories,
      ...state.ownerSearchMemory.filter((memory) => memory.ownerId !== input.ownerId || !seen.has(memory.recipeId))
    ].slice(0, 200);
  }
  state.agentRuns = [...input.agentRuns, ...state.agentRuns].slice(0, 1000);
  await writeState(state);
  return getLeadMagnetWorkspace(input.tenantId, input.ownerId);
}

export const leadMagnetStorageTools = {
  save_leads: saveLeadMagnetResults
};

export async function updateLeadDossier(
  tenantId: string,
  ownerId: string,
  leadId: string,
  input: LeadDossierUpdateInput
) {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  const leadIndex = state.leads.findIndex(
    (lead) => lead.id === leadId && scopeKey(lead.tenantId, lead.ownerId) === scoped
  );

  if (leadIndex < 0) {
    return { status: "not-found" as const };
  }

  const current = state.leads[leadIndex];
  const updated: LeadDossier = sanitizeLead({
    ...current,
    businessName: input.businessName.trim(),
    category: input.category.trim(),
    city: input.city.trim(),
    area: optionalText(input.area),
    location: {
      ...current.location,
      city: input.city.trim(),
      area: optionalText(input.area),
      status: input.city.trim() || optionalText(input.area) ? "found" : "not-found",
      evidence: [optionalText(input.area), input.city.trim()].filter(Boolean).join(", ") || "location not found"
    },
    phone: optionalText(input.phone),
    whatsapp: optionalText(input.whatsapp),
    email: optionalText(input.email),
    website: optionalText(input.website),
    instagram: optionalText(input.instagram),
    facebook: optionalText(input.facebook),
    linkedin: optionalText(input.linkedin),
    address: optionalText(input.address),
    contentQualitySignal: input.contentQualitySignal.trim(),
    whyTheyMayNeedAgency: input.whyTheyMayNeedAgency.trim(),
    outreachAngle: input.outreachAngle.trim(),
    nextAction: input.nextAction.trim(),
    updatedAt: new Date().toISOString()
  });

  const duplicate = state.leads.find(
    (lead, index) =>
      index !== leadIndex &&
      scopeKey(lead.tenantId, lead.ownerId) === scoped &&
      leadKey(lead) === leadKey(updated)
  );

  if (duplicate) {
    return { status: "duplicate" as const, duplicate };
  }

  state.leads[leadIndex] = updated;
  await writeState(state);
  return { status: "updated" as const, workspace: await getLeadMagnetWorkspace(tenantId, ownerId), lead: updated };
}

export async function deleteLeadDossier(tenantId: string, ownerId: string, leadId: string) {
  const state = await readState();
  const scoped = scopeKey(tenantId, ownerId);
  const lead = state.leads.find((candidate) => candidate.id === leadId && scopeKey(candidate.tenantId, candidate.ownerId) === scoped);

  if (!lead) {
    return null;
  }

  state.leads = state.leads.filter((candidate) => candidate.id !== leadId);
  state.drafts = state.drafts.filter((draft) => !(draft.leadId === leadId && scopeKey(draft.tenantId, draft.ownerId) === scoped));
  await writeState(state);
  return { workspace: await getLeadMagnetWorkspace(tenantId, ownerId), lead };
}

export async function saveMessageDraft(draft: MessageDraft) {
  const state = await readState();
  state.drafts = [draft, ...state.drafts.filter((item) => item.leadId !== draft.leadId)].slice(0, 200);
  await writeState(state);
  return draft;
}
