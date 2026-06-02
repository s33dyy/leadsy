import "server-only";

import {
	LEAD_MAGNET_BATCH_MAX,
	leadBriefFingerprint,
	type LeadBrief,
	type LeadBriefSnapshot,
	type LeadDossier,
	type LeadRunLabel,
	type LeadSourceRun,
	type ResearchPlanPreview
} from "@leadsy/domain";
import { campaignMinQualifiedTarget, runLeadResearch, type LeadResearchProgressHandler } from "@leadsy/ai";
import { getLeadMagnetWorkspace, saveLeadMagnetResults } from "./lead-magnet-store";

type LeadMagnetWorkspace = Awaited<ReturnType<typeof getLeadMagnetWorkspace>>;

type CampaignStopReason =
  | "campaign-target-reached"
  | "budget-cap"
  | "max-batches-reached"
  | "no-new-good-leads"
  | "source-exhausted";

type RunCampaignInput = {
  tenantId: string;
  ownerId: string;
  workspace: LeadMagnetWorkspace;
  budgetCapInr?: number;
  fullRun?: boolean;
  scenarioLabel?: string;
  runLabel?: LeadRunLabel;
  planPreview?: ResearchPlanPreview;
  shouldStop?: () => Promise<boolean> | boolean;
  onEvent?: LeadResearchProgressHandler;
};

function parsePositiveNumber(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function configuredCampaignSpendCapInr(inputCap?: number) {
  return inputCap ?? parsePositiveNumber(process.env.LEADSY_CAMPAIGN_SPEND_CAP_INR) ?? 100;
}

function configuredCampaignMaxBatches(leadGoal: number) {
  const configured = parsePositiveNumber(process.env.LEADSY_CAMPAIGN_MAX_BATCHES);
  if (configured) return Math.max(1, Math.round(configured));
  const minQualifiedTarget = campaignMinQualifiedTarget(leadGoal);
  return Math.min(24, Math.max(8, Math.ceil(minQualifiedTarget / LEAD_MAGNET_BATCH_MAX) * 2));
}

function configuredDryBatchLimit() {
  return Math.max(1, Math.round(parsePositiveNumber(process.env.LEADSY_CAMPAIGN_DRY_BATCH_LIMIT) ?? 3));
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

function campaignGoodCount(leads: LeadDossier[], brief: LeadBrief) {
  return leads.filter((lead) => lead.qualityDecision?.status === "good" && leadBelongsToBrief(lead, brief)).length;
}

function annotateRun(input: {
  run: LeadSourceRun;
  campaignId: string;
  brief: LeadBrief;
  runLabel: LeadRunLabel;
  scenarioLabel?: string;
  batchCount: number;
  goodBefore: number;
  minQualifiedTarget: number;
  stopReason?: CampaignStopReason;
}) {
  const campaignGoodEstimate = Math.max(input.goodBefore, input.goodBefore + input.run.found);
  const baseMetrics = input.run.metrics ?? {
    searchesRun: 0,
    pagesFetched: 0,
    candidateCount: 0,
    dedupedCount: 0,
    savedCount: input.run.found
  };
  const targetLeadGoal = baseMetrics.targetLeadGoal ?? input.brief.leadGoal;
  const metrics = {
    ...baseMetrics,
    campaignId: input.campaignId,
    campaignBatchCount: input.batchCount,
    minQualifiedTarget: input.minQualifiedTarget,
    targetLeadGoal,
    campaignGoodCount: campaignGoodEstimate,
    sourceExhaustedReason: input.stopReason
  };
  return {
    ...input.run,
    campaignId: input.campaignId,
    scenarioLabel: input.scenarioLabel,
    runLabel: input.runLabel,
    inputSnapshot: briefSnapshot(input.brief),
    metrics,
    spendGuard: input.stopReason && input.run.spendGuard
      ? { ...input.run.spendGuard, stoppedReason: input.stopReason }
      : input.run.spendGuard,
    ownerSummary: input.stopReason === "campaign-target-reached"
      ? `Campaign reached the requested target: ${campaignGoodEstimate} / ${targetLeadGoal} Good leads.`
      : input.stopReason
        ? `${input.run.ownerSummary ?? input.run.recommendation} Campaign stopped: ${input.stopReason.replace(/-/g, " ")}.`
        : input.run.ownerSummary,
    recommendation: input.stopReason === "campaign-target-reached"
      ? `Target reached. Review Good leads first, then continue with a larger target if you want more coverage.`
      : input.run.recommendation
  } satisfies LeadSourceRun;
}

export async function runLeadMagnetDiscoveryCampaign(input: RunCampaignInput) {
  if (!input.workspace.brief) {
    throw new Error("Tell Leadsy what you sell, who to find, and where to search before running discovery.");
  }

  const brief = input.workspace.brief;
  const campaignId = `campaign_${crypto.randomUUID()}`;
  const minQualifiedTarget = campaignMinQualifiedTarget(brief.leadGoal);
  const maxBatches = input.fullRun ? configuredCampaignMaxBatches(brief.leadGoal) : 1;
  const dryBatchLimit = configuredDryBatchLimit();
  const spendCapInr = input.fullRun ? configuredCampaignSpendCapInr(input.budgetCapInr) : input.budgetCapInr;
  const runLabel = input.runLabel ?? (input.scenarioLabel ? "QA Scenario" : "Live Campaign");
  let currentWorkspace = input.workspace;
  let latestRun: LeadSourceRun | undefined;
  const batchRuns: LeadSourceRun[] = [];
  let dryBatches = 0;
  let spentInr = 0;

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    if (await input.shouldStop?.()) {
      break;
    }
    const goodBefore = campaignGoodCount(currentWorkspace.leads, brief);
    if (input.fullRun && goodBefore >= minQualifiedTarget) {
      break;
    }

    const result = await runLeadResearch({
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      brief,
      existingLeads: currentWorkspace.leads,
      previousRuns: currentWorkspace.runs,
      planPreview: batchIndex === 0 ? input.planPreview : undefined,
      budgetCapInr: spendCapInr,
      fullRun: input.fullRun,
      onEvent: input.onEvent
    });

    const projectedSpent = spentInr + (result.run.cost?.costInr ?? 0);
    const projectedGood = goodBefore + result.run.found;
    const projectedDryBatches = result.run.found > 0 ? 0 : dryBatches + 1;
    const isLastAllowedBatch = batchIndex + 1 >= maxBatches;
    const stopReason: CampaignStopReason | undefined = !input.fullRun
      ? undefined
      : projectedGood >= minQualifiedTarget
        ? "campaign-target-reached"
        : spendCapInr && projectedSpent >= spendCapInr
          ? "budget-cap"
          : projectedDryBatches >= dryBatchLimit
            ? "no-new-good-leads"
            : isLastAllowedBatch
              ? "max-batches-reached"
              : result.run.metrics?.stoppedEarly
                ? "source-exhausted"
                : undefined;

    const run = annotateRun({
      run: result.run,
      campaignId,
      brief,
      runLabel,
      scenarioLabel: input.scenarioLabel,
      batchCount: batchIndex + 1,
      goodBefore,
      minQualifiedTarget,
      stopReason
    });

    currentWorkspace = await saveLeadMagnetResults({
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      leads: result.leads,
      run,
      agentRuns: result.agentRuns,
      brief
    });
    latestRun = run;
    batchRuns.push(run);
    spentInr = projectedSpent;
    dryBatches = projectedDryBatches;

    if (!input.fullRun || stopReason) {
      break;
    }
  }

  return {
    workspace: currentWorkspace,
    latestRun,
    batchRuns,
    campaignId,
    minQualifiedTarget
  };
}
