"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  Clipboard,
  DatabaseZap,
  ExternalLink,
  FileSearch,
  History,
  Globe2,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Radar,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  WandSparkles,
  X
} from "lucide-react";
import type {
  AgentQuestion,
  AgentRunLog,
  EvidenceUrl,
  LeadBrief,
  LeadBriefSnapshot,
  LeadDiscoveryMode,
  LeadDossier,
  LeadResearchEvent,
  LeadResearchMode,
  LeadResearchSourceBreakdown,
  LeadResearchSourceType,
  LeadSearchSession,
  LeadSourceRun,
  MessageDraft,
  OwnerSearchMemory,
  ResearchPlanPreview
} from "@leadsy/domain";
import { LEAD_MAGNET_DEFAULT_BATCH_SIZE, LEAD_MAGNET_MAX_LEAD_GOAL, leadBriefFingerprint } from "@leadsy/domain";
import { Badge, EmptyState, ProgressBar } from "./ui";

type SourceHealth = {
  publicSearch: boolean;
  openrouter: boolean;
  browserWorker: boolean;
};

type WorkspaceResponse = {
  brief: LeadBrief | null;
  briefHistory: LeadBrief[];
  leads: LeadDossier[];
  runs: LeadSourceRun[];
  drafts: MessageDraft[];
  agentRuns: AgentRunLog[];
  searchSessions: LeadSearchSession[];
  ownerSearchMemory?: OwnerSearchMemory[];
  activeSearchSession?: LeadSearchSession | null;
  sourceHealth: SourceHealth;
  latestRun?: LeadSourceRun;
};

type LeadMagnetLabProps = {
  initialWorkspace: WorkspaceResponse;
  initialError?: string;
  initialNotice?: string;
};

type BriefForm = {
  service: string;
  ownerWebsiteUrl: string;
  idealCustomers: string;
  searchLocations: string;
  leadGoal: number;
  researchMode: LeadResearchMode;
  sources: LeadResearchSourceType[];
  aiAction: "draft-only" | "follow-up-plan";
  excludedLeads: string;
};

type RequiredField = "service" | "idealCustomers" | "searchLocations" | "leadGoal" | "sources";
type ResearchFeedStatus = "running" | "completed" | "needs-source" | "failed";
type ResultTab = "good" | "proof" | "rejected" | "retained" | "history";

function retainedRun(run?: LeadSourceRun | null) {
  return run?.runLabel === "QA Scenario" || run?.runLabel === "Worst Case";
}

function briefSnapshotForUi(brief: LeadBrief): LeadBriefSnapshot {
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

function fingerprintForBrief(brief: LeadBrief | null) {
  return brief ? leadBriefFingerprint(briefSnapshotForUi(brief)) : "";
}

function briefSnapshotForForm(form: BriefForm): LeadBriefSnapshot {
  return {
    service: form.service,
    idealCustomers: form.idealCustomers,
    searchLocations: form.searchLocations,
    leadGoal: form.leadGoal,
    researchMode: form.researchMode,
    sources: form.sources,
    aiAction: form.aiAction,
    excludedLeads: form.excludedLeads,
    ownerWebsiteUrl: form.ownerWebsiteUrl
  };
}

function runMatchesBriefForUi(run: LeadSourceRun, brief: LeadBrief | null) {
  if (!brief || retainedRun(run)) return false;
  return run.inputSnapshot ? leadBriefFingerprint(run.inputSnapshot) === fingerprintForBrief(brief) : false;
}

function firstLeadIdForBrief(leads: LeadDossier[], brief: LeadBrief | null, runs: LeadSourceRun[] = []) {
  const activeFingerprint = fingerprintForBrief(brief);
  const retainedCampaignIds = new Set(runs.filter(retainedRun).map((run) => run.campaignId).filter((id): id is string => Boolean(id)));
  const campaignLeads = leads.filter(
    (lead) => activeFingerprint && lead.briefFingerprint === activeFingerprint && !(lead.campaignId ? retainedCampaignIds.has(lead.campaignId) : false)
  );
  return (
    campaignLeads.find((lead) => lead.qualityDecision?.status === "good")?.id ??
    campaignLeads[0]?.id ??
    ""
  );
}

type ResearchFeedItem = {
  id: string;
  title: string;
  detail: string;
  status: ResearchFeedStatus;
};

type RecordTouchItem = {
  lead: LeadDossier;
  touchedAt: number;
  status: "saved good lead" | "updated duplicate" | "needs proof";
};

type LeadEditForm = {
  businessName: string;
  category: string;
  city: string;
  area: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  address: string;
  contentQualitySignal: string;
  whyTheyMayNeedAgency: string;
  outreachAngle: string;
  nextAction: string;
};

const fullOsintSources: LeadResearchSourceType[] = [
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

const sourceOptions: Array<{
  id: LeadResearchSourceType;
  label: string;
  detail: string;
  modeLabel: string;
  healthKey?: keyof SourceHealth;
}> = [
  {
    id: "openrouter-web-search",
    label: "Free public web search",
    detail: "Leadsy runs free public search and local page checks first. OpenRouter only analyzes strong candidates.",
    modeLabel: "free web",
    healthKey: "publicSearch"
  },
  {
    id: "directory-osint",
    label: "Free business directories",
    detail: "Finds public directory, marketplace, chamber, event, association, and listing pages.",
    modeLabel: "free public",
    healthKey: "publicSearch"
  },
  {
    id: "social-osint",
    label: "Public social profiles",
    detail: "Looks for public Instagram, Facebook, LinkedIn, and YouTube signals without logging in.",
    modeLabel: "free public",
    healthKey: "publicSearch"
  },
  {
    id: "website-contact-osint",
    label: "Website + contact pages",
    detail: "Checks public home, about, service, contact, and landing pages for visible contact data.",
    modeLabel: "free public",
    healthKey: "publicSearch"
  },
  {
    id: "review-reputation-osint",
    label: "Free reviews + reputation",
    detail: "Collects public review/rating clues when visible and flags weak reputation proof.",
    modeLabel: "free public",
    healthKey: "publicSearch"
  },
  {
    id: "content-gap-osint",
    label: "Content gap audit",
    detail: "Finds stale websites, weak social content, missing reels, and poor offer clarity.",
    modeLabel: "free public",
    healthKey: "publicSearch"
  },
  {
    id: "hiring-news-osint",
    label: "Free hiring + news signals",
    detail: "Looks for public expansion, hiring, events, launches, or recent activity that suggests budget.",
    modeLabel: "free public",
    healthKey: "publicSearch"
  },
  {
    id: "competitor-osint",
    label: "Competitor context",
    detail: "Compares public presence against nearby alternatives to shape a sharper outreach angle.",
    modeLabel: "free public",
    healthKey: "publicSearch"
  },
  {
    id: "browser-public-page",
    label: "Public page extractor",
    detail: "Extracts visible email, phone, social links, and website snippets.",
    modeLabel: "local free",
    healthKey: "browserWorker"
  },
  {
    id: "manual-import",
    label: "Paste or upload list",
    detail: "Use your own real list while the AI scores and drafts.",
    modeLabel: "your data"
  }
];

const emptyForm: BriefForm = {
  service: "",
  ownerWebsiteUrl: "",
  idealCustomers: "",
  searchLocations: "",
  leadGoal: 25,
  researchMode: "broad",
  sources: fullOsintSources,
  aiAction: "draft-only",
  excludedLeads: ""
};

const emptySourceHealth: SourceHealth = {
  publicSearch: true,
  openrouter: false,
  browserWorker: false
};

function leadToEditForm(lead: LeadDossier): LeadEditForm {
  return {
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    area: lead.area ?? "",
    phone: lead.phone ?? "",
    whatsapp: lead.whatsapp ?? "",
    email: lead.email ?? "",
    website: lead.website ?? "",
    instagram: lead.instagram ?? "",
    facebook: lead.facebook ?? "",
    linkedin: lead.linkedin ?? "",
    address: lead.address ?? "",
    contentQualitySignal: lead.contentQualitySignal,
    whyTheyMayNeedAgency: lead.whyTheyMayNeedAgency,
    outreachAngle: lead.outreachAngle,
    nextAction: lead.nextAction
  };
}

function normalizeWorkspace(payload: Partial<WorkspaceResponse>): WorkspaceResponse {
  const runs = payload.runs ?? [];
  return {
    brief: payload.brief ?? null,
    briefHistory: payload.briefHistory ?? [],
    leads: payload.leads ?? [],
    runs,
    drafts: payload.drafts ?? [],
    agentRuns: payload.agentRuns ?? [],
    searchSessions: payload.searchSessions ?? [],
    ownerSearchMemory: payload.ownerSearchMemory ?? [],
    activeSearchSession: payload.activeSearchSession ?? null,
    sourceHealth: payload.sourceHealth ?? emptySourceHealth,
    latestRun: payload.latestRun ?? runs[0]
  };
}

function toForm(brief: LeadBrief | null): BriefForm {
  if (!brief) {
    return emptyForm;
  }
  return {
    service: brief.service,
    idealCustomers: brief.idealCustomers,
    searchLocations: brief.searchLocations,
    leadGoal: brief.leadGoal,
    researchMode: brief.researchMode ?? inferResearchMode(brief.leadGoal, brief.sources),
    sources: brief.sources,
    aiAction: brief.aiAction,
    excludedLeads: brief.excludedLeads,
    ownerWebsiteUrl: brief.ownerWebsiteUrl ?? ""
  };
}

function inferResearchMode(leadGoal: number, sources: LeadResearchSourceType[]): LeadResearchMode {
  return leadGoal >= 25 || sources.length >= fullOsintSources.length ? "broad" : "focused";
}

function researchModeCopy(mode: LeadResearchMode) {
  return mode === "broad"
    ? "Broad OSINT sweep: more public searches, more page checks, better for India-wide or large-market research."
    : "Focused local search: faster, tighter, better for one city, one niche, or a small prospect list.";
}

function sourceReady(source: (typeof sourceOptions)[number], health: SourceHealth) {
  return source.healthKey ? health[source.healthKey] : true;
}

function scoreTone(score: number): "lime" | "teal" | "amber" | "rose" {
  if (score >= 80) return "lime";
  if (score >= 68) return "teal";
  if (score >= 45) return "amber";
  return "rose";
}

function timeLabel(value?: string) {
  if (!value) return "just now";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function validateBrief(form: BriefForm) {
  const missing = missingBriefFields(form);
  if (missing.includes("service")) return "First tell Leadsy what you sell.";
  if (missing.includes("idealCustomers")) return "Tell Leadsy who to find.";
  if (missing.includes("searchLocations")) return "Tell Leadsy where to search.";
  if (missing.includes("leadGoal")) return `Lead count must be between 1 and ${LEAD_MAGNET_MAX_LEAD_GOAL}.`;
  if (missing.includes("sources")) return "Choose at least one search source.";
  return "";
}

function missingBriefFields(form: BriefForm): RequiredField[] {
  return [
    form.service.trim().length < 2 ? "service" : null,
    form.idealCustomers.trim().length < 2 ? "idealCustomers" : null,
    form.searchLocations.trim().length < 2 ? "searchLocations" : null,
    !Number.isFinite(form.leadGoal) || form.leadGoal < 1 || form.leadGoal > LEAD_MAGNET_MAX_LEAD_GOAL ? "leadGoal" : null,
    form.sources.length ? null : "sources"
  ].filter((field): field is RequiredField => Boolean(field));
}

const buttonMotion =
  "transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-px active:scale-[0.985]";
const fieldBase =
  "rounded-[6px] border bg-white/[0.04] text-sm text-white outline-none transition-all duration-150 placeholder:text-[var(--muted)] focus:border-teal-300/45 focus:bg-white/[0.06]";

const sourceLabels: Record<LeadResearchSourceType, string> = {
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

const audienceModeLabels: Record<LeadDiscoveryMode, string> = {
  "b2b-company": "B2B companies",
  "b2b-local-business": "Local businesses",
  "b2c-public-profile": "Public profiles",
  "consumer-intent": "Consumer intent",
  "creator-influencer": "Creators",
  "recruiting-candidate": "Candidates"
};

function sourceBreakdownEntries(
  breakdown?: Partial<Record<LeadResearchSourceType, LeadResearchSourceBreakdown>>
): Array<[LeadResearchSourceType, LeadResearchSourceBreakdown]> {
  return Object.entries(breakdown ?? {}).filter((entry): entry is [LeadResearchSourceType, LeadResearchSourceBreakdown] => {
    const [source, metrics] = entry;
    return Boolean(source in sourceLabels && metrics);
  });
}

function statusTone(status: ResearchFeedStatus | AgentRunLog["status"] | LeadSourceRun["status"]): "teal" | "amber" | "rose" | "lime" {
  if (status === "completed") return "teal";
  if (status === "failed") return "rose";
  if (status === "running") return "lime";
  return "amber";
}

function statusLabel(status: string) {
  return status.replaceAll("-", " ");
}

function friendlyAgentName(run: AgentRunLog) {
  if (run.provider === "local" && run.agent === "lead-finder") return "Public source collectors";
  if (run.provider === "local") return "Manual import scorer";
  if (run.agent === "page-extractor") return "Public page extractor";
  if (run.agent === "message-drafter") return "Message drafter";
  if (run.agent === "lead-scorer") return "Lead quality scorer";
  return "Public web search";
}

function friendlyProvider(provider: AgentRunLog["provider"]) {
  if (provider === "openrouter") return "OpenRouter analysis";
  if (provider === "browser-worker") return "Local public page worker";
  return "Leadsy local engine";
}

function evidenceProof(item: EvidenceUrl) {
  if (item.sourceType === "manual-import") return "Owner supplied this record.";
  if (item.sourceType === "browser-public-page") return "Visible public website detail was extracted.";
  if (item.sourceType === "social-osint") return "A public social profile or signal was found.";
  if (item.sourceType === "review-reputation-osint") return "Public reputation or review context was found.";
  if (item.sourceType === "content-gap-osint") return "Public content/website quality context was found.";
  if (item.sourceType === "hiring-news-osint") return "Public recent activity signal was found.";
  return "Public source evidence supports this lead.";
}

function formatPreciseInr(value?: number) {
  return `Rs. ${(Number.isFinite(value) ? Number(value) : 0).toFixed(6)}`;
}

function qualityTone(status?: string): "teal" | "amber" | "rose" | "lime" {
  if (status === "good" || status === "completed") return "teal";
  if (status === "rejected" || status === "failed") return "rose";
  if (status === "needs-proof" || status === "deferred") return "amber";
  return "lime";
}

function eventVerb(event: LeadResearchEvent) {
  if (event.type === "searched-web") return "Search";
  if (event.type === "candidate-found") return "Candidate pool";
  if (event.type === "public-page-checked") return "Page checked";
  if (event.type === "osint-added") return "OSINT added";
  if (event.type === "sentiment-scored") return "Sentiment scored";
  if (event.type === "saved") return "Saved good lead";
  if (event.type === "updated-duplicate") return "Updated duplicate";
  if (event.type === "quarantined") return "Needs proof";
  if (event.type === "discarded-noise") return "Discarded noise";
  if (event.type === "rejected") return "Rejected";
  return "Cost recorded";
}

function providerCompletedWithoutEvidence(input: {
  latestRun?: LeadSourceRun;
  agentRuns: AgentRunLog[];
  sourceHealth: SourceHealth;
}) {
  if (
    !input.latestRun ||
    !["completed", "failed"].includes(input.latestRun.status) ||
    input.latestRun.found > 0 ||
    input.latestRun.needsReview > 0 ||
    input.latestRun.connectionMessages.length ||
    !input.sourceHealth.publicSearch
  ) {
    return false;
  }

  const startedAt = Date.parse(input.latestRun.startedAt);
  const completedAt = Date.parse(input.latestRun.completedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) {
    return false;
  }

  return input.agentRuns.some((run) => {
    const createdAt = Date.parse(run.createdAt);
    return (
      run.agent === "lead-finder" &&
      (run.provider === "local" || run.provider === "openrouter") &&
      run.status === "completed" &&
      Boolean(run.metrics) &&
      Number.isFinite(createdAt) &&
      createdAt >= startedAt &&
      createdAt <= completedAt + 60_000
    );
  });
}

function buildResearchFeed(input: {
  loading: "refresh" | "save" | "preview" | "discover" | "import" | "draft" | "update" | "delete" | null;
  latestRun?: LeadSourceRun;
  brief: LeadBrief | null;
  researchMode?: LeadResearchMode;
  effectiveStatus?: ResearchFeedStatus | LeadSourceRun["status"];
  zeroEvidenceRun?: boolean;
}): ResearchFeedItem[] {
  if (input.loading === "save") {
    return [{ id: "save", title: "Saving lead brief", detail: "Leadsy is storing what you sell, who to find, and where to search.", status: "running" }];
  }
  if (input.loading === "preview") {
    return [{ id: "preview", title: "Preparing search plan", detail: "Leadsy is turning the broad brief into concrete buyer lanes before spending AI credit.", status: "running" }];
  }
  if (input.loading === "import") {
    return [
      { id: "import-read", title: "Reading pasted records", detail: "Leadsy is turning your pasted list into clean lead records.", status: "running" },
      { id: "import-score", title: "Scoring imported leads", detail: "Each record is checked for fit, contactability, and evidence.", status: "running" }
    ];
  }
  if (input.loading === "discover") {
    const broad = input.researchMode !== "focused";
    return broad
      ? [
          { id: "brief", title: "Saving lead brief", detail: "The brief is saved first so every search follows your target buyer and market.", status: "completed" },
          { id: "plan", title: "Planning broad source sweeps", detail: "Leadsy is creating multiple public search angles across niches, signals, and source types.", status: "running" },
          { id: "search", title: "Running source-specific collectors", detail: "Leadsy is using free public search, directories, profiles, reviews, websites, and public signals.", status: "running" },
          { id: "extract", title: "Checking public pages", detail: "Visible contact details, social links, and website clues are extracted only when public.", status: "running" },
          { id: "dedupe", title: "Building one clean candidate pool", detail: "Duplicate URLs and repeated business names are merged before anything is saved.", status: "running" },
          { id: "prepare", title: "Saving evidence-backed records", detail: "Real records appear only after Leadsy finds source evidence. Weak records are marked for review.", status: "running" }
        ]
      : [
          { id: "brief", title: "Saving lead brief", detail: "The brief is saved first so every search follows your target niche and city.", status: "completed" },
          { id: "search", title: "Searching focused public sources", detail: "Leadsy is checking a smaller set of public pages, directories, and business listings.", status: "running" },
          { id: "extract", title: "Checking public pages", detail: "Visible contact details, social links, and website clues are extracted only when public.", status: "running" },
          { id: "score", title: "Deduping and scoring", detail: "Duplicate businesses are merged; weak records are marked for review.", status: "running" },
          { id: "prepare", title: "Preparing records", detail: "Real records will appear only after they are saved with source evidence.", status: "running" }
        ];
  }
  if (!input.latestRun) {
    return [
      {
        id: "ready",
        title: input.brief ? "Ready to research" : "Waiting for your brief",
        detail: input.brief
          ? "Click Save + find real leads to start checking free public sources."
          : "Fill Step 1 so Leadsy knows what businesses to look for.",
        status: input.brief ? "completed" : "needs-source"
      }
    ];
  }

  const runStatus: ResearchFeedStatus =
    input.effectiveStatus === "completed" ? "completed" : input.effectiveStatus === "failed" ? "failed" : "needs-source";
  return [
    {
      id: "sources",
      title: "Sources checked",
      detail: input.zeroEvidenceRun
        ? "The public collectors ran, but no business had enough public evidence to save. No fake records were created."
	        : input.latestRun.metrics
	        ? `Batch ${input.latestRun.metrics.batchNumber ?? 1}: ${input.latestRun.metrics.searchesRun} searches ran, ${input.latestRun.metrics.pagesFetched} public pages were checked, ${input.latestRun.metrics.dedupedCount} unique candidates were deduped, ${input.latestRun.metrics.rawResultsDiscarded ?? 0} noisy results were discarded, and ${input.latestRun.metrics.alternateSourceRecovered ?? 0} blocked direct fetches were recovered through alternate OSINT.`
        : input.latestRun.sourcesUsed.length
        ? `${input.latestRun.sourcesUsed.map((source) => sourceLabels[source]).join(", ")} returned usable evidence.`
        : "No source returned usable evidence yet.",
      status: runStatus
    },
    {
      id: "records",
      title: "Records prepared",
      detail: `${input.latestRun.found} found, ${input.latestRun.qualified} high-confidence, ${input.latestRun.needsReview} need review.`,
      status: runStatus
    },
    {
      id: "guardrails",
      title: "Guardrails applied",
      detail: "Private profiles, login pages, paid data brokers, and invented contact details are blocked.",
      status: "completed"
    }
  ];
}

export function LeadMagnetLab({ initialWorkspace, initialError = "", initialNotice = "" }: LeadMagnetLabProps) {
  const [workspace, setWorkspace] = useState<WorkspaceResponse>(() => normalizeWorkspace(initialWorkspace));
  const [form, setForm] = useState<BriefForm>(toForm(initialWorkspace.brief));
  const [activeLeadId, setActiveLeadId] = useState(firstLeadIdForBrief(initialWorkspace.leads, initialWorkspace.brief, initialWorkspace.runs));
  const [importText, setImportText] = useState("");
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(initialNotice);
  const [showFieldGuidance, setShowFieldGuidance] = useState(false);
  const [loading, setLoading] = useState<"refresh" | "save" | "preview" | "discover" | "import" | "draft" | "update" | "delete" | null>(null);
  const [editingLeadId, setEditingLeadId] = useState("");
  const [leadModalMode, setLeadModalMode] = useState<"view" | "edit" | null>(null);
  const [leadEditForm, setLeadEditForm] = useState<LeadEditForm | null>(null);
  const [transcriptMode, setTranscriptMode] = useState<"simple" | "technical">("simple");
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>("good");
  const [planPreview, setPlanPreview] = useState<ResearchPlanPreview | null>(null);
  const [streamEvents, setStreamEvents] = useState<LeadResearchEvent[]>([]);
  const [activeSearchSession, setActiveSearchSession] = useState<LeadSearchSession | null>(
    initialWorkspace.activeSearchSession ?? null
  );
  const [agentQuestions, setAgentQuestions] = useState<AgentQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const searchAbortRef = useRef<AbortController | null>(null);
  const serviceRef = useRef<HTMLInputElement>(null);
  const idealCustomersRef = useRef<HTMLTextAreaElement>(null);
	  const searchLocationsRef = useRef<HTMLInputElement>(null);
	  const leadGoalRef = useRef<HTMLInputElement>(null);

	  const activeCampaignRuns = useMemo(
	    () => workspace.runs.filter((run) => runMatchesBriefForUi(run, workspace.brief)),
	    [workspace.brief, workspace.runs]
	  );
	  const latestRun =
	    workspace.latestRun && runMatchesBriefForUi(workspace.latestRun, workspace.brief)
	      ? workspace.latestRun
	      : activeCampaignRuns[0];
	  const activeBriefFingerprint = fingerprintForBrief(workspace.brief);
	  const retainedCampaignIds = useMemo(
	    () => new Set(workspace.runs.filter(retainedRun).map((run) => run.campaignId).filter((id): id is string => Boolean(id))),
	    [workspace.runs]
	  );
	  const currentCampaignLeads = useMemo(
	    () => workspace.leads.filter((lead) => Boolean(activeBriefFingerprint) && lead.briefFingerprint === activeBriefFingerprint && !(lead.campaignId ? retainedCampaignIds.has(lead.campaignId) : false)),
	    [activeBriefFingerprint, retainedCampaignIds, workspace.leads]
	  );
	  const retainedOtherLeads = useMemo(
	    () => workspace.leads.filter((lead) => !activeBriefFingerprint || lead.briefFingerprint !== activeBriefFingerprint || (lead.campaignId ? retainedCampaignIds.has(lead.campaignId) : false)),
	    [activeBriefFingerprint, retainedCampaignIds, workspace.leads]
	  );
  const usableLeads = useMemo(
    () => currentCampaignLeads.filter((lead) => lead.qualityDecision?.status === "good"),
    [currentCampaignLeads]
  );
  const needsProofLeads = useMemo(
    () => currentCampaignLeads.filter((lead) => lead.qualityDecision?.status === "needs-proof"),
    [currentCampaignLeads]
  );

  const activeLead = useMemo(() => {
    return (
      currentCampaignLeads.find((lead) => lead.id === activeLeadId) ??
      usableLeads[0] ??
      (activeResultTab === "retained" ? retainedOtherLeads.find((lead) => lead.id === activeLeadId) : undefined) ??
      currentCampaignLeads[0] ??
      null
    );
  }, [activeLeadId, activeResultTab, currentCampaignLeads, retainedOtherLeads, usableLeads]);

  const activeDraft = useMemo(() => {
    if (!activeLead) return null;
    return workspace.drafts.find((draft) => draft.leadId === activeLead.id) ?? null;
  }, [activeLead, workspace.drafts]);

  async function loadWorkspace() {
    setLoading("refresh");
    setError("");
    try {
      const response = await fetch("/api/lead-magnet/brief", { credentials: "include" });
      const payload = (await response.json()) as Partial<WorkspaceResponse> & { error?: string; message?: string };
      if (!response.ok || !payload.sourceHealth) {
        throw new Error(payload.message ?? payload.error ?? "Could not load lead workspace.");
      }
      const nextWorkspace = normalizeWorkspace(payload);
      setWorkspace(nextWorkspace);
      setForm(toForm(payload.brief ?? null));
      setActiveSearchSession(nextWorkspace.activeSearchSession ?? null);
      setActiveLeadId(firstLeadIdForBrief(nextWorkspace.leads, nextWorkspace.brief, nextWorkspace.runs));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function submitJson(url: string, body?: unknown, method = "POST") {
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let payload: { message?: string; error?: string } = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(response.ok ? "The server response could not be read." : "The server returned a technical error. Please try again.");
    }
    if (!response.ok) {
      throw new Error(payload.message ?? payload.error ?? "Action failed");
    }
    return payload as WorkspaceResponse;
  }

  async function saveBrief() {
    const validation = validateBrief(form);
    if (validation) {
      showValidation(validation, "Save did not run yet. Fill the highlighted field, then click Save brief again.");
      return;
    }
    setShowFieldGuidance(false);
    setLoading("save");
    setError("");
    setNotice("Saving your brief now...");
    try {
      const payload = await submitJson("/api/lead-magnet/brief", form);
      setWorkspace(normalizeWorkspace(payload));
      setNotice("Brief saved. You can see it in history below.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function streamSearchSession(sessionId: string) {
    setLoading("discover");
    setError("");
    setNotice("Searching public sources. Leadsy will ask only if a human choice can prevent wasted searches.");
    setStreamEvents([]);
    const controller = new AbortController();
    searchAbortRef.current = controller;
    try {
      const response = await fetch(`/api/lead-magnet/search/stream?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "GET",
        credentials: "include",
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(payload.message ?? payload.error ?? "Search stream could not start.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalPayload: WorkspaceResponse | undefined;
      const handlePacket = (packet: string) => {
        const eventName = packet.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
        const data = packet
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data) return;
        const parsed = JSON.parse(data) as WorkspaceResponse | LeadResearchEvent | LeadSearchSession | { message?: string; error?: string };
        if (eventName === "progress") {
          const event = parsed as LeadResearchEvent;
          setStreamEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
        } else if (eventName === "session") {
          setActiveSearchSession(parsed as LeadSearchSession);
        } else if (eventName === "final") {
          finalPayload = parsed as WorkspaceResponse;
        } else if (eventName === "error") {
          throw new Error((parsed as { message?: string; error?: string }).message ?? "Search failed.");
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const packets = buffer.split("\n\n");
        buffer = packets.pop() ?? "";
        for (const packet of packets) {
          handlePacket(packet);
        }
      }
      buffer += decoder.decode();
      for (const packet of buffer.split("\n\n").filter((packet) => packet.trim())) {
        handlePacket(packet);
      }

      if (!finalPayload) {
        throw new Error("Search finished without returning a workspace.");
      }
      const nextWorkspace = normalizeWorkspace(finalPayload);
      const session = nextWorkspace.activeSearchSession ?? null;
      setWorkspace(nextWorkspace);
      setActiveSearchSession(session);
      setPlanPreview(session?.planPreview ?? null);
      setActiveLeadId(firstLeadIdForBrief(nextWorkspace.leads, nextWorkspace.brief, nextWorkspace.runs));
      if (session?.status === "needs-input" && session.strategy.questions.length) {
        const defaults = Object.fromEntries(session.strategy.questions.map((question) => [question.id, question.answeredOptionId ?? question.defaultOptionId]));
        setQuestionAnswers(defaults);
        setAgentQuestions(session.strategy.questions);
        setNotice("Leadsy paused at a checkpoint and needs one choice before continuing.");
        return;
      }
      setAgentQuestions([]);
      setNotice(finalPayload.latestRun?.found ? "Search finished with Good leads ready to inspect." : "Search finished. Check Good and Needs Proof for what Leadsy could verify.");
    } catch (caught) {
      if ((caught as Error).name === "AbortError") {
        setNotice("Search stop requested. Any already-saved batch remains in history.");
      } else {
        setError((caught as Error).message);
      }
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
      }
      setLoading(null);
    }
  }

  async function startSearch() {
    const validation = validateBrief(form);
    if (validation) {
      showValidation(validation, "Search did not run yet. Give Leadsy enough context to plan the first buyer lanes.");
      return;
    }
    setShowFieldGuidance(false);
    setLoading("discover");
    setError("");
    setNotice("Leadsy is planning the search and will ask only the questions that matter.");
    setAgentQuestions([]);
    setQuestionAnswers({});
    try {
      const payload = (await submitJson("/api/lead-magnet/search/start", form)) as WorkspaceResponse & {
        searchSession?: LeadSearchSession;
      };
      const nextWorkspace = normalizeWorkspace(payload);
      const session = payload.searchSession ?? nextWorkspace.activeSearchSession ?? null;
      setWorkspace(nextWorkspace);
      setActiveSearchSession(session);
      setPlanPreview(session?.planPreview ?? null);
      if (session?.status === "needs-input" && session.strategy.questions.length) {
        const defaults = Object.fromEntries(session.strategy.questions.map((question) => [question.id, question.defaultOptionId]));
        setQuestionAnswers(defaults);
        setAgentQuestions(session.strategy.questions);
        setNotice("Leadsy needs a few choices before spending searches.");
        setLoading(null);
        return;
      }
      if (!session) {
        throw new Error("Search session was not created.");
      }
      await streamSearchSession(session.id);
    } catch (caught) {
      setError((caught as Error).message);
      setLoading(null);
    }
  }

  async function answerAgentQuestions() {
    if (!activeSearchSession) {
      setError("Start a search first.");
      return;
    }
    const previousQuestions = agentQuestions;
    const previousAnswers = questionAnswers;
    setAgentQuestions([]);
    setLoading("discover");
    setError("");
    setNotice("Applying your answers and starting the search.");
    try {
      const payload = (await submitJson("/api/lead-magnet/search/answer", {
        sessionId: activeSearchSession.id,
        answers: questionAnswers
      })) as WorkspaceResponse & { searchSession?: LeadSearchSession };
      const nextWorkspace = normalizeWorkspace(payload);
      const session = payload.searchSession ?? nextWorkspace.activeSearchSession ?? activeSearchSession;
      setWorkspace(nextWorkspace);
      setActiveSearchSession(session);
      setPlanPreview(session.planPreview ?? null);
      await streamSearchSession(session.id);
    } catch (caught) {
      setAgentQuestions(previousQuestions);
      setQuestionAnswers(previousAnswers);
      setError((caught as Error).message);
      setLoading(null);
    }
  }

  async function stopSearch() {
    const sessionId = activeSearchSession?.id;
    searchAbortRef.current?.abort();
    if (!sessionId) {
      setNotice("No active search is running.");
      setLoading(null);
      return;
    }
    try {
      const payload = (await submitJson("/api/lead-magnet/search/stop", { sessionId })) as WorkspaceResponse & {
        searchSession?: LeadSearchSession | null;
      };
      const nextWorkspace = normalizeWorkspace(payload);
      setWorkspace(nextWorkspace);
      setActiveSearchSession(payload.searchSession ?? nextWorkspace.activeSearchSession ?? null);
      setNotice("Stop requested. Leadsy will not start another batch for this search.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function importLeads() {
    const validation = validateBrief(form);
    if (validation) {
      showValidation(validation, "Import did not run yet. Complete the brief first so Leadsy can score the leads properly.");
      return;
    }
    if (!importText.trim()) {
      setError("Paste at least one real business before importing.");
      setNotice("");
      return;
    }
    setLoading("import");
    setError("");
    setNotice("");
    try {
      await submitJson("/api/lead-magnet/brief", form);
      const payload = await submitJson("/api/lead-magnet/import", { rawText: importText });
      const nextWorkspace = normalizeWorkspace(payload);
      setWorkspace(nextWorkspace);
      setImportText("");
      setActiveLeadId(firstLeadIdForBrief(nextWorkspace.leads, nextWorkspace.brief, nextWorkspace.runs));
      setNotice("Imported leads were scored and the run was saved in history.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function draftMessage(leadId: string) {
    setLoading("draft");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/lead-magnet/draft", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId })
      });
      const payload = (await response.json()) as { draft?: MessageDraft; message?: string; error?: string };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.message ?? payload.error ?? "Could not draft message");
      }
      await loadWorkspace();
      setActiveLeadId(leadId);
      setNotice("Draft created. It is saved with this lead.");
    } catch (caught) {
      setError((caught as Error).message);
      setLoading(null);
    }
  }

  function openLeadView(lead: LeadDossier) {
    setActiveLeadId(lead.id);
    setEditingLeadId("");
    setLeadEditForm(null);
    setLeadModalMode("view");
    setError("");
    setNotice("");
  }

  function startLeadEdit(lead: LeadDossier) {
    setActiveLeadId(lead.id);
    setEditingLeadId(lead.id);
    setLeadEditForm(leadToEditForm(lead));
    setLeadModalMode("edit");
    setError("");
    setNotice(`Editing ${lead.businessName}. Save update when you are done.`);
  }

  function closeLeadModal() {
    setLeadModalMode(null);
    setEditingLeadId("");
    setLeadEditForm(null);
    setNotice("");
  }

  function cancelLeadEdit() {
    closeLeadModal();
  }

  function updateLeadEditForm(patch: Partial<LeadEditForm>) {
    setLeadEditForm((current) => (current ? { ...current, ...patch } : current));
    setError("");
  }

  async function saveLeadEdit() {
    if (!editingLeadId || !leadEditForm) {
      return;
    }

    if (!leadEditForm.businessName.trim() || !leadEditForm.category.trim() || !leadEditForm.city.trim()) {
      setError("Business name, category, and city are required before updating a lead.");
      return;
    }

    setLoading("update");
    setError("");
    setNotice("");
    try {
      const payload = await submitJson(`/api/lead-magnet/leads/${encodeURIComponent(editingLeadId)}`, leadEditForm, "PATCH") as WorkspaceResponse & { lead?: LeadDossier };
      const nextWorkspace = normalizeWorkspace(payload);
      setWorkspace(nextWorkspace);
      setActiveLeadId(payload.lead?.id ?? editingLeadId);
      setEditingLeadId("");
      setLeadEditForm(null);
      setLeadModalMode("view");
      setNotice("Lead updated. The change is saved in your workspace.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function deleteLead(leadId: string) {
    const lead = workspace.leads.find((candidate) => candidate.id === leadId);
    const leadName = lead?.businessName ?? "this lead";
    const confirmed = window.confirm(`Delete ${leadName}? This removes the lead and its draft from your workspace.`);
    if (!confirmed) {
      return;
    }

    setLoading("delete");
    setError("");
    setNotice("");
    try {
      const payload = await submitJson(`/api/lead-magnet/leads/${encodeURIComponent(leadId)}`, undefined, "DELETE") as WorkspaceResponse & { deletedLeadId?: string };
      const nextWorkspace = normalizeWorkspace(payload);
      setWorkspace(nextWorkspace);
      const stillActive = nextWorkspace.leads.some((candidate) => candidate.id === activeLeadId);
      setActiveLeadId(stillActive ? activeLeadId : firstLeadIdForBrief(nextWorkspace.leads, nextWorkspace.brief, nextWorkspace.runs));
      if (editingLeadId === leadId) {
        setEditingLeadId("");
        setLeadEditForm(null);
      }
      if (activeLeadId === leadId) {
        setLeadModalMode(null);
      }
      setNotice(`${leadName} deleted. It will not appear in your lead list anymore.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(null);
    }
  }

  function toggleSource(source: LeadResearchSourceType) {
    setShowFieldGuidance(false);
    setError("");
    setPlanPreview(null);
    setForm((current) => {
      const next = current.sources.includes(source)
        ? current.sources.filter((item) => item !== source)
        : [...current.sources, source];
      return { ...current, sources: next.length ? next : [source] };
    });
    setNotice("Search sources updated.");
  }

  function updateForm(patch: Partial<BriefForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setPlanPreview(null);
    setActiveSearchSession(null);
    setAgentQuestions([]);
    setError("");
  }

  function selectAiAction(aiAction: BriefForm["aiAction"]) {
    updateForm({ aiAction });
    setNotice(
      aiAction === "draft-only"
        ? "Selected: AI will draft messages only. Nothing will be sent automatically."
        : "Selected: AI will draft messages and a follow-up plan. Sending still needs your approval."
    );
  }

  function selectResearchMode(researchMode: LeadResearchMode) {
    updateForm({ researchMode });
    setNotice(researchModeCopy(researchMode));
  }

  function selectSources(sources: LeadResearchSourceType[], label: string, researchMode = inferResearchMode(form.leadGoal, sources)) {
    updateForm({ sources, researchMode });
    setShowFieldGuidance(false);
    setNotice(`${label} selected: ${sources.length} source${sources.length === 1 ? "" : "s"} active. ${researchModeCopy(researchMode)}`);
  }

  function focusFirstMissing(field: RequiredField) {
    const target = {
      service: serviceRef.current,
      idealCustomers: idealCustomersRef.current,
      searchLocations: searchLocationsRef.current,
      leadGoal: leadGoalRef.current,
      sources: null
    }[field];
    target?.focus();
  }

  function showValidation(message: string, guidance: string) {
    const missing = missingBriefFields(form);
    setShowFieldGuidance(true);
    setError(message);
    setNotice(guidance);
    if (missing[0]) {
      window.setTimeout(() => focusFirstMissing(missing[0]), 0);
    }
  }

  async function handleBriefFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name === "sourcePreset") {
      const light = submitter.value === "light";
      selectSources(
        light ? ["openrouter-web-search", "browser-public-page", "manual-import"] : fullOsintSources,
        light ? "Light search" : "Full free search",
        light ? "focused" : "broad"
      );
      return;
    }
    if (submitter?.value === "discover" || submitter?.value === "full-discover") {
      await startSearch();
      return;
    }
    await saveBrief();
  }

  const latestEvents = (loading === "discover" && streamEvents.length ? streamEvents : latestRun?.events ?? [])
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const displayEvents = latestEvents.filter((event) => ["searched-web", "candidate-found", "public-page-checked", "osint-added", "saved", "quarantined", "discarded-noise", "rejected", "cost-recorded"].includes(event.type)).slice(0, 5);
  const qualityEvents = latestEvents.filter((event) => ["quarantined", "rejected", "updated-duplicate"].includes(event.type)).slice(0, 12);
  const needsProofEvents = qualityEvents.filter((event) => event.type === "quarantined");
  const rejectedEvents = qualityEvents.filter((event) => event.type === "rejected");
  const latestMetrics = latestRun?.metrics ?? {
    searchesRun: 0,
    pagesFetched: 0,
    candidateCount: 0,
    dedupedCount: 0,
    targetLeadGoal: form.leadGoal,
    minQualifiedTarget: form.leadGoal,
    campaignGoodCount: usableLeads.length,
    campaignNeedsProofCount: needsProofLeads.length,
    batchNumber: 1,
    batchSize: form.leadGoal > 100 ? LEAD_MAGNET_DEFAULT_BATCH_SIZE : form.leadGoal,
    rawResultsDiscarded: 0,
    usableProspects: usableLeads.length,
    properDataCount: usableLeads.length,
    missingContactCount: 0,
    directFetchBlocked: 0,
    retriedAfterBackoff: 0,
    alternateSourceRecovered: 0,
    robotsSkipped: 0,
    sourceDeferred: 0,
    rateLimitedCount: 0,
    savedCount: latestRun?.found ?? 0,
    sourceBreakdown: {}
  };
  const sourceBreakdown = sourceBreakdownEntries(latestMetrics.sourceBreakdown);
  const connectionMessages = [...new Set(latestRun?.connectionMessages ?? [])];
  const zeroEvidenceRun = providerCompletedWithoutEvidence({
    latestRun,
    agentRuns: workspace.agentRuns,
    sourceHealth: workspace.sourceHealth
  });
  const rawReceiptStatus: ResearchFeedStatus | LeadSourceRun["status"] =
    latestRun?.status ?? (loading === "discover" || loading === "import" ? "running" : "needs-source");
  const receiptStatus: ResearchFeedStatus | LeadSourceRun["status"] =
    zeroEvidenceRun ? "completed" : rawReceiptStatus;
  const receiptMessage = zeroEvidenceRun
    ? "Leadsy's public collectors did run. They saved 0 only because no business had enough public source evidence. Leadsy did not invent leads."
    : latestRun?.recommendation;
	  const campaignTarget = latestMetrics.targetLeadGoal ?? form.leadGoal;
	  const campaignGoodCount = usableLeads.length;
	  const campaignNeedsProofCount = needsProofLeads.length;
	  const campaignProgressLabel = `${Math.min(campaignGoodCount, campaignTarget)} / ${campaignTarget}`;
	  const savedBriefFingerprint = fingerprintForBrief(workspace.brief);
	  const formFingerprint = leadBriefFingerprint(briefSnapshotForForm(form));
	  const formHasUnsavedChanges = Boolean(workspace.brief && savedBriefFingerprint !== formFingerprint);
	  const ownerHeadline = loading === "discover"
	    ? "Research is running"
    : latestRun?.metrics?.targetLeadGoal
      ? `Good ${campaignProgressLabel}`
      : latestRun?.outcome?.headline ?? (latestRun ? "Research complete" : "Ready to find leads");
	  const currentBriefEmptySummary = campaignNeedsProofCount
	    ? `No Good leads pass the active brief yet. ${campaignNeedsProofCount} real records are held in Needs Proof until identity, location, fit, evidence, and contactability are strong enough.`
	    : latestRun
	      ? "No Good leads pass the active saved search yet. Older runs stay separated so they do not inflate this campaign."
	      : "Click Search. Leadsy will plan, ask only useful questions, and then run public-source research.";
  const ownerSummary = loading === "discover"
    ? `Leadsy is checking public sources for batch ${latestMetrics.batchNumber ?? 1}. Good leads count only after identity, location, fit, evidence, and contact checks pass.`
    : campaignGoodCount > 0
      ? latestRun?.outcome?.summary ?? receiptMessage
      : currentBriefEmptySummary;
  const ownerWhy = latestRun?.outcome?.whyNoLeads;
  const ownerNextActions = (campaignGoodCount > 0 ? latestRun?.outcome?.nextActions : undefined) ??
    (latestRun
      ? campaignGoodCount
        ? ["Review saved leads", "Open one lead dossier", "Draft a message for approval"]
        : campaignNeedsProofCount
          ? ["Review Needs Proof", "Strengthen buyer lanes", "Run protected search again"]
          : ["Use clearer buyer lanes", "Paste 5 real examples if you have them", "Run protected search again"]
	      : planPreview
	        ? ["Review the agent lanes", "Search", "Open research details only if needed"]
	        : ["Fill the brief", "Click Search", "Answer AI questions only if asked"]);
  const ownerStatusLabel = loading === "discover"
    ? "running"
    : campaignGoodCount
      ? latestRun?.outcome?.status ?? latestRun?.status ?? "leads-saved"
      : campaignNeedsProofCount
        ? "needs-proof"
        : latestRun
          ? "no current good leads"
          : "ready";
  const busy = Boolean(loading);
  const researchFeed = useMemo(
    () => buildResearchFeed({ loading, latestRun, brief: workspace.brief, researchMode: form.researchMode, effectiveStatus: receiptStatus, zeroEvidenceRun }),
    [latestRun, loading, receiptStatus, workspace.brief, form.researchMode, zeroEvidenceRun]
  );
  const touchedRecords = useMemo(() => {
    if (!latestRun) return [];
    const startedAt = Date.parse(latestRun.startedAt);
    if (!Number.isFinite(startedAt)) return [];
    return currentCampaignLeads
      .map((lead) => {
        const createdAt = Date.parse(lead.createdAt);
        const updatedAt = Date.parse(lead.updatedAt);
        const createdDuringRun = Number.isFinite(createdAt) && createdAt >= startedAt;
        const updatedDuringRun = Number.isFinite(updatedAt) && updatedAt >= startedAt;
        const decisionStatus = lead.qualityDecision?.status;
        return {
          lead,
          touchedAt: Math.max(Number.isFinite(updatedAt) ? updatedAt : 0, Number.isFinite(createdAt) ? createdAt : 0),
          status: createdDuringRun
            ? decisionStatus === "good"
              ? "saved good lead"
              : "needs proof"
            : updatedDuringRun
              ? "updated duplicate"
              : null
        };
      })
      .filter((item): item is RecordTouchItem => Boolean(item.status))
      .sort((left, right) => right.touchedAt - left.touchedAt)
      .slice(0, 8);
  }, [currentCampaignLeads, latestRun]);
  const agentTimeline = workspace.agentRuns
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);
  const missingFields = missingBriefFields(form);
  const briefReady = missingFields.length === 0;
  const hasIssue = (field: RequiredField) => showFieldGuidance && missingFields.includes(field);
  const requiredChecks: Array<{ id: RequiredField; label: string }> = [
    { id: "service", label: "What you sell" },
    { id: "idealCustomers", label: "Who to find" },
    { id: "searchLocations", label: "Where to search" },
    { id: "leadGoal", label: "Lead count" },
    { id: "sources", label: "Search sources" }
  ];
  const recentHistory = [
    ...workspace.briefHistory.slice(0, 4).map((brief) => ({
      id: brief.id,
      type: "Brief",
      title: brief.service,
      detail: `${brief.researchMode ?? inferResearchMode(brief.leadGoal, brief.sources)} · ${brief.idealCustomers} · ${brief.searchLocations}`,
      at: brief.updatedAt
    })),
    ...workspace.runs.slice(0, 4).map((run) => ({
      id: run.id,
      type: run.runLabel ?? "Run",
      title: `Batch ${run.metrics?.batchNumber ?? 1}: ${run.found} good · ${run.needsReview} needs proof`,
      detail: run.metrics?.targetLeadGoal
        ? `Good ${run.metrics.campaignGoodCount ?? run.found} / ${run.metrics.targetLeadGoal} target · ${run.scenarioLabel ?? run.status}`
        : run.status,
      at: run.completedAt
    }))
  ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 6);
  const resultTabs: Array<{ id: ResultTab; label: string; count: number }> = [
    { id: "good", label: "Good", count: usableLeads.length },
    { id: "proof", label: "Needs proof", count: needsProofLeads.length || needsProofEvents.length }
  ];
  const leadTableRows = [...usableLeads, ...needsProofLeads].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const topMetrics = [
    { label: "Status", value: loading === "discover" ? "Searching" : ownerStatusLabel, tone: loading === "discover" ? "lime" : campaignGoodCount ? "lime" : latestRun ? "amber" : "teal" },
    { label: "Good / target", value: campaignProgressLabel, tone: campaignGoodCount ? "lime" : "neutral" },
    { label: "Needs proof", value: campaignNeedsProofCount || latestRun?.qualityCounts?.needsProof || needsProofEvents.length, tone: campaignNeedsProofCount ? "amber" : "neutral" },
    { label: "Searches", value: latestMetrics.searchesRun, tone: latestMetrics.searchesRun ? "teal" : "neutral" },
    { label: "Pages", value: latestMetrics.pagesFetched, tone: latestMetrics.pagesFetched ? "teal" : "neutral" },
    { label: "Cost", value: formatPreciseInr(latestRun?.cost?.costInr), tone: latestRun?.cost?.costInr ? "amber" : "neutral" }
  ] as const;
  const gateBreakdown = latestMetrics.qualityGateBreakdown ?? {};
  const gateBlockers = [
    ["Missing contact", gateBreakdown.missingContact],
    ["Weak fit", gateBreakdown.weakFit],
    ["Missing location", gateBreakdown.missingLocation],
    ["Directory only", gateBreakdown.directoryOnly],
    ["No evidence URL", gateBreakdown.missingEvidenceUrl],
    ["Blocked source", gateBreakdown.blockedSource],
    ["Rejected noise", gateBreakdown.rejectedNoise]
  ].filter((item): item is [string, number] => typeof item[1] === "number" && item[1] > 0);

  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {topMetrics.map((metric) => (
          <div key={metric.label} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
            <div className="mono text-[10px] uppercase text-[var(--muted)]">{metric.label}</div>
            <div className="mt-2 flex min-h-8 items-center justify-between gap-2">
              <div className="break-words text-xl font-semibold text-white">{metric.value}</div>
              <Badge tone={metric.tone}>{metric.label === "Status" ? "live" : "now"}</Badge>
            </div>
          </div>
        ))}
      </div>
      {!campaignGoodCount && gateBlockers.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100">
          <span className="mono uppercase">Good blockers</span>
          {gateBlockers.slice(0, 5).map(([label, count]) => (
            <Badge key={label} tone="amber">{label}: {count}</Badge>
          ))}
        </div>
      ) : null}

      <div data-testid="lead-magnet-leads-table" className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <DatabaseZap size={16} className="text-[var(--teal)]" />
              Leads table
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-2)]">
              Good leads stay first. Needs Proof stays visible until it is fixed or deleted.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="lime">{usableLeads.length} good</Badge>
            <Badge tone="amber">{needsProofLeads.length} proof</Badge>
          </div>
        </div>
        {leadTableRows.length ? (
          <div className="overflow-x-auto rounded-[8px] border border-[var(--line)] bg-white/[0.03]">
            <table className="min-w-[920px] w-full border-collapse text-left">
              <thead className="border-b border-[var(--line)] bg-black/20">
                <tr className="mono text-[10px] uppercase text-[var(--muted)]">
                  <th className="px-3 py-3 font-medium">Lead</th>
                  <th className="px-3 py-3 font-medium">Fit</th>
                  <th className="px-3 py-3 font-medium">Contact</th>
                  <th className="px-3 py-3 font-medium">Next action</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leadTableRows.map((lead) => (
                  <tr key={lead.id} className="border-b border-[var(--line)] last:border-b-0">
                    <td className="max-w-[260px] px-3 py-3 align-top">
                      <div className="truncate text-sm font-semibold text-white">{lead.businessName}</div>
                      <div className="mt-1 flex min-w-0 items-start gap-1 text-xs text-[var(--muted)]">
                        <MapPin size={12} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 break-words">{lead.city} · {lead.category}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={lead.qualityDecision?.status === "good" ? "lime" : "amber"}>
                          {lead.qualityDecision?.status === "good" ? "good" : "needs proof"}
                        </Badge>
                        <Badge tone={scoreTone(lead.score.overall)}>{lead.score.overall}</Badge>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-3 py-3 align-top text-xs leading-5 text-[var(--muted-2)]">
                      <div className="break-words">WhatsApp: <span className="text-white">{lead.whatsapp ?? lead.phone ?? "not found"}</span></div>
                      <div className="break-words">Email: <span className="text-white">{lead.email ?? "not found"}</span></div>
                    </td>
                    <td className="max-w-[300px] px-3 py-3 align-top">
                      <p className="line-clamp-2 break-words text-xs leading-5 text-[var(--muted-2)]">{lead.nextAction}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="grid min-w-[220px] gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => openLeadView(lead)}
                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-2 text-xs font-medium text-white hover:border-[var(--line-strong)] ${buttonMotion}`}
                        >
                          <Bot size={13} />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => startLeadEdit(lead)}
                          disabled={busy}
                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-2 text-xs font-medium text-teal-100 hover:bg-teal-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                        >
                          <Pencil size={13} />
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLead(lead.id)}
                          disabled={busy}
                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-2 text-xs font-medium text-rose-100 hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Radar}
            title="No leads saved yet"
            detail="Search public sources or import a small real list. Saved leads will stay at the top of this page."
          />
        )}
      </div>

      <div className="min-w-0 space-y-4 overflow-x-hidden">
        <form
          id="lead-brief-form"
          data-testid="lead-brief-form"
          action="/api/lead-magnet/brief/form"
          method="post"
          onSubmit={handleBriefFormSubmit}
          className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mono text-[11px] uppercase text-[var(--teal)]">Search tool</div>
              <h3 className="mt-1 text-lg font-semibold text-white">Tell AI what leads to find</h3>
            </div>
	            <div className="flex flex-wrap justify-end gap-2">
	              <Badge tone="lime">real actions</Badge>
	              <Badge tone={formHasUnsavedChanges ? "amber" : briefReady ? "teal" : "amber"}>
	                {formHasUnsavedChanges ? "unsaved changes" : briefReady ? "ready" : "needs brief"}
	              </Badge>
	            </div>
          </div>

          <div className="mt-4 grid max-h-40 gap-2 overflow-y-auto overflow-x-hidden rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3 sm:grid-cols-2 lg:grid-cols-5">
            {requiredChecks.map((item) => {
              const done = !missingFields.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 rounded-[6px] px-2 py-2 text-xs ${
                    done ? "bg-teal-300/10 text-teal-100" : "bg-white/[0.03] text-[var(--muted-2)]"
                  }`}
                >
                  {done ? <Check size={14} /> : <AlertCircle size={14} className={hasIssue(item.id) ? "text-amber-200" : ""} />}
                  <span className="min-w-0 break-words">{item.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2">
              <span className="mono text-[10px] uppercase text-[var(--muted)]">What do you sell?</span>
              <input
                ref={serviceRef}
                name="service"
                value={form.service}
                onChange={(event) => updateForm({ service: event.target.value })}
                placeholder="Example: content marketing, reels, social media management"
                aria-invalid={hasIssue("service")}
                className={`h-11 px-3 ${fieldBase} ${
                  hasIssue("service") ? "border-amber-300/55 shadow-[0_0_0_3px_rgba(246,182,75,0.1)]" : "border-[var(--line)]"
                }`}
              />
            </label>
            <label className="grid gap-2">
              <span className="mono text-[10px] uppercase text-[var(--muted)]">Your website (optional)</span>
              <input
                name="ownerWebsiteUrl"
                value={form.ownerWebsiteUrl}
                onChange={(event) => updateForm({ ownerWebsiteUrl: event.target.value })}
                placeholder="https://your-business.com"
                className={`h-11 border-[var(--line)] px-3 ${fieldBase}`}
              />
            </label>
            <label className="grid gap-2">
              <span className="mono text-[10px] uppercase text-[var(--muted)]">Who should we find?</span>
              <textarea
                ref={idealCustomersRef}
                name="idealCustomers"
                value={form.idealCustomers}
                onChange={(event) => updateForm({ idealCustomers: event.target.value })}
                placeholder="Example: local shops, clinics, coaching centers, real estate builders that need better Instagram"
                rows={3}
                aria-invalid={hasIssue("idealCustomers")}
                className={`resize-none p-3 leading-6 ${fieldBase} ${
                  hasIssue("idealCustomers") ? "border-amber-300/55 shadow-[0_0_0_3px_rgba(246,182,75,0.1)]" : "border-[var(--line)]"
                }`}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-[1fr_132px]">
              <label className="grid gap-2">
                <span className="mono text-[10px] uppercase text-[var(--muted)]">Where should we search?</span>
                <input
                  ref={searchLocationsRef}
                  name="searchLocations"
                  value={form.searchLocations}
                  onChange={(event) => updateForm({ searchLocations: event.target.value })}
                  placeholder="Example: Barasat, Kolkata, North 24 Parganas"
                  aria-invalid={hasIssue("searchLocations")}
                  className={`h-11 px-3 ${fieldBase} ${
                    hasIssue("searchLocations") ? "border-amber-300/55 shadow-[0_0_0_3px_rgba(246,182,75,0.1)]" : "border-[var(--line)]"
                  }`}
                />
              </label>
              <label className="grid gap-2">
                <span className="mono text-[10px] uppercase text-[var(--muted)]">How many?</span>
                <input
                  ref={leadGoalRef}
                  name="leadGoal"
	                  type="number"
	                  min={1}
	                  max={LEAD_MAGNET_MAX_LEAD_GOAL}
                  value={form.leadGoal}
                  onChange={(event) => updateForm({ leadGoal: Number(event.target.value) })}
                  aria-invalid={hasIssue("leadGoal")}
                  className={`h-11 px-3 ${fieldBase} ${
                    hasIssue("leadGoal") ? "border-amber-300/55 shadow-[0_0_0_3px_rgba(246,182,75,0.1)]" : "border-[var(--line)]"
                  }`}
                />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="mono text-[10px] uppercase text-[var(--muted)]">Who should AI avoid?</span>
              <input
                name="excludedLeads"
                value={form.excludedLeads}
                onChange={(event) => updateForm({ excludedLeads: event.target.value })}
                placeholder="Example: agencies, already famous brands, businesses outside Kolkata"
                className={`h-11 border-[var(--line)] px-3 ${fieldBase}`}
              />
            </label>
          </div>

          <div className="mt-4 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mono text-[10px] uppercase text-[var(--muted)]">Research depth</div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-2)]">
                  Broad research needs more source sweeps and may take longer. It is meant for big markets, not tiny city lists.
                </p>
              </div>
              <Badge tone={form.researchMode === "broad" ? "lime" : "teal"}>
                {form.researchMode === "broad" ? "broad mode" : "focused mode"}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {[
                ["broad", "Broad OSINT sweep", "More searches, more public pages, larger candidate pool."],
                ["focused", "Focused local search", "Faster search for one niche, one city, or a small list."]
              ].map(([value, label, detail]) => (
                <label key={value} className={`relative cursor-pointer ${buttonMotion}`}>
                  <input
                    type="radio"
                    name="researchMode"
                    value={value}
                    checked={form.researchMode === value}
                    onChange={() => selectResearchMode(value as LeadResearchMode)}
                    className="peer sr-only"
                  />
                  <span
                    className={`block rounded-[6px] border p-3 transition-all duration-150 peer-checked:border-teal-300/45 peer-checked:bg-teal-300/[0.12] ${
                      form.researchMode === value
                        ? "border-teal-300/45 bg-teal-300/[0.12]"
                        : "border-[var(--line)] bg-black/20 hover:border-[var(--line-strong)]"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-white">
                      {form.researchMode === value ? <Check size={15} /> : <Search size={15} className="text-[var(--muted)]" />}
                      {label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted-2)]">{detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

	          {campaignGoodCount ? (
	            <div className="mt-4 grid gap-2 md:grid-cols-2">
	              {[
	                ["draft-only", "Draft messages only"],
	                ["follow-up-plan", "Draft + follow-up plan"]
	              ].map(([value, label]) => (
	                <label
	                  key={value}
	                  data-testid={`ai-action-${value}`}
	                  aria-pressed={form.aiAction === value}
	                  className={`relative cursor-pointer ${buttonMotion}`}
	                >
	                  <input
	                    type="radio"
	                    name="aiAction"
	                    value={value}
	                    checked={form.aiAction === value}
	                    onChange={() => selectAiAction(value as BriefForm["aiAction"])}
	                    className="peer sr-only"
	                  />
	                  <span
	                    className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border text-sm transition-all duration-150 peer-checked:border-teal-300/50 peer-checked:bg-teal-300/[0.14] peer-checked:text-teal-100 peer-checked:shadow-[0_0_22px_rgba(32,230,190,0.12)] ${
	                    form.aiAction === value
	                      ? "border-teal-300/50 bg-teal-300/[0.14] text-teal-100 shadow-[0_0_22px_rgba(32,230,190,0.12)]"
	                      : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
	                  }`}
	                  >
	                    {form.aiAction === value ? <Check size={15} /> : <Sparkles size={15} />}
	                    {label}
	                  </span>
	                </label>
	              ))}
	            </div>
	          ) : null}

          {error ? <div className="mt-4 rounded-[6px] border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</div> : null}
          {notice ? (
            <div className="mt-4 flex items-start gap-2 rounded-[6px] border border-teal-300/25 bg-teal-300/10 p-3 text-sm text-teal-100">
              <Check size={15} className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          ) : null}

	          <div className="mt-4 grid gap-3 md:grid-cols-2">
	            <button
	              type="submit"
	              data-testid="run-discovery-button"
	              name="intent"
	              value="discover"
	              disabled={busy}
	              className={`inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border text-sm font-medium disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion} ${
	                briefReady
	                  ? "border-teal-300/30 bg-teal-300/[0.12] text-teal-100 hover:bg-teal-300/[0.18]"
	                  : "border-amber-300/25 bg-amber-300/[0.08] text-amber-100 hover:border-amber-300/40"
	              }`}
	            >
	              {loading === "discover" ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}
	              {loading === "discover" ? "Searching..." : "Search"}
	            </button>
	            <button
	              type="button"
	              data-testid="stop-search-button"
	              onClick={stopSearch}
	              disabled={!activeSearchSession || ["completed", "stopped", "failed", "stale"].includes(activeSearchSession.status)}
	              className={`inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border border-rose-300/25 bg-rose-300/[0.08] text-sm font-medium text-rose-100 disabled:cursor-not-allowed disabled:opacity-45 ${buttonMotion}`}
	            >
	              <X size={16} />
	              Stop search
	            </button>
	          </div>
	        </form>

	        {agentQuestions.length ? (
	          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
	            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[8px] border border-[var(--line)] bg-[#08110f] p-4 shadow-2xl">
	              <div className="flex items-start justify-between gap-3">
	                <div>
	                  <div className="mono text-[11px] uppercase text-[var(--teal)]">AI needs input</div>
	                  <h3 className="mt-1 text-lg font-semibold text-white">Choose the search defaults</h3>
	                  <p className="mt-1 text-sm leading-6 text-[var(--muted-2)]">
	                    Leadsy will use these answers to avoid wasting public searches. Recommended options are already selected.
	                  </p>
	                </div>
	                <button
	                  type="button"
	                  onClick={() => setAgentQuestions([])}
	                  className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--line)] text-[var(--muted-2)] hover:text-white"
	                  aria-label="Close questions"
	                >
	                  <X size={16} />
	                </button>
	              </div>
	              <div className="mt-4 grid gap-4">
	                {agentQuestions.map((question) => (
	                  <div key={question.id} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
	                    <div className="text-sm font-semibold text-white">{question.prompt}</div>
	                    <p className="mt-1 text-xs leading-5 text-[var(--muted-2)]">{question.reason}</p>
	                    <div className="mt-3 grid gap-2">
	                      {question.options.map((option) => {
	                        const checked = (questionAnswers[question.id] ?? question.defaultOptionId) === option.id;
	                        return (
	                          <label
	                            key={option.id}
	                            className={`cursor-pointer rounded-[6px] border p-3 transition-all ${
	                              checked ? "border-teal-300/45 bg-teal-300/[0.12]" : "border-[var(--line)] bg-black/20 hover:border-[var(--line-strong)]"
	                            }`}
	                          >
	                            <input
	                              type="radio"
	                              name={question.id}
	                              checked={checked}
	                              onChange={() => setQuestionAnswers((current) => ({ ...current, [question.id]: option.id }))}
	                              className="sr-only"
	                            />
	                            <span className="flex items-center justify-between gap-3">
	                              <span className="text-sm font-medium text-white">{option.label}</span>
	                              {option.recommended ? <Badge tone="lime">recommended</Badge> : null}
	                            </span>
	                            <span className="mt-1 block text-xs leading-5 text-[var(--muted-2)]">{option.description}</span>
	                          </label>
	                        );
	                      })}
	                    </div>
	                  </div>
	                ))}
	              </div>
	              <div className="mt-4 flex flex-wrap justify-end gap-2">
	                <button
	                  type="button"
	                  onClick={() => setAgentQuestions([])}
	                  className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--line)] px-4 text-sm font-medium text-[var(--muted-2)] hover:text-white"
	                >
	                  Cancel
	                </button>
	                <button
	                  type="button"
	                  onClick={answerAgentQuestions}
	                  disabled={loading === "discover"}
	                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:opacity-55"
	                >
	                  {loading === "discover" ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
	                  Start search
	                </button>
	              </div>
	            </div>
	          </div>
	        ) : null}

	        {planPreview ? (
          <details className="rounded-[8px] border border-lime-300/25 bg-lime-300/[0.06] p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FileSearch size={16} className="text-lime-200" />
                  Agent plan
                </div>
                <Badge tone="lime">{planPreview.estimatedSearches} searches</Badge>
              </div>
            </summary>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mono mt-4 text-[11px] uppercase text-lime-200">Search plan</div>
                <h3 className="mt-1 text-lg font-semibold text-white">Buyer lanes Leadsy will try first</h3>
	                <p className="mt-1 text-sm leading-6 text-[var(--muted-2)]">
		                  {planPreview.spendGuard.mode === "full" ? "Full campaign" : "Protected mode"} cap {formatPreciseInr(planPreview.spendGuard.capInr)}. Good {planPreview.existingGoodCount ?? 0} / {planPreview.targetLeadGoal ?? form.leadGoal} target; this batch will save up to {planPreview.batchSize ?? form.leadGoal}.
	                </p>
	              </div>
	              <div className="flex flex-wrap justify-end gap-2">
	                {planPreview.audienceModes?.slice(0, 3).map((mode) => (
	                  <Badge key={mode} tone="neutral">{audienceModeLabels[mode]}</Badge>
	                ))}
	                <Badge tone="lime">{planPreview.estimatedSearches} searches</Badge>
	                <Badge tone="teal">batch {planPreview.batchNumber ?? 1}</Badge>
	              </div>
            </div>
            <div className="mt-3 grid max-h-[340px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
              {planPreview.lanes.slice(0, 6).map((lane) => (
                <div key={lane.id} className="rounded-[7px] border border-[var(--line)] bg-black/25 p-3">
                  <div className="break-words text-sm font-semibold text-white">{lane.label}</div>
                  <div className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">{lane.why}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lane.sourceTypes.slice(0, 3).map((source) => (
                      <Badge key={source} tone="neutral">{sourceLabels[source]}</Badge>
                    ))}
                    {lane.sourceTypes.length > 3 ? <Badge tone="neutral">+{lane.sourceTypes.length - 3} sources</Badge> : null}
                    {lane.audienceMode ? <Badge tone="lime">{audienceModeLabels[lane.audienceMode]}</Badge> : null}
                    <Badge tone="teal">{lane.expectedEvidence[1]}</Badge>
                  </div>
                  {lane.searches?.length ? (
                    <div className="mt-2 grid gap-1">
                      {lane.searches.slice(0, 3).map((search, index) => (
                        <div key={`${search.sourceType}-${index}`} className="break-words text-[11px] leading-5 text-[var(--muted)]">
                          {sourceLabels[search.sourceType]}: {search.query}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <details className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Globe2 size={16} className="text-[var(--teal)]" />
                Research source settings
              </div>
              <Badge tone="neutral">{form.sources.length} active</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted-2)]">
              Default is already set to free public research. Open this only when you want to change where Leadsy searches.
            </p>
          </summary>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Globe2 size={16} className="text-[var(--teal)]" />
                Free public research sources
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--muted-2)]">
                Free source mode: public web only. No ShadowDragon, no paid data brokers, no hidden scraping, no logins,
                no private profiles, no CAPTCHA bypass, no invented contacts.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="lime">free public sources</Badge>
                <Badge tone="teal">transparent research</Badge>
                <Badge tone="amber">AI drafts only</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                data-testid="full-free-search-button"
                form="lead-brief-form"
                name="sourcePreset"
                value="full"
                formAction="/api/lead-magnet/brief/form"
                onClick={() => selectSources(fullOsintSources, "Full free search", "broad")}
                className={`h-8 rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-3 text-xs font-medium text-teal-100 hover:bg-teal-300/15 ${buttonMotion}`}
              >
                Full free search
              </button>
              <button
                type="submit"
                data-testid="light-search-button"
                form="lead-brief-form"
                name="sourcePreset"
                value="light"
                formAction="/api/lead-magnet/brief/form"
                onClick={() => selectSources(["openrouter-web-search", "browser-public-page", "manual-import"], "Light search", "focused")}
                className={`h-8 rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 text-xs font-medium text-white hover:border-[var(--line-strong)] ${buttonMotion}`}
              >
                Light search
              </button>
            </div>
          </div>
          <div className="mt-3 grid max-h-[520px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
            {sourceOptions.map((source) => {
              const ready = workspace?.sourceHealth ? sourceReady(source, workspace.sourceHealth) : false;
              const checked = form.sources.includes(source.id);
              return (
                <label
                  key={source.id}
                  className={`group flex min-w-0 cursor-pointer items-start gap-3 rounded-[8px] border p-3 ${buttonMotion} ${
                    checked
                      ? "border-teal-300/35 bg-teal-300/10 shadow-[0_0_24px_rgba(32,230,190,0.08)]"
                      : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    form="lead-brief-form"
                    name="sources"
                    value={source.id}
                    checked={checked}
                    onChange={() => toggleSource(source.id)}
                    className="mt-1 size-4 accent-teal-300"
                  />
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150 ${
                      checked
                        ? "border-teal-300/45 bg-teal-300 text-black"
                        : "border-[var(--line-strong)] bg-black/20 group-hover:border-teal-300/35"
                    }`}
                  >
                    {checked ? <Check size={14} strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                      {source.label}
                      <Badge tone="lime">{source.modeLabel}</Badge>
                      <Badge tone={ready ? "teal" : "amber"}>{ready ? "ready" : "connect"}</Badge>
                    </span>
                    <span className="mt-1 block break-words text-xs leading-5 text-[var(--muted-2)]">{source.detail}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </details>

        <details className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Upload size={16} className="text-[var(--teal)]" />
              Import existing leads
            </div>
          </summary>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={5}
            placeholder={"One business per line. Example:\nABC Clinic, Barasat, +91..., https://abcclinic.com"}
            className="mt-3 w-full resize-none rounded-[6px] border border-[var(--line)] bg-white/[0.04] p-3 text-sm leading-6 text-white outline-none focus:border-teal-300/45"
          />
          <button
            type="button"
            onClick={importLeads}
            disabled={busy}
            className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.04] text-sm font-medium text-white hover:border-[var(--line-strong)] disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
          >
            {loading === "import" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {loading === "import" ? "Importing..." : "Import and score"}
          </button>
        </details>
      </div>

      <div className="min-w-0 space-y-4 overflow-x-hidden">
        <div className="hidden rounded-[8px] border border-[var(--line)] bg-black/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mono text-[11px] uppercase text-[var(--teal)]">Owner summary</div>
              <h3 className="mt-1 break-words text-2xl font-semibold text-white">{ownerHeadline}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-2)]">{ownerSummary}</p>
              {ownerWhy ? (
                <div className="mt-3 rounded-[6px] border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
                  Why: {ownerWhy}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge tone={latestRun?.runLabel === "Worst Case" ? "rose" : latestRun?.runLabel === "QA Scenario" ? "amber" : "teal"}>
                {latestRun?.runLabel ?? "Live Campaign"}
              </Badge>
              {latestRun?.scenarioLabel ? <Badge tone="neutral">{latestRun.scenarioLabel}</Badge> : null}
              <Badge tone={campaignGoodCount ? "lime" : latestRun || campaignNeedsProofCount ? "amber" : "teal"}>
                {ownerStatusLabel}
              </Badge>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {ownerNextActions.slice(0, 3).map((action, index) => (
              <div key={`${action}-${index}`} className="rounded-[6px] border border-teal-300/20 bg-teal-300/[0.07] p-3 text-sm text-teal-50">
                {action}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileSearch size={16} className="text-[var(--teal)]" />
              Live transcript
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTranscriptMode("simple")}
                className={`h-8 rounded-[6px] border px-3 text-xs font-medium ${buttonMotion} ${
                  transcriptMode === "simple"
                    ? "border-teal-300/35 bg-teal-300/10 text-teal-100"
                    : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)]"
                }`}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setTranscriptMode("technical")}
                className={`h-8 rounded-[6px] border px-3 text-xs font-medium ${buttonMotion} ${
                  transcriptMode === "technical"
                    ? "border-teal-300/35 bg-teal-300/10 text-teal-100"
                    : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)]"
                }`}
              >
                Technical
              </button>
              <Badge tone={loading === "discover" || loading === "import" || loading === "save" ? "lime" : "teal"}>
                {loading === "discover" || loading === "import" || loading === "save" ? "running" : "newest first"}
              </Badge>
            </div>
          </div>
          <div className="mt-3 grid max-h-[460px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
            {displayEvents.length ? (
              displayEvents.map((event) => (
                <div key={event.id} className="flex min-w-0 gap-3 rounded-[7px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[6px] border ${
                      event.status === "running"
                        ? "border-lime-300/25 bg-lime-300/10 text-lime-200"
                        : event.status === "failed" || event.status === "rejected"
                          ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
                          : event.status === "needs-proof" || event.status === "deferred"
                            ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                            : "border-teal-300/25 bg-teal-300/10 text-teal-200"
                    }`}
                  >
                    {event.status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 break-words text-sm font-semibold text-white">{eventVerb(event)}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-[var(--muted)]">{timeLabel(event.createdAt)}</span>
                        <Badge tone={qualityTone(event.status)}>{statusLabel(event.status)}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">
                      {transcriptMode === "simple" ? event.summary : event.technicalDetail || event.summary}
                    </p>
                    {transcriptMode === "technical" ? (
                      <div className="mt-2 grid gap-1 text-[11px] text-[var(--muted)]">
                        {event.sourceType ? <span>Source: {sourceLabels[event.sourceType]}</span> : null}
                        {event.businessName ? <span>Lead: {event.businessName}</span> : null}
                        {event.query ? <span className="break-words">Query: {event.query}</span> : null}
                        {event.url ? <span className="break-all">URL: {event.url}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              researchFeed.map((item) => (
                <div key={item.id} className="flex min-w-0 gap-3 rounded-[7px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[6px] border ${
                      item.status === "running"
                        ? "border-lime-300/25 bg-lime-300/10 text-lime-200"
                        : item.status === "failed"
                          ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
                          : item.status === "needs-source"
                            ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                            : "border-teal-300/25 bg-teal-300/10 text-teal-200"
                    }`}
                  >
                    {item.status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 break-words text-sm font-semibold text-white">{item.title}</div>
                      <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                    </div>
                    <p className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">{item.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="hidden grid gap-3 sm:grid-cols-4">
	          {[
	            ["Good / target", campaignProgressLabel],
	            ["Needs proof", campaignNeedsProofCount || latestRun?.qualityCounts?.needsProof || needsProofEvents.length],
	            ["Money spent", formatPreciseInr(latestRun?.cost?.costInr)],
	            ["Batch", latestMetrics.targetLeadGoal && latestMetrics.targetLeadGoal > 100 ? `${latestMetrics.batchNumber ?? 1} · ${latestMetrics.batchSize ?? 0}${latestMetrics.campaignBatchCount ? ` · ${latestMetrics.campaignBatchCount} kept` : ""}` : latestRun?.outcome?.status ?? (loading === "discover" ? "running" : "ready")]
	          ].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
              <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
              <div className="mt-2 break-words text-2xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
        {latestMetrics.sourceExhaustedReason ? (
          <div className="hidden rounded-[8px] border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            Campaign stop reason: {latestMetrics.sourceExhaustedReason.replace(/-/g, " ")}
          </div>
        ) : null}

	        <div className="hidden grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
	          {[
	            ["Searches run", latestMetrics.searchesRun],
	            ["Pages checked", latestMetrics.pagesFetched],
	            ["Usable prospects", latestMetrics.usableProspects ?? latestRun?.found ?? 0],
	            ["Needs proof", campaignNeedsProofCount || latestRun?.qualityCounts?.needsProof || 0],
	            ["Discarded noise", latestMetrics.rawResultsDiscarded ?? 0],
	            ["Blocked/rejected", latestRun?.blocked ?? latestMetrics.rejectedCount ?? 0]
	          ].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-teal-300/20 bg-teal-300/[0.06] p-3">
              <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
              <div className="mt-2 text-xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <details className="hidden rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileSearch size={16} className="text-[var(--teal)]" />
                Research details
              </div>
              <Badge tone="neutral">open only if needed</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted-2)]">
              The workspace summary above is the main answer. Open this for the OSINT receipt, tool log, and agent activity.
            </p>
          </summary>
          <div className="mt-4 grid gap-4">
        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileSearch size={16} className="text-[var(--teal)]" />
              Live research transcript
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTranscriptMode("simple")}
                className={`h-8 rounded-[6px] border px-3 text-xs font-medium ${buttonMotion} ${
                  transcriptMode === "simple"
                    ? "border-teal-300/35 bg-teal-300/10 text-teal-100"
                    : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)]"
                }`}
              >
                Simple timeline
              </button>
              <button
                type="button"
                onClick={() => setTranscriptMode("technical")}
                className={`h-8 rounded-[6px] border px-3 text-xs font-medium ${buttonMotion} ${
                  transcriptMode === "technical"
                    ? "border-teal-300/35 bg-teal-300/10 text-teal-100"
                    : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)]"
                }`}
              >
                Technical OSINT log
              </button>
              <Badge tone={loading === "discover" || loading === "import" || loading === "save" ? "lime" : "teal"}>
                {loading === "discover" || loading === "import" || loading === "save" ? "running" : "newest first"}
              </Badge>
            </div>
          </div>
          <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
            {displayEvents.length ? (
              displayEvents.map((event) => (
                <div key={event.id} className="flex min-w-0 gap-3 rounded-[7px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[6px] border ${
                      event.status === "running"
                        ? "border-lime-300/25 bg-lime-300/10 text-lime-200"
                        : event.status === "failed" || event.status === "rejected"
                          ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
                        : event.status === "needs-proof" || event.status === "deferred"
                            ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                            : "border-teal-300/25 bg-teal-300/10 text-teal-200"
                    }`}
                  >
                    {event.status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 break-words text-sm font-semibold text-white">{eventVerb(event)}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-[var(--muted)]">{timeLabel(event.createdAt)}</span>
                        <Badge tone={qualityTone(event.status)}>{statusLabel(event.status)}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">
                      {transcriptMode === "simple" ? event.summary : event.technicalDetail || event.summary}
                    </p>
                    {transcriptMode === "technical" ? (
                      <div className="mt-2 grid gap-1 text-[11px] text-[var(--muted)]">
                        {event.sourceType ? <span>Source: {sourceLabels[event.sourceType]}</span> : null}
                        {event.provider ? <span>Provider: {event.provider}</span> : null}
                        {event.businessName ? <span>Business: {event.businessName}</span> : null}
                        {event.location ? <span>Location: {event.location}</span> : null}
                        {event.query ? <span className="break-words">Query: {event.query}</span> : null}
                        {event.url ? <span className="break-all">URL: {event.url}</span> : null}
                        {event.rejectionReason ? <span>Reason: {event.rejectionReason}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              researchFeed.map((item) => (
                <div key={item.id} className="flex min-w-0 gap-3 rounded-[7px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[6px] border ${
                      item.status === "running"
                        ? "border-lime-300/25 bg-lime-300/10 text-lime-200"
                        : item.status === "failed"
                          ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
                          : item.status === "needs-source"
                            ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                            : "border-teal-300/25 bg-teal-300/10 text-teal-200"
                    }`}
                  >
                    {item.status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 break-words text-sm font-semibold text-white">{item.title}</div>
                      <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                    </div>
                    <p className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">{item.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Search size={16} className="text-[var(--teal)]" />
              OSINT receipt
            </div>
            <Badge tone={statusTone(receiptStatus)}>{statusLabel(receiptStatus)}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
            {receiptMessage
              ? receiptMessage
              : "No research run has started yet. After you click Save + find real leads, this receipt will show what was checked, what came back, and what was blocked."}
          </p>
	          <div className="mt-3 grid gap-2 sm:grid-cols-5">
	            {[
	              ["Searches run", latestMetrics.searchesRun],
	              ["Pages checked", latestMetrics.pagesFetched],
	              ["Candidates", latestMetrics.candidateCount],
	              ["Unique pool", latestMetrics.dedupedCount],
	              ["Saved records", latestMetrics.savedCount]
	            ].map(([label, value]) => (
              <div key={label} className="rounded-[6px] border border-teal-300/20 bg-teal-300/[0.06] p-2">
                <div className="text-sm font-semibold text-white">{value}</div>
                <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-[6px] border border-amber-300/20 bg-amber-300/[0.07] p-2">
              <div className="text-sm font-semibold text-white">{formatPreciseInr(latestRun?.cost?.costInr)}</div>
              <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">AI credit burned</div>
            </div>
            <div className="rounded-[6px] border border-amber-300/20 bg-amber-300/[0.07] p-2">
              <div className="text-sm font-semibold text-white">
                {formatPreciseInr(latestRun?.cost?.costInr && latestMetrics.savedCount ? latestRun.cost.costInr / latestMetrics.savedCount : 0)}
              </div>
              <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">Cost per saved lead</div>
            </div>
            <div className="rounded-[6px] border border-[var(--line)] bg-white/[0.03] p-2">
              <div className="text-sm font-semibold text-white">
                {latestRun?.cost ? `${latestRun.cost.fx.rate.toFixed(4)} USD-INR` : "not used yet"}
              </div>
              <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">
                FX source {latestRun?.cost?.fx.source ?? "waiting"}
              </div>
            </div>
          </div>
	          <div className="mt-3 grid gap-2 sm:grid-cols-4">
	            {[
	              ["Usable prospects", latestMetrics.usableProspects ?? latestRun?.found ?? 0],
	              ["Proper data", latestMetrics.properDataCount ?? latestRun?.found ?? 0],
	              ["Missing contact", latestMetrics.missingContactCount ?? 0],
	              ["Discarded noise", latestMetrics.rawResultsDiscarded ?? 0]
	            ].map(([label, value]) => (
	              <div key={label} className="rounded-[6px] border border-[var(--line)] bg-white/[0.03] p-2">
	                <div className="text-sm font-semibold text-white">{value}</div>
	                <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">{label}</div>
	              </div>
	            ))}
	          </div>
		          <div className="mt-3 grid gap-2 sm:grid-cols-4">
		            {[
		              ["Qualified", latestRun?.qualified ?? 0],
	              ["Needs proof", latestRun?.needsReview ?? 0],
	              ["Blocked/rejected", latestRun?.blocked ?? latestMetrics.rejectedCount ?? 0],
	              ["Recovered OSINT", latestMetrics.alternateSourceRecovered ?? 0]
	            ].map(([label, value]) => (
	              <div key={label} className="rounded-[6px] border border-[var(--line)] bg-white/[0.03] p-2">
	                <div className="text-sm font-semibold text-white">{value}</div>
	                <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">{label}</div>
		              </div>
		            ))}
		          </div>
          {sourceBreakdown.length ? (
            <div className="mt-3 rounded-[6px] border border-[var(--line)] bg-white/[0.03] p-3">
              <div className="mono text-[10px] uppercase text-[var(--muted)]">Source breakdown</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {sourceBreakdown.map(([source, metrics]) => (
                  <div key={source} className="rounded-[6px] border border-teal-300/15 bg-teal-300/[0.05] p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-white">{sourceLabels[source]}</div>
                      <Badge tone={(metrics.usableProspects ?? 0) > 0 ? "lime" : (metrics.needsProof ?? 0) > 0 ? "amber" : "neutral"}>
                        {metrics.usableProspects ?? 0} good
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-[var(--muted-2)]">
                      <span>{metrics.searchesRun} searches</span>
                      <span>{metrics.candidateCount} candidates</span>
                      <span>{metrics.pagesFetched} pages</span>
                      <span>{metrics.needsProof ?? 0} proof</span>
                      <span>{metrics.rawResultsDiscarded ?? 0} noise</span>
                      <span>{metrics.sourceDeferred ?? 0} deferred</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="mono text-[10px] uppercase text-[var(--muted)]">Asked to check</div>
              <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto overflow-x-hidden pr-1">
                {(latestRun?.sourcesRequested ?? form.sources).map((source) => (
                  <Badge key={source} tone="neutral">{sourceLabels[source]}</Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase text-[var(--muted)]">Returned evidence</div>
              <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto overflow-x-hidden pr-1">
                {latestRun?.sourcesUsed.length ? (
                  latestRun.sourcesUsed.map((source) => <Badge key={source} tone="teal">{sourceLabels[source]}</Badge>)
                ) : (
                  <Badge tone="amber">{latestRun ? "no usable source yet" : "waiting for first run"}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted-2)]">
            {latestRun ? (
              <>
                <span className="inline-flex items-center gap-1"><Timer size={13} /> Started {timeLabel(latestRun.startedAt)}</span>
                <span>Completed {timeLabel(latestRun.completedAt)}</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1"><Timer size={13} /> No run started yet</span>
            )}
          </div>
          <div className="mt-3 rounded-[6px] border border-teal-300/20 bg-teal-300/10 p-3 text-xs leading-5 text-teal-100">
            Public sources only. No private profiles, no paid data brokers, no login bypass, no CAPTCHA bypass, no invented contacts.
          </div>
          {connectionMessages.length ? (
            <div className="mt-3 grid max-h-[220px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
              {connectionMessages.map((message, index) => (
                <div key={`${message}-${index}`} className="rounded-[6px] border border-amber-300/20 bg-amber-300/10 p-2 text-xs text-amber-100">
                  {message}
                </div>
              ))}
            </div>
          ) : zeroEvidenceRun ? (
            <div className="mt-3 grid max-h-[220px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
              <div className="rounded-[6px] border border-amber-300/20 bg-amber-300/10 p-2 text-xs text-amber-100">
                Leadsy public collectors completed, but returned 0 businesses with usable public source evidence. Leadsy refused to invent leads or contacts.
              </div>
              <div className="rounded-[6px] border border-amber-300/20 bg-amber-300/10 p-2 text-xs text-amber-100">
                For broad research, the run can still be useful because the receipt shows how many searches, pages, and candidates were checked.
              </div>
            </div>
          ) : !workspace.sourceHealth.publicSearch ? (
            <div className="mt-3 rounded-[6px] border border-amber-300/20 bg-amber-300/10 p-2 text-xs text-amber-100">
              Public search is unavailable in this environment, so live collection cannot run until it is restored.
            </div>
          ) : null}
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <DatabaseZap size={16} className="text-[var(--teal)]" />
              Records added / updated
            </div>
            <Badge tone={touchedRecords.length ? "teal" : "amber"}>{touchedRecords.length}</Badge>
          </div>
          {touchedRecords.length ? (
            <div className="mt-3 grid max-h-[360px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
              {touchedRecords.map(({ lead, status }) => (
                <div
                  key={`${lead.id}-${status}`}
                  className="min-w-0 rounded-[7px] border border-[var(--line)] bg-white/[0.03] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{lead.businessName}</div>
                      <div className="mt-1 break-words text-xs text-[var(--muted-2)]">{lead.city} · {lead.evidence.length} evidence source{lead.evidence.length === 1 ? "" : "s"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={status === "saved good lead" ? "lime" : status === "needs proof" ? "amber" : "teal"}>{status}</Badge>
                      <Badge tone={scoreTone(lead.score.overall)}>{lead.score.overall}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lead.sourceTypes.slice(0, 4).map((source) => <Badge key={source} tone="neutral">{sourceLabels[source]}</Badge>)}
                  </div>
                  <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-[var(--muted-2)]">{lead.nextAction}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => openLeadView(lead)}
                      className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-2 text-xs font-medium text-white hover:border-[var(--line-strong)] ${buttonMotion}`}
                    >
                      <Bot size={13} />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => startLeadEdit(lead)}
                      disabled={busy}
                      className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-2 text-xs font-medium text-teal-100 hover:bg-teal-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                    >
                      <Pencil size={13} />
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLead(lead.id)}
                      disabled={busy}
                      className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-2 text-xs font-medium text-rose-100 hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">
              Run discovery or import a list. New and updated records will appear here with their source trail.
            </p>
          )}
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={16} className="text-amber-200" />
              Needs proof / rejected
            </div>
            <Badge tone={qualityEvents.length ? "amber" : "teal"}>{qualityEvents.length}</Badge>
          </div>
          {qualityEvents.length ? (
            <div className="mt-3 grid max-h-[360px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
              {qualityEvents.map((event) => (
                <div key={event.id} className="min-w-0 rounded-[7px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-semibold text-white">{event.businessName ?? event.title}</div>
                      <div className="mt-1 break-words text-xs text-[var(--muted-2)]">{event.summary}</div>
                    </div>
                    <Badge tone={qualityTone(event.status)}>{event.type === "updated-duplicate" ? "updated duplicate" : statusLabel(event.status)}</Badge>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
                    {event.location ? <span>Location: {event.location}</span> : null}
                    {event.rejectionReason ? <span>Reason: {event.rejectionReason}</span> : null}
                    {event.url ? <span className="break-all">Source: {event.url}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">
              Weak or rejected candidates will appear here instead of polluting the good-lead list.
            </p>
          )}
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bot size={16} className="text-[var(--teal)]" />
              Agent activity timeline
            </div>
            <Badge tone={agentTimeline.length ? "teal" : "amber"}>{agentTimeline.length}</Badge>
          </div>
          {agentTimeline.length ? (
            <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
              {agentTimeline.map((run) => (
                <div key={run.id} className="min-w-0 rounded-[7px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 break-words text-sm font-semibold text-white">{run.displayTitle ?? friendlyAgentName(run)}</div>
                    <Badge tone={statusTone(run.status)}>{statusLabel(run.status)}</Badge>
                  </div>
                  <div className="mt-1 break-words text-xs text-[var(--muted)]">{friendlyProvider(run.provider)} · {timeLabel(run.createdAt)}</div>
                  <p className="mt-2 break-words text-xs leading-5 text-[var(--muted-2)]">{run.displaySummary ?? run.outputSummary}</p>
                  <p className="mt-1 break-words text-xs leading-5 text-white/85">{run.technicalSummary ?? run.inputSummary}</p>
                  {run.metrics ? (
                    <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto overflow-x-hidden pr-1">
	                      <Badge tone="neutral">{run.metrics.searchesRun} searches</Badge>
	                      <Badge tone="neutral">{run.metrics.pagesFetched} pages</Badge>
	                      <Badge tone="neutral">{run.metrics.dedupedCount} unique candidates</Badge>
	                      <Badge tone={run.metrics.rawResultsDiscarded ? "amber" : "neutral"}>{run.metrics.rawResultsDiscarded ?? 0} noise</Badge>
	                      <Badge tone={run.metrics.usableProspects ? "teal" : "neutral"}>{run.metrics.usableProspects ?? 0} usable</Badge>
	                      <Badge tone={run.metrics.alternateSourceRecovered ? "teal" : "neutral"}>{run.metrics.alternateSourceRecovered ?? 0} recovered</Badge>
	                      <Badge tone={run.metrics.sourceDeferred ? "amber" : "neutral"}>{run.metrics.sourceDeferred ?? 0} deferred</Badge>
                      <Badge tone={run.metrics.savedCount ? "teal" : "amber"}>{run.metrics.savedCount} saved</Badge>
	                      {run.metrics.targetLeadGoal ? <Badge tone="lime">{run.metrics.campaignGoodCount ?? 0} / {run.metrics.targetLeadGoal} target</Badge> : null}
                      {run.metrics.sourceExhaustedReason ? <Badge tone="amber">{run.metrics.sourceExhaustedReason.replace(/-/g, " ")}</Badge> : null}
                      {run.cost ? <Badge tone="amber">{formatPreciseInr(run.cost.costInr)}</Badge> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">
              Agent activity will appear after Leadsy searches, extracts public pages, imports records, or drafts outreach.
            </p>
          )}
        </div>
          </div>
        </details>

        <div className="grid gap-4">
          <div className="min-w-0 rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Bot size={16} className="text-[var(--teal)]" />
                  Leads
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-2)]">
                  Good leads and Needs Proof stay separated.
                </p>
              </div>
              <Badge tone={usableLeads.length ? "lime" : "amber"}>{usableLeads.length} good</Badge>
            </div>

            <div className="mb-4 flex max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-1">
              {resultTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveResultTab(tab.id)}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-[6px] border px-3 text-xs font-medium ${buttonMotion} ${
                    activeResultTab === tab.id
                      ? "border-teal-300/45 bg-teal-300/[0.14] text-teal-100"
                      : "border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
                  }`}
                >
                  {tab.label}
                  <Badge tone={tab.count ? "teal" : "neutral"}>{tab.count}</Badge>
                </button>
              ))}
            </div>

            {activeResultTab === "good" ? (
              usableLeads.length ? (
                <div className="max-h-[620px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                  {usableLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className={`min-w-0 w-full rounded-[8px] border p-3 text-left ${
                        activeLead?.id === lead.id
                          ? "border-teal-300/35 bg-teal-300/10"
                          : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--line-strong)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{lead.businessName}</div>
                          <div className="mt-1 flex min-w-0 items-start gap-1 text-xs text-[var(--muted)]">
                            <MapPin size={12} className="mt-0.5 shrink-0" />
                            <span className="min-w-0 break-words">{lead.city} · {lead.category}</span>
                          </div>
                        </div>
                        <Badge tone={scoreTone(lead.score.overall)}>{lead.score.overall}</Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-[var(--muted-2)]">{lead.outreachAngle}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => openLeadView(lead)}
                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-2 text-xs font-medium text-white hover:border-[var(--line-strong)] ${buttonMotion}`}
                        >
                          <Bot size={13} />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => startLeadEdit(lead)}
                          disabled={busy}
                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-2 text-xs font-medium text-teal-100 hover:bg-teal-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                        >
                          <Pencil size={13} />
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLead(lead.id)}
                          disabled={busy}
                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-2 text-xs font-medium text-rose-100 hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Radar}
                  title="No good leads saved yet"
                  detail="Preview a plan and run protected search, or paste a small real list. Leadsy will not invent fake prospects."
                />
              )
	            ) : activeResultTab === "proof" ? (
	              needsProofLeads.length ? (
	                <div className="max-h-[620px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
	                  {needsProofLeads.map((lead) => (
	                    <div key={lead.id} className="min-w-0 rounded-[8px] border border-amber-300/25 bg-amber-300/[0.07] p-3">
	                      <div className="flex flex-wrap items-start justify-between gap-3">
	                        <div className="min-w-0 flex-1">
	                          <div className="break-words text-sm font-semibold text-white">{lead.businessName}</div>
	                          <p className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">{lead.qualityDecision.summary}</p>
	                        </div>
	                        <Badge tone="amber">needs proof</Badge>
	                      </div>
	                      <div className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
	                        <span>Location: {lead.location.evidence ?? lead.city}</span>
	                        {lead.website ? <span className="break-all">Source: {lead.website}</span> : lead.evidence[0]?.url ? <span className="break-all">Source: {lead.evidence[0].url}</span> : null}
	                      </div>
	                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
	                        <button
	                          type="button"
	                          onClick={() => openLeadView(lead)}
	                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-2 text-xs font-medium text-white hover:border-[var(--line-strong)] ${buttonMotion}`}
	                        >
	                          <Bot size={13} />
	                          View
	                        </button>
	                        <button
	                          type="button"
	                          onClick={() => startLeadEdit(lead)}
	                          disabled={busy}
	                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-2 text-xs font-medium text-teal-100 hover:bg-teal-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
	                        >
	                          <Pencil size={13} />
	                          Update
	                        </button>
	                        <button
	                          type="button"
	                          onClick={() => deleteLead(lead.id)}
	                          disabled={busy}
	                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-2 text-xs font-medium text-rose-100 hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
	                        >
	                          <Trash2 size={13} />
	                          Delete
	                        </button>
	                      </div>
	                    </div>
	                  ))}
	                </div>
	              ) : needsProofEvents.length ? (
	                <div className="max-h-[620px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                  {needsProofEvents.map((event) => (
                    <div key={event.id} className="min-w-0 rounded-[8px] border border-amber-300/25 bg-amber-300/[0.07] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm font-semibold text-white">{event.businessName ?? event.title}</div>
                          <p className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">{event.summary}</p>
                        </div>
                        <Badge tone="amber">needs proof</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
                        {event.location ? <span>Location: {event.location}</span> : <span>Location: not found</span>}
                        {event.url ? <span className="break-all">Source: {event.url}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="No weak leads waiting"
                  detail="Candidates that look possible but need more public proof will appear here instead of mixing with good leads."
                />
              )
            ) : activeResultTab === "rejected" ? (
              rejectedEvents.length ? (
                <div className="max-h-[620px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                  {rejectedEvents.map((event) => (
                    <div key={event.id} className="min-w-0 rounded-[8px] border border-rose-300/25 bg-rose-300/[0.07] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm font-semibold text-white">{event.businessName ?? event.title}</div>
                          <p className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">{event.summary}</p>
                        </div>
                        <Badge tone="rose">rejected</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
                        {event.rejectionReason ? <span>Reason: {event.rejectionReason}</span> : null}
                        {event.url ? <span className="break-all">Source: {event.url}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="No rejected pages in the latest view"
                  detail="Bad pages like vendor sites, portals, books, products, and weak directories are blocked before they become leads."
                />
              )
            ) : activeResultTab === "retained" ? (
              retainedOtherLeads.length ? (
                <div className="max-h-[620px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                  {retainedOtherLeads.map((lead) => (
                    <div key={lead.id} className="min-w-0 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm font-semibold text-white">{lead.businessName}</div>
                          <p className="mt-1 break-words text-xs leading-5 text-[var(--muted-2)]">{lead.city} · {lead.category}</p>
                        </div>
                        <Badge tone={lead.qualityDecision?.status === "good" ? "lime" : "amber"}>
                          {lead.qualityDecision?.status === "good" ? "good" : "needs proof"}
                        </Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
                        <span>Location: {lead.location.evidence ?? lead.city}</span>
                        {lead.website ? <span className="break-all">Source: {lead.website}</span> : lead.evidence[0]?.url ? <span className="break-all">Source: {lead.evidence[0].url}</span> : null}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => openLeadView(lead)}
                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-2 text-xs font-medium text-white hover:border-[var(--line-strong)] ${buttonMotion}`}
                        >
                          <Bot size={13} />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => startLeadEdit(lead)}
                          disabled={busy}
                          className={`inline-flex h-8 items-center justify-center gap-2 rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-2 text-xs font-medium text-teal-100 hover:bg-teal-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                        >
                          <Pencil size={13} />
                          Update
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={History}
                  title="No retained QA records"
                  detail="Other scenario and older-brief records will stay here when they do not match the active campaign."
                />
              )
            ) : recentHistory.length ? (
              <div className="max-h-[620px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                {recentHistory.map((item) => (
                  <div key={item.id} className="min-w-0 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span className="mono uppercase text-[var(--teal)]">{item.type}</span>
                      <span className="text-[var(--muted)]">{timeLabel(item.at)}</span>
                    </div>
                    <div className="mt-1 break-words text-sm font-semibold text-white">{item.title}</div>
                    <div className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[var(--muted-2)]">{item.detail}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={History}
                title="No history yet"
                detail="Saved briefs, imports, and protected searches will appear here newest first."
              />
            )}
          </div>

          <div className={leadModalMode ? "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/75 p-3 pt-16 backdrop-blur-sm md:p-8" : "hidden"}>
            {!activeLead ? (
              <div className="w-full max-w-3xl rounded-[8px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl">
                <EmptyState
                  icon={ShieldCheck}
                  title="Lead dossier + evidence trail will appear here"
                  detail="Once a real lead is found or imported, you will see public source URLs, captured time, quality score, and the safest next action."
                />
              </div>
            ) : (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`${leadModalMode === "edit" ? "Update" : "View"} ${activeLead.businessName}`}
                className="max-h-[calc(100vh-5rem)] w-full max-w-6xl overflow-y-auto overflow-x-hidden rounded-[8px] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl md:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-xl font-semibold text-white">{activeLead.businessName}</div>
                    <div className="mt-1 break-words text-sm text-[var(--muted-2)]">
                      {activeLead.category} · {activeLead.city}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                    <Badge tone={activeLead.score.status === "high-confidence" ? "lime" : "amber"}>
                      {activeLead.score.status.replace("-", " ")}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => startLeadEdit(activeLead)}
                      disabled={busy}
                      className={`inline-flex h-8 items-center gap-2 rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-3 text-xs font-medium text-teal-100 hover:bg-teal-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                    >
                      <Pencil size={13} />
                      Update lead
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLead(activeLead.id)}
                      disabled={busy}
                      className={`inline-flex h-8 items-center gap-2 rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-3 text-xs font-medium text-rose-100 hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                    >
                      <Trash2 size={13} />
                      Delete lead
                    </button>
                    <button
                      type="button"
                      onClick={closeLeadModal}
                      disabled={busy}
                      className={`inline-flex h-8 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 text-xs font-medium text-white hover:border-[var(--line-strong)] disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                    >
                      <X size={13} />
                      Close
                    </button>
                  </div>
                </div>

                {editingLeadId === activeLead.id && leadEditForm ? (
                  <div className="mt-5 max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-[8px] border border-teal-300/25 bg-teal-300/[0.06] p-4 pr-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">Update lead details</div>
                        <p className="mt-1 text-xs leading-5 text-[var(--muted-2)]">
                          Edit only what you know. Empty optional fields stay marked as not found.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={cancelLeadEdit}
                          disabled={busy}
                          className={`inline-flex h-8 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 text-xs font-medium text-white hover:border-[var(--line-strong)] disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                        >
                          <X size={13} />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveLeadEdit}
                          disabled={busy}
                          className={`inline-flex h-8 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.14] px-3 text-xs font-medium text-teal-100 hover:bg-teal-300/[0.2] disabled:cursor-not-allowed disabled:opacity-55 ${buttonMotion}`}
                        >
                          {loading === "update" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          Save update
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Business name</span>
                        <input
                          value={leadEditForm.businessName}
                          onChange={(event) => updateLeadEditForm({ businessName: event.target.value })}
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Category</span>
                        <input
                          value={leadEditForm.category}
                          onChange={(event) => updateLeadEditForm({ category: event.target.value })}
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">City</span>
                        <input
                          value={leadEditForm.city}
                          onChange={(event) => updateLeadEditForm({ city: event.target.value })}
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Area</span>
                        <input
                          value={leadEditForm.area}
                          onChange={(event) => updateLeadEditForm({ area: event.target.value })}
                          placeholder="Optional"
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Phone</span>
                        <input
                          value={leadEditForm.phone}
                          onChange={(event) => updateLeadEditForm({ phone: event.target.value })}
                          placeholder="not found"
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">WhatsApp</span>
                        <input
                          value={leadEditForm.whatsapp}
                          onChange={(event) => updateLeadEditForm({ whatsapp: event.target.value })}
                          placeholder="not found"
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Email</span>
                        <input
                          value={leadEditForm.email}
                          onChange={(event) => updateLeadEditForm({ email: event.target.value })}
                          placeholder="not found"
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Website</span>
                        <input
                          value={leadEditForm.website}
                          onChange={(event) => updateLeadEditForm({ website: event.target.value })}
                          placeholder="not found"
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Instagram</span>
                        <input
                          value={leadEditForm.instagram}
                          onChange={(event) => updateLeadEditForm({ instagram: event.target.value })}
                          placeholder="not found"
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Facebook</span>
                        <input
                          value={leadEditForm.facebook}
                          onChange={(event) => updateLeadEditForm({ facebook: event.target.value })}
                          placeholder="not found"
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">LinkedIn</span>
                        <input
                          value={leadEditForm.linkedin}
                          onChange={(event) => updateLeadEditForm({ linkedin: event.target.value })}
                          placeholder="not found"
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Address</span>
                        <input
                          value={leadEditForm.address}
                          onChange={(event) => updateLeadEditForm({ address: event.target.value })}
                          placeholder="not found"
                          className={`h-10 min-w-0 border-[var(--line)] px-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Content quality signal</span>
                        <textarea
                          value={leadEditForm.contentQualitySignal}
                          onChange={(event) => updateLeadEditForm({ contentQualitySignal: event.target.value })}
                          rows={2}
                          className={`resize-none border-[var(--line)] p-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Why this lead matters</span>
                        <textarea
                          value={leadEditForm.whyTheyMayNeedAgency}
                          onChange={(event) => updateLeadEditForm({ whyTheyMayNeedAgency: event.target.value })}
                          rows={3}
                          className={`resize-none border-[var(--line)] p-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Outreach angle</span>
                        <textarea
                          value={leadEditForm.outreachAngle}
                          onChange={(event) => updateLeadEditForm({ outreachAngle: event.target.value })}
                          rows={3}
                          className={`resize-none border-[var(--line)] p-3 ${fieldBase}`}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="mono text-[10px] uppercase text-[var(--muted)]">Next action</span>
                        <textarea
                          value={leadEditForm.nextAction}
                          onChange={(event) => updateLeadEditForm({ nextAction: event.target.value })}
                          rows={2}
                          className={`resize-none border-[var(--line)] p-3 ${fieldBase}`}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Fit", activeLead.score.fit],
                    ["Urgency", activeLead.score.urgency],
                    ["Contact", activeLead.score.contactability],
                    ["Evidence", activeLead.score.evidence]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                      <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>
                      <ProgressBar value={Number(value)} tone={scoreTone(Number(value)) === "rose" ? "rose" : scoreTone(Number(value))} />
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                      <div className="mono text-[10px] uppercase text-[var(--muted)]">Quality decision</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={qualityTone(activeLead.qualityDecision?.status)}>{activeLead.qualityDecision?.status ?? "needs proof"}</Badge>
                        {activeLead.qualityDecision?.reason ? <Badge tone="amber">{activeLead.qualityDecision.reason}</Badge> : null}
                      </div>
                      <p className="mt-2 break-words text-xs leading-5 text-[var(--muted-2)]">{activeLead.qualityDecision?.summary ?? activeLead.analysisSummary}</p>
                    </div>
                    <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                      <div className="mono text-[10px] uppercase text-[var(--muted)]">Location proof</div>
                      <div className="mt-2 text-sm font-semibold text-white">{activeLead.location?.evidence ?? "location not found"}</div>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted-2)]">
                        {[activeLead.location?.area, activeLead.location?.city, activeLead.location?.state, activeLead.location?.country].filter(Boolean).join(", ") || "No public location detail found."}
                      </p>
                    </div>
                    <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                      <div className="mono text-[10px] uppercase text-[var(--muted)]">Sentiment</div>
                      <div className="mt-2 text-sm font-semibold capitalize text-white">{activeLead.sentiment?.label ?? "neutral"}</div>
                      <p className="mt-2 break-words text-xs leading-5 text-[var(--muted-2)]">{activeLead.sentiment?.reason ?? "Sentiment not analysed yet."}</p>
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                      <WandSparkles size={16} className="text-[var(--teal)]" />
                      Why this lead matters
                    </div>
                    <p className="break-words text-sm leading-6 text-[var(--muted-2)]">{activeLead.analysisSummary || activeLead.whyTheyMayNeedAgency}</p>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--muted-2)] md:grid-cols-2">
                      <div className="min-w-0 break-words">Phone: <span className="text-white">{activeLead.phone ?? "not found"}</span></div>
                      <div className="min-w-0 break-words">Email: <span className="text-white">{activeLead.email ?? "not found"}</span></div>
                      <div className="min-w-0 break-words">Website: <span className="text-white">{activeLead.website ? "found" : "not found"}</span></div>
                      <div className="min-w-0 break-words">Reviews: <span className="text-white">{activeLead.reviewCount ?? "not found"}</span></div>
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">Evidence trail</div>
                      <Badge tone="teal">{activeLead.evidence.length} source{activeLead.evidence.length === 1 ? "" : "s"}</Badge>
                    </div>
                    <div className="grid max-h-[420px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
                      {activeLead.evidence.length ? (
                        activeLead.evidence.map((item, index) => (
                          <div
                            key={`${item.label}-${item.url ?? item.note}-${index}`}
                            className="min-w-0 rounded-[6px] border border-[var(--line)] bg-black/20 p-3 text-sm text-[var(--muted-2)]"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="min-w-0 break-words font-medium text-white">{item.label}</span>
                              <Badge tone="neutral">{sourceLabels[item.sourceType]}</Badge>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-[var(--muted-2)]">{evidenceProof(item)}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                              <span>Captured {timeLabel(item.capturedAt)}</span>
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-teal-100 hover:text-white"
                                >
                                  Open public source
                                  <ExternalLink size={12} />
                                </a>
                              ) : (
                                <span className="line-clamp-1">Note: {item.note ?? "No public URL attached"}</span>
                              )}
                            </div>
                            {item.url ? (
                              <div className="mono mt-2 break-all text-[10px] uppercase text-[var(--muted)]">{item.url}</div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[6px] border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
                          Evidence trail is empty for this record. Keep it for review; Leadsy should not treat it as high confidence until a public source or manual note is attached.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <MessageCircle size={16} className="text-[var(--teal)]" />
                        Draft for approval
                      </div>
	                      <button
	                        type="button"
	                        onClick={() => draftMessage(activeLead.id)}
	                        disabled={!campaignGoodCount || activeLead.qualityDecision?.status !== "good"}
	                        className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-45"
	                      >
                        {loading === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />}
                        Draft
                      </button>
                    </div>
	                    {activeDraft ? (
                      <div className="mt-4 rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                        <p className="text-sm leading-6 text-white">{activeDraft.message}</p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs text-[var(--muted-2)]">{activeDraft.rationale}</span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(activeDraft.message)}
                            className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-[var(--line)] px-3 text-xs text-white hover:border-[var(--line-strong)]"
                          >
                            <Clipboard size={13} />
                            Copy
                          </button>
                        </div>
                      </div>
	                    ) : (
	                      <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">
	                        {campaignGoodCount
	                          ? "AI will draft a short WhatsApp, DM, or email message. It will not send anything automatically."
	                          : "Drafting unlocks after Leadsy saves at least one Good lead. Discovery quality comes first."}
	                      </p>
	                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
